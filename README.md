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
- [ACLED (Armed Conflict Location & Event Data)](https://acleddata.com/) Palestine/Gaza events. Free academic API. Register at https://acleddata.com/register-for-access/ and set `ACLED_USERNAME` and `ACLED_PASSWORD` in `.env`. Attribution required.

## Phase 2 data pipeline

The build pipeline fetches and reconciles two sources:
- **Airwars** — civilian-harm incidents with credibility ratings. We also scrape each incident's article page for the narrative paragraphs ("assessed" incidents only; "researched but not assessed" stubs are skipped).
- **ACLED** — conflict-event records with broader actor/event-type taxonomy.

Records from both sources are merged by `(date, lat rounded to 3 decimals, lon rounded to 3 decimals)` ≈ 110m precision. Multi-source incidents preserve every source attribution in the side panel.

## Design

See [docs/superpowers/specs/2026-05-21-gaza-exhibit-design.md](docs/superpowers/specs/2026-05-21-gaza-exhibit-design.md).
