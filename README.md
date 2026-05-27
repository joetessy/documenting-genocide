# The Gaza Exhibit

An interactive web map + timeline that documents the war on Gaza since October 7, 2023.

Visitors pan, zoom, and tilt across the Gaza Strip; scrub a timeline that drives both per-incident markers and a 196,000-feature damaged-buildings layer; click any feature for a sourced per-record report; and take a guided tour through the war's major turning points.

This exhibit is single-developer, non-commercial, educational, and ad-free. Every claim on the map is backed by a public, citable source.

> **Audience.** The general public, journalists, researchers, and advocates. The exhibit is both a memorial and a documentary record.

---

## What it shows

| Layer | Count | Source | What it represents |
|---|---:|---|---|
| **Incidents** | ~8,100 unique | Airwars · UCDP · CIR · Geoconfirmed · AWSD · Wikidata | Documented attacks with date, location, casualties, and sourced narrative |
| **Damaged buildings** | 196,139 | OCHA UNOSAT (Comprehensive Damage Assessment, 11 Oct 2025) | Per-building damage classification across 14 satellite-imagery passes |
| **Civilian facilities** | 771 | HOT/OSM (health + education) | Hospitals, schools, universities |
| **Daily casualty toll** | ~960 days | Tech for Palestine (Gaza MoH aggregate) | Cumulative killed total driving the header counter |
| **Major events** | 19 curated | Wikipedia + Al Jazeera + Euronews + CFR | Turning points with focused camera, narrator, and rich side panel |

After cross-source dedup (~55 m precision, `(date, lat3, lon3)` keyed): **2,315 merges**, **5,684 unplotted**.

---

## Quick start

```bash
pnpm install
pnpm dev                  # http://localhost:5173
pnpm build-data           # refresh the data pipeline (uses cached raw data; pass --refresh to re-pull)
pnpm test                 # 182 tests across 15 files (Vitest)
pnpm typecheck            # exits 0
pnpm build                # production build: typecheck + build-data + vite build
```

The site is a static bundle. `pnpm build` produces `dist/` ready for any static host (Vercel, Netlify, GitHub Pages, S3, etc).

---

## Tech stack

- **Vite 6** · **TypeScript 5** (`strict`, `verbatimModuleSyntax`)
- **MapLibre GL JS 4.7** for rendering
- **OpenFreeMap** vector tiles (`tiles.openfreemap.org/planet`, `openmaptiles` schema; we author our own layer stack in [`src/map/style.ts`](src/map/style.ts))
- **Tailwind v4** via `@tailwindcss/vite` (lightly used; most styles live in `src/style.css`)
- **cheerio** for Airwars article narrative scraping
- **Vitest 2.1** · **pnpm** · **tsx** for running TS scripts
- **No UI framework.** Vanilla TS + DOM
- Custom Gaza polygon from **geoBoundaries** (CC BY 4.0), simplified to 161 vertices, embedded in [`src/map/gaza-boundary.ts`](src/map/gaza-boundary.ts)

The basemap is a custom pen-and-ink style ([`src/map/style.ts`](src/map/style.ts)) — pure white "paper" inside Gaza, near-black roads, black labels with white halos, slightly-warmed building greys for an atlas feel. Outside Gaza is a `#2b2826` warm dark charcoal applied via both a 2D mask polygon and a 1500 m fill-extrusion wall, so the dark frame holds at any 3D tilt.

---

## What a visitor sees

- **Pen-and-ink map** — Gaza floats as a brighter "paper" island against a darker frame. Red incident dots sized by casualty count, earth-tone damage dots, cyan health facilities, violet education facilities, and white-centred red "target" markers at the 10 curated major events with precise coordinates.
- **Header** (top-left) — large "*N* days since Oct 7" counter plus three live stats: cumulative **Killed (MoH)** / **Incidents** / **Buildings destroyed**, all gated by the scrubber date.
- **Layers & legend panel** — collapsible. Each layer toggle has an inline colour swatch so it doubles as the legend. Damage-status palette and incident-type sub-filters live inside expandable disclosures. Includes a controls hint (drag / scroll / Ctrl-drag).
- **Scrubber + dual-density histogram** (bottom centre) — date range slider with play button. Red bars = incidents/day, tan bars = damage/day. Curated event ticks above the bars; hover for details, click for a tour-style mini-stop.
- **Tour mode** — guided walkthrough of all 19 major events. Each stop varies its zoom/pitch/bearing so the sequence stays cinematic. A radar-style pulse marks each location.
- **Side panel** (right) — slides in for any clicked feature, with four render modes: incident, damage, facility, or major event (with sourced casualty figures).
- **About modal** — full attribution to every data source, with license terms.
- **First-visit onboarding overlay** — dismissed via localStorage flag.

---

## Project structure

```
gaza-exhibit/
├── data/raw/                            ~100 MB of committed source snapshots
│   ├── airwars/                         ~28 pages + ~2,709 article HTML files
│   ├── ucdp/                            gaza-events.json
│   ├── ocha/                            damage.geojson (14-pass UNOSAT data, ~56 MB)
│   ├── cir/                             incidents.geojson
│   ├── geoconfirmed/                    incidents.json
│   ├── awsd/                            incidents.csv + .json
│   ├── wikidata/                        incidents.json
│   ├── osm/                             health.geojson + education.geojson
│   └── casualty-toll/                   daily.json (MoH cumulative)
│
├── public/data/                         build output, client fetches these
│   ├── incidents.json                   ~8,100 deduped incidents (~9.5 MB)
│   ├── damage.geojson                   196,139 damage features (~55 MB)
│   ├── facilities.json                  771 facility points
│   ├── casualty-toll.json               ~960 daily MoH records
│   └── meta.json                        build manifest
│
├── scripts/                             build-time pipeline
│   ├── fetch-<source>.ts                one per source; idempotent unless --refresh
│   ├── normalize-<source>.ts            raw → Incident | DamageRecord | FacilityRecord
│   ├── scrape-airwars-articles.ts       cheerio narrative extraction
│   ├── dedupe.ts                        cross-source merge (richness-scored)
│   └── build-data.ts                    THE ORCHESTRATOR — fetches, normalizes, dedups, writes
│
├── shared/                              types + utilities used by both build and client
│   ├── types.ts                         Incident, DamageRecord, FacilityRecord, etc.
│   └── gaza-polygon.ts                  point-in-polygon test
│
├── src/                                 client
│   ├── main.ts                          entry: wires loaders → map → UI → scrubber → tour
│   ├── style.css                        design tokens + all component styles
│   ├── data/
│   │   ├── loader.ts                    fetches public/data/* into typed structures
│   │   └── timeline-events.ts           19 curated major moments
│   ├── map/
│   │   ├── map.ts                       MapLibre init, Gaza mask wall, NavigationControl
│   │   ├── style.ts                     custom pen-and-ink basemap style
│   │   ├── gaza-boundary.ts             embedded 161-vertex polygon + inverse mask
│   │   ├── marker-layer.ts              incident red-circle layer, casualty-tier sizing
│   │   ├── damage-layer.ts              196K damage circles, debounced time-gating
│   │   ├── facility-layer.ts            health + education facility points
│   │   └── timeline-event-layer.ts      curated white-centre/red-ring major-event markers
│   ├── time/
│   │   ├── time-controller.ts           date state machine + play/pause
│   │   ├── scrubber.ts                  DOM range input + play button
│   │   ├── histogram.ts                 SVG dual-series bars + event ticks
│   │   └── tour-controller.ts           guided walkthrough state machine
│   ├── ui/
│   │   ├── header.ts                    "N days since Oct 7" + Killed/Incidents/Damage stats
│   │   ├── layer-toggle.ts              combined layers + legend + controls hint panel
│   │   ├── side-panel.ts                incident / damage / facility / timeline-event render modes
│   │   ├── tooltip.ts                   hover popup over incident markers
│   │   ├── loading.ts                   splash with progressive status text
│   │   ├── about-modal.ts               sources / methodology / limitations
│   │   └── onboarding-overlay.ts        first-visit explainer
│   └── url-state.ts                     #date=YYYY-MM-DD&incident=<id> deep-linking
│
└── tests/                               15 files, 182 tests (Vitest)
```

---

## Data sources & attribution

Every source on the map is open or has explicit permission for the use we're putting it to. The About modal in-app lists every source with a clickable license line.

| Source | License | Notes |
|---|---|---|
| [Airwars](https://airwars.org/) | Non-commercial research/educational use per Airwars' published terms | Primary incident layer (1,568 records). Multi-paragraph narratives scraped from individual article pages. |
| [UCDP GED v25.1](https://ucdp.uu.se/downloads/) | Open for research/education with attribution | 3,674 Gaza events through 2024-12-31. |
| [OCHA UNOSAT — Comprehensive Damage Assessment (11 Oct 2025)](https://data.humdata.org/dataset/unosat-gaza-strip-comprehensive-damage-assessment-11-october-2025) | CC BY-IGO 3.0 | 196,139 damage features. Attribution to UNOSAT · OCHA. |
| [Centre for Information Resilience](https://www.info-res.org/israel-gaza-war/maps/israel-gaza-conflict-map/) | Explicit written permission | 1,053 records. Used with permission from Hannah at CIR (2026). |
| [Geoconfirmed](https://geoconfirmed.org/) | Per public API terms; attribution requested | 3,720 records via KMZ export. |
| [Aid Worker Security Database](https://www.aidworkersecurity.org/) | Free for non-commercial research with citation | 528 aid-worker incidents. Cite as: *Humanitarian Outcomes (year), Aid Worker Security Database, aidworkersecurity.org*. |
| [Wikidata](https://www.wikidata.org/) | CC0 | 38 structured records. |
| [Wikipedia](https://en.wikipedia.org/) | CC BY-SA 4.0 | Article-lead text for Wikidata-anchored records. Attributed to "Wikipedia contributors". |
| [HOT/OSM (Humanitarian Data Exchange)](https://data.humdata.org/) | ODbL | Health + education facilities. © OpenStreetMap contributors. |
| [Tech for Palestine](https://data.techforpalestine.org/) | Public open data (MoH aggregate) | ~960 daily cumulative casualty records. |
| [OpenFreeMap](https://openfreemap.org/) | Open basemap tiles | Vector tile source. |
| [geoBoundaries](https://www.geoboundaries.org/) | CC BY 4.0 | Gaza administrative polygon (simplified to 161 vertices). |
| [Newsreader](https://fonts.google.com/specimen/Newsreader) · [Inter](https://fonts.google.com/specimen/Inter) | OFL | Typography. |

**Note:** the CIR layer is the only source that requires explicit written permission; we obtained it. Forensic Architecture and AOAV had drafts prepared for permission but are not currently integrated.

---

## Build pipeline (`pnpm build-data`)

The pipeline is fully scripted and runs at build time only — no server-side runtime. It produces the JSON / GeoJSON files in `public/data/` that the client fetches.

```
   ┌────────────────────────────────────────────────────────────────────┐
   │                       pnpm build-data                              │
   ├────────────────────────────────────────────────────────────────────┤
   │                                                                    │
   │   fetch-<source>.ts (idempotent; cached in data/raw/<source>/)     │
   │           │                                                        │
   │           ▼                                                        │
   │   normalize-<source>.ts  →  Incident | DamageRecord | FacilityRecord
   │           │                                                        │
   │           ▼                                                        │
   │   dedupe.ts  (PRECISION ≈ 55 m, ties broken by richness score)     │
   │           │                                                        │
   │           ▼                                                        │
   │   Oct-7-2023 clip + per-source counts + unplotted bookkeeping      │
   │           │                                                        │
   │           ▼                                                        │
   │   public/data/{incidents.json, damage.geojson, facilities.json,    │
   │                casualty-toll.json, meta.json}                      │
   │                                                                    │
   └────────────────────────────────────────────────────────────────────┘
```

Each source obeys the same contract:

1. **`fetch-<source>.ts`** exports `fetch<Source>({ refresh?: boolean })`. Writes raw payload to `data/raw/<source>/`. Skips if files exist unless `--refresh` is passed. Every fetcher is also CLI-runnable.
2. **`normalize-<source>.ts`** exports pure normalize functions returning `Incident | null` (or `DamageRecord | null`, `FacilityRecord | null`). Returns `null` for missing coords, unparsable dates, or points outside the Gaza polygon. Easy to TDD.
3. **`tests/normalize-<source>.test.ts`** — Vitest covers: happy path, missing coords, outside polygon, malformed dates, category mapping, source URL extraction.
4. Wired into `build-data.ts` in three places: import, load helper, normalize loop. Add to dedupe input + `meta.source_counts`.

If you're adding a new source, [`fetch-geoconfirmed.ts`](scripts/fetch-geoconfirmed.ts) + [`normalize-geoconfirmed.ts`](scripts/normalize-geoconfirmed.ts) is a particularly clean template.

---

## Conventions

- **Extension-less local TS imports.** Use `from './foo'`, never `from './foo.ts'` (`allowImportingTsExtensions: false`).
- **2 spaces, single quotes, Conventional Commits.**
- **TDD where logic exists.** Each fetch source has a paired normalize + Vitest spec.
- **Each task ends with a commit.** Most work is one logical change per commit.
- **`data/raw/`** is committed (~100 MB total). Raw snapshots are frozen so builds are reproducible without re-fetching.
- **Geolocated data only.** Per-name memorial views without coordinates are out of scope for the map. A non-map memorial panel may be added later as a companion.

---

## Architecture notes

A few decisions that have bitten this codebase before and may bite again:

- **Safari rate-limits `history.replaceState()`** to ~100 calls per 10 s. The scrubber's URL-hash update is debounced 300 ms so a fast drag doesn't exceed the limit.
- **MapLibre's `setFilter()` on the 196 K-feature damage layer costs 50–300 ms per call.** Damage filter updates are debounced 120 ms; markers, header, and the URL hash all stay responsive during a drag while the damage layer catches up after the user pauses.
- **MapLibre `within` filters can't be combined with legacy filters.** [`map.ts`](src/map/map.ts) sets the filter to the `within` expression directly — combining throws "within not allowed".
- **3D-tilted clicks need padding.** A bbox of `±6 px` around the click point is used by the click router in `main.ts` so a tilted user can still hit a foreshortened dot.
- **One click handler at a time.** Multiple `map.on('click', layer, ...)` handlers fire in registration order and overwrite each other. The current design uses one click handler that calls `queryRenderedFeatures` with a layer priority list. Append to `CLICK_LAYER_PRIORITY` rather than adding per-layer handlers.
- **Damage layer's "Buildings destroyed" stat counts only `status === 'destroyed'`** (severe/moderate/possibly are visible but excluded from the headline number).
- **Killed counter uses MoH cumulative totals**, not a sum of per-incident `killed` fields. Per-incident reporting only covers a fraction of events; summing them would undercount by an order of magnitude.
- **`pmtiles` is a dependency but unused.** Retained from a retired protomaps experiment; safe to remove if future cleanup wants the tree trimmed.

---

## Useful one-liners

```bash
# Refresh just one source while leaving the rest cached:
tsx scripts/fetch-airwars.ts --refresh

# Run one test file in watch mode while iterating:
pnpm test:watch tests/normalize-cir.test.ts

# Inspect the latest build manifest:
cat public/data/meta.json

# Count plotted incidents by source (post-dedup):
node -e "
  const d = require('./public/data/incidents.json');
  const c = {};
  for (const i of d) for (const s of i.sources) c[s.org] = (c[s.org] || 0) + 1;
  console.log(c);
"

# See the unplotted-coord-rate per source during a build:
pnpm build-data 2>&1 | grep -E '(Normalized|Unplotted)'
```

---

## Roadmap

In rough priority order:

1. **Generate `og-card.png`** — the `og:image` and `twitter:image` tags currently 404. A 1200×630 PNG (styled map screenshot with headline numbers) before any wider sharing.
2. **Send permission emails** to Forensic Architecture and AOAV for their per-incident datasets. Long lead time; worth kicking off early.
3. **Service-worker tile caching** for reliability on slow / intermittent networks. The map is the single biggest UX risk if tiles fail.
4. **Mobile responsive layout.** Stacked vertical, larger touch targets, simpler camera. Two-column on tablet+.
5. **Memorial integration** with Tech for Palestine's `killed-in-gaza` list — not a map layer, a separate "names" panel.

---

## Acknowledgments

This exhibit only exists because of the journalists, researchers, and human-rights workers who put themselves at risk to document this war. Particular thanks to:

- **Airwars** for the incident catalogue and narratives.
- **Hannah and the CIR team** for granting us permission to use the Israel-Gaza Conflict Map data.
- **UNOSAT and OCHA** for the open damage assessment.
- **Tech for Palestine** for aggregating the MoH casualty toll into a clean public dataset.
- **OpenFreeMap** for an open vector-tile basemap that makes projects like this possible.
- **The OSM and Wikipedia/Wikidata communities** for the underlying geographic and structured data.

---

## License

Source code is provided for educational and research use. **Data sources retain their own licenses** (see the Data sources table above); the in-app About modal lists each with attribution requirements. Any reuse of the data must follow the source's license — do not redistribute under more permissive terms than the original.
