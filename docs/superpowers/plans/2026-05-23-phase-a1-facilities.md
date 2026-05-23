# Phase A1 — HOT/OSM Facilities Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add health and education facilities (hospitals, clinics, pharmacies, schools, universities) from HOT/OSM as a static reference overlay on the exhibit map, so visitors can see which civilian facilities sit inside damage zones.

**Architecture:** Mirror the existing per-source pipeline (`fetch-*.ts` + `normalize-*.ts` + tests + wired into `build-data.ts` → JSON committed to `public/data/`). On the client, add a parallel facility layer with two sub-categories (health, education) that does **not** flow through the existing `incidents`/`damage` paths — facilities are reference markers, not events. **No time axis** (facilities pass through unchanged when the scrubber moves). Two new toggles (Health, Education), one new side-panel mode.

**Tech Stack:** TypeScript 5 (strict, `verbatimModuleSyntax`), Vite 6, MapLibre GL JS, Vitest, pnpm. Extension-less local TS imports. 2 spaces, single quotes, Conventional Commits.

**Source datasets:**
- Health: https://data.humdata.org/dataset/hotosm_pse_health_facilities
  - Direct GeoJSON zip: `https://production-raw-data-api.s3.amazonaws.com/ISO3/PSE/health_facilities/hotosm_pse_health_facilities_osm_geojson.zip`
  - 2,391 features Palestine-wide → **571 in Gaza bbox** (351 hospitals, 398 clinics, 1,133 pharmacies, 326 doctors, 143 dentists, + small categories)
- Education: https://data.humdata.org/dataset/hotosm_pse_education_facilities
  - Direct GeoJSON zip: `https://production-raw-data-api.s3.amazonaws.com/ISO3/PSE/education_facilities/hotosm_pse_education_facilities_osm_geojson.zip`
  - 5,221 features Palestine-wide (mostly polygons) → **215 named point facilities in Gaza** (121 schools, 65 kindergartens, 24 colleges, 4 universities)
- License: **ODbL** (Open Database License) — explicitly permits reuse with attribution; no permission email needed
- Refresh cadence: monthly (HOT/OSM regenerates from OpenStreetMap)

**Why this and not UNOSAT extended:** The spec's original Phase A1 (UNOSAT cropland/roads/greenhouses) hit format friction — all three ship as ESRI File Geodatabase (.gdb), which Node can't parse; UNOSAT's CERN-hosted ArcGIS endpoint is currently returning "Could not access any server machines"; the only working cropland mirror has just 2 polygons covering the whole Strip. Facilities (originally Tier A items A4/A5) provide a stronger visual narrative — 786 hospital/clinic/school dots overlaid on 196K damaged buildings tell "this is what got hit." See the spec for the full pivot rationale.

**Spec reference:** `docs/superpowers/specs/2026-05-23-multi-source-expansion-design.md`, Tier A item A5.

---

## File Structure

**Created:**
- `scripts/fetch-osm-facilities.ts` — downloads both GeoJSON zips, unzips, caches raw geojson under `data/raw/osm/`
- `scripts/normalize-osm-facilities.ts` — OSM feature → `FacilityRecord` (TDD)
- `tests/normalize-osm-facilities.test.ts` — Vitest tests
- `src/map/facility-layer.ts` — MapLibre layer with two sub-layers (health-circles, education-circles), distinct colors, static (no time filter)
- `docs/superpowers/plans/2026-05-23-phase-a1-facilities.md` — this file

**Modified:**
- `shared/types.ts` — add `FacilityCategory`, `FacilityRecord`, extend `SourceOrg` with `'osm'`, extend `BuildMeta` with `facility_count`
- `scripts/build-data.ts` — load OSM raws, normalize, write `public/data/facilities.json`, update meta
- `src/data/loader.ts` — add `loadFacilities()`
- `src/ui/side-panel.ts` — add `openFacility(record)` mode + rendering
- `src/ui/layer-toggle.ts` — add `health` and `education` checkboxes (both default off)
- `src/main.ts` — load facilities, mount layer, wire toggles + click + sub-layer visibility
- `docs/superpowers/HANDOFF.md` — reflect new source

**Untouched but worth knowing exists:**
- `src/data/loader.ts` already declares a local `DamageFeature` interface; **don't confuse it with anything new in this plan.** This plan does not introduce a shared `DamageFeature` type — that's deferred.

---

## Task 1: Type definitions

**Files:**
- Modify: `shared/types.ts`

- [ ] **Step 1.1: Extend `SourceOrg`**

Open `shared/types.ts` and change the `SourceOrg` union to include `'osm'`:

```ts
export type SourceOrg = 'airwars' | 'acled' | 'ocha' | 'ucdp' | 'osm';
```

- [ ] **Step 1.2: Add `FacilityCategory` and `FacilityRecord`**

Append to `shared/types.ts` (after the existing `Incident` interface, before `BuildMeta`):

```ts
export type FacilityCategory = 'health' | 'education';

export interface FacilityRecord {
  id: string;                 // e.g. 'osm:node/505095722'
  category: FacilityCategory;
  subtype: string;            // OSM amenity value, e.g. 'pharmacy', 'school', 'university'
  location: { lat: number; lon: number };
  name: string;               // primary name (English or Latin transliteration)
  name_ar?: string;           // Arabic name when present
  governorate?: string;       // adm2_name from HOT/OSM (e.g. 'Rafah', 'Khan Younis')
  source: SourceAttribution;
}
```

- [ ] **Step 1.3: Extend `BuildMeta`**

Change the `BuildMeta` interface in `shared/types.ts` to add `facility_count`:

```ts
export interface BuildMeta {
  build_date: string;
  source_counts: Partial<Record<SourceOrg, number>>;
  dedup_merges: number;
  unplotted_count: number;
  damage_count?: number;
  facility_count?: number;
}
```

- [ ] **Step 1.4: Update side-panel ORG_LABEL**

`src/ui/side-panel.ts` has an exhaustive `ORG_LABEL: Record<SourceOrg, string>` map. Add an entry for the new source:

```ts
const ORG_LABEL: Record<SourceOrg, string> = {
  airwars: 'Airwars',
  acled: 'ACLED',
  ocha: 'OCHA',
  ucdp: 'UCDP',
  osm: 'OpenStreetMap (HOT)',
};
```

- [ ] **Step 1.5: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 1.6: Commit**

```bash
git add shared/types.ts src/ui/side-panel.ts
git commit -m "feat(types): add FacilityRecord + osm source org"
```

---

## Task 2: Fetch script

**Files:**
- Create: `scripts/fetch-osm-facilities.ts`

The HOT/OSM dataset publisher hosts on AWS S3. Each dataset is a small zip containing one GeoJSON file (and metadata sidecars we ignore).

- [ ] **Step 2.1: Create the fetch script**

Create `scripts/fetch-osm-facilities.ts` with this exact content:

```ts
import { mkdir, writeFile, access, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { spawn } from 'node:child_process';

const HEALTH_URL =
  'https://production-raw-data-api.s3.amazonaws.com/ISO3/PSE/health_facilities/' +
  'hotosm_pse_health_facilities_osm_geojson.zip';
const EDUCATION_URL =
  'https://production-raw-data-api.s3.amazonaws.com/ISO3/PSE/education_facilities/' +
  'hotosm_pse_education_facilities_osm_geojson.zip';
const OUT_DIR = 'data/raw/osm';

async function fileExists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}

async function download(url: string, dest: string): Promise<void> {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
  const body = res.body;
  if (!body) throw new Error('No response body');
  const out = createWriteStream(dest);
  await pipeline(body as unknown as NodeJS.ReadableStream, out);
}

async function unzipFirstGeojson(zipPath: string, destPath: string): Promise<void> {
  // The HOT/OSM zip contains: <name>.geojson + README.txt + config.yaml + metadata.json
  // We extract just the geojson by name.
  await new Promise<void>((resolve, reject) => {
    const p = spawn('unzip', ['-o', '-j', zipPath, '*.geojson', '-d', OUT_DIR], {
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    p.on('error', reject);
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`unzip exited ${code}`))));
  });
  // unzip writes to <OUT_DIR>/<original-name>.geojson. We don't know the exact name,
  // so move the most recently extracted .geojson to the canonical destPath.
  const { readdir, stat } = await import('node:fs/promises');
  const entries = await readdir(OUT_DIR);
  const geojsons = entries.filter((e) => e.endsWith('.geojson') && !e.endsWith(destPath.split('/').pop()!));
  // Find the most recently modified one (just extracted)
  let newest: { name: string; mtime: number } | null = null;
  for (const e of geojsons) {
    const s = await stat(join(OUT_DIR, e));
    if (!newest || s.mtimeMs > newest.mtime) newest = { name: e, mtime: s.mtimeMs };
  }
  if (!newest) throw new Error('No geojson found after unzip');
  await rename(join(OUT_DIR, newest.name), destPath);
}

async function fetchOne(url: string, kind: 'health' | 'education'): Promise<void> {
  const zipPath = join(OUT_DIR, `${kind}.zip`);
  const geojsonPath = join(OUT_DIR, `${kind}.geojson`);
  console.log(`Downloading HOT/OSM ${kind} from ${url}...`);
  await download(url, zipPath);
  await unzipFirstGeojson(zipPath, geojsonPath);
  await rm(zipPath);
  console.log(`Wrote ${geojsonPath}`);
}

export async function fetchOsmFacilities(opts: { refresh?: boolean } = {}): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const healthPath = join(OUT_DIR, 'health.geojson');
  const educationPath = join(OUT_DIR, 'education.geojson');

  if (!opts.refresh && (await fileExists(healthPath)) && (await fileExists(educationPath))) {
    console.log(`HOT/OSM snapshots already exist in ${OUT_DIR} — pass --refresh to re-download.`);
    return;
  }

  await fetchOne(HEALTH_URL, 'health');
  await fetchOne(EDUCATION_URL, 'education');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const refresh = process.argv.includes('--refresh');
  fetchOsmFacilities({ refresh }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 2.2: Run the fetch standalone**

Run: `pnpm tsx scripts/fetch-osm-facilities.ts --refresh`
Expected: console prints the two download lines + two `Wrote …` lines. No errors.

- [ ] **Step 2.3: Sanity-check the cache**

Run:
```bash
python3 -c "
import json
for k in ['health', 'education']:
    fc = json.load(open(f'data/raw/osm/{k}.geojson'))
    print(f'{k}: {len(fc[\"features\"])} features')
"
```
Expected: `health: 2391 features` and `education: 5221 features` (numbers may shift slightly between monthly OSM exports).

- [ ] **Step 2.4: Commit**

```bash
git add scripts/fetch-osm-facilities.ts data/raw/osm/
git commit -m "feat(data): fetch HOT/OSM Palestine health + education facilities"
```

---

## Task 3: Normalize tests (TDD — write failing tests first)

**Files:**
- Create: `tests/normalize-osm-facilities.test.ts`

- [ ] **Step 3.1: Write the test file**

Create `tests/normalize-osm-facilities.test.ts` with this exact content:

```ts
import { describe, it, expect } from 'vitest';
import { normalizeOsmFacility } from '../scripts/normalize-osm-facilities';
import type { Feature } from 'geojson';

const GAZA_HEALTH_FEATURE: Feature = {
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [34.2450104, 31.3095378] },
  properties: {
    id: 'node/505095722',
    name: 'Bader Pharmacy',
    name_ar: 'صيدلية بدر',
    amenity: 'pharmacy',
    healthcare: 'pharmacy',
    adm2_name: 'Rafah',
  },
};

const GAZA_EDUCATION_FEATURE: Feature = {
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [34.4500, 31.5000] },
  properties: {
    id: 'node/123456',
    name: 'Test School',
    name_ar: 'مدرسة اختبار',
    amenity: 'school',
    adm2_name: 'Gaza',
  },
};

const WEST_BANK_FEATURE: Feature = {
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [35.2000, 32.0000] },
  properties: { id: 'node/9', name: 'WB Hospital', amenity: 'hospital' },
};

const UNNAMED_FEATURE: Feature = {
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [34.45, 31.4] },
  properties: { id: 'node/10', name: null, amenity: 'pharmacy' },
};

const POLYGON_FEATURE: Feature = {
  type: 'Feature',
  geometry: { type: 'Polygon', coordinates: [[[34.45, 31.4], [34.46, 31.4], [34.46, 31.41], [34.45, 31.4]]] },
  properties: { id: 'way/100', name: 'Polygon School', amenity: 'school' },
};

const FALLBACK_HEALTHCARE_FEATURE: Feature = {
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [34.40, 31.40] },
  properties: { id: 'node/77', name: 'Healthcare Center', amenity: null, healthcare: 'clinic', adm2_name: 'Khan Younis' },
};

describe('normalizeOsmFacility', () => {
  it('produces a complete FacilityRecord from a Gaza health Point', () => {
    const r = normalizeOsmFacility(GAZA_HEALTH_FEATURE)!;
    expect(r.id).toBe('osm:node/505095722');
    expect(r.category).toBe('health');
    expect(r.subtype).toBe('pharmacy');
    expect(r.location.lat).toBeCloseTo(31.3095378);
    expect(r.location.lon).toBeCloseTo(34.2450104);
    expect(r.name).toBe('Bader Pharmacy');
    expect(r.name_ar).toBe('صيدلية بدر');
    expect(r.governorate).toBe('Rafah');
    expect(r.source.org).toBe('osm');
    expect(r.source.id).toBe('node/505095722');
    expect(r.source.url).toContain('openstreetmap.org/node/505095722');
  });

  it('produces a complete FacilityRecord from a Gaza education Point', () => {
    const r = normalizeOsmFacility(GAZA_EDUCATION_FEATURE)!;
    expect(r.category).toBe('education');
    expect(r.subtype).toBe('school');
    expect(r.name).toBe('Test School');
  });

  it('rejects West Bank features (outside Gaza bbox)', () => {
    expect(normalizeOsmFacility(WEST_BANK_FEATURE)).toBeNull();
  });

  it('rejects unnamed features', () => {
    expect(normalizeOsmFacility(UNNAMED_FEATURE)).toBeNull();
  });

  it('rejects non-Point geometries (polygons/lines)', () => {
    expect(normalizeOsmFacility(POLYGON_FEATURE)).toBeNull();
  });

  it('falls back to healthcare tag when amenity is missing (health category)', () => {
    const r = normalizeOsmFacility(FALLBACK_HEALTHCARE_FEATURE)!;
    expect(r.category).toBe('health');
    expect(r.subtype).toBe('clinic');
  });

  it('rejects amenity values that are neither health nor education', () => {
    const bad: Feature = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [34.45, 31.4] },
      properties: { id: 'node/11', name: 'Bus Stop', amenity: 'bus_station' },
    };
    expect(normalizeOsmFacility(bad)).toBeNull();
  });

  it('handles missing name_ar gracefully (returns record without it)', () => {
    const noAr: Feature = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [34.45, 31.4] },
      properties: { id: 'node/12', name: 'English Only', amenity: 'hospital' },
    };
    const r = normalizeOsmFacility(noAr)!;
    expect(r.name).toBe('English Only');
    expect(r.name_ar).toBeUndefined();
  });

  it('handles missing governorate gracefully', () => {
    const noGov: Feature = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [34.45, 31.4] },
      properties: { id: 'node/13', name: 'Mystery Clinic', amenity: 'clinic' },
    };
    const r = normalizeOsmFacility(noGov)!;
    expect(r.governorate).toBeUndefined();
  });
});
```

- [ ] **Step 3.2: Run the tests and verify they all fail with "module not found"**

Run: `pnpm vitest run tests/normalize-osm-facilities.test.ts`
Expected: every test fails because `scripts/normalize-osm-facilities.ts` doesn't exist yet. Don't commit yet — Task 4 commits the TDD pair.

---

## Task 4: Normalize implementation

**Files:**
- Create: `scripts/normalize-osm-facilities.ts`

- [ ] **Step 4.1: Write the normalize implementation**

Create `scripts/normalize-osm-facilities.ts` with this exact content:

```ts
import type { Feature } from 'geojson';
import type {
  FacilityRecord,
  FacilityCategory,
  SourceAttribution,
} from '../shared/types';

const HEALTH_AMENITIES = new Set([
  'hospital',
  'clinic',
  'pharmacy',
  'doctors',
  'dentist',
  'nursing_home',
]);

const HEALTH_HEALTHCARE = new Set([
  'hospital',
  'clinic',
  'pharmacy',
  'doctor',
  'dentist',
  'laboratory',
  'rehabilitation',
  'centre',
  'physiotherapist',
]);

const EDUCATION_AMENITIES = new Set([
  'school',
  'kindergarten',
  'college',
  'university',
]);

function isInGazaBbox(lat: number, lon: number): boolean {
  return lat >= 31.20 && lat <= 31.60 && lon >= 34.20 && lon <= 34.60;
}

function osmIdToUrl(osmId: string): string {
  // OSM ids are like 'node/505095722' or 'way/12345'. The OSM browse URL pattern is
  // https://www.openstreetmap.org/<type>/<id>
  return `https://www.openstreetmap.org/${osmId}`;
}

function classify(props: Record<string, unknown>): { category: FacilityCategory; subtype: string } | null {
  const amenity = typeof props.amenity === 'string' ? props.amenity : '';
  const healthcare = typeof props.healthcare === 'string' ? props.healthcare : '';

  if (amenity && EDUCATION_AMENITIES.has(amenity)) {
    return { category: 'education', subtype: amenity };
  }
  if (amenity && HEALTH_AMENITIES.has(amenity)) {
    return { category: 'health', subtype: amenity };
  }
  if (healthcare && HEALTH_HEALTHCARE.has(healthcare)) {
    return { category: 'health', subtype: healthcare };
  }
  return null;
}

export function normalizeOsmFacility(feat: Feature): FacilityRecord | null {
  if (feat.geometry?.type !== 'Point') return null;

  const coords = feat.geometry.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const [lon, lat] = coords as [number, number];
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (!isInGazaBbox(lat, lon)) return null;

  const props = (feat.properties ?? {}) as Record<string, unknown>;

  const rawId = typeof props.id === 'string' ? props.id : '';
  if (rawId.length === 0) return null;

  const name = typeof props.name === 'string' ? props.name.trim() : '';
  if (name.length === 0) return null;

  const classification = classify(props);
  if (classification === null) return null;

  const name_ar = typeof props.name_ar === 'string' && props.name_ar.trim().length > 0
    ? props.name_ar.trim()
    : undefined;
  const governorate = typeof props.adm2_name === 'string' && props.adm2_name.trim().length > 0
    ? props.adm2_name.trim()
    : undefined;

  const source: SourceAttribution = {
    org: 'osm',
    id: rawId,
    url: osmIdToUrl(rawId),
  };

  return {
    id: `osm:${rawId}`,
    category: classification.category,
    subtype: classification.subtype,
    location: { lat, lon },
    name,
    name_ar,
    governorate,
    source,
  };
}
```

- [ ] **Step 4.2: Run the tests and verify they all pass**

Run: `pnpm vitest run tests/normalize-osm-facilities.test.ts`
Expected: 9 tests pass.

- [ ] **Step 4.3: Run the full test suite**

Run: `pnpm test`
Expected: all tests pass (97 existing + 9 new = 106).

- [ ] **Step 4.4: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4.5: Commit**

```bash
git add scripts/normalize-osm-facilities.ts tests/normalize-osm-facilities.test.ts
git commit -m "feat(data): normalize OSM features to FacilityRecord (TDD)"
```

---

## Task 5: Build-data pipeline wiring

**Files:**
- Modify: `scripts/build-data.ts`

- [ ] **Step 5.1: Add imports + loader**

In `scripts/build-data.ts`, after the existing imports, add:

```ts
import { fetchOsmFacilities } from './fetch-osm-facilities';
import { normalizeOsmFacility } from './normalize-osm-facilities';
```

Extend the type import line. Change:

```ts
import type { Incident, BuildMeta, DamageRecord, DamageStatus } from '../shared/types';
```

to:

```ts
import type { Incident, BuildMeta, DamageRecord, DamageStatus, FacilityRecord } from '../shared/types';
```

Add a constant near the other RAW directory constants:

```ts
const OSM_RAW = 'data/raw/osm';
```

Add a loader function near `loadOchaFeatures`:

```ts
async function loadOsmFacilityFeatures(): Promise<GeoJSON.Feature[]> {
  const out: GeoJSON.Feature[] = [];
  for (const kind of ['health', 'education']) {
    try {
      const fc = JSON.parse(
        await readFile(join(OSM_RAW, `${kind}.geojson`), 'utf8'),
      ) as GeoJSON.FeatureCollection;
      if (fc.features) out.push(...fc.features);
    } catch { /* missing snapshot — return what we have */ }
  }
  return out;
}
```

- [ ] **Step 5.2: Wire fetch + normalize into `main()`**

In `scripts/build-data.ts`, find the existing fetch sequence:

```ts
await fetchAirwars();
await fetchUcdp();
await fetchOcha();
```

Change to:

```ts
await fetchAirwars();
await fetchUcdp();
await fetchOcha();
await fetchOsmFacilities();
```

After the OCHA damage write (the `await writeFile(join(OUT_DIR, 'damage.geojson'), …)` block), add a new section for facilities. **Critically: facilities are NOT deduped with incidents.** Add:

```ts
  const osmFeatures = await loadOsmFacilityFeatures();
  console.log(`Loaded ${osmFeatures.length} OSM facility features`);
  const facilities: FacilityRecord[] = [];
  let osmDropped = 0;
  for (const feat of osmFeatures) {
    const fac = normalizeOsmFacility(feat);
    if (fac) facilities.push(fac);
    else osmDropped++;
  }
  console.log(`Normalized ${facilities.length} facilities (${osmDropped} dropped — non-Gaza, polygons, unnamed, etc.)`);

  await writeFile(join(OUT_DIR, 'facilities.json'), JSON.stringify(facilities));
  console.log(`Wrote ${facilities.length} facilities to ${OUT_DIR}/facilities.json`);
```

- [ ] **Step 5.3: Update the meta block**

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

Change to:

```ts
const meta: BuildMeta = {
  build_date: new Date().toISOString(),
  source_counts: {
    airwars: airwarsIncidents.length,
    ucdp: ucdpIncidents.length,
    osm: facilities.length,
  },
  dedup_merges: merges,
  unplotted_count: airwarsUnplotted + ucdpUnplotted,
  damage_count: damageInConflict.length,
  facility_count: facilities.length,
};
```

- [ ] **Step 5.4: Run the build**

Run: `pnpm build-data`
Expected: console output includes `Loaded N OSM facility features`, `Normalized 786 facilities (N dropped …)`, `Wrote 786 facilities to public/data/facilities.json`. Build completes.

- [ ] **Step 5.5: Verify the JSON output**

Run:
```bash
python3 -c "
import json
d = json.load(open('public/data/facilities.json'))
print('count:', len(d))
print('categories:', {})
from collections import Counter
print('by category:', Counter(f['category'] for f in d))
print('first:', d[0] if d else 'empty')
"
```
Expected: ~786 total, broken down ~571 health + ~215 education. First record has all the FacilityRecord fields.

- [ ] **Step 5.6: Typecheck + tests**

Run: `pnpm typecheck && pnpm test`
Expected: both pass.

- [ ] **Step 5.7: Commit**

```bash
git add scripts/build-data.ts public/data/facilities.json public/data/meta.json
git commit -m "feat(build): wire OSM facilities into build pipeline"
```

---

## Task 6: Client loader

**Files:**
- Modify: `src/data/loader.ts`

- [ ] **Step 6.1: Add import + loadFacilities**

In `src/data/loader.ts`, change:

```ts
import type { Incident, BuildMeta } from '@shared/types';
```

to:

```ts
import type { Incident, BuildMeta, FacilityRecord } from '@shared/types';
```

Append at the bottom of the file:

```ts
export async function loadFacilities(): Promise<FacilityRecord[]> {
  const res = await fetch('/data/facilities.json');
  if (!res.ok) throw new Error(`Failed to load facilities.json: ${res.status}`);
  return (await res.json()) as FacilityRecord[];
}
```

- [ ] **Step 6.2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 6.3: Commit**

```bash
git add src/data/loader.ts
git commit -m "feat(client): add loadFacilities loader"
```

---

## Task 7: Facility map layer

**Files:**
- Create: `src/map/facility-layer.ts`

Visual treatment: small circles, distinct colors by category. Health = teal-blue (`#0891b2`), Education = soft purple (`#8b5cf6`). White stroke for visibility. Static — no time filter. Default off.

- [ ] **Step 7.1: Create the facility layer**

Create `src/map/facility-layer.ts` with this exact content:

```ts
import type { Map } from 'maplibre-gl';
import type { FacilityRecord, FacilityCategory } from '@shared/types';

const SOURCE_ID = 'facilities';
const HEALTH_LAYER_ID = 'facilities-health';
const EDUCATION_LAYER_ID = 'facilities-education';

const COLOR_HEALTH = '#0891b2';      // cyan-600 — distinct from teal displacement (removed) and red incidents
const COLOR_EDUCATION = '#8b5cf6';   // violet-500

export interface FacilityLayerHandle {
  setVisible(category: FacilityCategory, visible: boolean): void;
}

function toFeatureCollection(records: FacilityRecord[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: records.map((r) => ({
      type: 'Feature',
      id: r.id,
      geometry: { type: 'Point', coordinates: [r.location.lon, r.location.lat] },
      properties: {
        id: r.id,
        category: r.category,
        subtype: r.subtype,
      },
    })),
  };
}

export async function mountFacilityLayer(
  map: Map,
  records: FacilityRecord[],
): Promise<FacilityLayerHandle> {
  const visible: Record<FacilityCategory, boolean> = { health: false, education: false };
  let layerReady = false;

  function applyVisibility(): void {
    if (!layerReady) return;
    if (map.getLayer(HEALTH_LAYER_ID)) {
      map.setLayoutProperty(HEALTH_LAYER_ID, 'visibility', visible.health ? 'visible' : 'none');
    }
    if (map.getLayer(EDUCATION_LAYER_ID)) {
      map.setLayoutProperty(EDUCATION_LAYER_ID, 'visibility', visible.education ? 'visible' : 'none');
    }
  }

  const data = toFeatureCollection(records);

  const addLayers = (): void => {
    map.addSource(SOURCE_ID, { type: 'geojson', data });

    const paintFor = (color: string) => ({
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        10, 2.5,
        13, 4,
        17, 7,
      ] as unknown as maplibregl.DataDrivenPropertyValueSpecification<number>,
      'circle-color': color,
      'circle-stroke-width': 1.2,
      'circle-stroke-color': '#ffffff',
      'circle-opacity': 0.85,
      'circle-stroke-opacity': 0.9,
    });

    map.addLayer(
      {
        id: HEALTH_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        layout: { visibility: visible.health ? 'visible' : 'none' },
        filter: ['==', ['get', 'category'], 'health'] as unknown as maplibregl.FilterSpecification,
        paint: paintFor(COLOR_HEALTH),
      },
      'incidents-circles',
    );
    map.addLayer(
      {
        id: EDUCATION_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        layout: { visibility: visible.education ? 'visible' : 'none' },
        filter: ['==', ['get', 'category'], 'education'] as unknown as maplibregl.FilterSpecification,
        paint: paintFor(COLOR_EDUCATION),
      },
      'incidents-circles',
    );
    layerReady = true;
  };

  if (map.isStyleLoaded()) addLayers();
  else map.once('load', addLayers);

  return {
    setVisible(category, v) {
      visible[category] = v;
      applyVisibility();
    },
  };
}
```

- [ ] **Step 7.2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 7.3: Commit**

```bash
git add src/map/facility-layer.ts
git commit -m "feat(map): add facility-layer with health + education sub-layers"
```

---

## Task 8: Side-panel facility mode

**Files:**
- Modify: `src/ui/side-panel.ts`

The displacement panel work in the previous (reverted) session set up the pattern of adding new panel modes. This task adds a `facility` mode using the existing `sp-body / sp-cat / sp-title / sp-meta / sp-desc / sp-sources` class taxonomy.

- [ ] **Step 8.1: Add `FacilityRecord` to imports**

Change the first import line of `src/ui/side-panel.ts` to add `FacilityRecord`:

```ts
import type { Incident, CredibilityRating, SourceOrg, DamageStatus, FacilityRecord } from '@shared/types';
```

- [ ] **Step 8.2: Add `openFacility` to the handle and a render function**

In the `SidePanelHandle` interface, add the new method:

```ts
export interface SidePanelHandle {
  openIncident(incident: Incident): void;
  openDamage(feature: DamageFeature): void;
  openFacility(record: FacilityRecord): void;
  close(): void;
}
```

Add this new private function alongside `renderIncident` and `renderDamage`, before the `return` statement of `mountSidePanel`:

```ts
function renderFacility(fac: FacilityRecord): void {
  const kicker = fac.category === 'health' ? 'Health facility' : 'Education facility';
  const subtypeLabel = fac.subtype.replace(/_/g, ' ');
  const metaParts: string[] = [];
  metaParts.push(subtypeLabel.charAt(0).toUpperCase() + subtypeLabel.slice(1));
  if (fac.governorate) metaParts.push(escapeHtml(fac.governorate));

  const nameArHtml = fac.name_ar
    ? `<div class="sp-name-ar" dir="rtl" lang="ar">${escapeHtml(fac.name_ar)}</div>`
    : '';

  const sourcesHtml = `<div class="sp-source">
    <span class="sp-source-org">${escapeHtml(ORG_LABEL[fac.source.org] ?? fac.source.org.toUpperCase())}</span>
    <a href="${escapeHtml(fac.source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(fac.source.id)}</a>
  </div>`;

  el.innerHTML = `
    <button class="sp-close" aria-label="Close panel">✕</button>
    <div class="sp-body">
      <div class="sp-cat">${kicker}</div>
      <h2 class="sp-title">${escapeHtml(fac.name)}</h2>
      ${nameArHtml}
      <div class="sp-meta">${metaParts.join(' &middot; ')}</div>

      <div class="sp-sources-label">Source</div>
      <div class="sp-sources">${sourcesHtml}</div>
    </div>
  `;
  el.classList.add('is-open');
  el.scrollTop = 0;
  attachCloseHandler();
}
```

Then wire the new method into the returned handle. Match the existing return-block style (shorthand `openIncident: renderIncident` or method shorthand — match whatever the file uses):

```ts
  return {
    openIncident: renderIncident,
    openDamage: renderDamage,
    openFacility: renderFacility,
    close() {
      el.classList.remove('is-open');
    },
  };
```

- [ ] **Step 8.3: Add CSS for the Arabic-name line**

Open `src/style.css`. Find the existing `#side-panel .sp-title` rule and add this BELOW it (alongside the other panel rules):

```css
#side-panel .sp-name-ar {
  font-family: 'Newsreader', serif;
  font-size: 1.1rem;
  color: var(--ink-2, #6b6b6b);
  margin: 0.25rem 0 0 0;
  direction: rtl;
}
```

- [ ] **Step 8.4: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 8.5: Commit**

```bash
git add src/ui/side-panel.ts src/style.css
git commit -m "feat(ui): add side-panel facility mode (health + education)"
```

---

## Task 9: Layer toggle — Health + Education checkboxes

**Files:**
- Modify: `src/ui/layer-toggle.ts`

- [ ] **Step 9.1: Extend the state + UI**

Replace the entire body of `src/ui/layer-toggle.ts` with:

```ts
export interface LayerToggleState {
  incidents: boolean;
  damage: boolean;
  health: boolean;
  education: boolean;
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
    <label><input type="checkbox" id="toggle-health" /> Health facilities</label>
    <label><input type="checkbox" id="toggle-education" /> Education facilities</label>
  `;
  parent.appendChild(el);

  const listeners: Array<(s: LayerToggleState) => void> = [];
  const state: LayerToggleState = {
    incidents: true,
    damage: true,
    health: false,
    education: false,
  };

  function notify(): void {
    for (const fn of listeners) fn({ ...state });
  }

  const incidentsBox = el.querySelector<HTMLInputElement>('#toggle-incidents')!;
  const damageBox = el.querySelector<HTMLInputElement>('#toggle-damage')!;
  const healthBox = el.querySelector<HTMLInputElement>('#toggle-health')!;
  const educationBox = el.querySelector<HTMLInputElement>('#toggle-education')!;

  incidentsBox.addEventListener('change', () => { state.incidents = incidentsBox.checked; notify(); });
  damageBox.addEventListener('change', () => { state.damage = damageBox.checked; notify(); });
  healthBox.addEventListener('change', () => { state.health = healthBox.checked; notify(); });
  educationBox.addEventListener('change', () => { state.education = educationBox.checked; notify(); });

  return {
    onChange(fn) { listeners.push(fn); },
  };
}
```

- [ ] **Step 9.2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS at this point (main.ts will need wiring updates in Task 10 — TypeScript permits the callback to ignore extra state keys at runtime).

- [ ] **Step 9.3: Commit**

```bash
git add src/ui/layer-toggle.ts
git commit -m "feat(ui): add Health + Education checkboxes to layer toggle"
```

---

## Task 10: main.ts wiring

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 10.1: Update imports**

In `src/main.ts`, change:

```ts
import { mountDamageLayer } from './map/damage-layer';
import { loadIncidents, loadDamage } from './data/loader';
```

to:

```ts
import { mountDamageLayer } from './map/damage-layer';
import { mountFacilityLayer } from './map/facility-layer';
import { loadIncidents, loadDamage, loadFacilities } from './data/loader';
```

- [ ] **Step 10.2: Load facilities**

After the existing `const damageData = await loadDamage();` block (and its console.log), add:

```ts
  loading.setStatus('Loading facilities…');
  const facilities = await loadFacilities();
  console.log(`Loaded ${facilities.length} facilities`);
```

- [ ] **Step 10.3: Mount the facility layer**

After the existing `const damage = await mountDamageLayer(...)` block, add:

```ts
  const facilityLayer = await mountFacilityLayer(map, facilities);
  // Default off — facilities are a static reference overlay.
```

- [ ] **Step 10.4: Wire the toggles into the existing onChange handler**

Find:

```ts
  layerToggle.onChange((s) => {
    damage.setVisible(s.damage);
    if (map.getLayer('incidents-circles')) {
      map.setLayoutProperty('incidents-circles', 'visibility', s.incidents ? 'visible' : 'none');
    }
  });
```

Change to:

```ts
  layerToggle.onChange((s) => {
    damage.setVisible(s.damage);
    facilityLayer.setVisible('health', s.health);
    facilityLayer.setVisible('education', s.education);
    if (map.getLayer('incidents-circles')) {
      map.setLayoutProperty('incidents-circles', 'visibility', s.incidents ? 'visible' : 'none');
    }
  });
```

- [ ] **Step 10.5: Wire click handler for the facility layers**

After the existing `map.on('click', 'damage-circles', …)` block, add:

```ts
  const facilityById = new Map(facilities.map((f) => [f.id, f]));

  for (const layerId of ['facilities-health', 'facilities-education']) {
    map.on('click', layerId, (e) => {
      if (!e.features || e.features.length === 0) return;
      const id = e.features[0].properties?.id as string | undefined;
      if (!id) return;
      const fac = facilityById.get(id);
      if (!fac) return;
      sidePanel.openFacility(fac);
    });

    map.on('mouseenter', layerId, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', layerId, () => {
      map.getCanvas().style.cursor = '';
    });
  }
```

Also extend the empty-area click handler. Find:

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

Change to:

```ts
  map.on('click', (e) => {
    const hits = map.queryRenderedFeatures(e.point, {
      layers: ['incidents-circles', 'damage-circles', 'facilities-health', 'facilities-education']
        .filter((l) => map.getLayer(l)),
    });
    if (hits.length === 0) {
      sidePanel.close();
    }
  });
```

- [ ] **Step 10.6: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 10.7: Full test suite**

Run: `pnpm test`
Expected: 106/106 pass.

- [ ] **Step 10.8: Commit**

```bash
git add src/main.ts
git commit -m "feat(client): wire facility layer + toggles + click handlers"
```

---

## Task 11: Manual smoke test

**Files:** (none modified — observe only)

- [ ] **Step 11.1: Run dev server**

Run: `pnpm dev`
Open: http://localhost:5173

- [ ] **Step 11.2: Verify default state**

Expected:
- Header: unchanged (Incidents / Buildings / Killed — no new counter).
- Layer toggle: four checkboxes — Incidents ✓, Damaged buildings ✓, Health facilities ☐, Education facilities ☐.
- Map: no facility dots visible (both default off).

- [ ] **Step 11.3: Toggle Health facilities on**

Click the Health facilities checkbox.
Expected: ~571 small cyan/teal dots appear across Gaza, denser in urban areas (Gaza City, Khan Younis, Rafah). White stroke. Sized 2.5-7px depending on zoom.

- [ ] **Step 11.4: Toggle Education facilities on**

Click the Education facilities checkbox.
Expected: ~215 small violet/purple dots appear, also clustered in urban areas. Should be visually distinct from health dots (different color).

- [ ] **Step 11.5: Click a health facility**

Click any visible cyan dot.
Expected: side panel slides in — "Health facility" kicker, facility name as title, Arabic name underneath (right-to-left, when present), subtype + governorate meta line (e.g. "Hospital · Khan Younis"), OpenStreetMap source link at the bottom.

- [ ] **Step 11.6: Click an education facility**

Click any violet dot.
Expected: "Education facility" kicker, school/university name, similar layout.

- [ ] **Step 11.7: Click incident + damage (regression)**

Click an existing incident marker — should still open Incident mode.
Click a damage dot — should still open Damage mode.

- [ ] **Step 11.8: Click empty area**

Click a blank patch of map.
Expected: side panel closes.

- [ ] **Step 11.9: Scrub the timeline (regression)**

Drag the scrubber.
Expected: incident markers + damage dots animate as before. **Facility dots stay put** (they're not time-correlated).

- [ ] **Step 11.10: Toggle both facility layers off**

Both checkboxes unchecked → dots disappear cleanly.

---

## Task 12: HANDOFF + spec sync + final commit

**Files:**
- Modify: `docs/superpowers/HANDOFF.md`
- Modify: `docs/superpowers/specs/2026-05-23-multi-source-expansion-design.md`

- [ ] **Step 12.1: Update the HANDOFF data table**

Open `docs/superpowers/HANDOFF.md`. Find the "Current data state" table. Add a row for HOT/OSM facilities after the OCHA UNOSAT row:

```markdown
| HOT/OSM (Palestine) | 2,391 health + 5,221 education features | **571 health + 215 education** in Gaza, named points only | ODbL. Refreshed monthly. |
```

Adjust the "After dedup" row totals if you want to surface facilities count there.

- [ ] **Step 12.2: Update the "Most recent session" log**

Append:

```markdown
15. `<commit-hash>` — Phase A1: HOT/OSM facilities integration (FacilityRecord type, fetch/normalize, facility-layer with health + education sub-layers, side-panel facility mode, two new layer toggles)
```

Get the latest commit hash with `git log -1 --oneline` and substitute.

- [ ] **Step 12.3: Update the spec to mark A5 as completed**

Open `docs/superpowers/specs/2026-05-23-multi-source-expansion-design.md`. In the Tier A table, update the A5 (HOT/OSM Health + Education Facilities) row's "Records" cell to reflect what we actually integrated:

Change:
```markdown
| A5 | **HOT/OSM Health + Education Facilities (Palestine)** | Reference layer, more complete than OCHA's, refreshed monthly. | ~hundreds across both categories | ODbL | https://data.humdata.org/dataset/hotosm_pse_health_facilities and `…_education_facilities` |
```

to:
```markdown
| A5 | **HOT/OSM Health + Education Facilities (Palestine)** ✅ integrated | Reference layer, refreshed monthly. | **571 health + 215 education in Gaza** | ODbL | https://data.humdata.org/dataset/hotosm_pse_health_facilities and `…_education_facilities` |
```

In the "Build sequence" section, mark Phase A1 as done. Change:

```markdown
1. A1 + A2 + A3 UNOSAT extended damage layers. Same pattern as existing `fetch-ocha.ts`. Three layers, can ship together or one at a time.
2. A4 / A5 facilities layer. Smallest visual impact; do last in Phase A.
```

to:

```markdown
1. **A5 HOT/OSM facilities** ✅ done 2026-05-23 — pivoted to facilities first after UNOSAT extended hit format friction (CERN ArcGIS down, GDB-only on HDX).
2. A1 + A2 + A3 UNOSAT extended damage layers (deferred — needs GDAL install or working FeatureServer mirror).
3. A4 OCHA Health Facilities (skipped — superseded by HOT/OSM which is more complete and updates monthly).
```

- [ ] **Step 12.4: Run the full build to be sure nothing regressed**

Run: `pnpm build`
Expected: typecheck passes, build-data runs, vite build completes. No errors.

- [ ] **Step 12.5: Final commit**

```bash
git add docs/superpowers/HANDOFF.md docs/superpowers/specs/2026-05-23-multi-source-expansion-design.md
git commit -m "docs: update HANDOFF + spec for Phase A1 (HOT/OSM facilities)"
```

---

## Self-review against the spec

Coverage check against `docs/superpowers/specs/2026-05-23-multi-source-expansion-design.md`:

- ✅ Tier A item A5 (HOT/OSM facilities) — Tasks 2-10 implement fetch, normalize, build, layer, panel, toggles
- ✅ "Type system → FacilityRecord" — Task 1.2
- ✅ "Extend SourceOrg with 'osm'" — Task 1.1
- ✅ "Static overlay, not timeline-driven" — Task 7 facility layer has no time filter; Task 11.9 regression-checks scrub independence
- ✅ "Default off" — Task 9 initializes both checkboxes off; Task 7 layer starts hidden
- ✅ "Side panel: Facility mode — name, kind, governorate, source" — Task 8 renders kicker + title + Arabic name + meta + source link
- ✅ "Health + Education distinct toggles" — Task 9 adds two checkboxes; Task 7 has two sub-layers with distinct colors
- ✅ "Only `Incident` records run through `dedupe.ts`. FacilityRecord is NOT deduplicated" — Task 5 doesn't pass facilities to dedupeIncidents

Not covered by this plan (deferred or descoped):
- A1+A2+A3 UNOSAT extended damage layers — deferred pending GDAL install or upstream service restoration; spec Build sequence updated in Task 12.3
- Header counter for facilities — intentionally omitted (per spec: facilities are reference, not cumulative)
- Tier B sources (FA/CIR/AOAV) — conditional on permission replies

## Risks acknowledged in implementation

1. **OSM data freshness vs. exhibit timeline.** OSM is the *current* state of facilities as edited by contributors. A facility tagged "hospital" today might have been built post-2023 (or destroyed since); we're plotting a snapshot, not war-era state. This is a known limitation of OSM-as-source. Trade-off acceptable for v1.
2. **Polygon facilities skipped.** Some hospitals/schools in OSM are tagged on building polygons rather than nodes. We skip these (Task 4's "non-Point" rejection). Could add centroid computation later if coverage gaps are noticeable.
3. **Arabic name rendering.** The CSS in Task 8.3 sets `direction: rtl` on the Arabic-name line. Verify in smoke test that it actually displays right-to-left. If the font lacks Arabic glyphs, the browser fallback should still render correctly.
4. **Refresh cadence.** HOT/OSM regenerates monthly. Re-running `pnpm build-data --refresh` (would need to add a `--refresh` flag to `build-data.ts` if not present; current pattern is per-script) refetches. Out of scope for this plan; manual re-download for now.

---

**Plan complete and committed to `docs/superpowers/plans/2026-05-23-phase-a1-facilities.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks here in batches with checkpoints.

**Which approach?**
