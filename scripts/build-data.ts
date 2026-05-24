import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fetchAirwars } from './fetch-airwars';
import { fetchUcdp } from './fetch-ucdp';
import { fetchOcha } from './fetch-ocha';
import { fetchOsmFacilities } from './fetch-osm-facilities';
import { normalizeAirwarsRecord, type AirwarsTaxonomies, type ArticleData } from './normalize-airwars';
import { normalizeUcdpRecord } from './normalize-ucdp';
import { normalizeOchaFeature } from './normalize-ocha';
import { normalizeOsmFacility } from './normalize-osm-facilities';
import { dedupeIncidents } from './dedupe';
import type { Incident, BuildMeta, DamageRecord, DamageStatus, FacilityRecord } from '../shared/types';

const AIRWARS_RAW = 'data/raw/airwars';
const ARTICLES_DIR = 'data/raw/airwars/articles';
const UCDP_RAW = 'data/raw/ucdp';
const OCHA_RAW = 'data/raw/ocha';
const OSM_RAW = 'data/raw/osm';
const OUT_DIR = 'public/data';

async function loadAirwarsPages(): Promise<unknown[]> {
  const files = (await readdir(AIRWARS_RAW)).filter((f) => f.startsWith('page-') && f.endsWith('.json'));
  files.sort();
  const all: unknown[] = [];
  for (const f of files) {
    const data = JSON.parse(await readFile(join(AIRWARS_RAW, f), 'utf8'));
    if (Array.isArray(data)) all.push(...data);
  }
  return all;
}

async function loadTaxonomies(): Promise<AirwarsTaxonomies> {
  return JSON.parse(await readFile(join(AIRWARS_RAW, 'taxonomies.json'), 'utf8'));
}

async function loadArticles(): Promise<Map<string, ArticleData>> {
  try {
    const files = (await readdir(ARTICLES_DIR)).filter((f) => f.endsWith('.json'));
    const out = new Map<string, ArticleData>();
    for (const f of files) {
      const data = JSON.parse(await readFile(join(ARTICLES_DIR, f), 'utf8')) as ArticleData;
      const slug = f.replace(/\.json$/, '');
      out.set(slug, data);
    }
    return out;
  } catch { return new Map(); }
}

async function loadUcdpRows(): Promise<unknown[]> {
  try {
    return JSON.parse(await readFile(join(UCDP_RAW, 'gaza-events.json'), 'utf8'));
  } catch { return []; }
}

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

async function loadOchaFeatures(): Promise<GeoJSON.Feature[]> {
  try {
    const fc = JSON.parse(await readFile(join(OCHA_RAW, 'damage.geojson'), 'utf8')) as GeoJSON.FeatureCollection;
    return fc.features ?? [];
  } catch { return []; }
}

async function main(): Promise<void> {
  await fetchAirwars();
  await fetchUcdp();
  await fetchOcha();
  await fetchOsmFacilities();

  const airwarsRaws = await loadAirwarsPages();
  const taxonomies = await loadTaxonomies();
  const articles = await loadArticles();
  const ucdpRaws = await loadUcdpRows();
  console.log(`Loaded ${airwarsRaws.length} Airwars + ${ucdpRaws.length} UCDP raw records`);
  console.log(`  + ${articles.size} Airwars article files`);

  const airwarsIncidents: Incident[] = [];
  let airwarsUnplotted = 0;
  for (const raw of airwarsRaws) {
    const inc = normalizeAirwarsRecord(raw as never, taxonomies, articles);
    if (inc) airwarsIncidents.push(inc);
    else airwarsUnplotted++;
  }
  const ucdpIncidents: Incident[] = [];
  let ucdpUnplotted = 0;
  for (const raw of ucdpRaws) {
    const inc = normalizeUcdpRecord(raw as never);
    if (inc) ucdpIncidents.push(inc);
    else ucdpUnplotted++;
  }
  console.log(`Normalized ${airwarsIncidents.length} Airwars + ${ucdpIncidents.length} UCDP incidents`);
  console.log(`  Unplotted: ${airwarsUnplotted} Airwars, ${ucdpUnplotted} UCDP`);

  const { incidents: dedupedIncidents, merges } = dedupeIncidents([...airwarsIncidents, ...ucdpIncidents]);
  console.log(`Dedup: ${airwarsIncidents.length + ucdpIncidents.length} → ${dedupedIncidents.length} (${merges} merges)`);

  // Clip to the start of the war. Pre-Oct-7-2023 records are pre-war and
  // shouldn't appear in the exhibit's timeline. Keeps the bundle smaller too.
  const CONFLICT_START = '2023-10-07';
  const incidents = dedupedIncidents.filter((i) => i.date >= CONFLICT_START);
  const preWarDropped = dedupedIncidents.length - incidents.length;
  console.log(`Filtered to ${CONFLICT_START}+: ${incidents.length} (dropped ${preWarDropped} pre-war records)`);

  incidents.sort((a, b) => a.date.localeCompare(b.date));

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(join(OUT_DIR, 'incidents.json'), JSON.stringify(incidents));

  // OCHA UNOSAT damage layer
  const ochaFeatures = await loadOchaFeatures();
  console.log(`Loaded ${ochaFeatures.length} OCHA damage features`);
  const damageRecords: DamageRecord[] = [];
  let ochaRejected = 0;
  const statusCounts: Record<DamageStatus, number> = {
    destroyed: 0,
    severe: 0,
    moderate: 0,
    possibly_damaged: 0,
  };
  for (const feat of ochaFeatures) {
    const dr = normalizeOchaFeature(feat);
    if (dr) {
      damageRecords.push(dr);
      statusCounts[dr.status]++;
    } else {
      ochaRejected++;
    }
  }
  console.log(`Normalized ${damageRecords.length} damage records (${ochaRejected} rejected as non-buildings/out-of-bbox)`);
  console.log(`  Damage distribution: destroyed=${statusCounts.destroyed}, severe=${statusCounts.severe}, moderate=${statusCounts.moderate}, possibly_damaged=${statusCounts.possibly_damaged}`);

  // Same conflict-start clip for damage records — buildings first damaged
  // before Oct 7 2023 are pre-war baselines that shouldn't appear in the
  // war exhibit's timeline.
  const damageInConflict = damageRecords.filter((d) => d.assessment_date >= CONFLICT_START);
  const preWarDamageDropped = damageRecords.length - damageInConflict.length;
  console.log(`Filtered damage to ${CONFLICT_START}+: ${damageInConflict.length} (dropped ${preWarDamageDropped} pre-war assessments)`);

  // Carry through the rich detail (governorate + progression) onto the slim
  // public feature collection so the side panel can render a per-building
  // report when a damage dot is clicked.
  const rawDamageBySlug = new Map<string, { governorate: string; progression: Array<{ date: string; class: number }> }>();
  for (const feat of ochaFeatures) {
    const p = (feat.properties ?? {}) as Record<string, unknown>;
    const id = `unosat-${p.OBJECTID}`;
    rawDamageBySlug.set(id, {
      governorate: typeof p.governorate === 'string' ? p.governorate : '',
      progression: Array.isArray(p.progression) ? (p.progression as Array<{ date: string; class: number }>) : [],
    });
  }

  const damageFc: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: damageInConflict.map((d) => {
      const extra = rawDamageBySlug.get(d.id);
      return {
        type: 'Feature',
        id: d.id,
        geometry: { type: 'Point', coordinates: [d.location.lon, d.location.lat] },
        properties: {
          id: d.id,
          status: d.status,
          assessment_date: d.assessment_date,
          governorate: extra?.governorate ?? '',
          progression: extra?.progression ?? [],
        },
      };
    }),
  };
  await writeFile(join(OUT_DIR, 'damage.geojson'), JSON.stringify(damageFc));
  console.log(`Wrote ${damageInConflict.length} damage records to ${OUT_DIR}/damage.geojson`);

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
  await writeFile(join(OUT_DIR, 'meta.json'), JSON.stringify(meta, null, 2));

  const multiSourceCount = incidents.filter((i) => i.sources.length > 1).length;
  console.log(`Wrote ${incidents.length} incidents (${multiSourceCount} multi-source) to ${OUT_DIR}/incidents.json`);
  console.log(`Build complete.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
