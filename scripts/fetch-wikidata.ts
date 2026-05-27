import { mkdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';

// Pulls geolocated, dated events that are `part of` (P361) the Gaza war
// (Q122962941) from Wikidata, then enriches each with the lead paragraph
// of the corresponding Wikipedia article. To cover events that Wikipedia
// editors have written about but nobody has yet added to Wikidata, we
// also scrape a handful of Gaza-war topical categories on en.wikipedia
// and look up their page coordinates + lead extract directly.
//
// Both sources collapse into a single logical 'wikidata' SourceOrg in
// the normalize step — Wikipedia text is treated as enrichment over the
// Wikidata structural backbone.

const SPARQL_URL = 'https://query.wikidata.org/sparql';
const MEDIAWIKI_URL = 'https://en.wikipedia.org/w/api.php';
const OUT_DIR = 'data/raw/wikidata';
const OUT_FILE = 'incidents.json';
const USER_AGENT = 'GazaExhibit/1.0 (educational; +https://github.com/anonymous/gaza-exhibit)';
// The `extracts` prop is capped at 20 results per request even with
// `exlimit=max` — exceed that and the rest of the batch comes back without
// an extract field. Both `fetchExtracts` and `fetchPageDetails` chunk to
// this size since they both request extracts.
const MAX_EXTRACTS_PER_QUERY = 20;
// Polite delay between MediaWiki calls — they ask for ~200ms between requests.
const REQUEST_DELAY_MS = 250;

const SPARQL_QUERY = `SELECT ?event ?eventLabel ?date ?coord ?deaths ?article WHERE {
  ?event wdt:P361 wd:Q122962941.
  ?event wdt:P585 ?date.
  ?event wdt:P625 ?coord.
  OPTIONAL { ?event wdt:P1120 ?deaths. }
  OPTIONAL { ?article schema:about ?event.
             ?article schema:isPartOf <https://en.wikipedia.org/>. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;

// Top-level Wikipedia categories to crawl. Subcategories (e.g. yearly
// rollups like "Category:2024 massacres in the Gaza war") are followed
// one level deep.
const SEED_CATEGORIES = [
  'Massacres in the Gaza war',
  'Attacks on hospitals during the Gaza war',
  'Attacks on schools during the Gaza war',
  'Attacks on refugee camps during the Gaza war',
  'Terrorist incidents during the Gaza war',
];

export interface WikidataEvent {
  id: string;              // Wikidata QID like 'Q123109101', or wp:<slug> fallback
  label: string;           // English label
  date: string;            // ISO YYYY-MM-DD
  lat: number;
  lon: number;
  deaths: number | null;
  description: string;     // Wikipedia lead-paragraph plaintext, or ''
  wikipediaUrl: string | null;
  wikidataUrl: string;     // QID URL, or '' when no QID (kept as string for type stability)
}

interface SparqlBinding {
  event: { value: string };
  eventLabel?: { value: string };
  date: { value: string };
  coord: { value: string };
  deaths?: { value: string };
  article?: { value: string };
}

interface SparqlResponse {
  results: { bindings: SparqlBinding[] };
}

interface MediaWikiPage {
  pageid: number;
  title: string;
  extract?: string;
  coordinates?: Array<{ lat: number; lon: number; primary?: string; globe?: string }>;
  pageprops?: { wikibase_item?: string };
}

interface MediaWikiQueryResponse {
  query?: {
    pages?: Record<string, MediaWikiPage>;
    categorymembers?: Array<{ pageid: number; ns: number; title: string }>;
    normalized?: Array<{ from: string; to: string }>;
    redirects?: Array<{ from: string; to: string }>;
  };
  continue?: { cmcontinue?: string };
}

/** Resolve an original input title to whatever the API ended up calling it
 * after applying its normalization + redirect chains. The API returns these
 * as two ordered arrays — input → normalized → redirect target. */
function resolveTitle(
  original: string,
  normalized: Array<{ from: string; to: string }> | undefined,
  redirects: Array<{ from: string; to: string }> | undefined,
): string {
  let cur = original;
  for (const n of normalized ?? []) if (n.from === cur) cur = n.to;
  for (const r of redirects ?? []) if (r.from === cur) cur = r.to;
  return cur;
}

async function fileExists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function runSparql(query: string): Promise<SparqlResponse> {
  const body = new URLSearchParams({ query });
  const res = await fetch(SPARQL_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/sparql-results+json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body,
  });
  if (!res.ok) throw new Error(`SPARQL request failed: ${res.status} ${res.statusText}`);
  return (await res.json()) as SparqlResponse;
}

async function fetchMediaWiki(params: Record<string, string>): Promise<MediaWikiQueryResponse> {
  const url = new URL(MEDIAWIKI_URL);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '1');
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`MediaWiki request failed: ${res.status} ${res.statusText}`);
  return (await res.json()) as MediaWikiQueryResponse;
}

/** Parse a WKT POINT — `Point(lon lat)`. Note the order is lon-then-lat. */
export function parseWktPoint(wkt: string): { lat: number; lon: number } | null {
  const m = /^Point\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)$/i.exec(wkt);
  if (!m) return null;
  const lon = Number(m[1]);
  const lat = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

/** Extract Wikidata QID from a URI like `http://www.wikidata.org/entity/Q123` */
function qidFromUri(uri: string): string | null {
  const m = /\/(Q\d+)$/.exec(uri);
  return m ? m[1] : null;
}

/** Extract a Wikipedia article title from a URL like `https://en.wikipedia.org/wiki/Foo_bar` */
function titleFromWikipediaUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith('wikipedia.org')) return null;
    const m = /^\/wiki\/(.+)$/.exec(u.pathname);
    if (!m) return null;
    return decodeURIComponent(m[1]).replace(/_/g, ' ');
  } catch { return null; }
}

/** Drop the time portion of an ISO datetime (`2023-10-17T00:00:00Z` → `2023-10-17`). */
function truncateDate(iso: string): string {
  const i = iso.indexOf('T');
  return i === -1 ? iso : iso.slice(0, i);
}

interface SparqlAggregate {
  qid: string;
  label: string;
  date: string;
  lat: number;
  lon: number;
  deaths: number | null;
  wikipediaUrl: string | null;
}

/** Group SPARQL bindings by QID. Some events have multiple death-toll statements;
 * we keep the max. Multiple Wikipedia articles per event are rare but we keep the first. */
function aggregateSparqlBindings(bindings: SparqlBinding[]): SparqlAggregate[] {
  const byQid = new Map<string, SparqlAggregate>();
  for (const b of bindings) {
    const qid = qidFromUri(b.event.value);
    if (!qid) continue;
    const pt = parseWktPoint(b.coord.value);
    if (!pt) continue;
    const date = truncateDate(b.date.value);
    const label = b.eventLabel?.value ?? '';
    const deaths = b.deaths?.value ? Number(b.deaths.value) : null;
    const wikipediaUrl = b.article?.value ?? null;

    const existing = byQid.get(qid);
    if (!existing) {
      byQid.set(qid, { qid, label, date, lat: pt.lat, lon: pt.lon, deaths, wikipediaUrl });
    } else {
      // Multiple deaths counts — take the max.
      if (deaths !== null && (existing.deaths === null || deaths > existing.deaths)) {
        existing.deaths = deaths;
      }
      if (!existing.wikipediaUrl && wikipediaUrl) existing.wikipediaUrl = wikipediaUrl;
      if (!existing.label && label) existing.label = label;
    }
  }
  return Array.from(byQid.values());
}

/** Chunk an array into fixed-size slices. */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Batch-fetch lead-paragraph extracts from the MediaWiki API. The returned
 * map is keyed by the ORIGINAL input title — i.e. callers don't need to know
 * about MediaWiki's normalization or redirect machinery. */
async function fetchExtracts(titles: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const group of chunk(titles, MAX_EXTRACTS_PER_QUERY)) {
    await sleep(REQUEST_DELAY_MS);
    const data = await fetchMediaWiki({
      action: 'query',
      prop: 'extracts',
      exintro: '1',
      explaintext: '1',
      exlimit: 'max',
      titles: group.join('|'),
      redirects: '1',
    });
    const pages = data.query?.pages ?? {};
    const normalized = data.query?.normalized;
    const redirects = data.query?.redirects;
    // Index extracts by the page's canonical title.
    const extractByTitle = new Map<string, string>();
    for (const page of Object.values(pages)) {
      if (page.title && typeof page.extract === 'string') {
        extractByTitle.set(page.title, page.extract.trim());
      }
    }
    // For each input title, follow redirects to find the matching extract.
    for (const input of group) {
      const resolved = resolveTitle(input, normalized, redirects);
      const extract = extractByTitle.get(resolved);
      if (extract) out.set(input, extract);
    }
  }
  return out;
}

/** Fetch coordinates + pageprops + extracts for a batch of titles. Returned
 * map is keyed by the ORIGINAL input title (pre-redirect-resolution).
 * Capped at MAX_EXTRACTS_PER_QUERY because the `extracts` prop limits results. */
async function fetchPageDetails(titles: string[]): Promise<Map<string, MediaWikiPage>> {
  const out = new Map<string, MediaWikiPage>();
  for (const group of chunk(titles, MAX_EXTRACTS_PER_QUERY)) {
    await sleep(REQUEST_DELAY_MS);
    const data = await fetchMediaWiki({
      action: 'query',
      prop: 'coordinates|pageprops|extracts',
      exintro: '1',
      explaintext: '1',
      exlimit: 'max',
      coprop: 'type|name|globe',
      ppprop: 'wikibase_item',
      titles: group.join('|'),
      redirects: '1',
    });
    const pages = data.query?.pages ?? {};
    const normalized = data.query?.normalized;
    const redirects = data.query?.redirects;
    const pageByTitle = new Map<string, MediaWikiPage>();
    for (const page of Object.values(pages)) {
      if (page.title) pageByTitle.set(page.title, page);
    }
    for (const input of group) {
      const resolved = resolveTitle(input, normalized, redirects);
      const page = pageByTitle.get(resolved);
      if (page) out.set(input, page);
    }
  }
  return out;
}

/** List the page titles in a Wikipedia category. ns=0 → real articles only. */
async function listCategoryArticles(category: string): Promise<string[]> {
  const titles: string[] = [];
  let cmcontinue: string | undefined;
  do {
    await sleep(REQUEST_DELAY_MS);
    const params: Record<string, string> = {
      action: 'query',
      list: 'categorymembers',
      cmtitle: `Category:${category}`,
      cmlimit: '500',
      cmtype: 'page|subcat',
    };
    if (cmcontinue) params.cmcontinue = cmcontinue;
    const data = await fetchMediaWiki(params);
    const members = data.query?.categorymembers ?? [];
    for (const m of members) {
      if (m.ns === 0) {
        titles.push(m.title);
      } else if (m.ns === 14) {
        // Subcategory — recurse one level deep. Drop the "Category:" prefix.
        const sub = m.title.replace(/^Category:/, '');
        await sleep(REQUEST_DELAY_MS);
        const subParams: Record<string, string> = {
          action: 'query',
          list: 'categorymembers',
          cmtitle: `Category:${sub}`,
          cmlimit: '500',
          cmtype: 'page',
        };
        const subData = await fetchMediaWiki(subParams);
        const subMembers = subData.query?.categorymembers ?? [];
        for (const sm of subMembers) {
          if (sm.ns === 0) titles.push(sm.title);
        }
      }
    }
    cmcontinue = data.continue?.cmcontinue;
  } while (cmcontinue);
  return titles;
}

/** Pull every event from Wikidata + enrich with Wikipedia lead extracts. */
export async function gatherWikidataEvents(): Promise<WikidataEvent[]> {
  console.log('Running SPARQL query against Wikidata...');
  const sparql = await runSparql(SPARQL_QUERY);
  const aggregates = aggregateSparqlBindings(sparql.results.bindings);
  console.log(`  ${aggregates.length} distinct Wikidata events`);

  // Build a title → aggregate(s) lookup so we can attach the extract back.
  const titleToAggregate = new Map<string, SparqlAggregate>();
  for (const agg of aggregates) {
    if (!agg.wikipediaUrl) continue;
    const title = titleFromWikipediaUrl(agg.wikipediaUrl);
    if (title) titleToAggregate.set(title, agg);
  }

  if (titleToAggregate.size > 0) {
    console.log(`  fetching lead extracts for ${titleToAggregate.size} Wikipedia articles...`);
    const extracts = await fetchExtracts(Array.from(titleToAggregate.keys()));
    for (const [title, extract] of extracts) {
      const agg = titleToAggregate.get(title);
      if (agg) (agg as SparqlAggregate & { extract?: string }).extract = extract;
    }
  }

  return aggregates.map((agg) => ({
    id: agg.qid,
    label: agg.label,
    date: agg.date,
    lat: agg.lat,
    lon: agg.lon,
    deaths: agg.deaths,
    description: (agg as SparqlAggregate & { extract?: string }).extract ?? '',
    wikipediaUrl: agg.wikipediaUrl,
    wikidataUrl: `http://www.wikidata.org/entity/${agg.qid}`,
  }));
}

/** Slugify a title for use as a deterministic fallback id. */
function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Crawl Wikipedia categories for incidents not yet in Wikidata. */
export async function gatherWikipediaCategoryEvents(existingQids: Set<string>): Promise<WikidataEvent[]> {
  // 1. Pull article titles from every seed category (and one level of subcats).
  console.log(`Crawling ${SEED_CATEGORIES.length} Wikipedia categories...`);
  const seen = new Set<string>();
  for (const cat of SEED_CATEGORIES) {
    const titles = await listCategoryArticles(cat);
    console.log(`  Category:${cat} — ${titles.length} articles`);
    for (const t of titles) seen.add(t);
  }
  console.log(`  ${seen.size} unique candidate articles across all categories`);

  // 2. Pull coordinates + pageprops + extracts for each candidate.
  const details = await fetchPageDetails(Array.from(seen));

  // 3. Filter to articles that have coords and aren't already covered by Wikidata.
  const out: WikidataEvent[] = [];
  for (const page of details.values()) {
    const coord = page.coordinates?.find((c) => c.primary === '' || c.primary === undefined) ?? page.coordinates?.[0];
    if (!coord) continue;
    const qid = page.pageprops?.wikibase_item;
    if (qid && existingQids.has(qid)) continue;     // already in Wikidata results
    const lat = Number(coord.lat);
    const lon = Number(coord.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const title = page.title;
    const id = qid ?? `wp:${slugifyTitle(title)}`;
    out.push({
      id,
      label: title,
      // Date is not exposed via pageprops; the normalize step rejects entries
      // without an ISO YYYY-MM-DD date, so we punt and let it skip.
      date: '',
      lat,
      lon,
      deaths: null,
      description: typeof page.extract === 'string' ? page.extract.trim() : '',
      wikipediaUrl: `https://en.wikipedia.org/wiki/${title.replace(/ /g, '_')}`,
      wikidataUrl: qid ? `http://www.wikidata.org/entity/${qid}` : '',
    });
  }
  return out;
}

/** Try to extract an ISO YYYY-MM-DD from a Wikipedia lead extract — pattern like
 * "On 17 October 2023" or "the 7 October attacks". Returns the first such date
 * found, or null. Used to fill in dates for category-sourced events that don't
 * have a Wikidata P585 statement. */
export function extractDateFromExtract(text: string): string | null {
  if (!text) return null;
  const months: Record<string, string> = {
    january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
    july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
  };
  // Match either "17 October 2023" (DMY) or "October 17, 2023" (MDY).
  const dmy = /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i;
  const mdy = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/i;
  let m = dmy.exec(text);
  if (m) {
    const day = m[1].padStart(2, '0');
    const month = months[m[2].toLowerCase()];
    return `${m[3]}-${month}-${day}`;
  }
  m = mdy.exec(text);
  if (m) {
    const month = months[m[1].toLowerCase()];
    const day = m[2].padStart(2, '0');
    return `${m[3]}-${month}-${day}`;
  }
  return null;
}

export async function fetchWikidata(opts: { refresh?: boolean } = {}): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const outPath = join(OUT_DIR, OUT_FILE);
  if (!opts.refresh && (await fileExists(outPath))) {
    console.log(`Wikidata snapshot already exists at ${outPath} — pass --refresh to re-download.`);
    return;
  }

  const wikidataEvents = await gatherWikidataEvents();
  const existingQids = new Set<string>();
  for (const e of wikidataEvents) {
    if (e.id.startsWith('Q')) existingQids.add(e.id);
  }
  const wikipediaEvents = await gatherWikipediaCategoryEvents(existingQids);
  console.log(`  ${wikipediaEvents.length} additional category-sourced events`);

  // Fill in best-guess dates for category-sourced events (which lack a P585).
  for (const e of wikipediaEvents) {
    if (!e.date) {
      const guess = extractDateFromExtract(e.description);
      if (guess) e.date = guess;
    }
  }

  // Final dedup: union by id. Wikidata events take priority over category-sourced.
  const byId = new Map<string, WikidataEvent>();
  for (const e of wikidataEvents) byId.set(e.id, e);
  for (const e of wikipediaEvents) if (!byId.has(e.id)) byId.set(e.id, e);
  const merged = Array.from(byId.values());

  await writeFile(outPath, JSON.stringify(merged));
  console.log(`Wrote ${merged.length} events to ${outPath}`);
}

// CLI entry
if (import.meta.url === `file://${process.argv[1]}`) {
  const refresh = process.argv.includes('--refresh');
  fetchWikidata({ refresh }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
