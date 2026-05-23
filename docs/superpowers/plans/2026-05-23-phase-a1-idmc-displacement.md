# Phase A1 — IDMC Displacement Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add IDMC Internal Displacement Updates as a new geolocated event layer to the exhibit, with its own type, fetch/normalize pipeline, map layer (concentric rings sized by displaced figure), side-panel mode, layer toggle, and header counter.

**Architecture:** Mirror the existing per-source pipeline (`fetch-*.ts` + `normalize-*.ts` + tests + wired into `build-data.ts` → JSON committed to `public/data/`). On the client, add a parallel displacement layer that does **not** flow through the existing `incidents`/`damage` paths — it's a new conceptual category with its own type (`DisplacementEvent`), file (`displacement.json`), layer, and panel mode. Time-correlated via the existing `TimeController`.

**Tech Stack:** TypeScript 5 (strict, `verbatimModuleSyntax`), Vite 6, MapLibre GL JS, Vitest, pnpm. Extension-less local TS imports per `tsconfig.json`. 2 spaces, single quotes, Conventional Commits.

**Source dataset:**
- HDX page: https://data.humdata.org/dataset/pse-idmc-idu-events
- Direct CSV: `https://data.humdata.org/dataset/a641dda7-9b19-4103-b811-76a3963d29d2/resource/e6e48083-1276-4dce-a827-a12b21f3dbac/download/pse_idmc_idu_events.csv`
- License: **CC BY-IGO** (Creative Commons Attribution for Intergovernmental Organisations) — explicitly permits reuse with attribution; no permission email needed.
- Size: ~250 KB, 323 rows, 36 columns, all geocoded.
- Date coverage: **2025-01-01 → 2026-03-14** (the dataset only covers 2025+). The displacement counter will read 0 for any scrub position before 2025-01-01. This is correct and worth noting in the UI copy.

**Spec reference:** `docs/superpowers/specs/2026-05-23-multi-source-expansion-design.md`, Phase A1.

---

## File Structure

**Created:**
- `scripts/fetch-idmc.ts` — downloads IDMC IDU CSV, caches to `data/raw/idmc/`, writes parsed JSON
- `scripts/normalize-idmc.ts` — `IdmcRow` → `DisplacementEvent` (TDD)
- `tests/normalize-idmc.test.ts` — Vitest tests for normalize
- `src/map/displacement-layer.ts` — MapLibre layer rendering displacement events as concentric rings
- `docs/superpowers/plans/2026-05-23-phase-a1-idmc-displacement.md` — this file

**Modified:**
- `shared/types.ts` — add `'idmc'` to `SourceOrg`, add `DisplacementEvent` interface, extend `BuildMeta` with `displacement_count`
- `scripts/build-data.ts` — load IDMC rows, normalize, filter, write `public/data/displacement.json`, update meta
- `src/data/loader.ts` — add `loadDisplacement()`
- `src/ui/side-panel.ts` — add `openDisplacement(event)` mode + rendering
- `src/ui/layer-toggle.ts` — add Displacement checkbox (default off)
- `src/ui/header.ts` — add `Displaced` counter built from the displacement events
- `src/main.ts` — load displacement data, mount layer, wire toggle + counter + panel click
- `docs/superpowers/HANDOFF.md` — reflect new source

**Untouched but worth knowing exists:**
- `src/data/loader.ts` already declares a local `DamageFeature` interface; **don't confuse it with anything new in this plan.** This plan does not introduce a shared `DamageFeature` type — that's deferred to Phase A2/A3/A4.

---

## Task 1: Type definitions

**Files:**
- Modify: `shared/types.ts`

- [ ] **Step 1.1: Extend `SourceOrg`**

Open `shared/types.ts` and change the `SourceOrg` union to include `'idmc'`:

```ts
export type SourceOrg = 'airwars' | 'acled' | 'ocha' | 'ucdp' | 'idmc';
```

- [ ] **Step 1.2: Add `DisplacementEvent` interface**

Append to `shared/types.ts` (after the existing `Incident` interface, before `BuildMeta`):

```ts
export type DisplacementType = 'conflict' | 'disaster';

export interface DisplacementEvent {
  id: string;                         // e.g. 'idmc:246143'
  date: string;                       // ISO YYYY-MM-DD — displacement_start_date
  location: {
    lat: number;
    lon: number;
    name?: string;                    // e.g. 'Gaza Strip, Palestinian Territories'
  };
  figure: number;                     // people displaced
  displacement_type: DisplacementType;
  qualifier: string;                  // 'total', 'more than or equal to', etc — raw IDMC qualifier text
  description: string;                // single paragraph from IDMC `description` field
  sources: SourceAttribution[];
}
```

- [ ] **Step 1.3: Extend `BuildMeta`**

Change the `BuildMeta` interface in `shared/types.ts` to add `displacement_count`:

```ts
export interface BuildMeta {
  build_date: string;
  source_counts: Partial<Record<SourceOrg, number>>;
  dedup_merges: number;
  unplotted_count: number;
  damage_count?: number;
  displacement_count?: number;
}
```

- [ ] **Step 1.4: Typecheck**

Run: `pnpm typecheck`
Expected: PASS (no errors). Any reference to `SourceOrg` should still compile; `DisplacementEvent` is currently unused and that's OK.

- [ ] **Step 1.5: Commit**

```bash
git add shared/types.ts
git commit -m "feat(types): add DisplacementEvent + idmc source org"
```

---

## Task 2: IDMC fetch script

**Files:**
- Create: `scripts/fetch-idmc.ts`

The IDMC HDX endpoint returns a 302 redirect to S3 — `fetch()` in Node 20+ follows redirects by default. Single resource, no pagination, ~250 KB. Cache as both the raw CSV and a parsed JSON for easy `JSON.parse` consumption downstream.

- [ ] **Step 2.1: Create the fetch script**

Create `scripts/fetch-idmc.ts` with this exact content:

```ts
import { mkdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const CSV_URL =
  'https://data.humdata.org/dataset/a641dda7-9b19-4103-b811-76a3963d29d2' +
  '/resource/e6e48083-1276-4dce-a827-a12b21f3dbac/download/pse_idmc_idu_events.csv';
const OUT_DIR = 'data/raw/idmc';

async function fileExists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}

function csvToRows(text: string): Array<Record<string, string>> {
  // IDMC's description field contains embedded newlines, so we parse with a
  // state machine that respects quoted fields across newlines rather than
  // splitting by line first.
  const rows: string[][] = [];
  let inQuote = false;
  let line: string[] = [];
  let field = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuote) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuote = false;
      else field += c;
    } else {
      if (c === '"') inQuote = true;
      else if (c === ',') { line.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        line.push(field); field = '';
        if (line.length > 1 || line[0] !== '') rows.push(line);
        line = [];
      } else field += c;
    }
  }
  if (field.length > 0 || line.length > 0) { line.push(field); rows.push(line); }
  if (rows.length === 0) return [];
  const header = rows[0];
  return rows.slice(1).map((r) => Object.fromEntries(header.map((k, j) => [k, r[j] ?? ''])));
}

export async function fetchIdmc(opts: { refresh?: boolean } = {}): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const csvPath = join(OUT_DIR, 'idu-events.csv');
  const jsonPath = join(OUT_DIR, 'idu-events.json');

  if (!opts.refresh && (await fileExists(jsonPath))) {
    console.log(`IDMC snapshot already exists at ${jsonPath} — pass --refresh to re-download.`);
    return;
  }

  console.log(`Downloading IDMC IDU CSV from ${CSV_URL}...`);
  const res = await fetch(CSV_URL, { redirect: 'follow' });
  if (!res.ok) throw new Error(`IDMC fetch failed: ${res.status}`);
  const text = await res.text();
  await writeFile(csvPath, text, 'utf8');

  const rows = csvToRows(text);
  await writeFile(jsonPath, JSON.stringify(rows));
  console.log(`Wrote ${rows.length} IDMC rows to ${jsonPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const refresh = process.argv.includes('--refresh');
  fetchIdmc({ refresh }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 2.2: Run the fetch standalone**

Run: `pnpm tsx scripts/fetch-idmc.ts --refresh`
Expected: console prints `Downloading IDMC IDU CSV from …` then `Wrote 323 IDMC rows to data/raw/idmc/idu-events.json` (count may differ slightly as IDMC updates monthly).

- [ ] **Step 2.3: Sanity-check the cache**

Run: `python3 -c "import json; rows=json.load(open('data/raw/idmc/idu-events.json')); print(len(rows), rows[0].keys())"`
Expected output: a row count (likely 323+) and a dict of 36 keys including `id`, `latitude`, `longitude`, `figure`, `displacement_type`, `displacement_start_date`, `description`, `sources`, `role`.

- [ ] **Step 2.4: Commit**

```bash
git add scripts/fetch-idmc.ts data/raw/idmc/
git commit -m "feat(data): fetch IDMC Internal Displacement Updates"
```

---

## Task 3: Normalize tests (write failing tests first)

**Files:**
- Create: `tests/normalize-idmc.test.ts`

We're following the existing TDD pattern (see `tests/normalize-ucdp.test.ts` for reference). Write the full test file first, watch every test fail with "function not defined", then implement.

- [ ] **Step 3.1: Write the test file**

Create `tests/normalize-idmc.test.ts` with this exact content:

```ts
import { describe, it, expect } from 'vitest';
import { normalizeIdmcRow } from '../scripts/normalize-idmc';

const GAZA_CONFLICT_SAMPLE: Record<string, string> = {
  id: '246143',
  country: 'Palestine',
  iso3: 'PSE',
  latitude: '31.43317',
  longitude: '34.37793',
  role: 'Recommended figure',
  displacement_type: 'Conflict',
  qualifier: 'total',
  figure: '12500',
  displacement_start_date: '2025-04-12',
  displacement_end_date: '2025-04-12',
  event_id: '41769',
  event_name: 'Palestine: International armed conflict - Gaza - 12/04/2025',
  sources: 'Office for the Coordination of Humanitarian Affairs (OCHA)',
  locations_name: 'Gaza Strip, Palestinian Territories',
  description: 'Palestine: 12500 displacements, 12 April. Conflict in Gaza Strip displaced 12500 people, according to OCHA.',
};

const WEST_BANK_SAMPLE: Record<string, string> = {
  ...GAZA_CONFLICT_SAMPLE,
  id: '243265',
  latitude: '32.19080',
  longitude: '35.32328',
  locations_name: 'Nablus Governorate, Judea and Samaria, Palestinian Territories',
};

const TRIANGULATION_SAMPLE: Record<string, string> = {
  ...GAZA_CONFLICT_SAMPLE,
  id: '246144',
  role: 'Triangulation',
};

const GAZA_DISASTER_SAMPLE: Record<string, string> = {
  ...GAZA_CONFLICT_SAMPLE,
  id: '246145',
  displacement_type: 'Disaster',
  figure: '147',
  description: 'Sand/dust storm displaced 147 people in Gaza Strip.',
};

describe('normalizeIdmcRow', () => {
  it('produces a complete DisplacementEvent from a well-formed Gaza conflict row', () => {
    const r = normalizeIdmcRow(GAZA_CONFLICT_SAMPLE)!;
    expect(r.id).toBe('idmc:246143');
    expect(r.date).toBe('2025-04-12');
    expect(r.location.lat).toBeCloseTo(31.43317);
    expect(r.location.lon).toBeCloseTo(34.37793);
    expect(r.location.name).toBe('Gaza Strip, Palestinian Territories');
    expect(r.figure).toBe(12500);
    expect(r.displacement_type).toBe('conflict');
    expect(r.qualifier).toBe('total');
    expect(r.description).toContain('12500 displacements');
    expect(r.sources).toHaveLength(1);
    expect(r.sources[0].org).toBe('idmc');
    expect(r.sources[0].id).toBe('246143');
    expect(r.sources[0].url).toContain('data.humdata.org');
  });

  it('lowercases Disaster displacement_type', () => {
    const r = normalizeIdmcRow(GAZA_DISASTER_SAMPLE)!;
    expect(r.displacement_type).toBe('disaster');
    expect(r.figure).toBe(147);
  });

  it('rejects West Bank rows (outside Gaza bbox)', () => {
    expect(normalizeIdmcRow(WEST_BANK_SAMPLE)).toBeNull();
  });

  it('rejects rows with role=Triangulation (duplicates of Recommended figure)', () => {
    expect(normalizeIdmcRow(TRIANGULATION_SAMPLE)).toBeNull();
  });

  it('rejects rows missing latitude/longitude', () => {
    const noCoords = { ...GAZA_CONFLICT_SAMPLE, latitude: '', longitude: '' };
    expect(normalizeIdmcRow(noCoords)).toBeNull();
  });

  it('rejects rows with non-finite latitude/longitude', () => {
    const bad = { ...GAZA_CONFLICT_SAMPLE, latitude: 'NaN', longitude: 'abc' };
    expect(normalizeIdmcRow(bad)).toBeNull();
  });

  it('rejects rows with non-ISO displacement_start_date', () => {
    const bad = { ...GAZA_CONFLICT_SAMPLE, displacement_start_date: '14/03/2026' };
    expect(normalizeIdmcRow(bad)).toBeNull();
  });

  it('rejects rows with figure of zero or non-numeric', () => {
    expect(normalizeIdmcRow({ ...GAZA_CONFLICT_SAMPLE, figure: '0' })).toBeNull();
    expect(normalizeIdmcRow({ ...GAZA_CONFLICT_SAMPLE, figure: 'unknown' })).toBeNull();
  });

  it('rejects rows with unknown displacement_type', () => {
    const weird = { ...GAZA_CONFLICT_SAMPLE, displacement_type: 'Unknown' };
    expect(normalizeIdmcRow(weird)).toBeNull();
  });
});
```

- [ ] **Step 3.2: Run the tests and verify they all fail**

Run: `pnpm vitest run tests/normalize-idmc.test.ts`
Expected: every test fails because `normalize-idmc.ts` doesn't exist yet. The failure mode is "Cannot find module" — that's fine.

---

## Task 4: Normalize implementation

**Files:**
- Create: `scripts/normalize-idmc.ts`

- [ ] **Step 4.1: Write the normalize implementation**

Create `scripts/normalize-idmc.ts` with this exact content:

```ts
import type {
  DisplacementEvent,
  DisplacementType,
  SourceAttribution,
} from '../shared/types';

interface IdmcRow {
  id: string;
  latitude: string;
  longitude: string;
  role: string;
  displacement_type: string;
  qualifier: string;
  figure: string;
  displacement_start_date: string;
  locations_name: string;
  description: string;
}

const DATASET_URL = 'https://data.humdata.org/dataset/pse-idmc-idu-events';

function isInGazaBbox(lat: number, lon: number): boolean {
  return lat >= 31.20 && lat <= 31.60 && lon >= 34.20 && lon <= 34.60;
}

function parseDisplacementType(raw: string): DisplacementType | null {
  const t = raw.trim().toLowerCase();
  if (t === 'conflict') return 'conflict';
  if (t === 'disaster') return 'disaster';
  return null;
}

export function normalizeIdmcRow(row: Record<string, string>): DisplacementEvent | null {
  const r = row as IdmcRow;
  const id = (r.id ?? '').trim();
  if (id.length === 0) return null;

  // IDMC publishes both 'Recommended figure' (canonical) and 'Triangulation'
  // (a sanity-check from a second source) rows for the same event_id. We
  // keep only the canonical one to avoid double-counting.
  if ((r.role ?? '').trim() !== 'Recommended figure') return null;

  const date = (r.displacement_start_date ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const lat = Number(r.latitude);
  const lon = Number(r.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (!isInGazaBbox(lat, lon)) return null;

  const figure = Number(r.figure);
  if (!Number.isFinite(figure) || figure <= 0) return null;

  const displacement_type = parseDisplacementType(r.displacement_type ?? '');
  if (displacement_type === null) return null;

  const source: SourceAttribution = {
    org: 'idmc',
    id,
    url: DATASET_URL,
  };

  return {
    id: `idmc:${id}`,
    date,
    location: {
      lat,
      lon,
      name: (r.locations_name ?? '').trim() || undefined,
    },
    figure: Math.round(figure),
    displacement_type,
    qualifier: (r.qualifier ?? '').trim(),
    description: (r.description ?? '').trim(),
    sources: [source],
  };
}
```

- [ ] **Step 4.2: Run the tests and verify they all pass**

Run: `pnpm vitest run tests/normalize-idmc.test.ts`
Expected: 9 tests pass.

- [ ] **Step 4.3: Run the full test suite to confirm nothing else broke**

Run: `pnpm test`
Expected: all 97+ tests pass (97 existing + 9 new = 106).

- [ ] **Step 4.4: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4.5: Commit**

```bash
git add scripts/normalize-idmc.ts tests/normalize-idmc.test.ts
git commit -m "feat(data): normalize IDMC rows to DisplacementEvent (TDD)"
```

---

## Task 5: Build-data pipeline wiring

**Files:**
- Modify: `scripts/build-data.ts`

- [ ] **Step 5.1: Add IDMC imports + loader**

In `scripts/build-data.ts`, after the existing imports, add:

```ts
import { fetchIdmc } from './fetch-idmc';
import { normalizeIdmcRow } from './normalize-idmc';
```

Also extend the type import line on roughly line 10 — change:

```ts
import type { Incident, BuildMeta, DamageRecord, DamageStatus } from '../shared/types';
```

to:

```ts
import type { Incident, BuildMeta, DamageRecord, DamageStatus, DisplacementEvent } from '../shared/types';
```

Add a constant near the other RAW directory constants:

```ts
const IDMC_RAW = 'data/raw/idmc';
```

Add a loader function near `loadUcdpRows`:

```ts
async function loadIdmcRows(): Promise<Record<string, string>[]> {
  try {
    return JSON.parse(await readFile(join(IDMC_RAW, 'idu-events.json'), 'utf8'));
  } catch { return []; }
}
```

- [ ] **Step 5.2: Wire fetch + normalize into `main()`**

In `scripts/build-data.ts`, find the existing fetch sequence:

```ts
await fetchAirwars();
await fetchUcdp();
await fetchOcha();
```

Change it to:

```ts
await fetchAirwars();
await fetchUcdp();
await fetchOcha();
await fetchIdmc();
```

Then find this section (after UCDP normalization, before dedup):

```ts
console.log(`Normalized ${airwarsIncidents.length} Airwars + ${ucdpIncidents.length} UCDP incidents`);
console.log(`  Unplotted: ${airwarsUnplotted} Airwars, ${ucdpUnplotted} UCDP`);

const { incidents: dedupedIncidents, merges } = dedupeIncidents([...airwarsIncidents, ...ucdpIncidents]);
```

Insert IDMC normalization **before** the dedup line. **Do not** include displacement events in `dedupeIncidents` — displacement is a parallel category, not an incident. The block to insert:

```ts
const idmcRaws = await loadIdmcRows();
console.log(`Loaded ${idmcRaws.length} IDMC raw rows`);
const displacementEvents: DisplacementEvent[] = [];
let idmcUnplotted = 0;
for (const raw of idmcRaws) {
  const ev = normalizeIdmcRow(raw);
  if (ev) displacementEvents.push(ev);
  else idmcUnplotted++;
}
console.log(`Normalized ${displacementEvents.length} IDMC displacement events (${idmcUnplotted} dropped)`);
```

- [ ] **Step 5.3: Apply the conflict-start filter to displacement events**

Find the existing conflict-start filter section:

```ts
const CONFLICT_START = '2023-10-07';
const incidents = dedupedIncidents.filter((i) => i.date >= CONFLICT_START);
```

Immediately after that block, add:

```ts
const displacement = displacementEvents
  .filter((d) => d.date >= CONFLICT_START)
  .sort((a, b) => a.date.localeCompare(b.date));
console.log(`Filtered displacement to ${CONFLICT_START}+: ${displacement.length}`);
```

- [ ] **Step 5.4: Write displacement.json**

After the existing `damageFc` write block (the `await writeFile(join(OUT_DIR, 'damage.geojson'), …)` line), add:

```ts
await writeFile(join(OUT_DIR, 'displacement.json'), JSON.stringify(displacement));
console.log(`Wrote ${displacement.length} displacement events to ${OUT_DIR}/displacement.json`);
```

- [ ] **Step 5.5: Update the meta block**

Find the existing `meta` object:

```ts
const meta: BuildMeta = {
  build_date: new Date().toISOString(),
  source_counts: { airwars: airwarsIncidents.length, ucdp: ucdpIncidents.length },
  dedup_merges: merges,
  unplotted_count: airwarsUnplotted + ucdpUnplotted,
  damage_count: damageInConflict.length,
};
```

Change it to:

```ts
const meta: BuildMeta = {
  build_date: new Date().toISOString(),
  source_counts: {
    airwars: airwarsIncidents.length,
    ucdp: ucdpIncidents.length,
    idmc: displacementEvents.length,
  },
  dedup_merges: merges,
  unplotted_count: airwarsUnplotted + ucdpUnplotted + idmcUnplotted,
  damage_count: damageInConflict.length,
  displacement_count: displacement.length,
};
```

- [ ] **Step 5.6: Run the build**

Run: `pnpm build-data`
Expected: console output includes lines like `Loaded 323 IDMC raw rows`, `Normalized N IDMC displacement events`, `Filtered displacement to 2023-10-07+: N`, `Wrote N displacement events to public/data/displacement.json`. The build completes without errors.

- [ ] **Step 5.7: Verify the JSON output**

Run: `python3 -c "import json; d=json.load(open('public/data/displacement.json')); print('count:', len(d)); print('first:', d[0] if d else 'empty')"`
Expected: a non-zero count, and the first record has all the fields from `DisplacementEvent` (`id`, `date`, `location.lat/lon/name`, `figure`, `displacement_type`, `qualifier`, `description`, `sources`).

- [ ] **Step 5.8: Run typecheck and full tests**

Run: `pnpm typecheck && pnpm test`
Expected: both pass.

- [ ] **Step 5.9: Commit**

```bash
git add scripts/build-data.ts public/data/displacement.json public/data/meta.json
git commit -m "feat(build): wire IDMC displacement into build pipeline"
```

---

## Task 6: Client data loader

**Files:**
- Modify: `src/data/loader.ts`

- [ ] **Step 6.1: Add `DisplacementEvent` import + `loadDisplacement` function**

In `src/data/loader.ts`, change the type import line:

```ts
import type { Incident, BuildMeta } from '@shared/types';
```

to:

```ts
import type { Incident, BuildMeta, DisplacementEvent } from '@shared/types';
```

Append at the bottom of the file:

```ts
export async function loadDisplacement(): Promise<DisplacementEvent[]> {
  const res = await fetch('/data/displacement.json');
  if (!res.ok) throw new Error(`Failed to load displacement.json: ${res.status}`);
  return (await res.json()) as DisplacementEvent[];
}
```

- [ ] **Step 6.2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 6.3: Commit**

```bash
git add src/data/loader.ts
git commit -m "feat(client): add loadDisplacement loader"
```

---

## Task 7: Displacement map layer

**Files:**
- Create: `src/map/displacement-layer.ts`

Visual treatment: small filled circle at the displacement location, radius scaled to `figure` (people displaced) so larger displacement events visually dominate. Use a distinct color from incidents (deep teal `#0f766e`) so the displacement layer reads as separate from the war-red incidents. Time-filter via `<=` on `date`, the same pattern as `damage-layer.ts`.

- [ ] **Step 7.1: Create the displacement layer**

Create `src/map/displacement-layer.ts` with this exact content:

```ts
import type { Map } from 'maplibre-gl';
import type { DisplacementEvent } from '@shared/types';

const SOURCE_ID = 'displacement';
const LAYER_ID = 'displacement-circles';

const COLOR_CONFLICT = '#0f766e';   // teal-700
const COLOR_DISASTER = '#a16207';   // amber-700

export interface DisplacementLayerHandle {
  setVisible(visible: boolean): void;
  setVisibleDate(date: string): void;
}

function toFeatureCollection(events: DisplacementEvent[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: events.map((e) => ({
      type: 'Feature',
      id: e.id,
      geometry: { type: 'Point', coordinates: [e.location.lon, e.location.lat] },
      properties: {
        id: e.id,
        date: e.date,
        figure: e.figure,
        displacement_type: e.displacement_type,
      },
    })),
  };
}

export async function mountDisplacementLayer(
  map: Map,
  events: DisplacementEvent[],
): Promise<DisplacementLayerHandle> {
  let pendingDate: string | null = null;
  let pendingVisible = false;
  let layerReady = false;

  function buildFilter(date: string | null): maplibregl.FilterSpecification {
    return ['<=', ['get', 'date'], date ?? '1900-01-01'] as unknown as maplibregl.FilterSpecification;
  }

  let rafScheduled = false;
  function applyState(): void {
    if (rafScheduled) return;
    rafScheduled = true;
    requestAnimationFrame(() => {
      rafScheduled = false;
      if (!map.getLayer(LAYER_ID)) return;
      map.setLayoutProperty(LAYER_ID, 'visibility', pendingVisible ? 'visible' : 'none');
      map.setFilter(LAYER_ID, buildFilter(pendingDate));
    });
  }

  const data = toFeatureCollection(events);

  const addLayer = (): void => {
    map.addSource(SOURCE_ID, { type: 'geojson', data });
    map.addLayer(
      {
        id: LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        layout: { visibility: pendingVisible ? 'visible' : 'none' },
        filter: buildFilter(pendingDate),
        paint: {
          // Scale radius by sqrt(figure) so area is proportional to people displaced.
          // Clamp so a 1-person event is still visible and a 100k-person event doesn't dwarf the strip.
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            9,  ['max', 3, ['min', 22, ['*', 0.04, ['sqrt', ['get', 'figure']]]]],
            13, ['max', 5, ['min', 36, ['*', 0.07, ['sqrt', ['get', 'figure']]]]],
            17, ['max', 8, ['min', 60, ['*', 0.12, ['sqrt', ['get', 'figure']]]]],
          ],
          'circle-color': [
            'match',
            ['get', 'displacement_type'],
            'conflict', COLOR_CONFLICT,
            'disaster', COLOR_DISASTER,
            COLOR_CONFLICT,
          ],
          'circle-opacity': 0.35,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-opacity': 0.7,
        },
      },
      'incidents-circles',
    );
    map.setPaintProperty(LAYER_ID, 'circle-opacity-transition' as never, { duration: 400 } as never);
    layerReady = true;
  };

  if (map.isStyleLoaded()) addLayer();
  else map.once('load', addLayer);

  return {
    setVisible(visible) {
      pendingVisible = visible;
      if (layerReady) applyState();
    },
    setVisibleDate(date) {
      pendingDate = date;
      if (layerReady) applyState();
    },
  };
}
```

- [ ] **Step 7.2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 7.3: Commit**

```bash
git add src/map/displacement-layer.ts
git commit -m "feat(map): add displacement-layer with figure-scaled circles"
```

---

## Task 8: Side-panel displacement mode

**Files:**
- Modify: `src/ui/side-panel.ts`

- [ ] **Step 8.1: Add `DisplacementEvent` to imports**

In `src/ui/side-panel.ts`, change line 1:

```ts
import type { Incident, CredibilityRating, SourceOrg, DamageStatus } from '@shared/types';
```

to:

```ts
import type { Incident, CredibilityRating, SourceOrg, DamageStatus, DisplacementEvent } from '@shared/types';
```

Update the `ORG_LABEL` map (around line 11) to add IDMC:

```ts
const ORG_LABEL: Record<SourceOrg, string> = {
  airwars: 'Airwars',
  acled: 'ACLED',
  ocha: 'OCHA',
  ucdp: 'UCDP',
  idmc: 'IDMC',
};
```

- [ ] **Step 8.2: Add `openDisplacement` to the handle type and implementation**

In `src/ui/side-panel.ts`, find the `SidePanelHandle` interface (around line 58) and add the new method:

```ts
export interface SidePanelHandle {
  openIncident(incident: Incident): void;
  openDamage(feature: DamageFeature): void;
  openDisplacement(event: DisplacementEvent): void;
  close(): void;
}
```

Then read the existing `renderIncident` and `renderDamage` private functions (they're inside `mountSidePanel`) and follow the same pattern. Add this new private function alongside them, before the `return` statement of `mountSidePanel`:

```ts
function renderDisplacement(ev: DisplacementEvent): void {
  const dateLabel = formatDate(ev.date);
  const typeLabel = ev.displacement_type === 'conflict' ? 'Conflict-driven' : 'Disaster-driven';
  const qualifier = ev.qualifier && ev.qualifier !== 'total' ? `${escapeHtml(ev.qualifier)} ` : '';
  const figureLabel = `${qualifier}${formatN(ev.figure)} displaced`;
  const placeLabel = ev.location.name ? escapeHtml(ev.location.name) : 'Gaza';

  const sourcesHtml = ev.sources.map((s) => `
    <li class="sp-source">
      <a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">
        ${escapeHtml(ORG_LABEL[s.org] ?? s.org)}
      </a>
    </li>
  `).join('');

  el.innerHTML = `
    <button class="sp-close" aria-label="Close">×</button>
    <div class="sp-kicker">Displacement event</div>
    <div class="sp-date">${dateLabel}</div>
    <div class="sp-location">${placeLabel}</div>
    <div class="sp-figure">
      <strong>${escapeHtml(figureLabel)}</strong>
      <span class="sp-figure-type">${escapeHtml(typeLabel)}</span>
    </div>
    <div class="sp-narrative">
      <p>${escapeHtml(ev.description)}</p>
    </div>
    <ul class="sp-sources">${sourcesHtml}</ul>
  `;
  el.classList.add('is-open');
  attachCloseHandler();
}
```

Then add the public method to the returned handle. Find the `return {` block at the end of `mountSidePanel` and extend it:

```ts
  return {
    openIncident(incident: Incident) {
      renderIncident(incident);
    },
    openDamage(feature: DamageFeature) {
      renderDamage(feature);
    },
    openDisplacement(ev: DisplacementEvent) {
      renderDisplacement(ev);
    },
    close() {
      el.classList.remove('is-open');
    },
  };
```

(If your existing `return {` already has slightly different shape — match its existing key/value style.)

- [ ] **Step 8.3: Add CSS for the new panel fields**

Open `src/style.css` and add (anywhere with the other `.sp-*` rules):

```css
.sp-figure {
  margin: 0.75rem 0;
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}
.sp-figure strong {
  font-family: 'Newsreader', serif;
  font-size: 1.6rem;
  font-weight: 500;
}
.sp-figure-type {
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #6b6b6b;
}
```

- [ ] **Step 8.4: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 8.5: Commit**

```bash
git add src/ui/side-panel.ts src/style.css
git commit -m "feat(ui): add side-panel displacement mode"
```

---

## Task 9: Layer toggle — Displacement checkbox

**Files:**
- Modify: `src/ui/layer-toggle.ts`

- [ ] **Step 9.1: Extend the toggle state + UI**

Replace the entire body of `src/ui/layer-toggle.ts` with:

```ts
export interface LayerToggleState {
  incidents: boolean;
  damage: boolean;
  displacement: boolean;
}

export interface LayerToggleHandle {
  onChange(fn: (state: LayerToggleState) => void): void;
}

export function mountLayerToggle(parent: HTMLElement): LayerToggleHandle {
  const el = document.createElement('div');
  el.id = 'layer-toggle';
  el.innerHTML = `
    <div class="lt-heading">Layers</div>
    <label><input type="checkbox" id="toggle-incidents" checked /> Incidents</label>
    <label><input type="checkbox" id="toggle-damage" checked /> Damaged buildings</label>
    <label><input type="checkbox" id="toggle-displacement" /> Displacement</label>
  `;
  parent.appendChild(el);

  const listeners: Array<(s: LayerToggleState) => void> = [];
  const state: LayerToggleState = { incidents: true, damage: true, displacement: false };

  function notify(): void {
    for (const fn of listeners) fn({ ...state });
  }

  const incidentsBox = el.querySelector<HTMLInputElement>('#toggle-incidents')!;
  const damageBox = el.querySelector<HTMLInputElement>('#toggle-damage')!;
  const displacementBox = el.querySelector<HTMLInputElement>('#toggle-displacement')!;
  incidentsBox.addEventListener('change', () => { state.incidents = incidentsBox.checked; notify(); });
  damageBox.addEventListener('change', () => { state.damage = damageBox.checked; notify(); });
  displacementBox.addEventListener('change', () => { state.displacement = displacementBox.checked; notify(); });

  return {
    onChange(fn) { listeners.push(fn); },
  };
}
```

- [ ] **Step 9.2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS. (Note: `src/main.ts` still passes the old 2-key state to the callback; that breaks at runtime but typecheck only validates types. We'll fix that in Task 11.)

- [ ] **Step 9.3: Commit**

```bash
git add src/ui/layer-toggle.ts
git commit -m "feat(ui): add Displacement checkbox to layer toggle"
```

---

## Task 10: Header — Displaced counter

**Files:**
- Modify: `src/ui/header.ts`

- [ ] **Step 10.1: Add the displacement cumulative builder + counter**

In `src/ui/header.ts`, change the type import line:

```ts
import type { Incident } from '@shared/types';
```

to:

```ts
import type { Incident, DisplacementEvent } from '@shared/types';
```

After the `buildDamageCumulative` function, add:

```ts
function buildDisplacementCumulative(events: DisplacementEvent[]): DamageCumulative {
  const byDate = new Map<string, number>();
  for (const e of events) {
    byDate.set(e.date, (byDate.get(e.date) ?? 0) + e.figure);
  }
  const dates = [...byDate.keys()].sort();
  const cumCount: number[] = [];
  let cc = 0;
  for (const d of dates) {
    cc += byDate.get(d)!;
    cumCount.push(cc);
  }
  return { dateStrings: dates, cumCount };
}
```

Change the `mountHeader` signature to accept displacement events:

```ts
export function mountHeader(
  parent: HTMLElement,
  opts: {
    incidents: Incident[];
    damageFeatures: Array<{ properties?: { assessment_date?: string } }>;
    displacementEvents: DisplacementEvent[];
  },
): HeaderHandle {
```

Update the inner HTML template to add a fourth stat:

```ts
  el.innerHTML = `
    <h1 class="title">The Gaza Exhibit</h1>
    <p class="subtitle">A geographic record of the war on Gaza since Oct 7, 2023.</p>
    <div class="stats">
      <div class="stat"><strong id="stat-incidents">0</strong>Incidents</div>
      <div class="stat"><strong id="stat-damage">0</strong>Buildings</div>
      <div class="stat"><strong id="stat-killed">0</strong>Killed</div>
      <div class="stat"><strong id="stat-displaced">0</strong>Displaced</div>
    </div>
  `;
```

Build the cumulative + bind the element + update on date change. Add the cumulative build line right after the existing `buildDamageCumulative` call:

```ts
  const displacementCum = buildDisplacementCumulative(opts.displacementEvents);
```

Add the element bind right after the existing three:

```ts
  const elDisplaced = el.querySelector<HTMLElement>('#stat-displaced')!;
```

Update the `updateForDate` body to include displaced:

```ts
  return {
    updateForDate(date: string) {
      const inc = lookupCum(incidentCum.dateStrings, incidentCum.cumCount, date);
      const killed = lookupCum(incidentCum.dateStrings, incidentCum.cumKilled, date);
      const dam = lookupCum(damageCum.dateStrings, damageCum.cumCount, date);
      const disp = lookupCum(displacementCum.dateStrings, displacementCum.cumCount, date);
      elIncidents.textContent = fmt.format(inc);
      elDamage.textContent = fmt.format(dam);
      elKilled.textContent = fmt.format(killed);
      elDisplaced.textContent = fmt.format(disp);
    },
  };
```

- [ ] **Step 10.2: Typecheck**

Run: `pnpm typecheck`
Expected: FAIL — `src/main.ts` calls `mountHeader` without the new required `displacementEvents` field. We'll fix this in Task 11. If typecheck passes, double-check `mountHeader` actually requires `displacementEvents`.

- [ ] **Step 10.3: Commit (interim, will be followed by Task 11 fix)**

```bash
git add src/ui/header.ts
git commit -m "feat(ui): add Displaced cumulative counter to header"
```

---

## Task 11: main.ts wiring

**Files:**
- Modify: `src/main.ts`

This pulls all the pieces together. Load displacement data, mount the layer, wire the toggle and time-controller, attach click handler for opening the side panel.

- [ ] **Step 11.1: Update imports**

In `src/main.ts`, change:

```ts
import { mountDamageLayer } from './map/damage-layer';
import { loadIncidents, loadDamage } from './data/loader';
```

to:

```ts
import { mountDamageLayer } from './map/damage-layer';
import { mountDisplacementLayer } from './map/displacement-layer';
import { loadIncidents, loadDamage, loadDisplacement } from './data/loader';
```

- [ ] **Step 11.2: Load displacement data**

After the existing `const damageData = await loadDamage();` block, add:

```ts
  loading.setStatus('Loading displacement data…');
  const displacement = await loadDisplacement();
  console.log(`Loaded ${displacement.length} displacement events`);
```

- [ ] **Step 11.3: Pass displacement to header**

Change:

```ts
const header = mountHeader(app, { incidents, damageFeatures: damageData.features });
```

to:

```ts
const header = mountHeader(app, {
  incidents,
  damageFeatures: damageData.features,
  displacementEvents: displacement,
});
```

- [ ] **Step 11.4: Mount the displacement layer**

After the existing `const damage = await mountDamageLayer(...)` block, add:

```ts
  const displacementLayer = await mountDisplacementLayer(map, displacement);
  // Default off — see spec: visual overload risk at start.
```

- [ ] **Step 11.5: Wire the toggle**

Change the existing toggle handler:

```ts
  layerToggle.onChange((s) => {
    damage.setVisible(s.damage);
    if (map.getLayer('incidents-circles')) {
      map.setLayoutProperty('incidents-circles', 'visibility', s.incidents ? 'visible' : 'none');
    }
  });
```

to:

```ts
  layerToggle.onChange((s) => {
    damage.setVisible(s.damage);
    displacementLayer.setVisible(s.displacement);
    if (map.getLayer('incidents-circles')) {
      map.setLayoutProperty('incidents-circles', 'visibility', s.incidents ? 'visible' : 'none');
    }
  });
```

- [ ] **Step 11.6: Drive the displacement layer with the time controller**

Find the existing `timeCtrl.onChange` block:

```ts
  timeCtrl.onChange((date) => {
    markers.setVisibleDate(date);
    damage.setVisibleDate(date);
    header.updateForDate(date);
    const newHash = formatHash({ date });
    if (newHash !== location.hash) {
      history.replaceState(null, '', `${location.pathname}${location.search}${newHash}`);
    }
  });
```

Add `displacementLayer.setVisibleDate(date);`:

```ts
  timeCtrl.onChange((date) => {
    markers.setVisibleDate(date);
    damage.setVisibleDate(date);
    displacementLayer.setVisibleDate(date);
    header.updateForDate(date);
    const newHash = formatHash({ date });
    if (newHash !== location.hash) {
      history.replaceState(null, '', `${location.pathname}${location.search}${newHash}`);
    }
  });
```

And the initial date application:

```ts
  markers.setVisibleDate(timeCtrl.currentDate);
  damage.setVisibleDate(timeCtrl.currentDate);
  displacementLayer.setVisibleDate(timeCtrl.currentDate);
  header.updateForDate(timeCtrl.currentDate);
```

- [ ] **Step 11.7: Wire the click handler for opening the side panel**

After the existing `map.on('click', 'damage-circles', …)` block, add:

```ts
  const displacementById = new Map(displacement.map((d) => [d.id, d]));

  map.on('click', 'displacement-circles', (e) => {
    if (!e.features || e.features.length === 0) return;
    const id = e.features[0].properties?.id as string | undefined;
    if (!id) return;
    const ev = displacementById.get(id);
    if (!ev) return;
    sidePanel.openDisplacement(ev);
  });

  map.on('mouseenter', 'displacement-circles', () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', 'displacement-circles', () => {
    map.getCanvas().style.cursor = '';
  });
```

Also extend the empty-area click handler near the bottom — find:

```ts
  map.on('click', (e) => {
    const hits = map.queryRenderedFeatures(e.point, {
      layers: ['incidents-circles', 'damage-circles'].filter((l) => map.getLayer(l)),
    });
    if (hits.length === 0) {
      sidePanel.close();
    }
  });
```

Change to include the displacement layer:

```ts
  map.on('click', (e) => {
    const hits = map.queryRenderedFeatures(e.point, {
      layers: ['incidents-circles', 'damage-circles', 'displacement-circles']
        .filter((l) => map.getLayer(l)),
    });
    if (hits.length === 0) {
      sidePanel.close();
    }
  });
```

- [ ] **Step 11.8: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 11.9: Run full test suite**

Run: `pnpm test`
Expected: all tests pass.

- [ ] **Step 11.10: Commit**

```bash
git add src/main.ts
git commit -m "feat(client): wire displacement layer + counter + panel"
```

---

## Task 12: Manual smoke test

**Files:** (none modified — observe only)

- [ ] **Step 12.1: Run dev server**

Run: `pnpm dev`
Open: http://localhost:5173

- [ ] **Step 12.2: Verify default state**

Expected on initial load:
- Header shows 4 stat columns (Incidents / Buildings / Killed / Displaced). All numbers are the cumulative totals through the initial scrub date (which is the latest record).
- Layer-toggle shows three checkboxes: Incidents (checked), Damaged buildings (checked), Displacement (UNCHECKED).
- No teal/amber rings visible (because Displacement is off).

- [ ] **Step 12.3: Toggle Displacement on**

Click the Displacement checkbox.
Expected: small filled teal (and amber, if any disaster events) circles appear over Gaza locations. Larger circles for larger displacement figures. Stroke is white. Circles are translucent (35% fill, 70% stroke).

- [ ] **Step 12.4: Scrub the timeline**

Drag the scrubber from far-right back to 2024-06-01 then to 2024-12-01 then back to far-right.
Expected:
- Displacement circles only appear once the scrub date crosses 2025-01-01 (the first IDMC record). Before that, no circles.
- The Displaced counter in the header is 0 for any date before the first IDMC event, then grows monotonically.
- Damage layer and incident markers still scrub correctly (regression check).

- [ ] **Step 12.5: Click a displacement circle**

Click any visible displacement circle.
Expected:
- Side panel slides in with: "Displacement event" kicker, a date, the location name (e.g., "Gaza Strip, Palestinian Territories"), a bold figure with units (e.g., "12,500 displaced", "Conflict-driven"), a description paragraph, and a "IDMC" source link at the bottom.

- [ ] **Step 12.6: Click empty area**

Click a blank area of the map (no incident, no building, no displacement).
Expected: side panel closes.

- [ ] **Step 12.7: Click an incident marker and a damage dot (regression)**

Verify the existing Incident and Damage panel modes still work.

- [ ] **Step 12.8: Open browser devtools network tab and confirm `displacement.json` loaded**

Expected: a single 200 response, small file (<100 KB).

- [ ] **Step 12.9: Look at the console**

Expected: log lines include `Loaded N displacement events` and no errors.

- [ ] **Step 12.10: Toggle Displacement off**

Click the checkbox.
Expected: circles disappear cleanly.

---

## Task 13: HANDOFF + final commit

**Files:**
- Modify: `docs/superpowers/HANDOFF.md`

- [ ] **Step 13.1: Update the HANDOFF data table**

Open `docs/superpowers/HANDOFF.md` and find the "Current data state" table near the top. Add a row for IDMC after the UCDP row (keep the format identical to existing rows):

```markdown
| IDMC IDU | 323 records | N events (Gaza, post-Oct-7-2023, after Recommended-figure dedup) | CC BY-IGO. Monthly updates. Date range 2025-01-01+. |
```

Replace `N events` with the actual normalized count from your build output. Also update the "After dedup" line to add displacement to the totals if relevant.

- [ ] **Step 13.2: Update the "Most recent session" log**

In the same file, append a new bullet to the "What was done in the most recent session" list:

```markdown
15. `<commit-hash>` — Phase A1: IDMC displacement integration (new DisplacementEvent type, layer, side-panel mode, header counter)
```

Get the latest commit hash with `git log -1 --oneline` and substitute.

- [ ] **Step 13.3: Remove the ACLED-pending note**

Find the "Outstanding issues / pending work" → "High priority" section and update item 1 to reflect that ACLED is now confirmed unavailable (see the multi-source-expansion spec) and that Phase A1 has landed. You can replace the original item 1 wording with:

```markdown
1. **ACLED is unavailable for this use case** under any license tier — confirmed in writing 2026-05-23. Direct map display of ACLED records is prohibited. Tracked in `docs/superpowers/specs/2026-05-23-multi-source-expansion-design.md`. Three permission requests (FA, CIR, AOAV) are drafted and ready to send; integrations are conditional on a yes from at least one.
```

- [ ] **Step 13.4: Run the full build to be sure nothing regressed**

Run: `pnpm build`
Expected: typecheck passes, build-data runs, vite build completes. No errors.

- [ ] **Step 13.5: Final commit**

```bash
git add docs/superpowers/HANDOFF.md
git commit -m "docs: update HANDOFF for Phase A1 (IDMC displacement)"
```

- [ ] **Step 13.6: Tag the milestone (optional but consistent with the project's convention)**

```bash
git tag phase-a1-idmc
echo "Phase A1 complete. Displacement events now live."
```

---

## Self-review against the spec

Coverage check against `docs/superpowers/specs/2026-05-23-multi-source-expansion-design.md`:

- ✅ "A1 (IDMC displacement) — highest user-visible impact" — Tasks 2–11 implement fetch, normalize, build, layer, panel, counter
- ✅ "Type system implications → DisplacementEvent" — Task 1 adds the exact interface from the spec
- ✅ "Extend SourceOrg with 'idmc'" — Task 1.1
- ✅ "Apply the same Oct-7-2023 filter at the normalize step" — Task 5.3 (build-time filter; the IDMC dataset starts 2025-01-01 so this is a no-op for now but defends against future pre-war additions)
- ✅ "Default off (per spec recommendation)" — Task 9 sets `displacement: false` initially
- ✅ "Side-panel: Displacement mode — date, people displaced, displacement type, source link" — Task 8
- ✅ "Counters in the header: Displaced (cumulative from IDMC)" — Task 10
- ✅ "Only `Incident` records run through `dedupe.ts`. `DisplacementEvent` … are not deduplicated against incidents" — Task 5.2 (added IDMC normalize **before** the dedup line but excluded from the dedup call)

Not covered by this plan (deferred to later phases per the spec):
- Phase A2/A3/A4 (UNOSAT extended damage layers) — separate plans
- Phase A5/A6 (facilities overlay) — separate plan
- Tier B sources (FA / CIR / AOAV) — conditional on permission replies

## Risks acknowledged in implementation

1. **Empty displaced counter before 2025-01-01.** Correct given the dataset; surfaces clearly as 0 in the header until the scrubber crosses Jan 2025. No special-case needed.
2. **IDMC monthly updates.** Re-running `pnpm build-data` re-fetches; the fetch script writes both raw CSV (for inspection) and parsed JSON (for the build).
3. **Disaster events in a war exhibit.** We keep both Conflict and Disaster `displacement_type`s. The side panel distinguishes them with the "Conflict-driven" / "Disaster-driven" label. The user can review on smoke-test (Task 12) and decide if disaster-only events should be filtered out; one-line change in `normalizeIdmcRow` if so.
4. **`role` field dedup.** IDMC publishes both "Recommended figure" (canonical) and "Triangulation" (sanity-check from a second source) rows. Task 4 keeps only "Recommended figure" so we don't double-count. Verified by the `rejects rows with role=Triangulation` test in Task 3.

---

**Plan complete and committed to `docs/superpowers/plans/2026-05-23-phase-a1-idmc-displacement.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
