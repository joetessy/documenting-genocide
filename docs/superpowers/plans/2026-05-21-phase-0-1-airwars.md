# The Gaza Exhibit — Phase 0 + Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a static-site Gaza Exhibit with a Gaza-bounded MapLibre map, ~2,700 Airwars incidents rendered as red markers, a time scrubber with playback and event-density histogram, hover tooltip, click-to-open side panel with source attribution, URL deep-linking, and a loading screen.

**Architecture:** Static site (Vite + TypeScript + Tailwind v4, no UI framework). Build-time data pipeline fetches Airwars's WordPress REST API, normalizes each record into a unified `Incident` type, writes to `public/data/`. Client loads JSON, mounts MapLibre with custom muted-cartographic style, renders incidents as a marker layer driven by a `TimeController` state machine.

**Tech Stack:** Vite 6, TypeScript 5, Tailwind v4, MapLibre GL JS, pmtiles, tsx, Zod, Vitest, pnpm.

**Scope:** This plan covers **Phase 0 (Scaffold)** and **Phase 1 (Airwars end-to-end)** from the design spec ([2026-05-21-gaza-exhibit-design.md](../specs/2026-05-21-gaza-exhibit-design.md)). Phases 2 (ACLED + dedup), 3 (OCHA damage), and 4 (polish + mobile) will be planned separately after Phase 1 ships, when we have real data behavior to inform decisions.

**Explicitly deferred to later plans (NOT in this plan, but in the spec):**
- Marker fade-in animation (600ms) and pulse on most-recently-added markers — Phase 4 polish.
- Hex-bin clustering at low zoom — only adds it if Phase 4 perf pass shows it's needed; ~2,000 circles render fine in MapLibre without clustering.
- Layer toggle UI (Incidents / Damage / 3D Buildings) — Phase 3, when there's actually more than one layer to toggle.
- Mobile responsive layout — Phase 4.

**Reference docs:**
- Design spec: `docs/superpowers/specs/2026-05-21-gaza-exhibit-design.md`
- Reference project (matching aesthetic / stack): `../gazas-children`
- Airwars data caveats: no public API docs; coords missing on ~30-60% of records (we will measure and design the loading screen around the count of plotted vs. unplotted incidents)

---

## File Structure

```
gaza-exhibit/
├── .gitignore                          (already exists)
├── .env.example                        NEW
├── README.md                           NEW
├── package.json                        NEW
├── tsconfig.json                       NEW
├── vite.config.ts                      NEW
├── vitest.config.ts                    NEW
├── index.html                          NEW
│
├── docs/superpowers/
│   ├── specs/2026-05-21-gaza-exhibit-design.md   (exists)
│   └── plans/2026-05-21-phase-0-1-airwars.md     (this file)
│
├── scripts/
│   ├── fetch-airwars.ts                NEW  — pulls raw WP REST data, caches to data/raw/airwars/
│   ├── normalize-airwars.ts            NEW  — maps raw record → unified Incident
│   └── build-data.ts                   NEW  — orchestrator: fetch → normalize → write
│
├── shared/
│   └── types.ts                        NEW  — Incident, Source, DamageRecord, Meta (shared client+scripts)
│
├── data/raw/airwars/                   NEW (committed — frozen snapshot of source API responses)
│   ├── page-001.json                   NEW (minified)
│   ├── ... (~28 pages)
│   └── taxonomies.json                 NEW
│
├── public/data/
│   ├── incidents.json                  NEW (generated, committed)
│   └── meta.json                       NEW (generated, committed)
│
├── src/
│   ├── main.ts                         NEW  — entry, wires everything
│   ├── style.css                       NEW  — Tailwind imports + custom
│   ├── vite-env.d.ts                   NEW
│   ├── data/
│   │   └── loader.ts                   NEW  — fetch /data/incidents.json + parse
│   ├── map/
│   │   ├── map.ts                      NEW  — MapLibre init, bounds, camera
│   │   ├── style.ts                    NEW  — muted cartographic JSON style
│   │   └── marker-layer.ts             NEW  — render incidents by date filter
│   ├── time/
│   │   ├── time-controller.ts          NEW  — state + clock + listeners
│   │   ├── scrubber.ts                 NEW  — DOM track + play/pause UI
│   │   └── histogram.ts                NEW  — event density bars under track
│   ├── ui/
│   │   ├── tooltip.ts                  NEW  — hover tooltip
│   │   ├── side-panel.ts               NEW  — click-to-open incident detail
│   │   └── loading.ts                  NEW  — loading screen
│   └── url-state.ts                    NEW  — URL hash deep-link
│
└── tests/
    ├── normalize-airwars.test.ts       NEW
    ├── time-controller.test.ts         NEW
    ├── histogram.test.ts               NEW
    └── url-state.test.ts               NEW
```

---

## Conventions

- **Indentation:** 2 spaces.
- **Strings:** single quotes in TS, except JSON.
- **Commits:** Conventional Commits — `feat:`, `fix:`, `chore:`, `test:`, `docs:`.
- **Each task ends with a commit.** No exceptions — even failing-test commits are fine; they document the TDD step.
- **TDD where pure logic exists** (normalize, time-controller, histogram, url-state). For rendering modules (map, markers, scrubber DOM, tooltip, side-panel) verify by running `pnpm dev` and clicking around — note explicit verification steps.

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `src/main.ts`, `src/style.css`, `src/vite-env.d.ts`, `README.md`, `.env.example`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "gaza-exhibit",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "description": "An interactive exhibit documenting the war on Gaza.",
  "scripts": {
    "dev": "vite",
    "build": "pnpm run build-data && vite build && tsc --noEmit",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "build-data": "tsx scripts/build-data.ts"
  },
  "dependencies": {
    "maplibre-gl": "^4.7.0",
    "pmtiles": "^3.2.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "@types/node": "^22.0.0",
    "tailwindcss": "^4.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vite": "^6.0.0",
    "vitest": "^2.1.0",
    "zod": "^3.23.0"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "allowImportingTsExtensions": false,
    "noEmit": true,
    "types": ["vite/client", "node"],
    "paths": {
      "@shared/*": ["./shared/*"]
    },
    "baseUrl": "."
  },
  "include": ["src", "shared", "scripts", "tests"]
}
```

- [ ] **Step 3: Write `vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [tailwindcss()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './shared'),
    },
  },
});
```

- [ ] **Step 4: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './shared'),
    },
  },
});
```

- [ ] **Step 5: Write `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>The Gaza Exhibit</title>
    <meta name="description" content="An interactive map documenting the war on Gaza." />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 6: Write `src/main.ts`** (stub — will grow over later tasks)

```ts
import './style.css';

const app = document.getElementById('app');
if (app) {
  app.textContent = 'The Gaza Exhibit — scaffold OK';
}
```

- [ ] **Step 7: Write `src/style.css`**

```css
@import 'tailwindcss';

html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
  background: #f4ede0;
  color: #3a3530;
}

#app {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: relative;
}
```

- [ ] **Step 8: Write `src/vite-env.d.ts`**

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 9: Write `.env.example`**

```
# Optional: Airwars contact email for User-Agent header (per their methodology page).
# Set in .env (gitignored). Falls back to a generic UA if unset.
AIRWARS_CONTACT_EMAIL=
```

- [ ] **Step 10: Write `README.md`**

```markdown
# The Gaza Exhibit

An interactive web exhibit documenting the war on Gaza. Visitors pan and zoom across a map of Gaza, scrub a timeline from Oct 7 2023 to present, and click incident markers to read each documented attack with verifiable sources.

## Stack

- Vite + TypeScript + Tailwind v4 (no UI framework)
- MapLibre GL JS + pmtiles
- Build-time data pipeline (Airwars WordPress REST API today; ACLED + OCHA in later phases)

## Scripts

```sh
pnpm install
pnpm build-data   # fetch Airwars + write public/data/
pnpm dev          # start Vite dev server
pnpm build        # build-data + vite build + typecheck
pnpm test         # vitest run
pnpm typecheck    # tsc --noEmit
```

`pnpm build` runs `build-data` first so production deploys always embed a fresh data snapshot.

## Data sources

- [Airwars](https://airwars.org/) civilian-harm incidents (~2,700 Gaza records). No public API docs; we use the WordPress REST API at `https://airwars.org/wp-json/wp/v2/civ?country=767`. Attribution required.

## Design

See [docs/superpowers/specs/2026-05-21-gaza-exhibit-design.md](docs/superpowers/specs/2026-05-21-gaza-exhibit-design.md).
```

- [ ] **Step 11: Install dependencies**

```bash
pnpm install
```

Expected: lockfile created, `node_modules/` populated, no errors.

- [ ] **Step 12: Verify the dev server boots**

```bash
pnpm dev
```

Expected: Vite prints a local URL (typically `http://localhost:5173`). Visit it. Page shows "The Gaza Exhibit — scaffold OK" on the cream background. Stop with Ctrl-C.

- [ ] **Step 13: Verify typecheck**

```bash
pnpm typecheck
```

Expected: exits 0 with no output.

- [ ] **Step 14: Commit**

```bash
git add .
git commit -m "chore: scaffold Vite + TS + Tailwind + Vitest"
```

---

## Task 2: Shared types module

**Files:**
- Create: `shared/types.ts`

- [ ] **Step 1: Write `shared/types.ts`**

```ts
// Unified types shared between build scripts and client.
// The Incident type is the lingua franca: every source (Airwars now,
// ACLED/OCHA later) normalizes into this shape.

export type Governorate =
  | 'gaza_city'
  | 'north_gaza'
  | 'deir_al_balah'
  | 'khan_younis'
  | 'rafah';

export type IncidentCategory =
  | 'airstrike'
  | 'shelling'
  | 'ground_op'
  | 'attack_on_aid'
  | 'detention'
  | 'other';

export type SourceOrg = 'airwars' | 'acled' | 'ocha';

export type CredibilityRating = 'fair' | 'weak' | 'contested' | 'confirmed';

export interface SourceAttribution {
  org: SourceOrg;
  id: string;
  url: string;
  rating?: CredibilityRating;
}

export interface Casualties {
  killed: number | null;
  injured: number | null;
  killed_children: number | null;
  killed_women: number | null;
}

export interface IncidentLocation {
  lat: number;
  lon: number;
  name?: string;
  governorate?: Governorate;
}

export interface Incident {
  id: string;
  date: string;          // ISO YYYY-MM-DD
  location: IncidentLocation;
  category: IncidentCategory;
  casualties: Casualties;
  description: string;
  sources: SourceAttribution[];
}

export interface BuildMeta {
  build_date: string;          // ISO datetime
  source_counts: Partial<Record<SourceOrg, number>>;
  dedup_merges: number;
  unplotted_count: number;     // records discarded for missing coordinates
}
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add shared/types.ts
git commit -m "feat: define unified Incident schema"
```

---

## Task 3: Boot MapLibre with Gaza-bounded camera (visual milestone)

This is the first end-to-end milestone — proves the map renders, the camera is correctly bounded, and the protomaps tile pipeline works. No data yet.

**Files:**
- Create: `src/map/map.ts`
- Modify: `src/main.ts`, `src/style.css`

- [ ] **Step 1: Add MapLibre CSS to `src/style.css`** (append)

```css
@import 'maplibre-gl/dist/maplibre-gl.css';

#map {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
```

- [ ] **Step 2: Write `src/map/map.ts`**

We use protomaps' public hosted PMTiles file for the basemap, with a temporary OSM-bright style. Custom muted styling lands in Task 8.

```ts
import maplibregl, { Map } from 'maplibre-gl';
import { Protocol } from 'pmtiles';

const PROTOMAPS_TILES = 'https://demo-bucket.protomaps.com/v3.pmtiles';

// Gaza Strip bounding box (a little generous so the user can pan the edges in).
// SW corner, NE corner.
const GAZA_BOUNDS: [[number, number], [number, number]] = [
  [34.20, 31.20],  // SW: south of Rafah, west of coast
  [34.60, 31.60],  // NE: north of Beit Hanoun, east of border
];

const GAZA_CENTER: [number, number] = [34.40, 31.45];

export function mountMap(container: HTMLElement): Map {
  const protocol = new Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);

  const map = new maplibregl.Map({
    container,
    style: {
      version: 8,
      glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
      sources: {
        protomaps: {
          type: 'vector',
          url: `pmtiles://${PROTOMAPS_TILES}`,
          attribution:
            '<a href="https://protomaps.com">Protomaps</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        },
      },
      // Placeholder layers — Task 8 replaces with the muted cartographic style.
      layers: [
        { id: 'background', type: 'background', paint: { 'background-color': '#f4ede0' } },
        {
          id: 'water',
          type: 'fill',
          source: 'protomaps',
          'source-layer': 'water',
          paint: { 'fill-color': '#c8d4dc' },
        },
        {
          id: 'land',
          type: 'fill',
          source: 'protomaps',
          'source-layer': 'landuse',
          paint: { 'fill-color': '#dcc8a0', 'fill-opacity': 0.3 },
        },
      ],
    },
    center: GAZA_CENTER,
    zoom: 10,
    pitch: 30,
    bearing: 0,
    maxBounds: GAZA_BOUNDS,
    minZoom: 9,
    maxZoom: 17,
  });

  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
  return map;
}
```

- [ ] **Step 3: Update `src/main.ts`**

```ts
import './style.css';
import { mountMap } from './map/map.ts';

const app = document.getElementById('app');
if (!app) throw new Error('#app element not found');

const mapEl = document.createElement('div');
mapEl.id = 'map';
app.appendChild(mapEl);

mountMap(mapEl);
```

- [ ] **Step 4: Run `pnpm dev` and verify visually**

```bash
pnpm dev
```

Expected:
- Map renders covering full viewport.
- Camera centered roughly over the Gaza Strip with a slight tilt.
- You can pan/zoom/rotate but the camera stays within Gaza-area bounds.
- Mediterranean visible to the west, slight tint of land.

If the protomaps demo URL is unreachable, try `https://r2-public.protomaps.com/protomaps-sample-datasets/protomaps-basemap-opensource-20230408.pmtiles` as a substitute; if neither works, mark as a blocker and contact maintainer — do not fall back to Mapbox.

- [ ] **Step 5: Verify typecheck**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/ public/ index.html
git commit -m "feat: boot MapLibre with Gaza-bounded camera"
```

---

## Task 4: `fetch-airwars.ts` — pull raw incidents and cache

**Files:**
- Create: `scripts/fetch-airwars.ts`

This script pages through Airwars' WP REST API and writes raw JSON pages to `data/raw/airwars/`. It's idempotent (re-runs skip already-cached pages by default; pass `--refresh` to force re-fetch).

- [ ] **Step 1: Write `scripts/fetch-airwars.ts`**

```ts
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const BASE = 'https://airwars.org/wp-json/wp/v2/civ';
const COUNTRY_ID = 767;           // Palestinian Territories
const PER_PAGE = 100;
const OUT_DIR = 'data/raw/airwars';

const FIELDS = [
  'id',
  'date',
  'modified',
  'slug',
  'link',
  'title',
  'acf',
  'country',
  'belligerent',
  'strike_type',
  'civilian_harm_status',
  'geolocation_status',
  'casualty',
  'munition',
].join(',');

function userAgent(): string {
  const email = process.env.AIRWARS_CONTACT_EMAIL;
  const contact = email ? ` (contact: ${email})` : '';
  return `gaza-exhibit/0.1 build-time-fetch${contact}`;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function fetchPage(page: number): Promise<{ records: unknown[]; totalPages: number }> {
  const url = `${BASE}?country=${COUNTRY_ID}&per_page=${PER_PAGE}&page=${page}&_fields=${FIELDS}`;
  const res = await fetch(url, { headers: { 'User-Agent': userAgent(), Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Airwars fetch failed: page=${page} status=${res.status}`);
  const totalPages = Number(res.headers.get('X-WP-TotalPages') ?? '0');
  const records = (await res.json()) as unknown[];
  return { records, totalPages };
}

async function fetchTaxonomy(slug: string): Promise<Record<string, { name: string; slug: string }>> {
  // Resolve term IDs to human names for civilian_harm_status, strike_type, etc.
  const url = `https://airwars.org/wp-json/wp/v2/${slug}?per_page=100&_fields=id,name,slug`;
  const res = await fetch(url, { headers: { 'User-Agent': userAgent() } });
  if (!res.ok) throw new Error(`Taxonomy fetch failed: ${slug} status=${res.status}`);
  const terms = (await res.json()) as Array<{ id: number; name: string; slug: string }>;
  const out: Record<string, { name: string; slug: string }> = {};
  for (const t of terms) out[String(t.id)] = { name: t.name, slug: t.slug };
  return out;
}

export async function fetchAirwars(opts: { refresh?: boolean } = {}): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });

  // Taxonomies first — small, always re-fetch.
  const taxonomies = {
    civilian_harm_status: await fetchTaxonomy('civilian_harm_status'),
    strike_type: await fetchTaxonomy('strike_type'),
    casualty: await fetchTaxonomy('casualty'),
  };
  // Minified — files are committed to the repo, keep size down.
  await writeFile(join(OUT_DIR, 'taxonomies.json'), JSON.stringify(taxonomies));

  // First page tells us total pages.
  const first = await fetchPage(1);
  await writeFile(join(OUT_DIR, 'page-001.json'), JSON.stringify(first.records));
  console.log(`Fetched page 1/${first.totalPages} (${first.records.length} records)`);

  for (let p = 2; p <= first.totalPages; p++) {
    const path = join(OUT_DIR, `page-${String(p).padStart(3, '0')}.json`);
    if (!opts.refresh && (await fileExists(path))) {
      console.log(`Skipping page ${p}/${first.totalPages} (cached)`);
      continue;
    }
    await sleep(500);  // ~2 req/s throttle, polite to Cloudflare
    const { records } = await fetchPage(p);
    await writeFile(path, JSON.stringify(records));
    console.log(`Fetched page ${p}/${first.totalPages} (${records.length} records)`);
  }
  console.log('Airwars fetch complete.');
}

// CLI entry
if (import.meta.url === `file://${process.argv[1]}`) {
  const refresh = process.argv.includes('--refresh');
  fetchAirwars({ refresh }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 2: Run the fetcher manually**

```bash
pnpm tsx scripts/fetch-airwars.ts
```

Expected:
- Creates `data/raw/airwars/taxonomies.json` (small, ~few KB).
- Creates `data/raw/airwars/page-001.json` through `page-028.json` (approx — depends on current count).
- Each page contains an array of records.
- Final log line: "Airwars fetch complete."
- Total time: ~30-60 seconds (throttled).

If Cloudflare returns HTML challenges (`<title>Just a moment...</title>`), reduce throughput by increasing the sleep to 1000ms and retry. If it persists, set `AIRWARS_CONTACT_EMAIL` in `.env` for a more polite UA.

- [ ] **Step 3: Spot-check the cached data**

```bash
ls data/raw/airwars/ | head
node -e "const d = require('./data/raw/airwars/page-001.json'); console.log('first record id:', d[0]?.id, 'date:', d[0]?.acf?.incident_date, 'has geo:', !!d[0]?.acf?.geolocations?.length)"
```

Expected: a page count near 27-28, and the first record should print an id, a YYYYMMDD date, and `true`/`false` for geo presence.

- [ ] **Step 4: Verify typecheck**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 5: Commit (including the raw data snapshot)**

```bash
git add scripts/fetch-airwars.ts data/raw/airwars/
git commit -m "feat: fetch Airwars Gaza incidents and commit raw snapshot"
```

Note: **`data/raw/airwars/` IS committed**. This freezes a snapshot of the upstream API responses so that:
- Every developer (and CI) starts with the data — no extra requests to Airwars.
- Normalize/dedup changes in Phase 2+ can be re-run against the same data without re-fetching.
- The repo is auditable: anyone can verify our normalization is faithful to the original responses.

To refresh later (when Airwars publishes new incidents), run `pnpm tsx scripts/fetch-airwars.ts --refresh` and commit the new pages.

---

## Task 5: `normalize-airwars.ts` (TDD)

The heart of the data pipeline. Maps one raw Airwars record to one `Incident`. Drops records without coordinates (counted in `unplotted_count`).

**Files:**
- Create: `scripts/normalize-airwars.ts`, `tests/normalize-airwars.test.ts`

- [ ] **Step 1: Write the failing test** at `tests/normalize-airwars.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { normalizeAirwarsRecord, parseAirwarsDate, pickPrimaryCoord } from '../scripts/normalize-airwars.ts';

const TAXONOMIES = {
  civilian_harm_status: {
    '837': { name: 'Fair', slug: 'fair' },
    '838': { name: 'Weak', slug: 'weak' },
    '839': { name: 'Contested', slug: 'contested' },
    '840': { name: 'Confirmed', slug: 'confirmed' },
  },
  strike_type: {
    '432': { name: 'Airstrike and/or Artillery', slug: 'airstrike-artillery' },
    '433': { name: 'Ground operation', slug: 'ground-operation' },
  },
  casualty: {},
};

const SAMPLE_RECORD = {
  id: 93656,
  link: 'https://airwars.org/civilian-casualties/ispt0097-october-10-2023/',
  title: { rendered: 'ISPT0097 – October 10, 2023' },
  civilian_harm_status: [837],
  strike_type: [432],
  acf: {
    unique_reference_code: 'ISPT0097',
    incident_date: '20231010',
    location_name: "Dr. Nasr Al-Tatar's home",
    region: 'Gaza Strip',
    governorate: '',
    latitude: '',
    longitude: '',
    geolocations: [
      {
        latitude: 31.344261,
        longitude: 34.291017,
        geolocation_accuracy: 'exact_location',
        primary_coordinate: true,
      },
    ],
    killed_injured_civilian_non_combatants: { killed_min: 2, killed_max: 2, injured_min: '', injured_max: '' },
    killed_injured_children: { killed_min: 0, killed_max: 1, injured_min: '', injured_max: '' },
    killed_injured_women: { killed_min: 1, killed_max: 1, injured_min: '', injured_max: '' },
    killed_injured_men: { killed_min: 0, killed_max: 1, injured_min: '', injured_max: '' },
  },
};

describe('parseAirwarsDate', () => {
  it('converts YYYYMMDD to ISO YYYY-MM-DD', () => {
    expect(parseAirwarsDate('20231010')).toBe('2023-10-10');
    expect(parseAirwarsDate('20240301')).toBe('2024-03-01');
  });

  it('returns null for malformed input', () => {
    expect(parseAirwarsDate('')).toBeNull();
    expect(parseAirwarsDate('2023-10-10')).toBeNull();
    expect(parseAirwarsDate('not a date')).toBeNull();
  });
});

describe('pickPrimaryCoord', () => {
  it('picks the entry with primary_coordinate=true', () => {
    const geos = [
      { latitude: 1, longitude: 1, primary_coordinate: false },
      { latitude: 2, longitude: 2, primary_coordinate: true },
      { latitude: 3, longitude: 3, primary_coordinate: false },
    ];
    expect(pickPrimaryCoord(geos)).toEqual({ lat: 2, lon: 2 });
  });

  it('falls back to first entry if none are primary', () => {
    const geos = [
      { latitude: 5, longitude: 6, primary_coordinate: false },
      { latitude: 7, longitude: 8, primary_coordinate: false },
    ];
    expect(pickPrimaryCoord(geos)).toEqual({ lat: 5, lon: 6 });
  });

  it('returns null for empty array', () => {
    expect(pickPrimaryCoord([])).toBeNull();
  });
});

describe('normalizeAirwarsRecord', () => {
  it('produces a complete Incident from a well-formed record', () => {
    const result = normalizeAirwarsRecord(SAMPLE_RECORD, TAXONOMIES);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('airwars:ISPT0097');
    expect(result!.date).toBe('2023-10-10');
    expect(result!.location.lat).toBeCloseTo(31.344261);
    expect(result!.location.lon).toBeCloseTo(34.291017);
    expect(result!.location.name).toBe("Dr. Nasr Al-Tatar's home");
    expect(result!.category).toBe('airstrike');
    expect(result!.casualties.killed).toBe(2);
    expect(result!.casualties.killed_children).toBe(1);
    expect(result!.casualties.killed_women).toBe(1);
    expect(result!.sources).toHaveLength(1);
    expect(result!.sources[0].org).toBe('airwars');
    expect(result!.sources[0].id).toBe('ISPT0097');
    expect(result!.sources[0].rating).toBe('fair');
    expect(result!.sources[0].url).toBe('https://airwars.org/civilian-casualties/ispt0097-october-10-2023/');
  });

  it('returns null when coordinates are missing (record is unplotted)', () => {
    const noGeo = { ...SAMPLE_RECORD, acf: { ...SAMPLE_RECORD.acf, geolocations: [] } };
    expect(normalizeAirwarsRecord(noGeo, TAXONOMIES)).toBeNull();
  });

  it('returns null when date is malformed', () => {
    const badDate = { ...SAMPLE_RECORD, acf: { ...SAMPLE_RECORD.acf, incident_date: '' } };
    expect(normalizeAirwarsRecord(badDate, TAXONOMIES)).toBeNull();
  });

  it('uses casualty max when min < max (conservative count)', () => {
    const range = {
      ...SAMPLE_RECORD,
      acf: {
        ...SAMPLE_RECORD.acf,
        killed_injured_civilian_non_combatants: { killed_min: 2, killed_max: 5, injured_min: 1, injured_max: 8 },
      },
    };
    const r = normalizeAirwarsRecord(range, TAXONOMIES)!;
    expect(r.casualties.killed).toBe(5);
    expect(r.casualties.injured).toBe(8);
  });

  it('maps unknown strike_type to "other"', () => {
    const unknown = { ...SAMPLE_RECORD, strike_type: [99999] };
    const r = normalizeAirwarsRecord(unknown, TAXONOMIES)!;
    expect(r.category).toBe('other');
  });

  it('maps ground-operation slug to ground_op category', () => {
    const ground = { ...SAMPLE_RECORD, strike_type: [433] };
    const r = normalizeAirwarsRecord(ground, TAXONOMIES)!;
    expect(r.category).toBe('ground_op');
  });
});
```

- [ ] **Step 2: Run the failing test**

```bash
pnpm test tests/normalize-airwars.test.ts
```

Expected: FAIL with "Cannot find module" or similar — implementation doesn't exist yet.

- [ ] **Step 3: Write `scripts/normalize-airwars.ts`**

```ts
import type {
  Incident,
  IncidentCategory,
  CredibilityRating,
  SourceAttribution,
} from '../shared/types.ts';

export interface AirwarsTaxonomies {
  civilian_harm_status: Record<string, { name: string; slug: string }>;
  strike_type: Record<string, { name: string; slug: string }>;
  casualty: Record<string, { name: string; slug: string }>;
}

interface RawGeo {
  latitude: number | string;
  longitude: number | string;
  primary_coordinate?: boolean;
  geolocation_accuracy?: string;
}

interface RawCasualtyBucket {
  killed_min?: number | string;
  killed_max?: number | string;
  injured_min?: number | string;
  injured_max?: number | string;
}

interface RawAirwarsRecord {
  id: number;
  link: string;
  title: { rendered: string };
  civilian_harm_status: number[];
  strike_type: number[];
  acf: {
    unique_reference_code?: string;
    incident_date?: string;
    location_name?: string;
    region?: string;
    governorate?: string;
    geolocations?: RawGeo[];
    killed_injured_civilian_non_combatants?: RawCasualtyBucket;
    killed_injured_children?: RawCasualtyBucket;
    killed_injured_women?: RawCasualtyBucket;
    killed_injured_men?: RawCasualtyBucket;
  };
}

export function parseAirwarsDate(yyyymmdd: string): string | null {
  if (!/^\d{8}$/.test(yyyymmdd)) return null;
  const y = yyyymmdd.slice(0, 4);
  const m = yyyymmdd.slice(4, 6);
  const d = yyyymmdd.slice(6, 8);
  const mn = Number(m);
  const dn = Number(d);
  if (mn < 1 || mn > 12 || dn < 1 || dn > 31) return null;
  return `${y}-${m}-${d}`;
}

export function pickPrimaryCoord(geos: RawGeo[]): { lat: number; lon: number } | null {
  if (!geos || geos.length === 0) return null;
  const primary = geos.find((g) => g.primary_coordinate === true) ?? geos[0];
  const lat = Number(primary.latitude);
  const lon = Number(primary.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat === 0 && lon === 0) return null;
  return { lat, lon };
}

function pickCasualtyMax(bucket: RawCasualtyBucket | undefined, key: 'killed_max' | 'injured_max'): number | null {
  if (!bucket) return null;
  const v = bucket[key];
  if (v === '' || v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const STRIKE_TYPE_TO_CATEGORY: Record<string, IncidentCategory> = {
  'airstrike-artillery': 'airstrike',
  'airstrike': 'airstrike',
  'artillery': 'shelling',
  'shelling': 'shelling',
  'ground-operation': 'ground_op',
  'detention': 'detention',
  'attack-on-aid': 'attack_on_aid',
};

function mapCategory(strikeTypeIds: number[], tax: AirwarsTaxonomies): IncidentCategory {
  for (const id of strikeTypeIds) {
    const term = tax.strike_type[String(id)];
    if (!term) continue;
    const mapped = STRIKE_TYPE_TO_CATEGORY[term.slug];
    if (mapped) return mapped;
  }
  return 'other';
}

const RATING_SLUGS: Record<string, CredibilityRating> = {
  fair: 'fair',
  weak: 'weak',
  contested: 'contested',
  confirmed: 'confirmed',
};

function mapRating(statusIds: number[], tax: AirwarsTaxonomies): CredibilityRating | undefined {
  for (const id of statusIds) {
    const term = tax.civilian_harm_status[String(id)];
    if (!term) continue;
    const slug = term.slug.toLowerCase();
    if (RATING_SLUGS[slug]) return RATING_SLUGS[slug];
  }
  return undefined;
}

export function normalizeAirwarsRecord(raw: RawAirwarsRecord, tax: AirwarsTaxonomies): Incident | null {
  const date = parseAirwarsDate(raw.acf?.incident_date ?? '');
  if (!date) return null;

  const coord = pickPrimaryCoord(raw.acf?.geolocations ?? []);
  if (!coord) return null;

  const refCode = raw.acf?.unique_reference_code ?? String(raw.id);
  const rating = mapRating(raw.civilian_harm_status ?? [], tax);

  const source: SourceAttribution = {
    org: 'airwars',
    id: refCode,
    url: raw.link,
    ...(rating ? { rating } : {}),
  };

  return {
    id: `airwars:${refCode}`,
    date,
    location: {
      lat: coord.lat,
      lon: coord.lon,
      name: raw.acf?.location_name || raw.acf?.region || undefined,
    },
    category: mapCategory(raw.strike_type ?? [], tax),
    casualties: {
      killed: pickCasualtyMax(raw.acf?.killed_injured_civilian_non_combatants, 'killed_max'),
      injured: pickCasualtyMax(raw.acf?.killed_injured_civilian_non_combatants, 'injured_max'),
      killed_children: pickCasualtyMax(raw.acf?.killed_injured_children, 'killed_max'),
      killed_women: pickCasualtyMax(raw.acf?.killed_injured_women, 'killed_max'),
    },
    description: raw.title?.rendered ?? '',
    sources: [source],
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test tests/normalize-airwars.test.ts
```

Expected: all tests pass, 9 assertions across 7 test cases.

- [ ] **Step 5: Verify typecheck**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add scripts/normalize-airwars.ts tests/normalize-airwars.test.ts
git commit -m "feat: normalize Airwars records into unified Incident type"
```

---

## Task 6: `build-data.ts` — orchestrator

Wires fetch + normalize together, writes `public/data/incidents.json` and `public/data/meta.json`.

**Files:**
- Create: `scripts/build-data.ts`
- Output: `public/data/incidents.json`, `public/data/meta.json`

- [ ] **Step 1: Write `scripts/build-data.ts`**

```ts
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fetchAirwars } from './fetch-airwars.ts';
import { normalizeAirwarsRecord, type AirwarsTaxonomies } from './normalize-airwars.ts';
import type { Incident, BuildMeta } from '../shared/types.ts';

const RAW_DIR = 'data/raw/airwars';
const OUT_DIR = 'public/data';

async function loadAirwarsPages(): Promise<unknown[]> {
  const files = (await readdir(RAW_DIR)).filter((f) => f.startsWith('page-') && f.endsWith('.json'));
  files.sort();
  const all: unknown[] = [];
  for (const f of files) {
    const data = JSON.parse(await readFile(join(RAW_DIR, f), 'utf8'));
    if (Array.isArray(data)) all.push(...data);
  }
  return all;
}

async function loadTaxonomies(): Promise<AirwarsTaxonomies> {
  return JSON.parse(await readFile(join(RAW_DIR, 'taxonomies.json'), 'utf8'));
}

async function main(): Promise<void> {
  // 1. Make sure raw cache exists. fetchAirwars is incremental — cheap if cached.
  await fetchAirwars();

  // 2. Read everything back in.
  const raws = await loadAirwarsPages();
  const taxonomies = await loadTaxonomies();
  console.log(`Loaded ${raws.length} raw Airwars records`);

  // 3. Normalize each. Drop ones without coordinates or with a malformed date.
  const incidents: Incident[] = [];
  let unplotted = 0;
  for (const raw of raws) {
    const incident = normalizeAirwarsRecord(raw as never, taxonomies);
    if (incident) incidents.push(incident);
    else unplotted++;
  }

  // 4. Sort by date ascending — the client expects this for the time scrubber.
  incidents.sort((a, b) => a.date.localeCompare(b.date));

  // 5. Write outputs.
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(join(OUT_DIR, 'incidents.json'), JSON.stringify(incidents));
  const meta: BuildMeta = {
    build_date: new Date().toISOString(),
    source_counts: { airwars: incidents.length },
    dedup_merges: 0,
    unplotted_count: unplotted,
  };
  await writeFile(join(OUT_DIR, 'meta.json'), JSON.stringify(meta, null, 2));

  console.log(`Wrote ${incidents.length} incidents to ${OUT_DIR}/incidents.json`);
  console.log(`Unplotted (no coords / bad date): ${unplotted}`);
  console.log(`Build complete.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Run the build**

```bash
pnpm build-data
```

Expected output (numbers will vary):
```
Loaded ~2700 raw Airwars records
Wrote ~1500 incidents to public/data/incidents.json
Unplotted (no coords / bad date): ~1200
Build complete.
```

If the plotted/unplotted ratio is concerning (e.g., fewer than 30% plotted), inspect a few records manually to confirm whether coords are genuinely missing or our normalizer is too strict. The expectation per Airwars's documentation: many Gaza records lack precise coords because the conflict is recent and OSINT geolocation is in progress.

- [ ] **Step 3: Spot-check the output**

```bash
node -e "const d = require('./public/data/incidents.json'); console.log('count:', d.length); console.log('first:', d[0]); console.log('last:', d[d.length-1]);"
```

Expected: a count, a first record dated 2023-10-XX (earliest in the war), a last record dated near today.

- [ ] **Step 4: Commit (including generated data)**

```bash
git add scripts/build-data.ts public/data/
git commit -m "feat: build-data orchestrator + first Airwars data snapshot"
```

---

## Task 7: Client-side `loader.ts` (TDD)

**Files:**
- Create: `src/data/loader.ts`

The loader is just a fetch + parse, but isolating it makes the rest of the codebase testable.

- [ ] **Step 1: Write `src/data/loader.ts`**

```ts
import type { Incident, BuildMeta } from '@shared/types';

export interface LoadedData {
  incidents: Incident[];
  meta: BuildMeta;
}

export async function loadIncidents(): Promise<LoadedData> {
  const [incidentsRes, metaRes] = await Promise.all([
    fetch('/data/incidents.json'),
    fetch('/data/meta.json'),
  ]);
  if (!incidentsRes.ok) throw new Error(`Failed to load incidents.json: ${incidentsRes.status}`);
  if (!metaRes.ok) throw new Error(`Failed to load meta.json: ${metaRes.status}`);
  const incidents = (await incidentsRes.json()) as Incident[];
  const meta = (await metaRes.json()) as BuildMeta;
  return { incidents, meta };
}
```

- [ ] **Step 2: Wire it into `src/main.ts`** (replace previous content)

```ts
import './style.css';
import { mountMap } from './map/map.ts';
import { loadIncidents } from './data/loader.ts';

async function start(): Promise<void> {
  const app = document.getElementById('app');
  if (!app) throw new Error('#app element not found');

  const mapEl = document.createElement('div');
  mapEl.id = 'map';
  app.appendChild(mapEl);

  const map = mountMap(mapEl);

  const { incidents, meta } = await loadIncidents();
  console.log(`Loaded ${incidents.length} incidents, build ${meta.build_date}`);
  // Marker rendering wired up in Task 9.
  void map;
}

start().catch((err) => {
  console.error(err);
  document.body.textContent = `Error: ${err.message}`;
});
```

- [ ] **Step 3: Run dev server and verify in console**

```bash
pnpm dev
```

Open browser, open devtools console. Expected: `Loaded ~1500 incidents, build 2026-05-21T…`. Map still renders.

- [ ] **Step 4: Verify typecheck**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/
git commit -m "feat: client-side loader for incidents + meta"
```

---

## Task 8: Custom MapLibre cartographic style (muted palette)

Replace the placeholder layers with the full muted-cartographic style from the spec.

**Files:**
- Create: `src/map/style.ts`
- Modify: `src/map/map.ts`

- [ ] **Step 1: Write `src/map/style.ts`**

```ts
import type { StyleSpecification, LayerSpecification } from 'maplibre-gl';

// Muted cartographic palette from the design spec.
const COLORS = {
  land: '#f4ede0',
  builtArea: '#dcc8a0',
  water: '#c8d4dc',
  border: '#8a7f6e',
  road: '#b8a785',
  roadMajor: '#9c8d6f',
  label: '#3a3530',
  labelLight: '#6e6660',
} as const;

const PROTOMAPS_TILES = 'https://demo-bucket.protomaps.com/v3.pmtiles';

const LAYERS: LayerSpecification[] = [
  { id: 'background', type: 'background', paint: { 'background-color': COLORS.land } },
  {
    id: 'landuse',
    type: 'fill',
    source: 'protomaps',
    'source-layer': 'landuse',
    paint: { 'fill-color': COLORS.builtArea, 'fill-opacity': 0.45 },
  },
  {
    id: 'water',
    type: 'fill',
    source: 'protomaps',
    'source-layer': 'water',
    paint: { 'fill-color': COLORS.water },
  },
  {
    id: 'roads-minor',
    type: 'line',
    source: 'protomaps',
    'source-layer': 'roads',
    filter: ['in', 'kind', 'minor_road', 'path'],
    paint: { 'line-color': COLORS.road, 'line-width': 0.4 },
  },
  {
    id: 'roads-major',
    type: 'line',
    source: 'protomaps',
    'source-layer': 'roads',
    filter: ['in', 'kind', 'highway', 'major_road', 'medium_road'],
    paint: { 'line-color': COLORS.roadMajor, 'line-width': 0.8 },
  },
  {
    id: 'admin-borders',
    type: 'line',
    source: 'protomaps',
    'source-layer': 'boundaries',
    paint: { 'line-color': COLORS.border, 'line-width': 0.6, 'line-dasharray': [2, 2] },
  },
  {
    id: 'place-labels',
    type: 'symbol',
    source: 'protomaps',
    'source-layer': 'places',
    minzoom: 9,
    filter: ['in', 'kind', 'city', 'town', 'locality', 'neighbourhood'],
    layout: {
      'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
      'text-font': ['Noto Sans Regular'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 9, 11, 14, 16],
      'text-anchor': 'center',
    },
    paint: {
      'text-color': COLORS.label,
      'text-halo-color': COLORS.land,
      'text-halo-width': 1.2,
    },
  },
];

export function gazaStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      protomaps: {
        type: 'vector',
        url: `pmtiles://${PROTOMAPS_TILES}`,
        attribution:
          '<a href="https://protomaps.com">Protomaps</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      },
    },
    layers: LAYERS,
  };
}
```

- [ ] **Step 2: Modify `src/map/map.ts`** to use the new style

Replace the inline `style: { ... }` block with `style: gazaStyle()` and add the import:

```ts
import maplibregl, { Map } from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import { gazaStyle } from './style.ts';

const GAZA_BOUNDS: [[number, number], [number, number]] = [
  [34.20, 31.20],
  [34.60, 31.60],
];

const GAZA_CENTER: [number, number] = [34.40, 31.45];

export function mountMap(container: HTMLElement): Map {
  const protocol = new Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);

  const map = new maplibregl.Map({
    container,
    style: gazaStyle(),
    center: GAZA_CENTER,
    zoom: 10,
    pitch: 30,
    bearing: 0,
    maxBounds: GAZA_BOUNDS,
    minZoom: 9,
    maxZoom: 17,
  });

  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
  return map;
}
```

- [ ] **Step 3: Run dev server and verify visual change**

```bash
pnpm dev
```

Expected:
- Map now shows muted cream land, dusty-blue water, warm-tan built-up areas.
- Place labels (Gaza City, Khan Younis, Rafah, Deir al-Balah, Beit Hanoun) visible at zoom 10+.
- Admin border lines visible.

If a `source-layer` name doesn't match the protomaps schema (e.g., `landuse` is empty), open the network tab while panning, find a `.pbf` tile response, and inspect what layers are present using `maplibre-gl-inspect` or a temporary `console.log` of `map.getStyle()`. Adjust layer names accordingly. The protomaps v3 schema layers are: `earth`, `natural`, `land`, `water`, `physical_line`, `roads`, `transit`, `buildings`, `places`, `boundaries`, `pois`.

- [ ] **Step 4: Verify typecheck**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/map/
git commit -m "feat: custom muted cartographic style"
```

---

## Task 9: `MarkerLayer` — render incidents on the map

Adds a GeoJSON source + circle layer for incidents. Date filtering happens in Task 11 once `TimeController` exists; for now, all incidents render.

**Files:**
- Create: `src/map/marker-layer.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Write `src/map/marker-layer.ts`**

```ts
import type { Map } from 'maplibre-gl';
import type { Incident } from '@shared/types';

const SOURCE_ID = 'incidents';
const LAYER_ID = 'incidents-circles';
const HOVERED_ID = 'incidents-hovered';

function toGeoJSON(incidents: Incident[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: incidents.map((i) => ({
      type: 'Feature',
      id: i.id,
      geometry: { type: 'Point', coordinates: [i.location.lon, i.location.lat] },
      properties: {
        id: i.id,
        date: i.date,
        name: i.location.name ?? '',
        killed: i.casualties.killed ?? 0,
        injured: i.casualties.injured ?? 0,
        category: i.category,
      },
    })),
  };
}

export interface MarkerLayerHandle {
  setVisibleDate(date: string): void;        // ISO YYYY-MM-DD; shows incidents on or before this date
  setHoveredId(id: string | null): void;
}

export function mountMarkers(map: Map, incidents: Incident[]): MarkerLayerHandle {
  const features = toGeoJSON(incidents);

  function addSourcesAndLayers(): void {
    map.addSource(SOURCE_ID, { type: 'geojson', data: features });

    map.addLayer({
      id: LAYER_ID,
      type: 'circle',
      source: SOURCE_ID,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 3, 14, 6, 17, 9],
        'circle-color': '#e63946',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.5,
        'circle-opacity': 0.9,
      },
      filter: ['<=', ['get', 'date'], '1900-01-01'],  // initially hide everything
    });

    map.addLayer({
      id: HOVERED_ID,
      type: 'circle',
      source: SOURCE_ID,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 6, 14, 10, 17, 14],
        'circle-color': '#e63946',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
        'circle-opacity': 1,
      },
      filter: ['==', ['get', 'id'], ''],
    });
  }

  if (map.isStyleLoaded()) addSourcesAndLayers();
  else map.once('load', addSourcesAndLayers);

  return {
    setVisibleDate(date: string): void {
      if (map.getLayer(LAYER_ID)) {
        map.setFilter(LAYER_ID, ['<=', ['get', 'date'], date]);
      }
    },
    setHoveredId(id: string | null): void {
      if (map.getLayer(HOVERED_ID)) {
        map.setFilter(HOVERED_ID, ['==', ['get', 'id'], id ?? '']);
      }
    },
  };
}
```

- [ ] **Step 2: Wire markers into `src/main.ts`**

```ts
import './style.css';
import { mountMap } from './map/map.ts';
import { mountMarkers } from './map/marker-layer.ts';
import { loadIncidents } from './data/loader.ts';

async function start(): Promise<void> {
  const app = document.getElementById('app');
  if (!app) throw new Error('#app element not found');

  const mapEl = document.createElement('div');
  mapEl.id = 'map';
  app.appendChild(mapEl);

  const map = mountMap(mapEl);
  const { incidents, meta } = await loadIncidents();
  console.log(`Loaded ${incidents.length} incidents, build ${meta.build_date}`);

  const markers = mountMarkers(map, incidents);

  // Temporarily reveal everything until TimeController lands in Task 11.
  const latest = incidents[incidents.length - 1]?.date ?? '2026-01-01';
  markers.setVisibleDate(latest);
}

start().catch((err) => {
  console.error(err);
  document.body.textContent = `Error: ${err.message}`;
});
```

- [ ] **Step 3: Run dev server and verify**

```bash
pnpm dev
```

Expected: hundreds to thousands of red dots cover Gaza. Densest in Gaza City and Khan Younis. Visibly Gaza-shaped clustering — proves coords are real.

- [ ] **Step 4: Verify typecheck**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/
git commit -m "feat: render Airwars incidents as red marker layer"
```

---

## Task 10: Hover tooltip

**Files:**
- Create: `src/ui/tooltip.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Write `src/ui/tooltip.ts`**

```ts
import type { Incident } from '@shared/types';

const TT_ID = 'tooltip';

function formatCount(n: number | null): string {
  if (n === null) return '–';
  return String(n);
}

export interface TooltipHandle {
  show(incident: Incident, clientX: number, clientY: number): void;
  hide(): void;
}

export function mountTooltip(parent: HTMLElement): TooltipHandle {
  const el = document.createElement('div');
  el.id = TT_ID;
  el.style.cssText = [
    'position: absolute',
    'pointer-events: none',
    'background: rgba(255, 252, 245, 0.97)',
    'border: 1px solid #8a7f6e',
    'border-radius: 4px',
    'padding: 8px 10px',
    'font-size: 12px',
    'line-height: 1.4',
    'color: #3a3530',
    'box-shadow: 0 2px 8px rgba(0,0,0,0.15)',
    'max-width: 260px',
    'z-index: 10',
    'opacity: 0',
    'transition: opacity 120ms',
  ].join(';');
  parent.appendChild(el);

  return {
    show(incident, clientX, clientY) {
      el.innerHTML = `
        <div style="font-weight: 600">${incident.date}</div>
        <div>${incident.location.name ?? incident.location.governorate ?? 'Gaza'}</div>
        <div style="margin-top: 4px">
          Killed: ${formatCount(incident.casualties.killed)} · Injured: ${formatCount(incident.casualties.injured)}
        </div>
        <div style="margin-top: 4px; color: #6e6660">${incident.sources.length} source${incident.sources.length === 1 ? '' : 's'}</div>
      `;
      el.style.left = `${clientX + 14}px`;
      el.style.top = `${clientY + 14}px`;
      el.style.opacity = '1';
    },
    hide() {
      el.style.opacity = '0';
    },
  };
}
```

- [ ] **Step 2: Wire hover handling in `src/main.ts`**

Add to `start()` after `mountMarkers`:

```ts
import { mountTooltip } from './ui/tooltip.ts';
// ...inside start():
const tooltip = mountTooltip(app);
const byId = new Map(incidents.map((i) => [i.id, i]));

map.on('mousemove', 'incidents-circles', (e) => {
  if (!e.features || e.features.length === 0) return;
  const id = e.features[0].properties?.id as string | undefined;
  if (!id) return;
  const incident = byId.get(id);
  if (!incident) return;
  map.getCanvas().style.cursor = 'pointer';
  markers.setHoveredId(id);
  tooltip.show(incident, e.originalEvent.clientX, e.originalEvent.clientY);
});

map.on('mouseleave', 'incidents-circles', () => {
  map.getCanvas().style.cursor = '';
  markers.setHoveredId(null);
  tooltip.hide();
});
```

- [ ] **Step 3: Run dev server and verify hover**

```bash
pnpm dev
```

Expected: hovering a red marker enlarges it slightly (the hovered layer) and pops up a tooltip with date, name, casualty counts. Moving off hides it.

- [ ] **Step 4: Verify typecheck**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/
git commit -m "feat: hover tooltip on marker"
```

---

## Task 11: Click → side panel

**Files:**
- Create: `src/ui/side-panel.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Write `src/ui/side-panel.ts`**

```ts
import type { Incident, CredibilityRating } from '@shared/types';

const RATING_LABELS: Record<CredibilityRating, string> = {
  fair: 'Fair',
  weak: 'Weak',
  contested: 'Contested',
  confirmed: 'Confirmed',
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

function formatCasualtyLine(killed: number | null, injured: number | null): string {
  const parts: string[] = [];
  if (killed !== null) parts.push(`${killed} killed`);
  if (injured !== null) parts.push(`${injured} injured`);
  return parts.length > 0 ? parts.join(' · ') : 'Casualty figures unavailable';
}

export interface SidePanelHandle {
  open(incident: Incident): void;
  close(): void;
}

export function mountSidePanel(parent: HTMLElement): SidePanelHandle {
  const el = document.createElement('aside');
  el.id = 'side-panel';
  el.style.cssText = [
    'position: absolute',
    'top: 16px',
    'right: 16px',
    'width: 360px',
    'max-height: calc(100vh - 32px)',
    'overflow-y: auto',
    'background: rgba(255, 252, 245, 0.98)',
    'border: 1px solid #8a7f6e',
    'border-radius: 6px',
    'padding: 20px',
    'font-size: 14px',
    'color: #3a3530',
    'box-shadow: 0 4px 16px rgba(0,0,0,0.15)',
    'transform: translateX(calc(100% + 24px))',
    'transition: transform 200ms ease',
    'z-index: 9',
  ].join(';');
  parent.appendChild(el);

  return {
    open(incident) {
      const subBits: string[] = [incident.date];
      if (incident.location.governorate) subBits.push(incident.location.governorate.replace(/_/g, ' '));

      const sourcesHtml = incident.sources
        .map((s) => {
          const rating = s.rating ? ` <span style="color:#6e6660">(rated: ${RATING_LABELS[s.rating]})</span>` : '';
          const label = s.org === 'airwars' ? `Airwars ${escapeHtml(s.id)}` : `${s.org.toUpperCase()} ${escapeHtml(s.id)}`;
          return `<li><a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer" style="color:#3a3530">${label}</a>${rating}</li>`;
        })
        .join('');

      const children = incident.casualties.killed_children;
      const women = incident.casualties.killed_women;
      const demoLine: string[] = [];
      if (children !== null) demoLine.push(`${children} ${children === 1 ? 'child' : 'children'}`);
      if (women !== null) demoLine.push(`${women} ${women === 1 ? 'woman' : 'women'}`);

      el.innerHTML = `
        <button id="side-panel-close" style="position:absolute;top:12px;right:12px;background:none;border:none;font-size:20px;cursor:pointer;color:#6e6660">×</button>
        <div style="text-transform:uppercase;letter-spacing:0.05em;font-size:11px;color:#6e6660;margin-bottom:4px">${escapeHtml(incident.category.replace(/_/g, ' '))}</div>
        <h2 style="margin:0 0 4px 0;font-size:18px;font-weight:600">${escapeHtml(incident.location.name ?? 'Incident')}</h2>
        <div style="color:#6e6660;font-size:13px;margin-bottom:16px">${subBits.join(' · ')}</div>
        <div style="margin-bottom:16px;font-size:15px;font-weight:500">${formatCasualtyLine(incident.casualties.killed, incident.casualties.injured)}</div>
        ${demoLine.length > 0 ? `<div style="margin-bottom:16px;font-size:13px;color:#6e6660">Including ${demoLine.join(', ')}</div>` : ''}
        <div style="margin-bottom:16px;line-height:1.5">${escapeHtml(incident.description)}</div>
        <div style="text-transform:uppercase;letter-spacing:0.05em;font-size:11px;color:#6e6660;margin-bottom:6px">Sources</div>
        <ul style="margin:0;padding-left:18px;font-size:13px">${sourcesHtml}</ul>
      `;
      el.style.transform = 'translateX(0)';
      const closeBtn = document.getElementById('side-panel-close');
      closeBtn?.addEventListener('click', () => {
        el.style.transform = 'translateX(calc(100% + 24px))';
      });
    },
    close() {
      el.style.transform = 'translateX(calc(100% + 24px))';
    },
  };
}
```

- [ ] **Step 2: Wire click handler in `src/main.ts`** (add after tooltip wiring)

```ts
import { mountSidePanel } from './ui/side-panel.ts';
// ...inside start():
const sidePanel = mountSidePanel(app);

map.on('click', 'incidents-circles', (e) => {
  if (!e.features || e.features.length === 0) return;
  const id = e.features[0].properties?.id as string | undefined;
  if (!id) return;
  const incident = byId.get(id);
  if (!incident) return;
  sidePanel.open(incident);
});
```

- [ ] **Step 3: Run dev server and verify**

```bash
pnpm dev
```

Expected: clicking a marker slides in a side panel from the right with full incident details + clickable source link to the Airwars record. × button closes it.

- [ ] **Step 4: Verify typecheck**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/
git commit -m "feat: side panel with full incident details + source attribution"
```

---

## Task 12: `time-controller.ts` (TDD)

The state machine for current date + listeners. Pure logic, fully testable.

**Files:**
- Create: `src/time/time-controller.ts`, `tests/time-controller.test.ts`

- [ ] **Step 1: Write the failing test** at `tests/time-controller.test.ts`

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TimeController, addDays, formatDate } from '../src/time/time-controller.ts';

describe('addDays', () => {
  it('handles same-month addition', () => {
    expect(addDays('2024-03-05', 3)).toBe('2024-03-08');
  });
  it('rolls over months', () => {
    expect(addDays('2024-03-30', 5)).toBe('2024-04-04');
  });
  it('handles negative deltas', () => {
    expect(addDays('2024-03-05', -7)).toBe('2024-02-27');
  });
});

describe('formatDate', () => {
  it('formats ISO into a human label', () => {
    expect(formatDate('2024-03-12')).toBe('Mar 12, 2024');
  });
});

describe('TimeController', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('initializes at the start date', () => {
    const tc = new TimeController({ start: '2023-10-07', end: '2024-06-01' });
    expect(tc.currentDate).toBe('2023-10-07');
  });

  it('notifies listeners when the date changes', () => {
    const tc = new TimeController({ start: '2023-10-07', end: '2024-06-01' });
    const spy = vi.fn();
    tc.onChange(spy);
    tc.setDate('2023-10-15');
    expect(spy).toHaveBeenCalledWith('2023-10-15');
  });

  it('clamps setDate to range', () => {
    const tc = new TimeController({ start: '2023-10-07', end: '2024-06-01' });
    tc.setDate('2020-01-01');
    expect(tc.currentDate).toBe('2023-10-07');
    tc.setDate('2030-01-01');
    expect(tc.currentDate).toBe('2024-06-01');
  });

  it('does not notify if setDate is a no-op', () => {
    const tc = new TimeController({ start: '2023-10-07', end: '2024-06-01' });
    const spy = vi.fn();
    tc.onChange(spy);
    tc.setDate('2023-10-07');
    expect(spy).not.toHaveBeenCalled();
  });

  it('play() advances the date on a timer', () => {
    const tc = new TimeController({ start: '2023-10-07', end: '2024-06-01', stepDaysPerSecond: 10 });
    const spy = vi.fn();
    tc.onChange(spy);
    tc.play();
    vi.advanceTimersByTime(1000);
    expect(tc.currentDate).toBe('2023-10-17');
    expect(spy).toHaveBeenCalled();
  });

  it('pause() stops advancing', () => {
    const tc = new TimeController({ start: '2023-10-07', end: '2024-06-01', stepDaysPerSecond: 10 });
    tc.play();
    vi.advanceTimersByTime(500);
    tc.pause();
    const at = tc.currentDate;
    vi.advanceTimersByTime(2000);
    expect(tc.currentDate).toBe(at);
  });

  it('play() stops at the end date', () => {
    const tc = new TimeController({ start: '2023-10-07', end: '2023-10-10', stepDaysPerSecond: 10 });
    tc.play();
    vi.advanceTimersByTime(10000);
    expect(tc.currentDate).toBe('2023-10-10');
    expect(tc.isPlaying).toBe(false);
  });
});
```

- [ ] **Step 2: Run failing test**

```bash
pnpm test tests/time-controller.test.ts
```

Expected: FAIL with module not found.

- [ ] **Step 3: Write `src/time/time-controller.ts`**

```ts
const MS_PER_DAY = 86_400_000;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export function clampDate(iso: string, min: string, max: string): string {
  if (iso < min) return min;
  if (iso > max) return max;
  return iso;
}

export interface TimeControllerOptions {
  start: string;                   // ISO YYYY-MM-DD
  end: string;
  stepDaysPerSecond?: number;      // playback rate
  initialDate?: string;
}

export type DateChangeListener = (date: string) => void;

export class TimeController {
  readonly start: string;
  readonly end: string;
  readonly stepDaysPerSecond: number;
  private _currentDate: string;
  private listeners: DateChangeListener[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(opts: TimeControllerOptions) {
    this.start = opts.start;
    this.end = opts.end;
    this.stepDaysPerSecond = opts.stepDaysPerSecond ?? 3;
    this._currentDate = clampDate(opts.initialDate ?? opts.start, opts.start, opts.end);
  }

  get currentDate(): string {
    return this._currentDate;
  }

  get isPlaying(): boolean {
    return this.timer !== null;
  }

  onChange(fn: DateChangeListener): () => void {
    this.listeners.push(fn);
    return () => {
      const i = this.listeners.indexOf(fn);
      if (i >= 0) this.listeners.splice(i, 1);
    };
  }

  setDate(date: string): void {
    const clamped = clampDate(date, this.start, this.end);
    if (clamped === this._currentDate) return;
    this._currentDate = clamped;
    for (const l of this.listeners) l(clamped);
  }

  step(deltaDays: number): void {
    this.setDate(addDays(this._currentDate, deltaDays));
  }

  play(): void {
    if (this.timer !== null) return;
    const tickMs = 100;
    const daysPerTick = (this.stepDaysPerSecond * tickMs) / 1000;
    let accumulator = 0;
    this.timer = setInterval(() => {
      accumulator += daysPerTick;
      const stepN = Math.floor(accumulator);
      if (stepN < 1) return;
      accumulator -= stepN;
      const next = addDays(this._currentDate, stepN);
      this.setDate(next);
      if (this._currentDate === this.end) this.pause();
    }, tickMs);
  }

  pause(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  togglePlay(): void {
    if (this.isPlaying) this.pause();
    else this.play();
  }
}
```

- [ ] **Step 4: Run tests to verify all pass**

```bash
pnpm test tests/time-controller.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Wire TimeController into `src/main.ts`**

Replace the temporary "reveal everything" block:

```ts
import { TimeController } from './time/time-controller.ts';
// ...inside start(), after `const markers = mountMarkers(...)`:
const firstDate = incidents[0]?.date ?? '2023-10-07';
const lastDate = incidents[incidents.length - 1]?.date ?? '2024-12-31';

const timeCtrl = new TimeController({
  start: firstDate,
  end: lastDate,
  stepDaysPerSecond: 3,
  initialDate: lastDate,  // start fully populated; the scrubber UI will let the user rewind
});

timeCtrl.onChange((date) => markers.setVisibleDate(date));
markers.setVisibleDate(timeCtrl.currentDate);
```

- [ ] **Step 6: Verify dev server still works**

```bash
pnpm dev
```

Expected: all markers visible (since initialDate = lastDate). No regression.

- [ ] **Step 7: Verify typecheck**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 8: Commit**

```bash
git add src/ tests/
git commit -m "feat: TimeController state machine with play/pause"
```

---

## Task 13: `scrubber.ts` — DOM track + play/pause UI

**Files:**
- Create: `src/time/scrubber.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Write `src/time/scrubber.ts`**

```ts
import { TimeController, formatDate, addDays } from './time-controller.ts';

function daysBetween(start: string, end: string): number {
  const s = new Date(`${start}T00:00:00Z`).getTime();
  const e = new Date(`${end}T00:00:00Z`).getTime();
  return Math.round((e - s) / 86_400_000);
}

export function mountScrubber(parent: HTMLElement, ctrl: TimeController): HTMLElement {
  const container = document.createElement('div');
  container.id = 'scrubber';
  container.style.cssText = [
    'position: absolute',
    'bottom: 16px',
    'left: 50%',
    'transform: translateX(-50%)',
    'width: min(900px, calc(100vw - 32px))',
    'background: rgba(255, 252, 245, 0.97)',
    'border: 1px solid #8a7f6e',
    'border-radius: 6px',
    'padding: 14px 18px',
    'display: grid',
    'grid-template-columns: auto 1fr auto',
    'gap: 16px',
    'align-items: center',
    'z-index: 8',
    'box-shadow: 0 2px 8px rgba(0,0,0,0.1)',
  ].join(';');

  const playBtn = document.createElement('button');
  playBtn.textContent = '▶';
  playBtn.style.cssText = 'background:none;border:1px solid #8a7f6e;color:#3a3530;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:14px';
  playBtn.setAttribute('aria-label', 'Play timeline');

  const trackWrap = document.createElement('div');
  trackWrap.style.cssText = 'position: relative; height: 32px';

  const histogramHost = document.createElement('div');
  histogramHost.id = 'histogram-host';
  histogramHost.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  trackWrap.appendChild(histogramHost);

  const track = document.createElement('input');
  track.type = 'range';
  track.min = '0';
  track.max = String(daysBetween(ctrl.start, ctrl.end));
  track.value = String(daysBetween(ctrl.start, ctrl.currentDate));
  track.style.cssText = 'width:100%;position:relative;z-index:2;cursor:pointer;accent-color:#e63946';
  track.setAttribute('aria-label', 'Date scrubber');
  trackWrap.appendChild(track);

  const label = document.createElement('div');
  label.id = 'scrubber-label';
  label.style.cssText = 'font-size:13px;font-weight:500;color:#3a3530;min-width:120px;text-align:right;font-variant-numeric:tabular-nums';
  label.textContent = formatDate(ctrl.currentDate);

  container.appendChild(playBtn);
  container.appendChild(trackWrap);
  container.appendChild(label);
  parent.appendChild(container);

  // Wire interactions.
  track.addEventListener('input', () => {
    const date = addDays(ctrl.start, Number(track.value));
    ctrl.setDate(date);
  });

  playBtn.addEventListener('click', () => {
    ctrl.togglePlay();
    playBtn.textContent = ctrl.isPlaying ? '⏸' : '▶';
  });

  // Keep the UI in sync if anything else changes the date (URL, keyboard).
  ctrl.onChange((date) => {
    track.value = String(daysBetween(ctrl.start, date));
    label.textContent = formatDate(date);
    if (!ctrl.isPlaying) playBtn.textContent = '▶';
  });

  // Keyboard shortcuts.
  document.addEventListener('keydown', (e) => {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key === ' ') {
      e.preventDefault();
      ctrl.togglePlay();
      playBtn.textContent = ctrl.isPlaying ? '⏸' : '▶';
    } else if (e.key === 'ArrowLeft') {
      ctrl.step(e.shiftKey ? -7 : -1);
    } else if (e.key === 'ArrowRight') {
      ctrl.step(e.shiftKey ? 7 : 1);
    }
  });

  return histogramHost;
}
```

- [ ] **Step 2: Wire scrubber into `src/main.ts`** (add after TimeController setup)

```ts
import { mountScrubber } from './time/scrubber.ts';
// ...inside start():
mountScrubber(app, timeCtrl);
```

- [ ] **Step 3: Run dev server and verify**

```bash
pnpm dev
```

Expected:
- Scrubber bar at the bottom of the screen.
- Date label on the right (e.g., "Mar 12, 2024").
- Dragging the track changes the visible markers — markers disappear when you scrub left.
- Play button starts forward animation; pause stops.
- Spacebar toggles play; arrow keys step.

- [ ] **Step 4: Verify typecheck**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/
git commit -m "feat: time scrubber with playback and keyboard controls"
```

---

## Task 14: `histogram.ts` — event density bars (TDD)

**Files:**
- Create: `src/time/histogram.ts`, `tests/histogram.test.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Write failing test** at `tests/histogram.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { bucketByDay } from '../src/time/histogram.ts';
import type { Incident } from '../shared/types.ts';

function makeIncident(date: string, id: string): Incident {
  return {
    id,
    date,
    location: { lat: 31.5, lon: 34.4 },
    category: 'airstrike',
    casualties: { killed: 1, injured: null, killed_children: null, killed_women: null },
    description: '',
    sources: [{ org: 'airwars', id, url: 'x' }],
  };
}

describe('bucketByDay', () => {
  it('counts incidents per day across the range', () => {
    const incidents: Incident[] = [
      makeIncident('2023-10-07', 'a'),
      makeIncident('2023-10-07', 'b'),
      makeIncident('2023-10-08', 'c'),
      makeIncident('2023-10-10', 'd'),
    ];
    const buckets = bucketByDay(incidents, '2023-10-07', '2023-10-10');
    expect(buckets).toEqual([2, 1, 0, 1]);
  });

  it('returns zeros for an empty input', () => {
    const buckets = bucketByDay([], '2023-10-07', '2023-10-09');
    expect(buckets).toEqual([0, 0, 0]);
  });

  it('ignores incidents outside the range', () => {
    const incidents: Incident[] = [
      makeIncident('2023-09-30', 'before'),
      makeIncident('2023-10-08', 'in'),
      makeIncident('2023-10-15', 'after'),
    ];
    const buckets = bucketByDay(incidents, '2023-10-07', '2023-10-10');
    expect(buckets).toEqual([0, 1, 0, 0]);
  });
});
```

- [ ] **Step 2: Run failing test**

```bash
pnpm test tests/histogram.test.ts
```

Expected: FAIL with module not found.

- [ ] **Step 3: Write `src/time/histogram.ts`**

```ts
import type { Incident } from '@shared/types';

const MS_PER_DAY = 86_400_000;

function daysBetween(start: string, end: string): number {
  const s = new Date(`${start}T00:00:00Z`).getTime();
  const e = new Date(`${end}T00:00:00Z`).getTime();
  return Math.round((e - s) / MS_PER_DAY);
}

export function bucketByDay(incidents: Incident[], start: string, end: string): number[] {
  const days = daysBetween(start, end) + 1;
  const buckets = new Array<number>(days).fill(0);
  const startMs = new Date(`${start}T00:00:00Z`).getTime();
  const endMs = new Date(`${end}T00:00:00Z`).getTime();
  for (const inc of incidents) {
    const t = new Date(`${inc.date}T00:00:00Z`).getTime();
    if (t < startMs || t > endMs) continue;
    const idx = Math.round((t - startMs) / MS_PER_DAY);
    buckets[idx]++;
  }
  return buckets;
}

export function renderHistogram(host: HTMLElement, buckets: number[]): void {
  host.innerHTML = '';
  const max = Math.max(1, ...buckets);
  const w = host.clientWidth;
  const h = host.clientHeight;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${buckets.length} ${h}`);
  svg.setAttribute('width', String(w));
  svg.setAttribute('height', String(h));
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.style.position = 'absolute';
  svg.style.inset = '0';

  for (let i = 0; i < buckets.length; i++) {
    if (buckets[i] === 0) continue;
    const bh = (buckets[i] / max) * h * 0.7;
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', String(i));
    rect.setAttribute('y', String(h - bh));
    rect.setAttribute('width', '1');
    rect.setAttribute('height', String(bh));
    rect.setAttribute('fill', '#8a7f6e');
    rect.setAttribute('fill-opacity', '0.35');
    svg.appendChild(rect);
  }
  host.appendChild(svg);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test tests/histogram.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Wire into `src/main.ts`** (after `mountScrubber`)

```ts
import { bucketByDay, renderHistogram } from './time/histogram.ts';
// ...inside start():
const histogramHost = mountScrubber(app, timeCtrl);

const buckets = bucketByDay(incidents, timeCtrl.start, timeCtrl.end);
// Wait one frame so the host has a computed width.
requestAnimationFrame(() => renderHistogram(histogramHost, buckets));
window.addEventListener('resize', () => renderHistogram(histogramHost, buckets));
```

(Also delete the standalone `mountScrubber(app, timeCtrl);` line from Task 13 — it's now assigned to `histogramHost`.)

- [ ] **Step 6: Run dev server and verify**

```bash
pnpm dev
```

Expected: under the scrubber track, you see grey vertical bars representing event density per day. Tall bars cluster in heavy days (early Oct 2023, late 2023, mid-2024, etc.).

- [ ] **Step 7: Verify typecheck**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 8: Commit**

```bash
git add src/ tests/
git commit -m "feat: event density histogram under scrubber"
```

---

## Task 15: `url-state.ts` (TDD) + loading screen + final integration

This task bundles three small concerns: URL hash deep-linking, an initial loading screen, and a final smoke check.

**Files:**
- Create: `src/url-state.ts`, `src/ui/loading.ts`, `tests/url-state.test.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Write failing test** at `tests/url-state.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { parseHash, formatHash } from '../src/url-state.ts';

describe('parseHash', () => {
  it('parses a date hash', () => {
    expect(parseHash('#date=2024-03-12')).toEqual({ date: '2024-03-12' });
  });
  it('returns empty for no hash', () => {
    expect(parseHash('')).toEqual({});
    expect(parseHash('#')).toEqual({});
  });
  it('ignores malformed dates', () => {
    expect(parseHash('#date=not-a-date')).toEqual({});
    expect(parseHash('#date=2024-13-50')).toEqual({});
  });
});

describe('formatHash', () => {
  it('formats a date into the hash', () => {
    expect(formatHash({ date: '2024-03-12' })).toBe('#date=2024-03-12');
  });
  it('returns empty hash for empty input', () => {
    expect(formatHash({})).toBe('');
  });
});
```

- [ ] **Step 2: Run failing test**

```bash
pnpm test tests/url-state.test.ts
```

Expected: FAIL with module not found.

- [ ] **Step 3: Write `src/url-state.ts`**

```ts
export interface UrlState {
  date?: string;        // ISO YYYY-MM-DD
}

const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function parseHash(hash: string): UrlState {
  if (!hash || hash === '#') return {};
  const out: UrlState = {};
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const date = params.get('date');
  if (date && DATE_RE.test(date)) out.date = date;
  return out;
}

export function formatHash(state: UrlState): string {
  const params = new URLSearchParams();
  if (state.date) params.set('date', state.date);
  const s = params.toString();
  return s ? `#${s}` : '';
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test tests/url-state.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Write `src/ui/loading.ts`**

```ts
export interface LoadingHandle {
  setStatus(text: string): void;
  destroy(): void;
}

export function mountLoading(parent: HTMLElement): LoadingHandle {
  const el = document.createElement('div');
  el.id = 'loading';
  el.style.cssText = [
    'position: absolute',
    'inset: 0',
    'background: #f4ede0',
    'display: flex',
    'align-items: center',
    'justify-content: center',
    'flex-direction: column',
    'gap: 12px',
    'z-index: 100',
    'transition: opacity 300ms',
    'font-family: ui-sans-serif, system-ui, sans-serif',
    'color: #3a3530',
  ].join(';');
  el.innerHTML = `
    <div style="font-size:18px;font-weight:500">The Gaza Exhibit</div>
    <div id="loading-status" style="font-size:13px;color:#6e6660">Loading…</div>
  `;
  parent.appendChild(el);

  return {
    setStatus(text) {
      const s = document.getElementById('loading-status');
      if (s) s.textContent = text;
    },
    destroy() {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 300);
    },
  };
}
```

- [ ] **Step 6: Wire URL state + loading into `src/main.ts`** (replace current file)

```ts
import './style.css';
import { mountMap } from './map/map.ts';
import { mountMarkers } from './map/marker-layer.ts';
import { loadIncidents } from './data/loader.ts';
import { TimeController } from './time/time-controller.ts';
import { mountScrubber } from './time/scrubber.ts';
import { bucketByDay, renderHistogram } from './time/histogram.ts';
import { mountTooltip } from './ui/tooltip.ts';
import { mountSidePanel } from './ui/side-panel.ts';
import { mountLoading } from './ui/loading.ts';
import { parseHash, formatHash } from './url-state.ts';

async function start(): Promise<void> {
  const app = document.getElementById('app');
  if (!app) throw new Error('#app element not found');

  const loading = mountLoading(app);
  loading.setStatus('Loading map…');

  const mapEl = document.createElement('div');
  mapEl.id = 'map';
  app.appendChild(mapEl);

  const map = mountMap(mapEl);

  loading.setStatus('Loading incidents from Airwars…');
  const { incidents, meta } = await loadIncidents();
  console.log(`Loaded ${incidents.length} incidents (${meta.unplotted_count} unplotted), build ${meta.build_date}`);

  const markers = mountMarkers(map, incidents);
  const tooltip = mountTooltip(app);
  const sidePanel = mountSidePanel(app);
  const byId = new Map(incidents.map((i) => [i.id, i]));

  const firstDate = incidents[0]?.date ?? '2023-10-07';
  const lastDate = incidents[incidents.length - 1]?.date ?? '2024-12-31';
  const initial = parseHash(location.hash);

  const timeCtrl = new TimeController({
    start: firstDate,
    end: lastDate,
    stepDaysPerSecond: 3,
    initialDate: initial.date ?? lastDate,
  });

  timeCtrl.onChange((date) => {
    markers.setVisibleDate(date);
    const newHash = formatHash({ date });
    if (newHash !== location.hash) {
      history.replaceState(null, '', `${location.pathname}${location.search}${newHash}`);
    }
  });
  markers.setVisibleDate(timeCtrl.currentDate);

  const histogramHost = mountScrubber(app, timeCtrl);
  const buckets = bucketByDay(incidents, timeCtrl.start, timeCtrl.end);
  requestAnimationFrame(() => renderHistogram(histogramHost, buckets));
  window.addEventListener('resize', () => renderHistogram(histogramHost, buckets));

  map.on('mousemove', 'incidents-circles', (e) => {
    if (!e.features || e.features.length === 0) return;
    const id = e.features[0].properties?.id as string | undefined;
    if (!id) return;
    const incident = byId.get(id);
    if (!incident) return;
    map.getCanvas().style.cursor = 'pointer';
    markers.setHoveredId(id);
    tooltip.show(incident, e.originalEvent.clientX, e.originalEvent.clientY);
  });
  map.on('mouseleave', 'incidents-circles', () => {
    map.getCanvas().style.cursor = '';
    markers.setHoveredId(null);
    tooltip.hide();
  });

  map.on('click', 'incidents-circles', (e) => {
    if (!e.features || e.features.length === 0) return;
    const id = e.features[0].properties?.id as string | undefined;
    if (!id) return;
    const incident = byId.get(id);
    if (!incident) return;
    sidePanel.open(incident);
  });

  // Wait for map's first render before hiding loading.
  map.once('idle', () => loading.destroy());
}

start().catch((err) => {
  console.error(err);
  document.body.textContent = `Error: ${err.message}`;
});
```

- [ ] **Step 7: Run full test suite**

```bash
pnpm test
```

Expected: all tests pass across all test files.

- [ ] **Step 8: Run typecheck**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 9: Full manual smoke check**

```bash
pnpm dev
```

Verify each of these in the browser:
- [ ] Loading screen shows briefly, then fades out.
- [ ] Muted cream/tan/blue cartographic map of Gaza renders.
- [ ] Red marker dots cover Gaza (Gaza City and Khan Younis densest).
- [ ] Bottom scrubber: dragging the slider changes which markers are visible.
- [ ] Play button starts forward animation; markers appear over time.
- [ ] Spacebar toggles play. Arrow keys step ±1 day. Shift+arrow steps ±7 days.
- [ ] Hover a marker → tooltip appears with date, location, casualty figures.
- [ ] Click a marker → side panel slides in with full details and a clickable Airwars source link.
- [ ] Reload with `#date=2023-12-01` in the URL → scrubber starts at Dec 1 2023.
- [ ] As you scrub, the URL hash updates.

If any step fails, fix and re-verify before continuing.

- [ ] **Step 10: Run a production build to confirm it bundles**

```bash
pnpm build
```

Expected:
- `build-data` runs first (uses cached pages, fast).
- Vite produces a `dist/` directory.
- TypeScript exits clean.
- Output size is well under 5 MB (mostly the incidents.json and MapLibre).

```bash
pnpm preview
```

Visit the printed URL — confirm the production build behaves identically.

- [ ] **Step 11: Commit final integration**

```bash
git add src/ tests/
git commit -m "feat: URL deep-link, loading screen, and Phase 1 integration"
```

- [ ] **Step 12: Tag the milestone**

```bash
git tag phase-1-airwars
```

---

## Phase 1 complete. What's next.

At this point the exhibit is shippable: deploy `dist/` to GitHub Pages or Netlify and you have an interactive Gaza incident map driven by Airwars data with a working timeline. Roughly ~1500-2000 plotted incidents out of ~2700 Airwars Gaza records.

**Before planning Phase 2, capture these observations from the data you now have:**

1. **What's the actual plotted/unplotted ratio?** (from `meta.json` and the build log)
2. **What does the date distribution look like?** Are there long stretches with no events that the scrubber playback feels slow through?
3. **Are the categories useful in their current taxonomy?** Or is everything mapped to `airstrike` and `other` because Airwars uses one strike type for most records?
4. **How does the page perform with ~2000 markers?** Is clustering needed at low zoom or do circles render fine?
5. **What's the smallest data file that loads acceptably fast?** If `incidents.json` is much larger than a few MB, we should investigate binary packing in Phase 2.

These observations feed into Phase 2 (ACLED + dedup) planning — particularly the dedup tuning radius, schema decisions about categories, and whether we need to introduce clustering or binary packing before adding more data.
