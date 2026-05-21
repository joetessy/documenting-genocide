import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fetchAirwars } from './fetch-airwars';
import { fetchUcdp } from './fetch-ucdp';
import { fetchOcha } from './fetch-ocha';
import { normalizeAirwarsRecord, type AirwarsTaxonomies, type ArticleData } from './normalize-airwars';
import { normalizeUcdpRecord } from './normalize-ucdp';
import { normalizeOchaFeature } from './normalize-ocha';
import { dedupeIncidents } from './dedupe';
import type { Incident, BuildMeta, DamageRecord, DamageStatus } from '../shared/types';

const AIRWARS_RAW = 'data/raw/airwars';
const ARTICLES_DIR = 'data/raw/airwars/articles';
const UCDP_RAW = 'data/raw/ucdp';
const OCHA_RAW = 'data/raw/ocha';
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

  const { incidents, merges } = dedupeIncidents([...airwarsIncidents, ...ucdpIncidents]);
  console.log(`Dedup: ${airwarsIncidents.length + ucdpIncidents.length} → ${incidents.length} (${merges} merges)`);

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

  const damageFc: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: damageRecords.map((d) => ({
      type: 'Feature',
      id: d.id,
      geometry: { type: 'Point', coordinates: [d.location.lon, d.location.lat] },
      properties: { id: d.id, status: d.status, assessment_date: d.assessment_date },
    })),
  };
  await writeFile(join(OUT_DIR, 'damage.geojson'), JSON.stringify(damageFc));
  console.log(`Wrote ${damageRecords.length} damage records to ${OUT_DIR}/damage.geojson`);

  const meta: BuildMeta = {
    build_date: new Date().toISOString(),
    source_counts: { airwars: airwarsIncidents.length, ucdp: ucdpIncidents.length },
    dedup_merges: merges,
    unplotted_count: airwarsUnplotted + ucdpUnplotted,
    damage_count: damageRecords.length,
  };
  await writeFile(join(OUT_DIR, 'meta.json'), JSON.stringify(meta, null, 2));

  const multiSourceCount = incidents.filter((i) => i.sources.length > 1).length;
  console.log(`Wrote ${incidents.length} incidents (${multiSourceCount} multi-source) to ${OUT_DIR}/incidents.json`);
  console.log(`Build complete.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
