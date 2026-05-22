# The Gaza Exhibit — Handoff Document

**Last updated:** 2026-05-22
**Repo state:** clean
**Latest commit:** `e227241` — `feat: per-building damage detail + clickable damage layer`
**Latest tag:** `phase-1.75-multi-source` (further commits on top, not yet tagged)

---

## What this is

An interactive web exhibit that documents the war on Gaza since October 7, 2023. Visitors pan and zoom a 3D-styled map of the Gaza Strip, scrub a timeline that drives both incident markers and a damaged-buildings layer, and click any feature for a per-record report with verifiable sources.

The project is single-developer, non-commercial, educational. Reference aesthetic: `gazas-children` (the user's prior memorial piece — same Vite + TS + custom-rendering stack family).

Spec: [`docs/superpowers/specs/2026-05-21-gaza-exhibit-design.md`](specs/2026-05-21-gaza-exhibit-design.md).

---

## Quick orientation for a new agent

```bash
cd /Users/yusuf/Projects/gaza-exhibit
pnpm install
pnpm dev                  # http://localhost:5173
pnpm build-data           # refresh data pipeline (uses cached raw data; --refresh to re-pull)
pnpm test                 # 97 tests, all passing
pnpm typecheck            # exits 0
pnpm build                # production build (typecheck + build-data + vite build)
```

Architecture is static-site: build-time data pipeline writes JSON/GeoJSON to `public/data/`, client (vanilla TS + MapLibre, no UI framework) loads them and renders.

---

## Current data state

Numbers after the build:

| Source | Raw count | Plotted (post-Oct-7-2023, in Gaza bbox) | Notes |
|---|---|---|---|
| Airwars | 2,709 records | 1,590 incidents | Each plotted incident has a full multi-paragraph narrative scraped from the Airwars article page (1,624 articles assessed). |
| UCDP (Uppsala GED v25.1) | 3,820 Gaza events | 3,676 incidents | Free public CSV, no API key. Annual release ends 2024-12-31 (so 2025 is missing). |
| OCHA UNOSAT 11-Oct-2025 CDA | 198,308 features | **196,141 damaged buildings** | Each has 14 sensor passes; we extract first-damage-date + full progression. |
| **After dedup + Oct-7-2023 filter** | — | **3,540 unique incidents + 196,141 damage points** | 925 incidents are multi-source. |

The damage layer carries: id, status, first-damage-date, governorate, progression timeline (every change in damage class across the 14 sensor passes).

---

## Tech stack

- Vite 6, TypeScript 5 (strict, `verbatimModuleSyntax`), Tailwind v4
- MapLibre GL JS (rendering); OpenFreeMap (`tiles.openfreemap.org/planet`) for vector tiles
- pmtiles is installed but unused (was for the original protomaps path, retired)
- cheerio for HTML scraping (Airwars articles)
- Vitest, pnpm
- No UI framework — vanilla TS + DOM
- Custom Gaza boundary polygon from geoBoundaries (CC BY 4.0), simplified to 161 vertices

Custom MapLibre style at `src/map/style.ts` defines a muted neutral palette using OpenFreeMap's `openmaptiles` vector source. 3D building extrusion built into the style. A cream-colored fill-extrusion "wall" rises 1500m outside Gaza to occlude everything beyond the strip (3D-occlusion, not just 2D mask).

---

## Convention reminders

- **Extension-less local TS imports** — `tsconfig.json` has `allowImportingTsExtensions: false`. Always `from './foo'`, never `from './foo.ts'`.
- **2 spaces, single quotes, Conventional Commits.**
- **TDD where logic exists; manual smoke for rendering.**
- **Each task ends with a commit.**
- **`data/raw/{airwars,ucdp,ocha}/` is committed** to the repo (frozen snapshots; one-time fetches, ~80 MB total).

---

## Current UI / UX state

Visual direction: **sleek minimal**. Off-white background `#f7f6f3`, hairline borders, mostly Inter sans, Newsreader serif only for large numbers + dates + panel titles. Single accent red `#d3091e` for incident markers and emphasis.

Components mounted in `src/`:
- **Header** (top-left) — title + subtitle + three live counters (Incidents / Buildings / Killed) that update as the timeline scrubs. Counters are cumulative through the current date.
- **Layer toggle** (top-left under header) — Incidents + Damaged buildings checkboxes. Damage on by default.
- **Scrubber** (bottom center) — range input over a dual-series histogram (red bars = incidents per day, tan bars = damage per day). Play/pause, keyboard (space/arrow keys).
- **Side panel** (right) — slides in on click. Two modes:
  - **Incident** — category, location, casualty cards, narrative paragraphs, source pills with credibility rating
  - **Damage** — destroyed/severe/moderate/possibly status, governorate, first-assessed date, full damage-progression timeline with color-coded markers
- **Hover tooltip** — small dark popup with date/place/casualties on incident hover
- **Loading screen** — fades out on map load

Camera defaults: zoom 11, pitch 50°, bearing −15°. Bounded to Gaza-only `maxBounds: [[34.15, 31.15], [34.65, 31.65]]`. The cream wall makes everything outside the strip invisible regardless of viewing angle.

Timeline anchor: starts at **2023-10-07** regardless of data extremes. Initial date is the latest record so the user sees the war's full extent and scrubs back.

---

## What was done in the most recent session (chronological)

1. `phase-1-airwars` — Airwars only, title descriptions, custom muted map
2. `phase-1.5-narratives` — added scraped Airwars article narratives (1,624 articles, multi-paragraph)
3. `phase-1.75-multi-source` — added UCDP (3,676 incidents) + OCHA UNOSAT (196,141 buildings); cross-source dedup
4. `794ba55` — fix protomaps tile 404 by switching to OSM raster (temporary)
5. `7288ce8` — switch to OpenFreeMap vector tiles + 3D buildings + Gaza mask polygon
6. `ecaea8c` — fix scrubber race condition (filter updates lost) + widen nav bounds
7. `5c88814` — custom muted cartographic style (replace OpenFreeMap stock liberty)
8. `d46ecf5` — UI overhaul (editorial / cream-warm) + total Gaza isolation via fill-extrusion wall
9. `2e2587c` — time-correlated damage layer (extract first-damage-date from 14 UNOSAT sensor passes)
10. `29ec1ea` — dual histogram + live cumulative counters + tighter dedup (110m → 55m)
11. `7ec479f` — anchor timeline to Oct 7 2023 + filter pre-war data
12. `ea3886e` — sleek minimal UI redesign (off-white, hairline borders)
13. `9cb0f0e` — performance fixes (rAF batching, larger damage radius, opacity transitions)
14. `e227241` — per-building damage detail (governorate + progression timeline in clickable side panel)

---

## Outstanding issues / pending work

### High priority

1. **ACLED licensing decision pending.** User sent inquiry to `licensing@acleddata.com` asking about Research-tier free trial and pricing. ACLED responded that Open tier doesn't include API access; user has uid 197874. The drafted reply is in chat history. Waiting on their response.

2. **Map feels sparse** — only 3,540 incidents over 2.5 years. The 196K damage layer carries the visual weight, but the user has expressed wanting more EVENT density. ACLED would add ~10K-15K events. Until then, we've explored alternatives — see "Available datasets that need integration" below.

3. **Scrubber/damage smoothness** — the most recent perf round added rAF batching, larger circle radii (1.4-5.5px), and 400ms opacity transitions. User had complained about "extremely choppy" and "damaged buildings go in and out at random." Worth verifying this is actually smooth now; if not, next levers are clustering at low zoom (`cluster: true` on the damage source) or pre-aggregating by week.

### Medium priority

4. **Damage data file size** — `public/data/damage.geojson` is 57 MB raw (~8 MB gzipped) after adding governorate + progression. Eager-loaded on app start. If load time is a concern, switch to PMTiles or stream + render incrementally.

5. **The Insecurity Insight attempt was REVERTED** — the user wants GEOLOCATED data only. II publishes coordinates as `null` (censored). Don't try to integrate II as map dots. If we ever want sector counters as aggregates in the header, the script + xlsx parsing was at `scripts/fetch-insecurity.ts` + `scripts/normalize-insecurity.ts` in the previous session but the user explicitly rejected this direction.

### Notes

6. **Mobile responsive layout** — never built. Desktop-first commitment was made in the spec.
7. **No live data updates** — build is manual; user re-runs `pnpm build-data` to refresh. A future GitHub Actions cron could automate.
8. **Memorial integration (Tech for Palestine killed-in-gaza)** — 60K named victims, public domain, data already cached at... actually we haven't cached it. The user explicitly said "no the stuff needs to be geolocated" so this is also off the table even though the spec originally listed it as Phase 1 inspiration.

---

## Available datasets that COULD be integrated (all require geolocated data per user's constraint)

Research summary from a thorough investigation:

| # | Source | Geocoded events | License | Effort |
|---|---|---|---|---|
| 1 | **Wikidata SPARQL** | ~40-50 marquee Gaza incidents (Al-Ahli hospital, Flour Massacre, Al-Mawasi, Rafah aid convoy) with coords + Wikipedia-grade narratives | CC0 | **Low** — single SPARQL query, ~half-day |
| 2 | **Forensic Architecture** GeoJSON layers | Thousands of points across 6 categories (spatial control, displacement, agriculture, medical, civilian infra, aid) | Likely CC-BY but ASK FIRST | **High** — must scrape their map's network calls to enumerate `data/geojson/*.geojson` paths. URL: `gaza.forensic-architecture.org/database` |
| 3 | **UNITAR/UNOSAT** additional layers | WASH (water infra), agriculture damage, night-light damage — same FeatureServer pattern as current building CDA | CC-BY-IGO 3.0 | **Medium** — same pipeline pattern as `scripts/fetch-ocha.ts` |
| 4 | **Aid Worker Security Database** | Small Gaza count but each event has lat/lon | Free | **Low-medium** |
| 5 | **Centre for Information Resilience Israel-Gaza Map** | ~1,700+ verified incidents on their ArcGIS | Unclear | **High** — no public bulk download, ArcGIS REST scraping |

### Datasets that LACK coords (don't waste time on these per user's constraint)

- ACLED at Open tier (aggregate only without paid API)
- Insecurity Insight (coordinates censored)
- Tech for Palestine killed-in-gaza (60K names but no coords)
- B'Tselem fatalities (locality only)
- HRW investigations (HTML articles, coords in body text not structured)
- Amnesty Crisis Evidence Lab (only ~15 cases, PDFs)
- OCHA Protection of Civilians (aggregate)
- WHO SSA (no lat/lon)
- CPJ killed journalists (HTML only)

---

## Recommended next moves

Order of value, in the absence of ACLED:

1. **Wait for ACLED Research-tier reply** — best long-term outcome. User already sent the email.
2. **Integrate Wikidata** — half-day, adds ~50 high-profile incidents with Wikipedia narratives. Follow the existing per-source pattern: `scripts/fetch-wikidata.ts` → `scripts/normalize-wikidata.ts` → wire into `build-data.ts`. SourceOrg gets a `'wikidata'` member. The SPARQL query is something like `SELECT ?event ?date ?coord ?deaths WHERE { ?event wdt:P361 wd:Q122962941; wdt:P585 ?date; wdt:P625 ?coord. OPTIONAL { ?event wdt:P1120 ?deaths } }`.
3. **Try Forensic Architecture scrape** — high-value but high-effort. Open their map in a browser with devtools open, watch the Network panel for `*.geojson` requests, enumerate them, write a fetcher. The methodology PDF mentions thousands of geolocated points across six categories.
4. **Performance audit pass 2** — if scrub still feels choppy, enable `cluster: true` on the damage source at low zoom (the source is already declared in `src/map/damage-layer.ts`).

---

## Key files & where logic lives

```
gaza-exhibit/
├── docs/superpowers/
│   ├── specs/2026-05-21-gaza-exhibit-design.md            (the original spec)
│   ├── plans/2026-05-21-phase-0-1-airwars.md              (Phase 1 plan, executed)
│   ├── plans/2026-05-21-phase-2-acled-dedup.md            (Phase 2 plan, partially executed — ACLED blocked)
│   ├── plans/2026-05-21-phase-1.75-ucdp-ocha.md           (Phase 1.75 plan, executed)
│   └── HANDOFF.md                                          (this file)
│
├── scripts/
│   ├── fetch-airwars.ts            Airwars WP REST + commits ~2700 raw pages
│   ├── scrape-airwars-articles.ts  HTML article scraper (cheerio)
│   ├── normalize-airwars.ts        Airwars raw → Incident (TDD)
│   ├── fetch-ucdp.ts               Downloads + filters GED 25.1 CSV to Gaza events
│   ├── normalize-ucdp.ts           UCDP row → Incident (TDD)
│   ├── fetch-ocha.ts               Paginated ArcGIS FeatureServer fetch with 14-sensor extraction
│   ├── normalize-ocha.ts           OCHA feature → DamageRecord (TDD)
│   ├── fetch-acled.ts              READY (but blocked on ACLED license)
│   ├── normalize-acled.ts          READY (TDD; not yet wired into build-data)
│   ├── dedupe.ts                   Cross-source merge by (date, lat3, lon3) ~55m precision
│   └── build-data.ts               THE ORCHESTRATOR — fetches, normalizes, dedups, writes
│
├── shared/
│   └── types.ts                    Incident, DamageRecord, BuildMeta, SourceOrg, etc.
│
├── data/raw/                       Committed snapshots (~80 MB)
│   ├── airwars/page-{001..028}.json + taxonomies.json + articles/{slug}.json (~2700 files)
│   ├── ucdp/gaza-events.json
│   └── ocha/damage.geojson         (47 MB; 14-sensor data)
│
├── public/data/                    Build output (committed; what the client fetches)
│   ├── incidents.json              3,540 deduped incidents
│   ├── damage.geojson              196,141 damage features (with progression)
│   └── meta.json                   build_date, source_counts, dedup_merges, etc.
│
├── src/
│   ├── main.ts                     Entry; wires loaders → map → UI → scrubber
│   ├── style.css                   Design tokens + all component styles (sleek minimal)
│   ├── data/loader.ts              loadIncidents + loadDamage (both committed JSONs)
│   ├── map/
│   │   ├── map.ts                  MapLibre init, Gaza mask wall, navigation bounds
│   │   ├── style.ts                Custom muted cartographic style on OpenFreeMap source
│   │   ├── gaza-boundary.ts        Embedded simplified polygon + inverse-polygon mask data
│   │   ├── marker-layer.ts         Incidents red-circle layer, hover state, rAF-batched filter
│   │   └── damage-layer.ts         Damage tan-circle layer, time-filter, rAF-batched, opacity transition
│   ├── time/
│   │   ├── time-controller.ts      State machine: date + play/pause + listeners (TDD)
│   │   ├── scrubber.ts             DOM range input + play button + date label (rAF batched)
│   │   └── histogram.ts            Dual-series SVG bars in scrubber (TDD)
│   ├── ui/
│   │   ├── header.ts               Title + subtitle + 3 live counters (precomputed cumulative arrays + binary search)
│   │   ├── side-panel.ts           Two modes: openIncident / openDamage
│   │   ├── tooltip.ts              Hover popup
│   │   ├── layer-toggle.ts         Incidents/Damage checkboxes
│   │   └── loading.ts              Fade-out splash screen
│   └── url-state.ts                #date=YYYY-MM-DD hash deep-link
│
└── tests/                          97 tests across 8 files, all green
```

---

## User preferences (observed across the session)

- **Geolocated data only.** Memorial views without coords are off the table.
- **Sleek/minimal UI** over editorial/cream. Inter + Newsreader, hairlines, off-white.
- **3D camera with smooth scrub-through** is the desired feel.
- **Total Gaza isolation** — no Israeli/Egyptian content visible at any angle or zoom.
- **Performance over feature count** — choppy scrubbing was their biggest complaint.
- **The timeline starts Oct 7 2023.** Pre-war records are filtered out at build time.
- **Damaged buildings are real events**, not just a background layer. Clickable, time-correlated, with full progression.

---

## How to pick up from here

1. Read this doc + the spec.
2. `pnpm dev`, scrub the timeline, click a few markers and a few damage dots to see the current experience.
3. Check `git log --oneline phase-1.75-multi-source..HEAD` to see the post-tag work in order.
4. If ACLED has responded by then, start there. Otherwise, the Wikidata integration is the highest-impact next move under the geolocation constraint.

Good luck.
