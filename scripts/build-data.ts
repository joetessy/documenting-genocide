import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fetchAirwars } from './fetch-airwars';
import { normalizeAirwarsRecord, type AirwarsTaxonomies, type ArticleData } from './normalize-airwars';
import type { Incident, BuildMeta } from '../shared/types';

const RAW_DIR = 'data/raw/airwars';
const ARTICLES_DIR = 'data/raw/airwars/articles';
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
  } catch {
    return new Map();
  }
}

async function main(): Promise<void> {
  await fetchAirwars();

  const raws = await loadAirwarsPages();
  const taxonomies = await loadTaxonomies();
  const articles = await loadArticles();
  console.log(`Loaded ${raws.length} raw Airwars records and ${articles.size} article files`);

  const incidents: Incident[] = [];
  let unplotted = 0;
  for (const raw of raws) {
    const incident = normalizeAirwarsRecord(raw as never, taxonomies, articles);
    if (incident) incidents.push(incident);
    else unplotted++;
  }

  incidents.sort((a, b) => a.date.localeCompare(b.date));

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(join(OUT_DIR, 'incidents.json'), JSON.stringify(incidents));
  const assessedCount = incidents.filter((i) => i.description.length > 1).length;
  const meta: BuildMeta = {
    build_date: new Date().toISOString(),
    source_counts: { airwars: incidents.length },
    dedup_merges: 0,
    unplotted_count: unplotted,
  };
  await writeFile(join(OUT_DIR, 'meta.json'), JSON.stringify(meta, null, 2));

  console.log(`Wrote ${incidents.length} incidents to ${OUT_DIR}/incidents.json`);
  console.log(`  - With multi-paragraph narratives: ${assessedCount}`);
  console.log(`  - Title-only fallback: ${incidents.length - assessedCount}`);
  console.log(`Unplotted: ${unplotted}`);
  console.log(`Build complete.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
