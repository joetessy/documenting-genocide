import { mkdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const BASE = 'https://airwars.org/wp-json/wp/v2/civ';
const COUNTRY_ID = 767;           // Palestinian Territories
const PER_PAGE = 100;
const OUT_DIR = 'data/raw/airwars';

const FIELDS = [
  'id',
  'date',
  'modified',
  'slug',
  'link',
  'title',
  'acf',
  'country',
  'belligerent',
  'strike_type',
  'civilian_harm_status',
  'geolocation_status',
  'casualty',
  'munition',
].join(',');

function userAgent(): string {
  const email = process.env.AIRWARS_CONTACT_EMAIL;
  const contact = email ? ` (contact: ${email})` : '';
  return `gaza-exhibit/0.1 build-time-fetch${contact}`;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function fetchPage(page: number): Promise<{ records: unknown[]; totalPages: number }> {
  const url = `${BASE}?country=${COUNTRY_ID}&per_page=${PER_PAGE}&page=${page}&_fields=${FIELDS}`;
  const res = await fetch(url, { headers: { 'User-Agent': userAgent(), Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Airwars fetch failed: page=${page} status=${res.status}`);
  const totalPages = Number(res.headers.get('X-WP-TotalPages') ?? '0');
  const records = (await res.json()) as unknown[];
  return { records, totalPages };
}

async function fetchTaxonomy(slug: string): Promise<Record<string, { name: string; slug: string }>> {
  // Resolve term IDs to human names for civilian_harm_status, strike_type, etc.
  const url = `https://airwars.org/wp-json/wp/v2/${slug}?per_page=100&_fields=id,name,slug`;
  const res = await fetch(url, { headers: { 'User-Agent': userAgent() } });
  if (!res.ok) throw new Error(`Taxonomy fetch failed: ${slug} status=${res.status}`);
  const terms = (await res.json()) as Array<{ id: number; name: string; slug: string }>;
  const out: Record<string, { name: string; slug: string }> = {};
  for (const t of terms) out[String(t.id)] = { name: t.name, slug: t.slug };
  return out;
}

export async function fetchAirwars(opts: { refresh?: boolean } = {}): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });

  // Taxonomies first — small, always re-fetch.
  const taxonomies = {
    civilian_harm_status: await fetchTaxonomy('civilian_harm_status'),
    strike_type: await fetchTaxonomy('strike_type'),
    casualty: await fetchTaxonomy('casualty'),
  };
  // Minified — files are committed to the repo, keep size down.
  await writeFile(join(OUT_DIR, 'taxonomies.json'), JSON.stringify(taxonomies));

  // First page tells us total pages.
  const first = await fetchPage(1);
  await writeFile(join(OUT_DIR, 'page-001.json'), JSON.stringify(first.records));
  console.log(`Fetched page 1/${first.totalPages} (${first.records.length} records)`);

  for (let p = 2; p <= first.totalPages; p++) {
    const path = join(OUT_DIR, `page-${String(p).padStart(3, '0')}.json`);
    if (!opts.refresh && (await fileExists(path))) {
      console.log(`Skipping page ${p}/${first.totalPages} (cached)`);
      continue;
    }
    await sleep(500);  // ~2 req/s throttle, polite to Cloudflare
    const { records } = await fetchPage(p);
    await writeFile(path, JSON.stringify(records));
    console.log(`Fetched page ${p}/${first.totalPages} (${records.length} records)`);
  }
  console.log('Airwars fetch complete.');
}

// CLI entry
if (import.meta.url === `file://${process.argv[1]}`) {
  const refresh = process.argv.includes('--refresh');
  fetchAirwars({ refresh }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
