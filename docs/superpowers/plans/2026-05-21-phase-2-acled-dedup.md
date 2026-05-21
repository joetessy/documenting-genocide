# The Gaza Exhibit — Phase 2 Implementation Plan (ACLED + Dedup + Airwars Narratives)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Layer ACLED conflict-event data on top of the Phase 1 Airwars exhibit, reconcile the two sources with dedup logic, and replace the title-only description field with real narrative text scraped from Airwars article pages.

**Architecture:** Extends the Phase 1 build-time data pipeline. Three new ingestion stages: (a) `scrape-airwars-articles.ts` fetches HTML article pages and extracts narrative paragraphs; (b) `fetch-acled.ts` OAuth2-authenticates and pages through ACLED's API for Gaza events; (c) `dedupe.ts` groups multi-source records by `(date, lat3, lon3)` and merges them into single `Incident` records with multi-source attribution. The unified schema's `description` field becomes `string[]` (paragraph array). The side panel renders multi-paragraph narratives and lists all source attributions.

**Tech Stack:** All existing Phase 1 deps (Vite 6, TypeScript 5, MapLibre, Vitest). Adds **cheerio** for server-side HTML parsing.

**Scope:** This plan covers **Phase 2 (ACLED + dedup)** from the design spec ([2026-05-21-gaza-exhibit-design.md](../specs/2026-05-21-gaza-exhibit-design.md)) **plus** the description-narrative work that was deferred from Phase 1. Phase 3 (OCHA damage layer) and Phase 4 (polish + mobile) are planned separately.

**Reference docs:**
- Phase 1 plan: `docs/superpowers/plans/2026-05-21-phase-0-1-airwars.md` (for established patterns)
- Phase 1 ended at tag `phase-1-airwars` + commit `d8f7d68` (post-fix HEAD).
- Design spec: `docs/superpowers/specs/2026-05-21-gaza-exhibit-design.md`

---

## Prerequisites (manual)

Before any tasks below run the ACLED fetcher, you must:

1. **Register a free ACLED account:** https://acleddata.com/register-for-access/
2. **Accept the Terms of Use** to unlock API access.
3. **Add credentials to `.env`** (gitignored, already so):
   ```
   ACLED_USERNAME=<your-email>
   ACLED_PASSWORD=<your-password>
   ```
4. **Confirm OAuth works** by running this curl after Task 5 lands:
   ```bash
   curl -s -X POST https://acleddata.com/oauth/token \
     -d "username=$ACLED_USERNAME" -d "password=$ACLED_PASSWORD" \
     -d "grant_type=password" -d "client_id=acled" -d "scope=authenticated" \
     | head -c 200
   ```
   Expect a JSON response with `access_token`. If you get an error, the account isn't activated yet.

Tasks 5+ (ACLED ingestion) will halt loudly if credentials are missing. Tasks 1-4 (Airwars narratives) don't require ACLED and can be run independently.

---

## File Structure

```
gaza-exhibit/
├── scripts/
│   ├── fetch-airwars.ts                 (exists, unchanged)
│   ├── scrape-airwars-articles.ts       NEW  — fetch + parse HTML article pages
│   ├── normalize-airwars.ts             MODIFY  — accept article arg, return string[] description
│   ├── fetch-acled.ts                   NEW  — OAuth + paginated ACLED ingest
│   ├── normalize-acled.ts               NEW  — map raw ACLED → Incident
│   ├── dedupe.ts                        NEW  — group + merge across sources
│   └── build-data.ts                    MODIFY  — orchestrate full pipeline
│
├── shared/
│   └── types.ts                         MODIFY  — Incident.description: string[]
│
├── data/raw/
│   ├── airwars/
│   │   ├── page-001.json…page-028.json  (exists)
│   │   ├── taxonomies.json              (exists)
│   │   └── articles/                    NEW (committed, ~2k JSON files)
│   │       └── <slug>.json              NEW per incident
│   └── acled/                           NEW (committed)
│       └── page-001.json…page-NNN.json  NEW
│
├── public/data/
│   ├── incidents.json                   REGENERATE
│   └── meta.json                        REGENERATE
│
├── src/
│   └── ui/
│       └── side-panel.ts                MODIFY — multi-paragraph + multi-source UI
│
├── tests/
│   ├── normalize-airwars.test.ts        MODIFY — update for string[] description + article arg
│   ├── normalize-acled.test.ts          NEW
│   └── dedupe.test.ts                   NEW
│
├── .env.example                         MODIFY  — add ACLED_USERNAME/PASSWORD
└── README.md                            MODIFY  — ACLED setup notes
```

---

## Conventions

- All Phase 1 conventions still apply: extension-less local TS imports, 2-space indent, single quotes, Conventional Commits.
- Each task ends with a commit. TDD where pure logic; manual smoke for UI changes.
- Don't move the `phase-1-airwars` tag — Phase 2 adds new commits and ends with a new `phase-2-acled` tag.

---

## Task 1: Add cheerio + .env.example + README updates

Small setup task. Adds the HTML parser dependency and documents ACLED setup for new contributors.

**Files:**
- Modify: `package.json`, `.env.example`, `README.md`

- [ ] **Step 1: Add `cheerio` to dependencies**

```bash
pnpm add cheerio
```

This should add `"cheerio": "^1.x"` to `dependencies` in `package.json` and update the lockfile.

- [ ] **Step 2: Update `.env.example`**

Replace the existing contents with:

```
# Optional: Airwars contact email for User-Agent header (per their methodology page).
# Falls back to a generic UA if unset.
AIRWARS_CONTACT_EMAIL=

# Required for the ACLED data source (Phase 2+).
# Register a free account at https://acleddata.com/register-for-access/
# Then accept the Terms of Use to unlock API access.
ACLED_USERNAME=
ACLED_PASSWORD=
```

- [ ] **Step 3: Update `README.md`**

In the `## Data sources` section, append after the Airwars line:

```markdown
- [ACLED (Armed Conflict Location & Event Data)](https://acleddata.com/) Palestine/Gaza events. Free academic API. Register at https://acleddata.com/register-for-access/ and set `ACLED_USERNAME` and `ACLED_PASSWORD` in `.env`. Attribution required.
```

Add a new section after `## Data sources`:

```markdown
## Phase 2 data pipeline

The build pipeline fetches and reconciles two sources:
- **Airwars** — civilian-harm incidents with credibility ratings. We also scrape each incident's article page for the narrative paragraphs ("assessed" incidents only; "researched but not assessed" stubs are skipped).
- **ACLED** — conflict-event records with broader actor/event-type taxonomy.

Records from both sources are merged by `(date, lat rounded to 3 decimals, lon rounded to 3 decimals)` ≈ 110m precision. Multi-source incidents preserve every source attribution in the side panel.
```

- [ ] **Step 4: Verify typecheck still passes**

```bash
pnpm typecheck
```

Expected: exits 0. cheerio's types come from the package itself.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml .env.example README.md
git commit -m "chore: add cheerio + document ACLED setup for Phase 2"
```

---

## Task 2: `scrape-airwars-articles.ts` — fetch HTML, extract narrative paragraphs

Fetches each Airwars incident's article HTML, detects whether the incident has been assessed (vs. stub), extracts the narrative paragraphs from `article div[data-anchor-id="assessment"] div.prose > p`, and writes one JSON per slug into `data/raw/airwars/articles/`. Idempotent: skips files that already exist unless `--refresh` is passed.

**Files:**
- Create: `scripts/scrape-airwars-articles.ts`
- Commits: `data/raw/airwars/articles/*.json`

- [ ] **Step 1: Write `scripts/scrape-airwars-articles.ts`**

```ts
import { mkdir, readFile, readdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import * as cheerio from 'cheerio';

const PAGE_DIR = 'data/raw/airwars';
const OUT_DIR = 'data/raw/airwars/articles';

export type ArticleStatus = 'assessed' | 'stub' | 'error';

export interface ArticleData {
  slug: string;
  status: ArticleStatus;
  paragraphs: string[];  // empty for stubs/errors
  error?: string;        // present only when status === 'error'
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

function slugFromLink(link: string): string | null {
  // e.g. "https://airwars.org/civilian-casualties/ispt0097-october-10-2023/"
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

export function parseArticleHtml(html: string): ArticleData {
  const $ = cheerio.load(html);
  const assessment = $('article div[data-anchor-id="assessment"] div.prose').first();
  if (assessment.length === 0) {
    return { slug: '', status: 'stub', paragraphs: [] };
  }
  const paragraphs: string[] = [];
  assessment.children('p').each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 0) paragraphs.push(text);
  });
  return {
    slug: '',
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
      await sleep(800);  // ~1.25 req/s — polite to Cloudflare
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

// CLI entry
if (import.meta.url === `file://${process.argv[1]}`) {
  const refresh = process.argv.includes('--refresh');
  scrapeArticles({ refresh }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 2: Run the scraper** (long-running, ~35-45 min)

**Important:** the scrape takes much longer than Bash's default 2-min timeout. Use `run_in_background: true` and monitor progress.

Launch in background:

```bash
pnpm tsx scripts/scrape-airwars-articles.ts > /tmp/scrape-airwars.log 2>&1
```

Then poll progress every couple of minutes by reading `/tmp/scrape-airwars.log`:

```bash
tail -5 /tmp/scrape-airwars.log
ls data/raw/airwars/articles/ | wc -l
```

Once the file count stabilizes near ~2,700 and the log ends with `Scrape complete. Fetched X, skipped Y, errors Z, total ~2700`, the scrape is done.

Expected:
- Discovers ~2,709 incident links.
- Fetches each article at ~1.25 req/sec.
- Total time: ~35-45 minutes (one-time cost; subsequent runs skip cached).
- Creates ~2,700 JSON files in `data/raw/airwars/articles/`.

If Cloudflare 403s start appearing (unlikely with the Chrome UA + Accept headers), increase the sleep to 1200ms and retry. Errors written to the JSON file with `status: 'error'` are normal at the tail of the long tail — if the count is very high (>10%), stop and investigate.

If the scrape genuinely hits a wall (Cloudflare ban, network issue), report DONE_WITH_CONCERNS and we will diagnose. **Do not fall back to fetching fewer incidents — the snapshot must be comprehensive.**

- [ ] **Step 3: Spot-check article files**

```bash
ls data/raw/airwars/articles/ | wc -l
```

Expected: ~2,700 files.

```bash
# Find an assessed article and read it
for f in data/raw/airwars/articles/ispt0005-*; do
  cat "$f" | head -c 500
  echo
  echo "---"
done | head -40
```

Expected: at least one file with `"status":"assessed"` and non-empty paragraphs containing the real narrative.

```bash
# Count statuses
node -e "
  const fs = require('fs');
  const dir = 'data/raw/airwars/articles';
  const counts = { assessed: 0, stub: 0, error: 0 };
  for (const f of fs.readdirSync(dir)) {
    const d = JSON.parse(fs.readFileSync(\`\${dir}/\${f}\`, 'utf8'));
    counts[d.status] = (counts[d.status] ?? 0) + 1;
  }
  console.log(counts);
"
```

Expected: roughly `{ assessed: ~1000-1500, stub: ~1000-1500, error: <50 }`. Exact ratio depends on how many Gaza incidents Airwars has fully assessed at this point.

- [ ] **Step 4: Verify typecheck**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 5: Commit (including all article files)**

```bash
git add scripts/scrape-airwars-articles.ts data/raw/airwars/articles/
git commit -m "feat: scrape Airwars article narratives and commit snapshot"
```

The article files ARE committed — same rationale as the page snapshots. Snapshot freezes data, no repeat requests on fresh clones.

---

## Task 3: Schema migration — `description: string[]`

Changes `Incident.description` from `string` to `string[]` (array of paragraphs). Updates `normalize-airwars` to wrap its current single string in an array. Updates `side-panel` to render the array as multiple `<p>` tags. Tests updated.

This task is purely a refactor — no behavior change yet. Task 4 makes the array actually contain multi-paragraph narratives.

**Files:**
- Modify: `shared/types.ts`, `scripts/normalize-airwars.ts`, `tests/normalize-airwars.test.ts`, `src/ui/side-panel.ts`

- [ ] **Step 1: Update `shared/types.ts`** — change line `description: string;` to `description: string[];`

The full updated `Incident` interface:

```ts
export interface Incident {
  id: string;
  date: string;          // ISO YYYY-MM-DD
  location: IncidentLocation;
  category: IncidentCategory;
  casualties: Casualties;
  description: string[];  // Array of paragraphs. Phase 1 sources may produce a single-element array.
  sources: SourceAttribution[];
}
```

- [ ] **Step 2: Update `scripts/normalize-airwars.ts`** — wrap the description in an array

Find the line that sets `description`:

```ts
description: decodeHtmlEntities(raw.title?.rendered ?? ''),
```

(If the actual current code differs, adapt. As of Phase 1 HEAD `d8f7d68`, this is the line in `normalizeAirwarsRecord`.)

Replace with:

```ts
description: [decodeHtmlEntities(raw.title?.rendered ?? '')].filter((s) => s.length > 0),
```

The `.filter` drops the array entry if the title was empty, so we end up with `[]` rather than `['']`.

- [ ] **Step 3: Update `tests/normalize-airwars.test.ts`**

Find the existing "produces a complete Incident" test assertion about description. It currently asserts something like:

```ts
// (no explicit description assertion in Phase 1, but add one now)
```

If there's no existing description assertion, add this after the sources block in the "produces a complete Incident" test:

```ts
expect(result!.description).toEqual(['ISPT0097 – October 10, 2023']);
```

Also update the existing HTML-entity-decoding test (which previously expected a string) to expect an array:

```ts
it('decodes HTML entities in description', () => {
  const withEntities = {
    ...SAMPLE_RECORD,
    title: { rendered: 'ISPT0097 &#8211; October 10, 2023' },
  };
  const r = normalizeAirwarsRecord(withEntities, TAXONOMIES)!;
  expect(r.description).toEqual(['ISPT0097 – October 10, 2023']);
});
```

(Search for `description` in the test file and update every assertion to use array shape.)

- [ ] **Step 4: Update `src/ui/side-panel.ts`** — render array as paragraphs

Find the line that renders description in the `open()` function. It currently is:

```ts
<div style="margin-bottom:16px;line-height:1.5">${escapeHtml(incident.description)}</div>
```

Replace with:

```ts
<div style="margin-bottom:16px;line-height:1.5">${incident.description.map((p) => `<p style="margin:0 0 8px 0">${escapeHtml(p)}</p>`).join('')}</div>
```

Each paragraph becomes its own `<p>` tag with bottom margin. Multi-paragraph narratives display naturally; single-paragraph titles look identical to the current rendering.

- [ ] **Step 5: Re-run build-data to regenerate incidents.json with the new schema**

```bash
pnpm build-data
```

Expected: same incident count as Phase 1 (~1590), but each incident's description is now an array.

- [ ] **Step 6: Run full test suite**

```bash
pnpm test
```

Expected: all tests pass (45 from Phase 1, possibly +1 if a new explicit description test was added).

- [ ] **Step 7: Verify typecheck**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 8: Smoke-test the dev server**

```bash
pnpm dev
# in another shell
curl -s http://localhost:5173/data/incidents.json | node -e "
  let data = '';
  process.stdin.on('data', c => data += c);
  process.stdin.on('end', () => {
    const d = JSON.parse(data);
    console.log('count:', d.length);
    console.log('first description type:', typeof d[0].description, Array.isArray(d[0].description) ? 'array' : 'string');
    console.log('first description:', d[0].description);
  });
"
```

Expected: `array` and a single-element array containing the title string.

Kill the dev server.

- [ ] **Step 9: Commit**

```bash
git add shared/types.ts scripts/normalize-airwars.ts tests/normalize-airwars.test.ts src/ui/side-panel.ts public/data/
git commit -m "refactor: Incident.description is now string[] (paragraphs)"
```

---

## Task 4: Use scraped narratives in normalize-airwars

Now that the schema accepts a paragraph array, populate it with the real narrative text from the scraped articles. `normalizeAirwarsRecord` takes an optional third argument: a map from slug → ArticleData. If the article is `assessed`, the description is the article's paragraphs. Otherwise, fall back to the title (as today).

**Files:**
- Modify: `scripts/normalize-airwars.ts`, `tests/normalize-airwars.test.ts`

- [ ] **Step 1: Write the failing test** — add a new describe block to `tests/normalize-airwars.test.ts`

```ts
describe('normalizeAirwarsRecord with article narratives', () => {
  it('uses article paragraphs when status is "assessed"', () => {
    const articles = new Map([
      ['ispt0097-october-10-2023', {
        slug: 'ispt0097-october-10-2023',
        status: 'assessed' as const,
        paragraphs: [
          'On October 10th 2023, at least 2 civilians were killed when a residential building was struck.',
          'Sources on social media identified the victims as members of the Al-Tatar family.',
        ],
      }],
    ]);
    const r = normalizeAirwarsRecord(SAMPLE_RECORD, TAXONOMIES, articles)!;
    expect(r.description).toEqual([
      'On October 10th 2023, at least 2 civilians were killed when a residential building was struck.',
      'Sources on social media identified the victims as members of the Al-Tatar family.',
    ]);
  });

  it('falls back to title when article status is "stub"', () => {
    const articles = new Map([
      ['ispt0097-october-10-2023', {
        slug: 'ispt0097-october-10-2023',
        status: 'stub' as const,
        paragraphs: [],
      }],
    ]);
    const r = normalizeAirwarsRecord(SAMPLE_RECORD, TAXONOMIES, articles)!;
    expect(r.description).toEqual(['ISPT0097 – October 10, 2023']);
  });

  it('falls back to title when no article is found in the map', () => {
    const r = normalizeAirwarsRecord(SAMPLE_RECORD, TAXONOMIES, new Map())!;
    expect(r.description).toEqual(['ISPT0097 – October 10, 2023']);
  });

  it('still works with no articles argument (backwards compatible)', () => {
    const r = normalizeAirwarsRecord(SAMPLE_RECORD, TAXONOMIES)!;
    expect(r.description).toEqual(['ISPT0097 – October 10, 2023']);
  });
});
```

- [ ] **Step 2: Run the failing test**

```bash
pnpm test tests/normalize-airwars.test.ts -t "with article narratives"
```

Expected: FAIL — `normalizeAirwarsRecord` doesn't accept a 3rd argument yet.

- [ ] **Step 3: Update `scripts/normalize-airwars.ts`**

First, add the ArticleData type at the top of the file (or import from the scraper). Add the slug-extraction helper. Update the signature.

Near the top, after the existing imports, import the `ArticleData` type and `slugFromLink` helper from the scraper module (don't redefine them — both are exported from `scrape-airwars-articles.ts` in Task 2):

Existing imports stay (`Incident`, `IncidentCategory`, etc.). Add:

```ts
import { type ArticleData, slugFromLink } from './scrape-airwars-articles';
```

Then re-export `ArticleData` from this file so `build-data.ts` can import it from `normalize-airwars` (matches the Task 5 build-data code):

```ts
export type { ArticleData };
```

Update `normalizeAirwarsRecord` to take a third arg:

```ts
export function normalizeAirwarsRecord(
  raw: RawAirwarsRecord,
  tax: AirwarsTaxonomies,
  articles?: Map<string, ArticleData>,
): Incident | null {
  const date = parseAirwarsDate(raw.acf?.incident_date ?? '');
  if (!date) return null;

  const coord = pickPrimaryCoord(raw.acf?.geolocations ?? []);
  if (!coord) return null;

  if (!isInGazaBbox(coord.lat, coord.lon)) return null;

  const refCode = (raw.acf?.unique_reference_code ?? String(raw.id)).trim();
  const rating = mapRating(raw.civilian_harm_status ?? [], tax);

  const source: SourceAttribution = {
    org: 'airwars',
    id: refCode,
    url: raw.link,
    ...(rating ? { rating } : {}),
  };

  const titleDescription = decodeHtmlEntities(raw.title?.rendered ?? '');
  let description: string[] = titleDescription.length > 0 ? [titleDescription] : [];

  if (articles) {
    const slug = slugFromLink(raw.link);
    if (slug) {
      const article = articles.get(slug);
      if (article && article.status === 'assessed' && article.paragraphs.length > 0) {
        description = article.paragraphs;
      }
    }
  }

  return {
    id: `airwars:${raw.id}`,
    date,
    location: {
      lat: coord.lat,
      lon: coord.lon,
      name: raw.acf?.location_name || raw.acf?.region || undefined,
    },
    category: mapCategory(raw.strike_type ?? [], tax),
    casualties: {
      killed: pickCasualtyMax(raw.acf?.killed_injured_civilian_non_combatants, 'killed_max'),
      injured: pickCasualtyMax(raw.acf?.killed_injured_civilian_non_combatants, 'injured_max'),
      killed_children: pickCasualtyMax(raw.acf?.killed_injured_children, 'killed_max'),
      killed_women: pickCasualtyMax(raw.acf?.killed_injured_women, 'killed_max'),
    },
    description,
    sources: [source],
  };
}
```

(The `isInGazaBbox` check should already be in the function from Phase 1's fix commit `d8f7d68`. If not, add it.)

- [ ] **Step 4: Run tests to verify all pass**

```bash
pnpm test tests/normalize-airwars.test.ts
```

Expected: all tests pass, including the 4 new ones.

- [ ] **Step 5: Verify typecheck**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add scripts/normalize-airwars.ts tests/normalize-airwars.test.ts
git commit -m "feat: use scraped Airwars article paragraphs as description"
```

(Note: `incidents.json` is not regenerated here — that happens in Task 5 when build-data wires in the article-loading step.)

---

## Task 5: Update `build-data.ts` to load articles and pass through

Hooks the scraper output into the normalize step. Reads `data/raw/airwars/articles/*.json`, builds a map, passes to each `normalizeAirwarsRecord` call.

**Files:**
- Modify: `scripts/build-data.ts`

- [ ] **Step 1: Update `scripts/build-data.ts`**

Add the article loading function and pass the map through. The full updated file:

```ts
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
    // Directory doesn't exist yet — articles haven't been scraped.
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
```

- [ ] **Step 2: Run the build**

```bash
pnpm build-data
```

Expected output (numbers will vary based on assessment ratio):
```
Loaded 2709 raw Airwars records and ~2700 article files
Wrote 1590 incidents to public/data/incidents.json
  - With multi-paragraph narratives: ~1000-1500
  - Title-only fallback: ~100-500
Unplotted: ~1119
Build complete.
```

- [ ] **Step 3: Spot-check that narratives flowed through**

```bash
node -e "
  const d = require('./public/data/incidents.json');
  const multi = d.find(i => i.description.length > 1);
  console.log('Sample multi-paragraph incident:', multi?.id);
  console.log('Description (first paragraph):', multi?.description[0]);
  console.log('Paragraph count:', multi?.description.length);
"
```

Expected: a real-looking incident with a multi-paragraph narrative.

- [ ] **Step 4: Smoke-test in browser**

```bash
pnpm dev
```

Visit `http://localhost:5173`, click a marker that has a long narrative (or just click around). The side panel should show multiple paragraphs.

Kill dev server.

- [ ] **Step 5: Run all tests + typecheck**

```bash
pnpm test && pnpm typecheck
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add scripts/build-data.ts public/data/
git commit -m "feat: integrate Airwars article narratives into build pipeline"
```

---

## Task 6: `fetch-acled.ts` — OAuth + paginated ACLED ingestion

Fetches all Gaza-Strip ACLED events from `2023-10-07` onward, writes paginated raw JSON to `data/raw/acled/`.

**Requires:** `ACLED_USERNAME` and `ACLED_PASSWORD` in `.env`. Without these, the script halts with a clear error message.

**Files:**
- Create: `scripts/fetch-acled.ts`

- [ ] **Step 1: Write `scripts/fetch-acled.ts`**

```ts
import { mkdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const OAUTH_URL = 'https://acleddata.com/oauth/token';
const API_URL = 'https://acleddata.com/api/acled/read';
const COUNTRY = 'Palestine';
const ADMIN1 = 'Gaza Strip';
const START_DATE = '2023-10-07';
const PER_PAGE = 5000;
const OUT_DIR = 'data/raw/acled';

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

async function getAccessToken(): Promise<string> {
  const username = process.env.ACLED_USERNAME;
  const password = process.env.ACLED_PASSWORD;
  if (!username || !password) {
    throw new Error(
      'ACLED_USERNAME and ACLED_PASSWORD must be set in .env. ' +
      'Register at https://acleddata.com/register-for-access/'
    );
  }
  const body = new URLSearchParams({
    username,
    password,
    grant_type: 'password',
    client_id: 'acled',
    scope: 'authenticated',
  });
  const res = await fetch(OAUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`ACLED OAuth failed: status ${res.status} — check ACLED_USERNAME/PASSWORD`);
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error('ACLED OAuth returned no access_token');
  return json.access_token;
}

async function fetchAcledPage(token: string, page: number): Promise<unknown[]> {
  const params = new URLSearchParams({
    _format: 'json',
    country: COUNTRY,
    admin1: ADMIN1,
    event_date: START_DATE,
    event_date_where: '>=',
    page: String(page),
    limit: String(PER_PAGE),
  });
  const url = `${API_URL}?${params}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`ACLED fetch failed: page=${page} status=${res.status}`);
  const json = (await res.json()) as { data?: unknown[]; status?: number };
  if (!Array.isArray(json.data)) {
    throw new Error(`ACLED response missing 'data' array on page ${page}`);
  }
  return json.data;
}

export async function fetchAcled(opts: { refresh?: boolean } = {}): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const token = await getAccessToken();
  console.log('ACLED auth OK.');

  let page = 1;
  while (true) {
    const out = join(OUT_DIR, `page-${String(page).padStart(3, '0')}.json`);
    if (!opts.refresh && (await fileExists(out))) {
      console.log(`Page ${page} cached, skipping`);
      page++;
      // We don't know totalPages, so we need to check whether the cached page is the last one.
      // Read it to see if it's full or partial.
      const { readFile } = await import('node:fs/promises');
      const cached = JSON.parse(await readFile(out, 'utf8')) as unknown[];
      if (cached.length < PER_PAGE) {
        console.log(`Cached page ${page - 1} was partial (size=${cached.length}); done.`);
        break;
      }
      continue;
    }
    await sleep(500);
    const records = await fetchAcledPage(token, page);
    await writeFile(out, JSON.stringify(records));
    console.log(`Fetched page ${page} (${records.length} records)`);
    if (records.length < PER_PAGE) {
      console.log('Final page reached.');
      break;
    }
    page++;
  }
  console.log('ACLED fetch complete.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const refresh = process.argv.includes('--refresh');
  fetchAcled({ refresh }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 2: Run the fetcher** (requires ACLED credentials in `.env`)

```bash
pnpm tsx scripts/fetch-acled.ts
```

Expected:
- `ACLED auth OK.`
- One or more pages fetched (typical Gaza dataset has 5000-15000+ events since Oct 2023, so 1-3 pages).
- `ACLED fetch complete.`
- Files in `data/raw/acled/page-001.json` etc.

If you get `ACLED_USERNAME and ACLED_PASSWORD must be set in .env`, register and set them per Prerequisites at the top of this plan.

- [ ] **Step 3: Spot-check the response**

```bash
node -e "
  const d = require('./data/raw/acled/page-001.json');
  console.log('count:', d.length);
  console.log('first:', JSON.stringify(d[0], null, 2).slice(0, 600));
  console.log('unique sub_event_types:', [...new Set(d.map(r => r.sub_event_type))].slice(0, 10));
"
```

Expected: a record count, a sample record with `event_id_cnty`, `event_date`, `latitude`, `longitude`, `sub_event_type`, `notes`, `fatalities`, `source`, and a list of event subtypes.

- [ ] **Step 4: Verify typecheck**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 5: Commit (including raw data)**

```bash
git add scripts/fetch-acled.ts data/raw/acled/
git commit -m "feat: fetch ACLED Gaza events via OAuth + commit raw snapshot"
```

---

## Task 7: `normalize-acled.ts` (TDD)

Maps one raw ACLED record to one `Incident`. Same shape as `normalize-airwars.ts` — pure function with helpers, drops records without coordinates or with malformed dates.

**Files:**
- Create: `scripts/normalize-acled.ts`, `tests/normalize-acled.test.ts`

- [ ] **Step 1: Write the failing test** at `tests/normalize-acled.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { normalizeAcledRecord, mapAcledCategory } from '../scripts/normalize-acled';

const SAMPLE_RECORD = {
  event_id_cnty: 'PSE12345',
  event_date: '2023-10-15',
  year: '2023',
  disorder_type: 'Political violence',
  event_type: 'Explosions/Remote violence',
  sub_event_type: 'Air/drone strike',
  actor1: 'Military Forces of Israel (2022-)',
  actor2: 'Civilians (Palestine)',
  country: 'Palestine',
  admin1: 'Gaza Strip',
  admin2: 'Gaza',
  location: 'Gaza City',
  latitude: '31.5018',
  longitude: '34.4660',
  notes: 'On 15 October 2023, Israeli forces conducted an airstrike on a residential building in Gaza City, killing at least 8 civilians including 3 children.',
  fatalities: '8',
  source: 'Al Jazeera; Reuters',
  source_scale: 'International',
  timestamp: '1697500000',
};

describe('mapAcledCategory', () => {
  it('maps Air/drone strike to airstrike', () => {
    expect(mapAcledCategory('Air/drone strike')).toBe('airstrike');
  });

  it('maps Shelling/artillery/missile attack to shelling', () => {
    expect(mapAcledCategory('Shelling/artillery/missile attack')).toBe('shelling');
  });

  it('maps Armed clash to ground_op', () => {
    expect(mapAcledCategory('Armed clash')).toBe('ground_op');
  });

  it('maps Attack to other (too generic)', () => {
    expect(mapAcledCategory('Attack')).toBe('other');
  });

  it('maps unknown sub_event_type to other', () => {
    expect(mapAcledCategory('Some other event')).toBe('other');
  });
});

describe('normalizeAcledRecord', () => {
  it('produces a complete Incident from a well-formed record', () => {
    const r = normalizeAcledRecord(SAMPLE_RECORD)!;
    expect(r.id).toBe('acled:PSE12345');
    expect(r.date).toBe('2023-10-15');
    expect(r.location.lat).toBeCloseTo(31.5018);
    expect(r.location.lon).toBeCloseTo(34.4660);
    expect(r.location.name).toBe('Gaza City');
    expect(r.category).toBe('airstrike');
    expect(r.casualties.killed).toBe(8);
    expect(r.casualties.injured).toBeNull();
    expect(r.casualties.killed_children).toBeNull();
    expect(r.description).toHaveLength(1);
    expect(r.description[0]).toContain('Israeli forces conducted an airstrike');
    expect(r.sources).toHaveLength(1);
    expect(r.sources[0].org).toBe('acled');
    expect(r.sources[0].id).toBe('PSE12345');
    expect(r.sources[0].url).toContain('acleddata.com');
  });

  it('returns null when coordinates are missing', () => {
    const noLat = { ...SAMPLE_RECORD, latitude: '' };
    expect(normalizeAcledRecord(noLat)).toBeNull();
  });

  it('returns null when coordinates are outside Gaza bbox', () => {
    const outside = { ...SAMPLE_RECORD, latitude: '34.49', longitude: '31.50' };
    expect(normalizeAcledRecord(outside)).toBeNull();
  });

  it('returns null when date is malformed', () => {
    const badDate = { ...SAMPLE_RECORD, event_date: 'not a date' };
    expect(normalizeAcledRecord(badDate)).toBeNull();
  });

  it('parses string fatalities to number', () => {
    const r = normalizeAcledRecord({ ...SAMPLE_RECORD, fatalities: '12' })!;
    expect(r.casualties.killed).toBe(12);
  });

  it('handles fatalities of "0" as 0 (not null)', () => {
    const r = normalizeAcledRecord({ ...SAMPLE_RECORD, fatalities: '0' })!;
    expect(r.casualties.killed).toBe(0);
  });
});
```

- [ ] **Step 2: Run the failing test**

```bash
pnpm test tests/normalize-acled.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write `scripts/normalize-acled.ts`**

```ts
import type { Incident, IncidentCategory, SourceAttribution } from '../shared/types';

interface RawAcledRecord {
  event_id_cnty: string;
  event_date: string;
  sub_event_type?: string;
  latitude?: string;
  longitude?: string;
  location?: string;
  notes?: string;
  fatalities?: string;
  source?: string;
}

function isValidISODate(s: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(s);
}

function parseNumberOrNull(s: string | undefined): number | null {
  if (s === undefined || s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function isInGazaBbox(lat: number, lon: number): boolean {
  return lat >= 31.20 && lat <= 31.60 && lon >= 34.20 && lon <= 34.60;
}

const ACLED_TO_CATEGORY: Record<string, IncidentCategory> = {
  'Air/drone strike': 'airstrike',
  'Shelling/artillery/missile attack': 'shelling',
  'Armed clash': 'ground_op',
  'Grenade': 'shelling',
  'Remote explosive/landmine/IED': 'other',
  'Suicide bomb': 'other',
  'Arrests': 'detention',
  'Disrupted weapons use': 'other',
  'Mob violence': 'other',
  'Protest with intervention': 'other',
  'Peaceful protest': 'other',
  'Violent demonstration': 'other',
  'Attack': 'other',
  'Abduction/forced disappearance': 'detention',
  'Looting/property destruction': 'other',
  'Sexual violence': 'other',
  'Government regains territory': 'ground_op',
  'Non-state actor overtakes territory': 'ground_op',
  'Non-violent transfer of territory': 'other',
  'Change to group/activity': 'other',
  'Headquarters or base established': 'other',
  'Agreement': 'other',
  'Other': 'other',
};

export function mapAcledCategory(subEventType: string): IncidentCategory {
  return ACLED_TO_CATEGORY[subEventType] ?? 'other';
}

export function normalizeAcledRecord(raw: RawAcledRecord): Incident | null {
  if (!isValidISODate(raw.event_date)) return null;

  const lat = parseNumberOrNull(raw.latitude);
  const lon = parseNumberOrNull(raw.longitude);
  if (lat === null || lon === null) return null;
  if (!isInGazaBbox(lat, lon)) return null;

  const id = raw.event_id_cnty.trim();
  if (id.length === 0) return null;

  const source: SourceAttribution = {
    org: 'acled',
    id,
    url: `https://acleddata.com/data-export-tool/?event_id_cnty=${encodeURIComponent(id)}`,
  };

  const notes = raw.notes?.trim() ?? '';
  const description = notes.length > 0 ? [notes] : [];

  return {
    id: `acled:${id}`,
    date: raw.event_date,
    location: {
      lat,
      lon,
      name: raw.location || undefined,
    },
    category: mapAcledCategory(raw.sub_event_type ?? ''),
    casualties: {
      killed: parseNumberOrNull(raw.fatalities),
      injured: null,
      killed_children: null,
      killed_women: null,
    },
    description,
    sources: [source],
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test tests/normalize-acled.test.ts
```

Expected: all 11 tests pass (5 in `mapAcledCategory` + 6 in `normalizeAcledRecord`).

- [ ] **Step 5: Verify typecheck**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add scripts/normalize-acled.ts tests/normalize-acled.test.ts
git commit -m "feat: normalize ACLED records into unified Incident type"
```

---

## Task 8: `dedupe.ts` — group + merge cross-source records (TDD)

Pure function: takes an array of Incidents from any source(s), groups by `(date, lat3, lon3)`, merges within each group. Returns deduped array + merge count.

**Merge rules** (from spec):
- Longest description (longest cumulative character count across paragraphs)
- Max casualty count for each field (`killed`, `injured`, `killed_children`, `killed_women`)
- Union of source attributions
- Category: take Airwars's if present, else first source's
- Location: take Airwars's location.name if present, else first

**Files:**
- Create: `scripts/dedupe.ts`, `tests/dedupe.test.ts`

- [ ] **Step 1: Write the failing test** at `tests/dedupe.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { dedupeIncidents, groupKey } from '../scripts/dedupe';
import type { Incident } from '../shared/types';

function makeIncident(overrides: Partial<Incident> & { id: string }): Incident {
  return {
    id: overrides.id,
    date: overrides.date ?? '2023-10-15',
    location: overrides.location ?? { lat: 31.5018, lon: 34.466 },
    category: overrides.category ?? 'airstrike',
    casualties: overrides.casualties ?? { killed: null, injured: null, killed_children: null, killed_women: null },
    description: overrides.description ?? [],
    sources: overrides.sources ?? [{ org: 'airwars', id: 'X', url: 'x' }],
  };
}

describe('groupKey', () => {
  it('rounds lat/lon to 3 decimal places', () => {
    expect(groupKey('2023-10-15', 31.50189, 34.46591)).toBe('2023-10-15:31.502:34.466');
  });
  it('returns the same key for points within ~110m', () => {
    const k1 = groupKey('2023-10-15', 31.5018, 34.466);
    const k2 = groupKey('2023-10-15', 31.5020, 34.4664);
    expect(k1).toBe(k2);
  });
  it('returns different keys for points >110m apart', () => {
    const k1 = groupKey('2023-10-15', 31.5018, 34.466);
    const k2 = groupKey('2023-10-15', 31.5050, 34.466);
    expect(k1).not.toBe(k2);
  });
  it('returns different keys for different dates', () => {
    expect(groupKey('2023-10-15', 31.5, 34.4)).not.toBe(groupKey('2023-10-16', 31.5, 34.4));
  });
});

describe('dedupeIncidents', () => {
  it('returns input unchanged when no duplicates', () => {
    const a = makeIncident({ id: 'a', location: { lat: 31.5, lon: 34.4 } });
    const b = makeIncident({ id: 'b', location: { lat: 31.55, lon: 34.45 } });
    const { incidents, merges } = dedupeIncidents([a, b]);
    expect(incidents).toHaveLength(2);
    expect(merges).toBe(0);
  });

  it('merges two incidents at the same location and date', () => {
    const a = makeIncident({
      id: 'airwars:1',
      casualties: { killed: 5, injured: null, killed_children: 2, killed_women: null },
      description: ['Airwars narrative paragraph one.', 'Paragraph two.'],
      sources: [{ org: 'airwars', id: 'A1', url: 'a' }],
    });
    const b = makeIncident({
      id: 'acled:1',
      casualties: { killed: 7, injured: 3, killed_children: null, killed_women: null },
      description: ['Short ACLED note.'],
      sources: [{ org: 'acled', id: 'B1', url: 'b' }],
    });
    const { incidents, merges } = dedupeIncidents([a, b]);
    expect(incidents).toHaveLength(1);
    expect(merges).toBe(1);
    const merged = incidents[0];
    expect(merged.casualties.killed).toBe(7);     // max
    expect(merged.casualties.injured).toBe(3);    // max (other was null)
    expect(merged.casualties.killed_children).toBe(2);
    expect(merged.description).toHaveLength(2);   // Airwars (longer) wins
    expect(merged.description[0]).toContain('Airwars');
    expect(merged.sources).toHaveLength(2);
    expect(merged.sources.map((s) => s.org).sort()).toEqual(['acled', 'airwars']);
  });

  it('keeps Airwars location.name when both sources have one', () => {
    const a = makeIncident({
      id: 'airwars:1',
      location: { lat: 31.5, lon: 34.4, name: "Al-Tatar's home" },
      sources: [{ org: 'airwars', id: 'A1', url: 'a' }],
    });
    const b = makeIncident({
      id: 'acled:1',
      location: { lat: 31.5, lon: 34.4, name: 'Gaza City' },
      sources: [{ org: 'acled', id: 'B1', url: 'b' }],
    });
    const { incidents } = dedupeIncidents([a, b]);
    expect(incidents[0].location.name).toBe("Al-Tatar's home");
  });

  it('handles 3+ incidents at the same location', () => {
    const a = makeIncident({ id: 'airwars:1', casualties: { killed: 5, injured: null, killed_children: null, killed_women: null }, sources: [{ org: 'airwars', id: 'A', url: 'a' }] });
    const b = makeIncident({ id: 'acled:1', casualties: { killed: 7, injured: null, killed_children: null, killed_women: null }, sources: [{ org: 'acled', id: 'B', url: 'b' }] });
    const c = makeIncident({ id: 'acled:2', casualties: { killed: 6, injured: null, killed_children: null, killed_women: null }, sources: [{ org: 'acled', id: 'C', url: 'c' }] });
    const { incidents, merges } = dedupeIncidents([a, b, c]);
    expect(incidents).toHaveLength(1);
    expect(merges).toBe(2);  // 2 merge operations (a+b, then +c)
    expect(incidents[0].casualties.killed).toBe(7);
    expect(incidents[0].sources).toHaveLength(3);
  });

  it('preserves Airwars id as the merged incident id when present', () => {
    const a = makeIncident({ id: 'airwars:1' });
    const b = makeIncident({ id: 'acled:1' });
    const { incidents } = dedupeIncidents([a, b]);
    expect(incidents[0].id).toBe('airwars:1');
  });
});
```

- [ ] **Step 2: Run the failing test**

```bash
pnpm test tests/dedupe.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write `scripts/dedupe.ts`**

```ts
import type { Incident, Casualties, SourceAttribution } from '../shared/types';

export function groupKey(date: string, lat: number, lon: number): string {
  return `${date}:${lat.toFixed(3)}:${lon.toFixed(3)}`;
}

function descriptionLength(desc: string[]): number {
  return desc.reduce((acc, p) => acc + p.length, 0);
}

function maxN(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.max(a, b);
}

function mergeCasualties(a: Casualties, b: Casualties): Casualties {
  return {
    killed: maxN(a.killed, b.killed),
    injured: maxN(a.injured, b.injured),
    killed_children: maxN(a.killed_children, b.killed_children),
    killed_women: maxN(a.killed_women, b.killed_women),
  };
}

function unionSources(a: SourceAttribution[], b: SourceAttribution[]): SourceAttribution[] {
  const seen = new Set<string>();
  const out: SourceAttribution[] = [];
  for (const s of [...a, ...b]) {
    const k = `${s.org}:${s.id}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

function hasAirwarsSource(inc: Incident): boolean {
  return inc.sources.some((s) => s.org === 'airwars');
}

function mergeTwo(a: Incident, b: Incident): Incident {
  const aIsAirwars = hasAirwarsSource(a);
  const bIsAirwars = hasAirwarsSource(b);
  const primary = aIsAirwars && !bIsAirwars ? a : (bIsAirwars && !aIsAirwars ? b : a);
  const secondary = primary === a ? b : a;

  const longerDescription =
    descriptionLength(a.description) >= descriptionLength(b.description) ? a.description : b.description;

  return {
    id: primary.id,
    date: a.date,  // same date by definition (group key)
    location: {
      lat: primary.location.lat,
      lon: primary.location.lon,
      name: primary.location.name ?? secondary.location.name,
      governorate: primary.location.governorate ?? secondary.location.governorate,
    },
    category: primary.category !== 'other' ? primary.category : secondary.category,
    casualties: mergeCasualties(a.casualties, b.casualties),
    description: longerDescription,
    sources: unionSources(a.sources, b.sources),
  };
}

export interface DedupResult {
  incidents: Incident[];
  merges: number;
}

export function dedupeIncidents(incidents: Incident[]): DedupResult {
  const groups = new Map<string, Incident>();
  let merges = 0;
  for (const inc of incidents) {
    const key = groupKey(inc.date, inc.location.lat, inc.location.lon);
    const existing = groups.get(key);
    if (existing) {
      groups.set(key, mergeTwo(existing, inc));
      merges++;
    } else {
      groups.set(key, inc);
    }
  }
  return { incidents: [...groups.values()], merges };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test tests/dedupe.test.ts
```

Expected: all 9 tests pass (4 groupKey + 5 dedupeIncidents).

- [ ] **Step 5: Verify typecheck**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add scripts/dedupe.ts tests/dedupe.test.ts
git commit -m "feat: dedupe incidents across sources by date + 110m precision"
```

---

## Task 9: Update `build-data.ts` to integrate ACLED + dedup

Final orchestrator update: fetch both sources, normalize both, dedupe, write.

**Files:**
- Modify: `scripts/build-data.ts`

- [ ] **Step 1: Update `scripts/build-data.ts`**

```ts
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fetchAirwars } from './fetch-airwars';
import { normalizeAirwarsRecord, type AirwarsTaxonomies, type ArticleData } from './normalize-airwars';
import { fetchAcled } from './fetch-acled';
import { normalizeAcledRecord } from './normalize-acled';
import { dedupeIncidents } from './dedupe';
import type { Incident, BuildMeta } from '../shared/types';

const AIRWARS_RAW = 'data/raw/airwars';
const ARTICLES_DIR = 'data/raw/airwars/articles';
const ACLED_RAW = 'data/raw/acled';
const OUT_DIR = 'public/data';

async function loadJsonPages(dir: string): Promise<unknown[]> {
  const files = (await readdir(dir)).filter((f) => f.startsWith('page-') && f.endsWith('.json'));
  files.sort();
  const all: unknown[] = [];
  for (const f of files) {
    const data = JSON.parse(await readFile(join(dir, f), 'utf8'));
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
  } catch {
    return new Map();
  }
}

async function main(): Promise<void> {
  // 1. Fetch both sources (cache-fast on re-runs).
  await fetchAirwars();
  await fetchAcled();

  // 2. Load all raw inputs.
  const airwarsRaws = await loadJsonPages(AIRWARS_RAW);
  const taxonomies = await loadTaxonomies();
  const articles = await loadArticles();
  const acledRaws = await loadJsonPages(ACLED_RAW);
  console.log(`Loaded ${airwarsRaws.length} Airwars + ${acledRaws.length} ACLED raw records`);
  console.log(`  + ${articles.size} Airwars article files`);

  // 3. Normalize each.
  const airwarsIncidents: Incident[] = [];
  let airwarsUnplotted = 0;
  for (const raw of airwarsRaws) {
    const inc = normalizeAirwarsRecord(raw as never, taxonomies, articles);
    if (inc) airwarsIncidents.push(inc);
    else airwarsUnplotted++;
  }
  const acledIncidents: Incident[] = [];
  let acledUnplotted = 0;
  for (const raw of acledRaws) {
    const inc = normalizeAcledRecord(raw as never);
    if (inc) acledIncidents.push(inc);
    else acledUnplotted++;
  }
  console.log(`Normalized ${airwarsIncidents.length} Airwars + ${acledIncidents.length} ACLED incidents`);
  console.log(`  Unplotted: ${airwarsUnplotted} Airwars, ${acledUnplotted} ACLED`);

  // 4. Dedupe across sources.
  const { incidents, merges } = dedupeIncidents([...airwarsIncidents, ...acledIncidents]);
  console.log(`Dedup: ${airwarsIncidents.length + acledIncidents.length} → ${incidents.length} (${merges} merges)`);

  // 5. Sort by date ascending.
  incidents.sort((a, b) => a.date.localeCompare(b.date));

  // 6. Write outputs.
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(join(OUT_DIR, 'incidents.json'), JSON.stringify(incidents));
  const meta: BuildMeta = {
    build_date: new Date().toISOString(),
    source_counts: {
      airwars: airwarsIncidents.length,
      acled: acledIncidents.length,
    },
    dedup_merges: merges,
    unplotted_count: airwarsUnplotted + acledUnplotted,
  };
  await writeFile(join(OUT_DIR, 'meta.json'), JSON.stringify(meta, null, 2));

  const multiSourceCount = incidents.filter((i) => i.sources.length > 1).length;
  console.log(`Wrote ${incidents.length} incidents (${multiSourceCount} multi-source) to ${OUT_DIR}/incidents.json`);
  console.log(`Build complete.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Run the full build**

```bash
pnpm build-data
```

Expected output (numbers will vary):
```
Loaded 2709 Airwars + N ACLED raw records
  + ~2700 Airwars article files
Normalized 1590 Airwars + M ACLED incidents
  Unplotted: ~1119 Airwars, X ACLED
Dedup: (sum) → (deduped) (K merges)
Wrote (count) incidents (M multi-source) to public/data/incidents.json
Build complete.
```

Pay attention to the `K merges` number — if it's wildly off (e.g., zero, or >50% of input), inspect the data. Some merges (~5-20%) are expected.

- [ ] **Step 3: Smoke-check the output**

```bash
node -e "
  const d = require('./public/data/incidents.json');
  const m = require('./public/data/meta.json');
  console.log('total:', d.length, 'multi-source:', d.filter(i => i.sources.length > 1).length);
  console.log('source_counts:', m.source_counts);
  console.log('dedup_merges:', m.dedup_merges);
  const multi = d.find(i => i.sources.length > 1);
  console.log('Multi-source example:', JSON.stringify(multi, null, 2).slice(0, 600));
"
```

- [ ] **Step 4: Smoke-test in browser**

```bash
pnpm dev
```

Visit, click markers, confirm:
- Multi-source markers' side panel shows BOTH Airwars + ACLED in the Sources section.
- Description shows whichever source had the longer narrative (usually Airwars when assessed).
- All previous functionality still works.

Kill dev server.

- [ ] **Step 5: Run tests + typecheck**

```bash
pnpm test && pnpm typecheck
```

Expected: all pass.

- [ ] **Step 6: Commit (including regenerated data)**

```bash
git add scripts/build-data.ts public/data/
git commit -m "feat: orchestrate Airwars + ACLED with cross-source dedup"
```

---

## Task 10: Side panel multi-source UI polish

The side panel already iterates `incident.sources` and renders a list — Phase 1 just only ever saw a single source. Verify it gracefully handles multi-source and that the description rendering (multi-paragraph from Task 3) reads well with longer narratives.

Optional small polish: add a count badge ("2 sources") above the sources list, and slightly tighten the styling.

**Files:**
- Modify: `src/ui/side-panel.ts`

- [ ] **Step 1: Read the current side panel**

```bash
cat src/ui/side-panel.ts
```

Locate the section that renders `sources` (the `<ul>` block).

- [ ] **Step 2: Update the Sources section** with a count header

Find the existing sources block:

```ts
<div style="text-transform:uppercase;letter-spacing:0.05em;font-size:11px;color:#6e6660;margin-bottom:6px">Sources</div>
<ul style="margin:0;padding-left:18px;font-size:13px">${sourcesHtml}</ul>
```

Replace with:

```ts
<div style="text-transform:uppercase;letter-spacing:0.05em;font-size:11px;color:#6e6660;margin-bottom:6px">Sources (${incident.sources.length})</div>
<ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.6">${sourcesHtml}</ul>
```

(Just adds the count and improves line-height.)

- [ ] **Step 3: Smoke-test in browser**

```bash
pnpm dev
```

Click a multi-source marker. Confirm:
- "Sources (2)" header (or 3, depending on the incident)
- Both sources listed as clickable links
- Different ratings shown if Airwars has a rating but ACLED doesn't
- Description reads as multiple paragraphs

Kill dev server.

- [ ] **Step 4: Verify typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/ui/side-panel.ts
git commit -m "feat: side panel shows source count + improves multi-source layout"
```

---

## Task 11: Final integration verification + Phase 2 tag

Whole-system smoke check + tag.

- [ ] **Step 1: Run the full test suite**

```bash
pnpm test
```

Expected counts (approximate):
- normalize-airwars: ~28 tests (was 23 in Phase 1, +4 article tests + 1 typing migration)
- normalize-acled: 11 tests
- dedupe: 9 tests
- time-controller: 11 tests
- url-state: 5 tests
- histogram: 3 tests

Total: ~67 tests passing.

- [ ] **Step 2: Run the full production build**

```bash
pnpm build
```

Expected:
- typecheck passes
- build-data runs (uses cached pages, fast)
- vite build produces `dist/`
- No errors

```bash
ls -lah dist/
ls -lah dist/data/
```

- [ ] **Step 3: Run the production preview**

```bash
pnpm preview
# in another shell
curl -s http://localhost:4173/data/meta.json
```

Confirm meta.json has both `airwars` and `acled` source counts and a non-zero `dedup_merges`.

Kill preview.

- [ ] **Step 4: Tag the Phase 2 milestone**

```bash
git tag phase-2-acled
```

- [ ] **Step 5: Confirm tags**

```bash
git tag --list 'phase-*'
```

Expected:
```
phase-1-airwars
phase-2-acled
```

## Phase 2 complete. What's next.

After Phase 2 ships you have a multi-source Gaza exhibit: ~1500-2500 deduped incidents with real narratives, multi-source attribution, ACLED breadth + Airwars depth. Next is Phase 3 (OCHA UNOSAT damage layer) and Phase 4 (polish + mobile).

**Observations to capture before planning Phase 3:**

1. Real dedup merge ratio — was it ~5%, ~20%, ~50%? Affects whether dedup tuning needs revisit.
2. ACLED record count — bigger or smaller than expected? Some events may not match the schema cleanly.
3. Multi-source UI feel — do users (you, in spot-checks) find multi-source attribution useful, or is one source enough per incident?
4. Performance — with combined dataset potentially ~2x larger, does the map still render smoothly? Time to investigate clustering or binary packing?
5. Description quality — are the scraped narratives genuinely useful in the side panel, or do they make the panel feel too dense?
