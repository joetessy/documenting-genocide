# Multi-Source Expansion — Design Specification

**Date:** 2026-05-23
**Status:** Drafted, awaiting user review
**Supersedes nothing** — extends `2026-05-21-gaza-exhibit-design.md` with additional data sources.

## Purpose

The current exhibit has 3,540 deduped incidents (Airwars + UCDP) and 196,141 damaged-building features (OCHA UNOSAT). The user's evaluation is that the incident layer feels too sparse and the exhibit needs **hundreds-to-thousands of additional geolocated event records** to convey scale. This spec defines which new sources we pursue, on what licensing terms, and how each lands in the existing architecture.

The driving constraint from the original spec stands: **only geolocated data**. Memorial views without per-event coordinates are out of scope.

## Context: what changed since the original spec

1. **ACLED is unavailable** for direct map display under any license tier. Their licensing team confirmed in writing that the agreement prohibits rendering ACLED records as individual points on an interactive map regardless of attribution — across Open, Research, and commercial tiers. The data may only be used in derivative or transformed products. This rules out ACLED as a source for the exhibit as designed.

2. **OCHA's Humanitarian Data Exchange (HDX) discovery pass found five immediately-usable, openly-licensed Gaza datasets** that we did not previously know about. These need no permission emails — their licenses (CC-BY / CC-BY-SA / ODbL) explicitly permit reuse with attribution.

3. **Two sources from the original handoff candidate list turned out not to have what we need:** Bellingcat (no structured Gaza database; their J&A Unit shut down July 2025 and the work moved to GLAN DRAGNET) and Euro-Med Human Rights Monitor (aggregate press releases only, no per-event coordinates).

These findings shape the strategy below.

## Strategy

**Two tiers, layered.**

- **Bulk-density tier** — many points with simpler per-record metadata, visible as a background density signal.
- **Rich-narrative tier** — fewer points with full narratives and source citations, visible as foreground highlights.

The existing Airwars layer (1,590 incidents with multi-paragraph scraped narratives) anchors the rich-narrative tier. The existing UCDP layer (3,676 events with brief notes) sits between bulk and rich. New sources slot into whichever tier their metadata depth supports.

## Licensing & permission posture

Established after the ACLED experience:

- **If the dataset's license explicitly permits reuse with attribution** (CC-BY, CC-BY-SA, CC0, ODbL, public domain, government open-data), integrate without contacting the publisher. Attribute per their stated terms.
- **If the dataset has no published license, or has restrictive language**, do not integrate without written go-ahead. Send a permission request describing the exact use, scope, attribution, and distribution model, and wait for a yes.
- **Default-to-ask in ambiguous cases.** Better to wait than to need a takedown later.

We use the same email template for permission requests across organizations, customized per source.

## Sources — Tier A: clear-licensed (integrate without permission)

All five surfaced from the HDX discovery pass. Each is downloadable today.

| # | Source | What it adds | Records | License | URL |
|---|---|---|---|---|---|
| A1 | **UNOSAT — FAO Gaza Cropland Damage Assessment (July 2025)** | NDVI-based agricultural-loss polygons. | thousands of polygons | CC BY-SA | https://data.humdata.org/dataset/unosat-fao-gaza-strip-cropland-damage-assessment-july-2025 |
| A2 | **UNOSAT Gaza Road Network Damage (July 2025)** | Polyline damage: 1,511 km destroyed, 484 km severely, 1,484 km moderate. | ~3,500 km of polylines | CC BY-SA | https://data.humdata.org/dataset/unosat-gaza-strip-road-network-comprehensive-damage-assessment-july-2025 |
| A3 | **UNOSAT — FAO Greenhouse Damage Assessment (Dec 2024)** | Greenhouse damage polygons. | hundreds of polygons | CC BY-SA | https://data.humdata.org/dataset/unosat-fao-gaza-strip-greenhouse-comprehensive-damage-assessment-december-2024 |
| A4 | **OCHA oPt Health Facilities** | Static reference layer: 505 hospitals and clinics across Gaza and West Bank, with type and governorate. | 505 points | CC BY | https://data.humdata.org/dataset/state-of-palestine-health-0 |
| A5 | **HOT/OSM Health + Education Facilities (Palestine)** | Reference layer, more complete than OCHA's, refreshed monthly. | ~hundreds across both categories | ODbL | https://data.humdata.org/dataset/hotosm_pse_health_facilities and `…_education_facilities` |

### Priority ordering within Tier A

1. **A1 + A2 + A3 (UNOSAT extended)** — extend the existing damage layer with categories beyond buildings. Same fetch pattern as the current `fetch-ocha.ts`, lowest engineering risk, highest visual payoff.
2. **A4 OR A5 (facilities)** — pick one. OCHA's is authoritative but a snapshot; HOT/OSM is community-maintained and updates monthly. Recommend HOT/OSM for freshness, with OCHA as a fallback if HOT/OSM coverage is patchy. Either way these are a **static overlay**, not timeline-driven.

### License compatibility note

The CC BY-SA datasets (A1/A2/A3) require share-alike on any redistributed derivative. For the exhibit, this means:

- Display in the running site is unaffected.
- Any normalized files we commit into `public/data/` that incorporate A1/A2/A3 must be redistributed under CC BY-SA, with attribution.
- Mixed-license `damage.geojson` is **not acceptable**. We will keep A1/A2/A3 in separate output files (`damage-cropland.geojson`, `damage-roads.geojson`, `damage-greenhouses.geojson`) so each file carries one license, declared in a sibling LICENSE note or in the file's `meta` block.

## Sources — Tier B: permission-pending

Permission requests drafted 2026-05-23; sending pending. All three integrations are conditional on a written yes.

| # | Source | What it'd add if approved | Records | License status | Contact |
|---|---|---|---|---|---|
| B1 | **Forensic Architecture — Gaza public-data repo** | Researcher-grade geolocated incidents and damage features across three categories: Environment, Medical Infrastructure, Spatial Control. Includes raids/checkpoints/buffer zones and incident classifications (confirmed / most likely / unknown). | Thousands of features (GeoJSONs are 28–64 MB each) | No license declared; treat as all-rights-reserved | Contact form at https://contact.forensic-architecture.org/ ("Rights and reproductions requests" category); CC `info@forensic-architecture.org` |
| B2 | **Centre for Information Resilience — Israel-Gaza Map** | Verified incidents with date, location, category, casualty count, and multiple per-incident source links (Link_1 … Link_N). | 2,255 features (confirmed via ArcGIS FeatureServer query) | No license posted | `hello@info-res.org`; CC `media@info-res.org`. ArcGIS layer at `services-eu1.arcgis.com/06WOSMGHsCnaFyMp/arcgis/rest/services/Indigo_Incidents_Layer_view/FeatureServer/0` |
| B3 | **AOAV Explosive Weapons Monitor — per-incident records** | Per-incident date, location, casualties, weapon classification. AOAV currently publishes only aggregates; per-event data exists internally. | Unknown until shared | "All rights reserved" on site footer; third-party CC BY-NC-ND references unconfirmed | `ioverton@aoav.org.uk` (Iain Overton, Executive Director, dataset owner); CC `info@aoav.org.uk` |

### Priority among Tier B

If multiple come back yes, B2 (CIR) is the most directly drop-in (already structured per-incident records with the exact field shape we need). B1 (FA) is the highest research-grade quality and adds new categories (spatial control, environment). B3 (AOAV) is the least certain and has lowest probability of yes; treat as bonus.

If only one comes back yes, integrate that one and revisit the others later.

## Cuts (with rationale)

- ❌ **Bellingcat** — No structured Gaza incident database to license. Their Damage Proxy Map embeds ~541 pins sourced from a third party (Geoconfirmed); the Justice & Accountability Unit (the closest thing to a structured-data team) closed in July 2025 and the work transitioned to GLAN's DRAGNET project. Track DRAGNET when it publishes; do not contact Bellingcat for this purpose.
- ❌ **Euro-Med Human Rights Monitor** — Publishes press releases and image-based infographics only. Casualties reported as Gaza-wide or governorate-level aggregates, not per-incident coordinates. Fails the geolocation constraint at the source.
- ❌ **ACLED at any tier** — Direct map display prohibited by user agreement regardless of license level. (For completeness; not in original list.)
- ❌ **Insecurity Insight** datasets on HDX — Lat/lon columns present but **all values null across all PSE rows** (~12,000 rows scanned across 5 files). Coordinates are systematically censored.
- ❌ **B'Tselem Masafer Yatta** dataset (CC BY) — Village-name only, no coordinates. Could be geocoded via OSM gazetteer but is West Bank not Gaza; deferred.
- ❌ **PCBS Violations Against Education** — Gaza Strip / West Bank totals only, no coordinates.

## Type system implications

The existing types in `shared/types.ts` accommodate per-source incidents fine. The new sources require modest extensions and two new top-level types.

### 1. Extend `SourceOrg`

```ts
export type SourceOrg =
  | 'airwars'
  | 'acled'        // retained for compatibility; not actively used
  | 'ocha'
  | 'ucdp'
  | 'unosat_fao'   // A1 + A3 (cropland, greenhouses)
  | 'unosat_road'  // A2 (roads)
  | 'osm'          // A5 (HOT/OSM facilities)
  | 'fa'           // B1 (if approved)
  | 'cir'          // B2 (if approved)
  | 'aoav';        // B3 (if approved)
```

### 2. New `DamageFeature` type (for A1/A2/A3 and possibly FA Environment)

The existing `DamageRecord` is point-based and building-status-oriented. The new damage layers are polygons and polylines with damage-class metadata, not building-level.

```ts
export type DamageFeatureKind = 'cropland' | 'road' | 'greenhouse';
export type DamageFeatureGeometry = 'polygon' | 'polyline';

export interface DamageFeature {
  id: string;
  kind: DamageFeatureKind;
  geometry: GeoJSON.Polygon | GeoJSON.LineString;
  status: DamageStatus;               // reuse existing
  assessment_date: string;
  source: SourceAttribution;
}
```

These ship as separate GeoJSON files (`damage-cropland.geojson`, `damage-roads.geojson`, `damage-greenhouses.geojson`) because they have different licenses (CC BY-SA) than the existing `damage.geojson` (CC BY-IGO 3.0).

### 3. New `FacilityRecord` type (for A4/A5)

Reference layer, static, not timeline-driven.

```ts
export type FacilityKind = 'hospital' | 'clinic' | 'school' | 'university';

export interface FacilityRecord {
  id: string;
  kind: FacilityKind;
  location: { lat: number; lon: number; name: string };
  governorate?: Governorate;
  source: SourceAttribution;
}
```

### 4. `Incident` extensions for permission-pending sources

If B2 (CIR) is approved, each CIR record normalizes cleanly into the existing `Incident` shape — date, lat, lon, category, casualties, multiple source URLs. No type change needed beyond adding `'cir'` to `SourceOrg`.

If B1 (FA) is approved, FA's Medical Infrastructure and some Spatial Control records may map to `Incident`, while Environment polygons and buffer-zone features map to `DamageFeature`. We will decide per FA category at integration time.

If B3 (AOAV) is approved, AOAV records map to `Incident`.

## Pipeline shape

Follows the existing per-source pattern:

```
scripts/
  fetch-unosat-fao.ts    (A1 + A3)
  normalize-unosat-fao.ts
  fetch-unosat-road.ts   (A2)
  normalize-unosat-road.ts
  fetch-osm-facilities.ts (A5)
  normalize-osm-facilities.ts
  fetch-fa.ts            (B1 — built after permission)
  normalize-fa.ts
  fetch-cir.ts           (B2 — built after permission)
  normalize-cir.ts
  fetch-aoav.ts          (B3 — built after permission)
  normalize-aoav.ts
```

Each fetch caches to `data/raw/{source}/`. Each normalize is TDD-tested per the existing convention. `build-data.ts` orchestrates and writes to `public/data/`.

**Dedup interaction:** Only `Incident` records run through `dedupe.ts`. `DamageFeature` and `FacilityRecord` are not deduplicated against incidents — they're parallel layers, not the same conceptual entity. Cross-source dedup applies only when the same real-world incident is reported by multiple sources (Airwars + UCDP + future CIR/FA/AOAV).

**Pre-Oct-7 filter:** All new sources apply the same Oct-7-2023 filter at the normalize step. (Exception: facility records have no date; they pass through.)

## Client / UI implications

### New layer toggles

The existing toggle has Incidents + Damaged-buildings. We add:

- Cropland damage (A1) — toggleable polygon fill.
- Road damage (A2) — toggleable polyline overlay.
- Greenhouse damage (A3) — toggleable polygon fill.
- Health facilities (A4 or A5) — small icon overlay; subtle, default off.
- Education facilities (A5) — same.

Open question: how many simultaneous toggles is too many? At some point the layer-toggle UI should become a grouped panel rather than a flat checklist. Resolved in implementation.

### Side panel cases

New side-panel modes:

- **Damage feature (polygon / line)** — kind, status, assessment date, source. Clicking a cropland polygon shows assessment date and damaged area.
- **Facility** — name, kind, governorate, source. No timeline content.

Incident, Damage (existing building), Damage-feature, and Facility are all distinct panel modes. The existing `side-panel.ts` already has two modes (incident / damage); we extend to four.

### Attribution

Each record's panel surfaces its source org with the agreed attribution string. Add an /about page (currently absent) that lists every source, its license, and a link to the data hub. This is non-negotiable for the CC BY / CC BY-SA / ODbL terms.

### Counters in the header

The header currently shows three live counters (Incidents / Buildings / Killed). Consider adding:

- **Cropland damaged (km²)** or **roads damaged (km)** — derived from A1/A2 totals. Probably one, not both, to avoid header clutter.

Decided at implementation time based on visual density.

## Build sequence

**Phase A — clear-licensed (no waiting):**

1. A1 + A2 + A3 UNOSAT extended damage layers. Same pattern as existing `fetch-ocha.ts`. Three layers, can ship together or one at a time.
2. A4 / A5 facilities layer. Smallest visual impact; do last in Phase A.

**Phase B — permission-conditional:**

For each Tier B yes:

3. Per-source fetch + normalize + integration. Order by which permission lands first.

If no Tier B permissions come through, Phase A is the entirety of the work and still represents a substantial expansion (three new damage categories + facilities overlay).

## Risks & open questions

1. **CC BY-SA share-alike contagion.** Mitigated by keeping the SA-licensed outputs in separate files with explicit per-file license declaration. Confirm the approach with a brief LICENSE.md addition before shipping.

2. **Layer-toggle UI overcrowding.** With 5–7 layer toggles, the current flat checklist becomes unwieldy. Implementation will likely group toggles (Events / Damage / Reference).

3. **No permission responses.** If all three Tier B requests stall or get declined, Phase A still ships meaningfully. There is no scenario where we wait indefinitely.

4. **HOT/OSM completeness vs. OCHA accuracy.** Unknown which is better for Gaza-specific facility coverage. Decide after a one-day discovery comparison during A4/A5 implementation.

## References

- Original spec: `docs/superpowers/specs/2026-05-21-gaza-exhibit-design.md`
- Original handoff: `docs/superpowers/HANDOFF.md` ("Available datasets that COULD be integrated" table)
- ACLED licensing correspondence: in session chat history, 2026-05-23
- HDX dataset discovery report: in session chat history, 2026-05-23
- Forensic Architecture public data: https://github.com/forensic-architecture/gaza-public-data
- CIR FeatureServer: https://services-eu1.arcgis.com/06WOSMGHsCnaFyMp/arcgis/rest/services/Indigo_Incidents_Layer_view/FeatureServer/0

## Next step

After user approval of this spec: invoke the `writing-plans` skill to produce a step-by-step implementation plan for **Phase A1 (UNOSAT extended damage layers)** as the first concrete deliverable. Subsequent phases get their own plans.
