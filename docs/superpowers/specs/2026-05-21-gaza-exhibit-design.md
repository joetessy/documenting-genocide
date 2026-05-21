# The Gaza Exhibit — Design Specification

**Date:** 2026-05-21
**Status:** Approved for implementation planning

## Purpose

The Gaza Exhibit is an interactive web exhibit that documents the human and infrastructure toll of the war on Gaza. Visitors pan, zoom, and rotate across a map of Gaza, scrub a timeline from October 7, 2023 to the present, watch documented attacks accumulate as markers as time advances, and click any marker to read the documented incident with verifiable sources.

The exhibit's goal is to convey the gravity of the situation in a way that is both emotionally resonant and evidence-grounded. Every claim on the map is backed by a public, citable source.

## Audience and devices

General public, journalists, researchers, advocates. **Desktop-first, mobile-tolerable** — the showcase experience is on desktop; mobile gets a stacked vertical layout that works but is not the primary target.

## Reference inspiration

The exhibit lives in the same craftsmanship family as the user's prior project `gazas-children` (located at `../gazas-children` relative to this repo): static site, Vite + TypeScript, Tailwind v4, no UI framework, custom rendering. Emotional register: serious, considered, never flashy.

## Visual direction

Cartographic editorial base (warm muted earth tones, hand-drawn atlas feel) with bright red highlighted markers for incidents. The base map stays out of the way; the red marks demand attention.

- **Land:** warm cream `#f4ede0`
- **Built area:** warm tan `#dcc8a0`
- **Water:** pale dusty blue `#c8d4dc`
- **Borders, roads:** warm grey `#8a7f6e`, thin
- **Labels:** dark warm grey `#3a3530`, serif for place names, sans for UI
- **Incident markers:** solid red `#e63946` with a 2px white outer ring and a soft glow

## Architecture

Static site, no backend server. Three logical layers:

```
┌──────────────────────────────────────────────────────────────┐
│  BUILD-TIME (pnpm build-data)                                │
│                                                              │
│   Airwars API ──┐                                            │
│   ACLED API ────┼──► fetch ──► normalize ──► dedupe ──►      │
│   OCHA HDX  ────┘                          incidents.json    │
│                                            damage.geojson    │
│                                            meta.json         │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼  (committed to public/data/)
┌──────────────────────────────────────────────────────────────┐
│  CLIENT (src/, served as static files)                       │
│                                                              │
│   main.ts ──► loader.ts ──► incidents in memory              │
│                  │                                           │
│                  ▼                                           │
│              MapLibre map ◄──► TimeController                │
│                  │                    │                      │
│              MarkerLayer        scrubber + play/pause        │
│                  │                                           │
│                  ▼                                           │
│              hover tooltip / click side panel                │
└──────────────────────────────────────────────────────────────┘
```

**Key architectural choices:**

- Build-time data pipeline (re-run `pnpm build-data` when sources update — same model as gazas-children). No live API calls from the browser.
- Data committed to repo as JSON, so the site works fully offline once loaded.
- No framework (React, Vue) — keeps bundle small, matches reference project.

## Data sources

| Source | Role | Field highlights | Access |
|---|---|---|---|
| **Airwars** | Primary incident layer | lat/lon, date, casualty estimate, description, credibility rating, source URLs | Public API, free |
| **ACLED** | Breadth of conflict events | lat/lon, date, actor, fatalities, notes | Free academic API key |
| **OCHA HDX (UNOSAT)** | Damage assessment | per-building damage status, lat/lon, assessment date | Public REST + downloads |
| **Tech for Palestine** | Future enrichment (post-MVP) | per-victim names, daily casualty aggregates, weekly damage aggregates — *no geocoding* | Public API, free |

## Data pipeline

### Fetch
One script per source under `scripts/`: `fetch-airwars.ts`, `fetch-acled.ts`, `fetch-ocha.ts`. Each isolated so a failure in one doesn't kill the pipeline. Outputs raw JSON to `data/raw/{source}/`. Caches by source-record id so re-runs are incremental.

ACLED needs an API key, kept in `.env` (gitignored). A checked-in cached snapshot lets collaborators run without their own key for the existing date range.

### Normalize
A normalize function per source maps source-specific fields into the unified `Incident` type below. The category taxonomy is **ours**, not any source's — we map each source's vocabulary into our six categories.

### Dedup
After normalizing, `dedupe.ts` groups records by **(date, lat rounded to 3 decimals, lon rounded to 3 decimals)** — approximately 110m precision. Two records in the same group are treated as the same real-world event.

Within a group:
- Keep the longest description (Airwars typically wins).
- Take the **max** casualty count across sources (conservative).
- Union the `sources` array, preserving every source-id and URL.

Outputs `meta.json` includes counts of merges per build for monitoring tuning.

### Output
`public/data/` after a build:
- `incidents.json` — array of `Incident`
- `damage.geojson` — UNOSAT damage records as GeoJSON
- `meta.json` — `{ build_date, source_counts, dedup_merges }`

If the JSON gets large enough to hurt initial paint, we switch to a packed binary format (see gazas-children's `names.bin` for the pattern).

## Schemas

### Incident

```ts
type Incident = {
  id: string;                    // stable hash of (date, lat, lon)
  date: string;                  // ISO YYYY-MM-DD
  location: {
    lat: number;
    lon: number;
    name?: string;               // e.g. "Al-Ahli Arab Hospital, Gaza City"
    governorate?:
      | 'gaza_city'
      | 'north_gaza'
      | 'deir_al_balah'
      | 'khan_younis'
      | 'rafah';
  };
  category:
    | 'airstrike'
    | 'shelling'
    | 'ground_op'
    | 'attack_on_aid'
    | 'detention'
    | 'other';
  casualties: {
    killed: number | null;       // null = unknown, not zero
    injured: number | null;
    killed_children: number | null;
    killed_women: number | null;
  };
  description: string;
  sources: Array<{
    org: 'airwars' | 'acled' | 'ocha';
    id: string;
    url: string;
    rating?: 'fair' | 'weak' | 'contested';  // Airwars only
  }>;
};
```

### DamageRecord

The damage layer is **separate from incidents** because UNOSAT records building damage status, not events. There is no causal link from a damaged building to a specific strike.

```ts
type DamageRecord = {
  id: string;
  location: { lat: number; lon: number };
  status: 'destroyed' | 'severe' | 'moderate' | 'possibly_damaged';
  assessment_date: string;       // when UNOSAT assessed it
  source: { org: 'ocha'; url: string };
};
```

## Map rendering

**Engine:** MapLibre GL JS (free, OSS, no Mapbox bill).

**Tile source:** Self-hosted protomaps PMTiles. Single static file, zero ongoing cost, full ownership.

**Camera:**
- Initial framing: full Gaza Strip in view, slight tilt (~30°), facing north.
- Bounded so the user cannot pan to Cairo or Tel Aviv — focus stays on Gaza.
- Zoom range: 9 (full strip) to 17 (city block).
- Rotate enabled; tilt enabled with max ~60°.

**Marker rendering:**
- Zoom < 12: clustered into hex bins via MapLibre's built-in clustering; bin color = count.
- Zoom ≥ 12: individual markers (8px solid red, 2px white ring, soft glow).
- Hover: scales to 12px, glow intensifies.
- Selected (clicked): scales to 14px, persistent ring, side panel open.

**Damage layer (toggleable, off by default in MVP):**
- Dots colored by status: destroyed `#8b1a1a`, severe `#d97706`, moderate `#eab308`, possibly `#9ca3af`.

**Animation:**
- New markers fade in over 600ms when the scrubber crosses their date.
- Subtle pulse (1s ease) on most-recently-added markers, fading after 3s.
- Otherwise the map is still.

## Time controller

**Scrubber UI** (bottom of screen, full width minus margins):
- Range: Oct 7, 2023 → most-recent event date (computed at build time).
- Granularity: one day per step. Scrubbing animates between days smoothly.
- Play/pause: ~3 days/sec default; speed control ½× / 1× / 2× / 4×.
- Histogram of event density per day rendered underneath the track.
- Keyboard: space toggles play, arrow keys step ±1 day, shift+arrow ±7 days.
- Current date in URL hash (`#date=2024-03-12`) for deep-linking.

**Accumulation behavior:**
- Markers appear when the scrubber reaches their date.
- They **stay visible** once they appear (matches user intent of "accumulate to the end").
- Scrubbing backward fades them out in reverse.

## Interaction model

**Hover (desktop only):** small tooltip following the cursor — date, location name, casualty counts, number of sources.

**Click → side panel** (~360px, slides in from right):
- Location name and date
- Casualty breakdown including children and women
- Category
- Description paragraph (prefer Airwars's narrative)
- Source attributions with credibility ratings and external links to source records
- Close button; clicking elsewhere also closes.

**Layer toggle** (top-right, small panel):
- Incidents (default on)
- Damage assessment (default off)
- 3D buildings (greyed out, post-MVP)

**Empty / loading:**
- On load: cream background, "Loading [N] incidents from Airwars, ACLED, OCHA…" with thin progress bar.
- Scrubbed to a date with no events: no popup, no empty state. Silence is appropriate.

**Mobile fallback:**
- < 768px: map fills top 60%, scrubber and selected-incident card stack vertically.
- Hover replaced by tap.
- Side panel becomes a full-screen modal.

## Phasing

Approach 3 — vertical slice per source. Each phase ends with a shippable state.

**Phase 0 — Scaffold** (1-2 days)
Vite + TS + Tailwind set up; MapLibre boots with placeholder Gaza-bounded camera and stub style; CI/typecheck green.

**Phase 1 — Airwars end-to-end** (~1-2 weeks)
Fetch + normalize Airwars; client loader; marker layer with hover tooltip and click panel; TimeController with scrubber, playback, and histogram; URL deep-link.

**Phase 2 — ACLED + dedup** (~1 week)
Add ACLED fetcher and normalize; implement `dedupe.ts`; side panel renders multi-source attribution; dedup stats in `meta.json`.

**Phase 3 — OCHA damage layer** (~1 week)
Add OCHA fetcher and normalize; new map layer (toggleable); damage popup format.

**Phase 4 — Polish & mobile fallback** (~3-5 days)
Mobile responsive layout; loading and empty states; performance pass; accessibility check.

**Total: ~5-7 weeks** of focused work for the MVP as specified.

## Tech stack

- Build: Vite 6, TypeScript 5, Tailwind v4
- Map: MapLibre GL JS
- Tiles: protomaps PMTiles (self-hosted)
- Clustering: MapLibre's built-in (deck.gl reserved for post-MVP 3D buildings)
- Data fetch (build-time): `tsx` + native `fetch`
- Schema validation: Zod
- No UI framework (no React/Vue)
- Package manager: pnpm
- Hosting: GitHub Pages or Netlify (static)

## Out of scope for MVP

- Onboarding modal / first-visit tutorial
- 3D building extrusions
- Dollar-cost damage estimates
- Memorial / victim-name integration (gazas-children-style names panel)
- Translations (interface is English-only at MVP)
- Embeddable widgets / share cards
- Live data updates (currently build-time, manual re-runs)

## Post-MVP roadmap

Roughly in priority order:

1. **Onboarding modal** — explains the project and how to use the scrubber on first visit.
2. **3D building extrusions** — OSM building footprints rise from the map; damaged buildings change state.
3. **Memorial integration** — Tech for Palestine's `killed-in-gaza` names list, either as a separate names view or attached to incidents.
4. **Dollar-cost damage estimates** — research whether World Bank or PCBS publish replacement costs.
5. **Translations** — Arabic at minimum.
6. **Share cards / embeds** — for social spread.
7. **Live data updates** — GitHub Actions cron re-runs `pnpm build-data` daily and redeploys.

## Risks and open questions

- **Dedup tuning.** 110m precision is a starting heuristic. We'll output merge counts per build and may need to adjust radius, add casualty-count similarity, or require date-window matching.
- **Category mapping is editorial.** Different orgs categorize differently. The mapping is in code and will be visible to anyone who looks.
- **Data freshness.** Build-time pipeline means stale data between manual re-runs. Acceptable for MVP; live updates in post-MVP roadmap.
- **Source API stability.** Airwars and ACLED could change schemas. The per-source `fetch-*.ts` + `normalize-*.ts` isolation contains the blast radius — only one normalizer breaks if a source changes.
- **Performance at scale.** Thousands of markers across multiple sources. Clustering at low zoom should handle it, but we'll verify with a perf pass in Phase 4. Fallback: pack incidents into a binary format like gazas-children does.
- **ACLED API key.** Free for academic use; need to confirm the project's use case qualifies before depending on it. If not, ACLED falls out and we proceed with Airwars + OCHA only.

## Success criteria

- All MVP-scope features functional end-to-end.
- Static site deployed and accessible.
- Every marker on the map has at least one citable source with a working URL.
- Time scrubber playback runs smoothly across the full date range on a modern laptop.
- Mobile layout is usable (not necessarily delightful).
- Project structure is clean enough that a contributor can add a fourth data source without rewriting existing code.
