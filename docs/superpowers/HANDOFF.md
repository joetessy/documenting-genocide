# The Gaza Exhibit — Handoff Document

**Last updated:** 2026-05-27
**Repo state:** dirty — uncommitted regenerated build outputs (`data/raw/airwars/page-001.json`, `public/data/damage.geojson`, `public/data/facilities.json`, `public/data/meta.json`). All are single-line minimized JSON re-writes from a recent `pnpm build-data` run, no semantic changes.
**Latest commit:** `d9f1dde` — `feat(ui): remove bottom-right "i" attribution overlay`
**Test count:** 182 passing across 15 files (Vitest).

---

## What this is

The Gaza Exhibit is an interactive web map + timeline that documents the war on Gaza since October 7, 2023. Visitors pan, zoom, and tilt across the Gaza Strip; scrub a timeline that drives both incident markers and a 196K-feature damaged-buildings layer; and click any feature for a per-record report with verifiable sources.

The audience is the general public, journalists, researchers, and advocates. The exhibit is both a memorial and a documentary record — every claim on the map is backed by a public, citable source. It is single-developer, non-commercial, educational, and ad-free.

It deliberately strives for total Gaza isolation (nothing east of the border or south of Egypt appears) and a pen-and-ink basemap aesthetic, so the red incident markers and earth-tone damage points carry the visual weight against a stark white "paper" inside Gaza and a warm dark charcoal frame outside.

---

## Quick orientation for a new agent

```bash
pnpm install
pnpm dev                  # http://localhost:5173
pnpm build-data           # refresh data pipeline (uses cached raw data; --refresh to re-pull)
pnpm test                 # 182 tests
pnpm typecheck            # exits 0
pnpm build                # production build (typecheck + build-data + vite build)
```

Architecture: static site. A build-time data pipeline fetches, normalizes, dedupes, and writes JSON/GeoJSON to `public/data/`. The client is vanilla TS + DOM + MapLibre — no UI framework. Vite serves it in dev, `vite build` produces a static bundle.

---

## Current data state

Numbers from the latest [`public/data/meta.json`](../../public/data/meta.json):

| Source | Records normalized | Notes |
|---|---|---|
| Airwars | 1,568 | Each plotted incident has a multi-paragraph narrative scraped from the article page (~2,709 article files cached). |
| UCDP GED v25.1 | 3,674 | Free public CSV. Annual release ends 2024-12-31 (so events in 2025+ are missing). |
| Centre for Information Resilience | 1,053 | ArcGIS FeatureServer pull (post-Gaza-polygon filter). |
| Geoconfirmed | 3,720 | KMZ bulk export via the public API. |
| AWSD (Aid Worker Security Database) | 528 | CSV filter to Palestine, 2023+. |
| Wikidata + Wikipedia | 38 | SPARQL + MediaWiki article-lead enrichment. |
| OSM facilities (health + education) | 771 | Static reference layer, no time axis. |
| OCHA UNOSAT (damage) | 196,139 buildings | 14 sensor passes per building; we extract first-damage-date + full progression. |
| Tech for Palestine / MoH casualty toll | latest 72,803 killed | Daily cumulative, drives the header "Killed" counter. |

After cross-source dedup (≈55 m precision, `(date, lat3, lon3)`-keyed) and Oct-7-2023 clip:

- **2,315 dedup merges**, **5,684 unplotted** (no coords / out-of-polygon).
- The published `incidents.json` carries roughly **8,000+ unique incidents**; the multi-source count (any incident with `sources.length > 1`) is in the **2,000+** range.
- **`damage.geojson`** ships 196,139 features (point geometry + status + progression timeline).
- **`facilities.json`** ships 771 health + education facilities (~571 health, ~200 education).
- **`casualty-toll.json`** ships ~960 daily MoH cumulative records.

### Attribution requirements (already wired into the about modal + side panel)

- **CIR:** "Centre for Information Resilience" on first mention; "CIR" afterwards. Used with **explicit written permission** from Hannah (CIR, 2026).
- **AWSD:** "Humanitarian Outcomes (year), Aid Worker Security Database, aidworkersecurity.org".
- **Wikipedia text:** CC BY-SA 4.0, attributed to "Wikipedia contributors".
- **Wikidata structural records:** CC0.
- **OCHA UNOSAT (CDA 11 Oct 2025):** CC BY-IGO 3.0 — attribution to UNOSAT · OCHA.
- **HOT/OSM facilities:** ODbL — OpenStreetMap contributors via the Humanitarian Data Exchange.
- **UCDP:** open for research/education with attribution.
- **Airwars:** non-commercial research and educational use per Airwars' published terms.
- **Geoconfirmed:** per their public API terms; attribution requested.

---

## Tech stack

- **Vite 6**, **TypeScript 5** (`strict`, `verbatimModuleSyntax`, `allowImportingTsExtensions: false`)
- **Tailwind v4** via `@tailwindcss/vite` (most styles still live in `src/style.css` — Tailwind is set up but lightly used)
- **MapLibre GL JS 4.7** for rendering
- **OpenFreeMap** for vector tiles (`tiles.openfreemap.org/planet` — the `openmaptiles` schema; we author our own layer stack in [`src/map/style.ts`](../../src/map/style.ts))
- **cheerio** for Airwars article scraping
- **Vitest 2.1**, **pnpm**, **tsx** for running TS scripts
- **pmtiles** is installed but currently unused (retained from the original protomaps path)
- **No UI framework** — vanilla TS + DOM
- Custom Gaza polygon from **geoBoundaries** (CC BY 4.0), simplified to **161 vertices**, embedded in [`src/map/gaza-boundary.ts`](../../src/map/gaza-boundary.ts) and shared with build scripts via [`shared/gaza-polygon.ts`](../../shared/gaza-polygon.ts).

The basemap is a custom pen-and-ink style ([`src/map/style.ts`](../../src/map/style.ts)) — pure white "paper" inside Gaza, near-black roads, black labels with white halos, building greys slightly warmed for an atlas feel. The "outside" of Gaza is a `#2b2826` warm dark charcoal applied via both a 2D mask polygon and a 1500 m fill-extrusion wall, so the dark frame holds at any 3D tilt.

---

## Convention reminders

- **Extension-less local TS imports.** `from './foo'`, never `from './foo.ts'` — `allowImportingTsExtensions: false`.
- **2 spaces, single quotes, Conventional Commits.**
- **TDD where logic exists.** Each fetch source has a paired normalize + Vitest spec.
- **Each task ends with a commit.** Most work is one logical change per commit.
- `data/raw/{airwars,ucdp,ocha,cir,geoconfirmed,awsd,wikidata,osm,casualty-toll}/` is **committed** to the repo as frozen snapshots. Combined they total ~100 MB.

---

## Current UI / UX state

What a visitor sees on first load:

- **Map** — white paper inside Gaza, warm dark charcoal (`#2b2826`) outside. Pen-and-ink palette: black roads, near-black labels with white halos, slightly warmed building greys.
- **3D tilt enabled** — drag-rotate + pinch-zoom + touch-pitch. Default pitch 0, bearing -15°, zoom 11, centered at (34.40, 31.42).
- **NavigationControl** top-right (MapLibre stock) with pitch visualization, compass, and zoom buttons.
- **Header card** top-left (white card, backdrop blur):
  - Subtitle "A geographic record of the war on Gaza since Oct 7, 2023."
  - "Day N" counter ("Day –" when scrubbed before Oct 7).
  - Three live stats: **Killed (MoH)** / **Incidents** / **Buildings destroyed**, all cumulative through the current scrubber date.
- **Layer toggle** top-right:
  - **Incidents** (with expandable sub-filter for 6 categories: airstrike / shelling / ground_op / attack_on_aid / detention / other)
  - **Damaged buildings**
  - **Health facilities** (off by default)
  - **Education facilities** (off by default)
- **Scrubber** bottom-center — date range slider with Play button on the left + date label on the right. Spans 2023-10-06 to the latest incident date.
- **Dual-series histogram** above the slider — red bars = incidents/day, tan bars = damage/day, plus small red event-marker ticks for the 14 curated `TIMELINE_EVENTS`. Hovering a tick shows a custom tooltip; clicking jumps the scrubber to that date.
- **Bottom-left controls** — "Start the tour" button, About, Legend, plus a small "rotation hint" text.
- **Side panel** (right) slides in on click. Four modes: Incident / Damage / Facility / TimelineEvent.
- **Hover tooltip** — small dark popup with date/place/casualties when hovering an incident marker.
- **One-time onboarding overlay** on first visit (localStorage flag `gaza-exhibit:onboarding-dismissed`).
- **Tour mode** that walks through all 14 `TIMELINE_EVENTS` with camera fly-to (zoom 14, pitch 40, 1800 ms ease), a pulsing red landmark ring at each focus point, and a bottom-right narrator card with title + description. 7500 ms per stop. Clicking the map cancels.

### Camera & timeline anchors

- Initial scrubber state is **2023-10-06** — one day pre-war, so the map starts empty and Day 1 = the first scrubber click forward.
- `maxBounds` is `[[33.70, 30.80], [35.10, 32.00]]`, `minZoom: 8`, `maxZoom: 18`, `maxPitch: 75`.
- The cream-wall + flat-mask combination means everything outside Gaza is occluded at every angle.

### Incident marker sizing

Red dots scale by `killed` into 4 tiers (< 10, 10–49, 50–99, 100+), with separate radii per zoom level (smallest at z9, largest at z17). Stroke is pure black for contrast on the white paper.

### Damage palette

- Destroyed: `#7a0e0e` (deep blood red)
- Severe: `#c2470d` (rust)
- Moderate: `#856416` (olive)
- Possibly damaged: `#4a4a4a` (medium-dark grey)

Damage circles are `circle-blur: 0.35` for soft edges; radius scales 1.4 → 5.5 from z9 → z17.

---

## Sources currently integrated + licensing posture

| Source | License | Permission status |
|---|---|---|
| Airwars | terms permit non-commercial research/educational use | open |
| UCDP GED v25.1 | open for research/education with attribution | open |
| OCHA UNOSAT (CDA 11 Oct 2025) | CC BY-IGO 3.0 | open |
| Centre for Information Resilience | with explicit written permission | **sent + approved by Hannah (2026)** |
| Geoconfirmed | per their public API terms | open |
| Aid Worker Security Database | free for non-commercial research with citation | open |
| Wikidata | CC0 | open |
| Wikipedia | CC BY-SA 4.0 | open |
| HOT/OSM (Palestine) | ODbL | open |
| Tech for Palestine (MoH aggregator) | public open data | open |

**Forensic Architecture (FA)** and **AOAV** had permission emails drafted in the multi-source spec but **not yet sent** (or not yet approved). They remain candidate sources but are not integrated.

---

## Outstanding issues / pending work

1. **Permission emails to send.** FA and AOAV (per [`docs/superpowers/specs/2026-05-23-multi-source-expansion-design.md`](specs/2026-05-23-multi-source-expansion-design.md) Tier B). FA in particular would unlock thousands of researcher-grade points across new categories (spatial control, environment).
2. **OCHA Protection of Civilians per-incident database.** OCHA fronts it through their UI, not a public bulk endpoint. Worth a permission inquiry — would add hundreds of per-incident PoC records.
3. **`og-card.png` is referenced in `index.html` `og:image` and `twitter:image` metadata but does not exist in `public/`.** Social link previews currently 404. Generate a 1200×630 PNG before any wider sharing.
4. **Mobile responsive layout never built.** Desktop-first commitment was made in the original spec; mobile is still untouched.
5. **Service-worker tile caching** would help reliability on flaky networks and for offline viewing — not implemented.
6. **Memorial integration (Tech for Palestine `killed-in-gaza` list, 60K names).** No per-name coords; the user originally rejected aggregate data, but a separate "names" view could be considered as a non-map memorial panel that complements the geographic view.
7. **Cluster damage at low zoom** was attempted then reverted (commits `6b94f50` then `26dd4be`). If 196K dots at z8–z10 ever becomes a performance issue again, revisit with a different visual treatment.
8. **Uncommitted noise in the working tree.** `pnpm build-data` was run recently and modified 4 files (raw + public outputs). These are normal regenerations; either commit them or reset.

---

## Available datasets that COULD be integrated

| Source | Status | Effort |
|---|---|---|
| **Forensic Architecture** — GitHub repo at `github.com/forensic-architecture/gaza-public-data` | No license declared; send permission email | High — need a yes first; GeoJSONs are 28–64 MB each across 6 categories |
| **OCHA Protection of Civilians per-incident** | UI-fronted only; send permission email | Medium |
| **TRACE Data Portal (GCPEA education attacks)** | Gated; send permission email | Medium |
| **WHO Surveillance System for Attacks** | Confirmed no per-event coordinates — **skip** | n/a |
| **Insecurity Insight** | Confirmed all coordinates censored — **skip** | n/a |
| **Bellingcat** | No structured DB; J&A Unit shut down July 2025. Watch **GLAN DRAGNET** as a potential successor. | unknown |
| **UNOSAT extended layers** (cropland, roads, greenhouses) | CC BY-SA, integrate without permission | Medium — same pattern as `fetch-ocha.ts`; needs separate output files due to share-alike |

(Refer to [`docs/superpowers/specs/2026-05-23-multi-source-expansion-design.md`](specs/2026-05-23-multi-source-expansion-design.md) for the full plan, though Phases B2 (CIR), A1 (HOT/OSM facilities), A4/A5 (Wikidata, Geoconfirmed, AWSD) are now **done** and Phase A1-IDMC was reverted.)

---

## Recommended next moves

In rough priority order — the user has final say:

1. **Generate the actual `og-card.png`** (1200×630). The `og:image` and `twitter:image` tags currently 404 — any link share looks broken. Could be a styled screenshot of the map with the headline numbers ("8,000+ incidents · 196K+ buildings · Day N").
2. **Send the FA + AOAV permission emails** (drafts already in the multi-source spec). Long lead time, so kick off early.
3. **Service-worker tile caching** for reliability on slow / intermittent networks. The map is the single biggest UX risk if tiles fail.
4. **Mobile responsive layout.** Stacked vertical, larger touch targets, simpler camera. Two-column on tablet+.
5. **Memorial integration with Tech for Palestine `killed-in-gaza`.** Not a map layer — a separate "names" panel that complements the geographic view. The original constraint was no aggregate-only sources for the *map*, but a memorial mode is a legitimate companion.

---

## Key files & where logic lives

```
gaza-exhibit/
├── docs/superpowers/
│   ├── specs/2026-05-21-gaza-exhibit-design.md            original spec
│   ├── specs/2026-05-23-multi-source-expansion-design.md  multi-source plan (partially executed; B2/A1/A4-A5 now done)
│   ├── plans/2026-05-21-phase-0-1-airwars.md              executed
│   ├── plans/2026-05-21-phase-1.75-ucdp-ocha.md           executed
│   ├── plans/2026-05-21-phase-2-acled-dedup.md            partially executed; ACLED blocked
│   ├── plans/2026-05-23-phase-a1-facilities.md            executed
│   └── HANDOFF.md                                          (this file)
│
├── scripts/
│   ├── fetch-airwars.ts            Airwars WP REST + ~2,709 cached articles
│   ├── fetch-ucdp.ts               UCDP GED 25.1 CSV filter to Gaza
│   ├── fetch-ocha.ts               OCHA UNOSAT building damage (paginated ArcGIS, 14 sensor passes)
│   ├── fetch-cir.ts                CIR Israel-Gaza Map via ArcGIS FeatureServer
│   ├── fetch-geoconfirmed.ts       Geoconfirmed KMZ from public API
│   ├── fetch-awsd.ts               Aid Worker Security Database CSV
│   ├── fetch-wikidata.ts           Wikidata SPARQL + Wikipedia MediaWiki API enrichment
│   ├── fetch-osm-facilities.ts     HOT/OSM health + education facilities (S3 zips)
│   ├── fetch-casualty-toll.ts      Daily MoH casualty figures via Tech for Palestine
│   ├── fetch-acled.ts              READY but blocked on ACLED license (not wired)
│   ├── normalize-airwars.ts        Raw → Incident (TDD, 28 cases)
│   ├── normalize-ucdp.ts           Raw → Incident (TDD, 10 cases)
│   ├── normalize-ocha.ts           Raw → DamageRecord (TDD, 16 cases)
│   ├── normalize-cir.ts            Raw → Incident (TDD, 12 cases)
│   ├── normalize-geoconfirmed.ts   Raw → Incident (TDD, 14 cases)
│   ├── normalize-awsd.ts           Raw → Incident (TDD, 15 cases)
│   ├── normalize-wikidata.ts       Raw → Incident (TDD, 15 cases)
│   ├── normalize-osm-facilities.ts Raw → FacilityRecord (TDD, 9 cases)
│   ├── normalize-acled.ts          READY (TDD, 11 cases; not wired into build-data)
│   ├── scrape-airwars-articles.ts  Cheerio scraper for Airwars article narratives
│   ├── dedupe.ts                   Cross-source merge by (date, lat3, lon3); data-driven richness score
│   └── build-data.ts               THE ORCHESTRATOR — fetches, normalizes, dedups, writes
│
├── shared/
│   ├── types.ts                    Incident, DamageRecord, FacilityRecord, BuildMeta, SourceOrg, etc.
│   └── gaza-polygon.ts             Point-in-polygon test re-exported from src/map/gaza-boundary.ts
│
├── data/raw/                       Committed snapshots (~100 MB)
│   ├── airwars/                    ~28 page-{NNN}.json + taxonomies.json + articles/{slug}.json (~2,709 files)
│   ├── ucdp/                       gaza-events.json
│   ├── ocha/                       damage.geojson (~56 MB; 14-pass UNOSAT data)
│   ├── cir/                        incidents.geojson
│   ├── geoconfirmed/               incidents.json
│   ├── awsd/                       incidents.csv + incidents.json
│   ├── wikidata/                   incidents.json
│   ├── osm/                        health.geojson + education.geojson
│   └── casualty-toll/              daily.json (MoH cumulative)
│
├── public/data/                    Build output (committed — client fetches these)
│   ├── incidents.json              ~8,100 deduped incidents (~9.5 MB)
│   ├── damage.geojson              196,139 damage features (point geometry + progression) (~55 MB)
│   ├── facilities.json             771 facility points (~240 KB)
│   ├── casualty-toll.json          ~960 daily MoH cumulative records (~52 KB)
│   └── meta.json                   { build_date, source_counts, dedup_merges, casualty_toll_count, etc. }
│
├── src/
│   ├── main.ts                     Entry: wires loaders → map → UI → scrubber → tour
│   ├── style.css                   Design tokens + all component styles (pen-and-ink)
│   ├── data/
│   │   ├── loader.ts               loadIncidents, loadDamage, loadFacilities, loadCasualtyToll
│   │   └── timeline-events.ts      14 curated major-moment markers with optional focus coords
│   ├── map/
│   │   ├── map.ts                  MapLibre init, Gaza mask wall (charcoal), NavigationControl
│   │   ├── style.ts                Custom pen-and-ink basemap style on OpenFreeMap source
│   │   ├── gaza-boundary.ts        Embedded 161-vertex polygon + inverse-polygon mask data
│   │   ├── marker-layer.ts         Incidents red-circle layer with casualty-tier sizing + hover state + category filter (rAF batched)
│   │   ├── damage-layer.ts         Damage circles by status; filter-based time gating (debounced from main.ts)
│   │   └── facility-layer.ts       Health (cyan) + Education (violet) facility points
│   ├── time/
│   │   ├── time-controller.ts      State machine: date + play/pause + listeners (TDD)
│   │   ├── scrubber.ts             DOM range input + play button + date label (rAF batched)
│   │   ├── histogram.ts            Dual-series SVG bars + event marker ticks with custom HTML tooltips (TDD)
│   │   └── tour-controller.ts      Guided walkthrough of TIMELINE_EVENTS with camera fly-to + narrator card
│   ├── ui/
│   │   ├── header.ts               Killed / Incidents / Buildings destroyed + Day N counter (binary search over precomputed cum arrays)
│   │   ├── side-panel.ts           Incident / Damage / Facility / TimelineEvent render modes
│   │   ├── tooltip.ts              Hover popup over incident dots
│   │   ├── layer-toggle.ts         Incidents (expandable categories) / Damage / Health / Education
│   │   ├── loading.ts              Fade-out splash with progressive status text
│   │   ├── about-modal.ts          About / sources / methodology / limitations modal
│   │   ├── onboarding-overlay.ts   First-visit dismissible explainer (localStorage flag)
│   │   └── legend.ts               Bottom-left expandable legend card
│   └── url-state.ts                #date=YYYY-MM-DD&incident=<id> hash deep-linking (debounced from main.ts)
│
└── tests/                          15 files, 182 tests
    ├── dedupe.test.ts                       15 cases
    ├── gaza-polygon.test.ts                  8 cases
    ├── histogram.test.ts                     5 cases
    ├── time-controller.test.ts              11 cases
    ├── timeline-events.test.ts               8 cases
    ├── url-state.test.ts                     5 cases
    ├── normalize-airwars.test.ts            28 cases
    ├── normalize-ucdp.test.ts               10 cases
    ├── normalize-ocha.test.ts               16 cases
    ├── normalize-cir.test.ts                12 cases
    ├── normalize-geoconfirmed.test.ts       14 cases
    ├── normalize-awsd.test.ts               15 cases
    ├── normalize-wikidata.test.ts           15 cases
    ├── normalize-osm-facilities.test.ts      9 cases
    └── normalize-acled.test.ts              11 cases   (kept; acled is not wired but tests guard the normalize fn)
```

---

## User preferences (observed across sessions)

- **Geolocated data only.** Memorial views without coords are off the map. (A non-map memorial panel may still be acceptable.)
- **Pen-and-ink basemap aesthetic.** Dramatic contrast — Gaza floats as a brighter island against a darker frame.
- **Sleek minimal UI.** Hairline borders, off-white card backgrounds with backdrop blur, restrained typography (Newsreader serif for large numbers + headings, Inter sans for UI).
- **Smooth scrub-through feel.** Performance has always been prioritized over feature breadth — debounced damage updates, rAF-batched filters, precomputed cumulative arrays for header counters.
- **Total Gaza isolation.** Nothing east of the Israel border or south of the Egypt border should appear at any zoom or tilt.
- **The timeline starts pre-war (Oct 6 2023).** The empty state precedes the first events so the war's beginning is felt.
- **Damaged buildings are real events**, not just a background layer — clickable, time-correlated, with a per-building progression timeline in the side panel.
- **Red incident markers scale by casualty severity** (4 tiers: <10 / 10–49 / 50–99 / 100+).
- **Every datum is sourced.** The about modal lists every source and license; the side panel shows per-incident source URLs.

---

## Reading the codebase efficiently

If you're picking up cold, follow this order and you'll be productive fast:

1. **[`shared/types.ts`](../../shared/types.ts)** (95 lines) — the canonical shapes. `Incident`, `DamageRecord`, `FacilityRecord`, `BuildMeta`, `SourceOrg`. Everything else flows from these.
2. **[`scripts/build-data.ts`](../../scripts/build-data.ts)** (332 lines) — the build orchestrator. Reading it linearly tells you exactly what sources feed the build and in what order: fetch → load raw → normalize → dedupe → conflict-start clip → write outputs.
3. **[`scripts/dedupe.ts`](../../scripts/dedupe.ts)** (142 lines) — the cross-source merge. `richnessScore()` is data-driven (no Airwars preference); ties go to the first argument for determinism. `PRECISION = 0.0005` ≈ 55 m.
4. **[`src/main.ts`](../../src/main.ts)** (493 lines) — the client entry. Reading top-to-bottom shows: loaders → map mount → header mount → markers/damage/facility layers → layer toggle wiring → time controller + URL hash debouncing → scrubber + histogram → tour controller → click router with layer priority. Two small helpers live at the bottom (`mountTourNarrator`, `showLandmarkHighlight`).
5. **[`src/map/style.ts`](../../src/map/style.ts)** + **[`src/map/map.ts`](../../src/map/map.ts)** — the pen-and-ink basemap and the Gaza mask wall. The `MASK_COLOR = '#2b2826'` warm dark charcoal is the single value that defines the "outside" tone.
6. The per-source pairs (`fetch-*.ts` + `normalize-*.ts` + matching test) — read one to understand the pattern, then the rest follow the same shape.

### Per-source pipeline pattern

Each source obeys the same contract:

- `fetch-<source>.ts` — exports `fetch<Source>({ refresh?: boolean })`. Writes raw payload to `data/raw/<source>/`. Idempotent — skips if files exist unless `--refresh` is passed. Each is also CLI-runnable via `import.meta.url === ...` guard.
- `normalize-<source>.ts` — exports `normalize<Source>Record/Feature/Row(raw)` returning an `Incident | null` (or `FacilityRecord | null`). Returns null when coords are missing, date can't be parsed, or the point falls outside the Gaza polygon. Pure functions — easy to TDD.
- `tests/normalize-<source>.test.ts` — Vitest covers: happy path, missing coords, outside polygon, malformed dates, category mapping, source URL extraction, etc.
- Wired into `build-data.ts` in three places: import, load helper, normalize loop. Add the new source to the dedupe input array and the `meta.source_counts` block.

If you're adding a new source, copy any existing pair as a template — `fetch-geoconfirmed.ts` + `normalize-geoconfirmed.ts` is a particularly clean example.

---

## Notes on quirks & gotchas

A few things that have bitten this codebase before and may bite again:

- **Safari rate-limits `history.replaceState()`** to ~100 calls per 10 s. The scrubber's URL hash update is debounced 300 ms in [`main.ts:scheduleHashUpdate`](../../src/main.ts) to keep dragging from exceeding the limit.
- **MapLibre's `setFilter()` on the 196K-feature damage layer costs 50–300 ms per call.** Damage filter updates are debounced 120 ms separately from the rest of the timeline change pipeline (see `scheduleDamageUpdate` in `main.ts`). Markers, header, and the URL hash all stay responsive during a fast drag while the damage layer catches up after the user pauses.
- **MapLibre `within` filters can't be combined with legacy filters.** [`map.ts:filterLabelsToGaza`](../../src/map/map.ts) sets the filter to the `within` expression directly — combining throws "within not allowed".
- **3D-tilted clicks need padding.** A bbox of `±6 px` around the click point is used by the click router in `main.ts` so a tilted user can still hit a foreshortened dot.
- **Multiple click handlers on the same map fire in registration order and overwrite each other.** The current design uses one click handler that calls `queryRenderedFeatures` with a layer priority list. Don't add per-layer click handlers — append to `CLICK_LAYER_PRIORITY` instead.
- **Damage layer counts only `status === 'destroyed'`** for the header's "Buildings destroyed" stat. Severe/moderate/possibly are visible on the map but excluded from the headline number — see `buildDamageCumulative` in [`header.ts`](../../src/ui/header.ts).
- **Killed counter uses MoH cumulative totals**, not a sum of per-incident `killed` fields. Per-incident reporting only covers a fraction of events; summing them would undercount by an order of magnitude. The MoH daily JSON is already cumulative — we binary-search by date.
- **Test file `tests/normalize-acled.test.ts` exists and passes (11 cases).** ACLED is **not wired into the build** (their license forbids per-point rendering) but the normalize function + tests are kept as scaffolding in case licensing terms ever change.
- **`pmtiles` is a dependency but unused.** Retained from a retired protomaps experiment; safe to remove if future cleanup wants the dep tree trimmed.
- **The OG card image is missing.** `<meta property="og:image" content="/og-card.png">` 404s. See "Outstanding issues".

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

# Find unplotted-coord-rate per source during the build (re-run with verbose):
pnpm build-data 2>&1 | grep -E '(Normalized|Unplotted)'
```

---

## How to pick up from here

1. Read this doc + skim [`specs/2026-05-21-gaza-exhibit-design.md`](specs/2026-05-21-gaza-exhibit-design.md) and [`specs/2026-05-23-multi-source-expansion-design.md`](specs/2026-05-23-multi-source-expansion-design.md).
2. `pnpm dev`, scrub the timeline, click "Start the tour", click a few incidents and damage dots.
3. `git log --oneline -30` to see the most recent work in order.
4. Pick from "Recommended next moves" or wait for user instruction.

Good luck.
