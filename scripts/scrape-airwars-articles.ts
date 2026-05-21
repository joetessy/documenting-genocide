import { mkdir, readFile, readdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import * as cheerio from 'cheerio';

const PAGE_DIR = 'data/raw/airwars';
const OUT_DIR = 'data/raw/airwars/articles';

export type ArticleStatus = 'assessed' | 'stub' | 'error';

export interface ArticleData {
  slug: string;
  status: ArticleStatus;
  paragraphs: string[];
  error?: string;
}

function userAgent(): string {
  return 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
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

export function slugFromLink(link: string): string | null {
  const m = link.match(/\/civilian-casualties\/([^/]+)\/?$/);
  return m ? m[1] : null;
}

async function loadIncidentLinks(): Promise<Array<{ slug: string; link: string }>> {
  const files = (await readdir(PAGE_DIR)).filter((f) => f.startsWith('page-') && f.endsWith('.json'));
  files.sort();
  const out: Array<{ slug: string; link: string }> = [];
  for (const f of files) {
    const raw = JSON.parse(await readFile(join(PAGE_DIR, f), 'utf8')) as Array<{ link: string }>;
    for (const r of raw) {
      const slug = slugFromLink(r.link);
      if (slug) out.push({ slug, link: r.link });
    }
  }
  return out;
}

export function parseArticleHtml(html: string): { status: ArticleStatus; paragraphs: string[] } {
  const $ = cheerio.load(html);
  const assessment = $('article div[data-anchor-id="assessment"] div.prose').first();
  if (assessment.length === 0) {
    return { status: 'stub', paragraphs: [] };
  }
  const paragraphs: string[] = [];
  assessment.children('p').each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 0) paragraphs.push(text);
  });
  return {
    status: paragraphs.length > 0 ? 'assessed' : 'stub',
    paragraphs,
  };
}

async function fetchArticle(link: string): Promise<string> {
  const res = await fetch(link, {
    headers: {
      'User-Agent': userAgent(),
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept': 'text/html,application/xhtml+xml',
    },
  });
  if (!res.ok) throw new Error(`status ${res.status}`);
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('text/html')) throw new Error(`non-html content-type: ${ct}`);
  return await res.text();
}

export async function scrapeArticles(opts: { refresh?: boolean } = {}): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const links = await loadIncidentLinks();
  console.log(`Discovered ${links.length} incident links`);

  let done = 0;
  let fetched = 0;
  let skipped = 0;
  let errors = 0;

  for (const { slug, link } of links) {
    const out = join(OUT_DIR, `${slug}.json`);
    if (!opts.refresh && (await fileExists(out))) {
      skipped++;
      done++;
      continue;
    }
    try {
      await sleep(800);
      const html = await fetchArticle(link);
      const parsed = parseArticleHtml(html);
      const data: ArticleData = { slug, status: parsed.status, paragraphs: parsed.paragraphs };
      await writeFile(out, JSON.stringify(data));
      fetched++;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const data: ArticleData = { slug, status: 'error', paragraphs: [], error: errMsg };
      await writeFile(out, JSON.stringify(data));
      errors++;
    }
    done++;
    if (done % 50 === 0) {
      console.log(`Progress: ${done}/${links.length} (fetched=${fetched}, skipped=${skipped}, errors=${errors})`);
    }
  }
  console.log(`Scrape complete. Fetched ${fetched}, skipped ${skipped}, errors ${errors}, total ${done}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const refresh = process.argv.includes('--refresh');
  scrapeArticles({ refresh }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
