import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fetchAirwars } from './fetch-airwars';
import { normalizeAirwarsRecord, type AirwarsTaxonomies } from './normalize-airwars';
import type { Incident, BuildMeta } from '../shared/types';

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
