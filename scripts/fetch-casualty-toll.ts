import { mkdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';

// Tech for Palestine aggregates the Gaza Ministry of Health's daily casualty
// figures into a clean JSON time-series. We use it because:
//   - It surfaces a CUMULATIVE killed count (`killed_cum`) directly from the
//     MoH bulletins, which is the authoritative tally;
//   - It updates daily and is freely available with no auth;
//   - Summing our own incident-level killed counts is wrong — eyewitness
//     reporting only covers a fraction of events, so it severely undercounts.
// See https://data.techforpalestine.org/docs/casualties-daily for the schema.
const ENDPOINT = 'https://data.techforpalestine.org/api/v2/casualties_daily.json';
const OUT_DIR = 'data/raw/casualty-toll';
const OUT_FILE = 'daily.json';
const USER_AGENT = 'GazaExhibit/1.0 (educational; +https://github.com/anonymous/gaza-exhibit)';

export interface DailyCasualty {
  date: string;       // ISO YYYY-MM-DD
  killed: number;     // cumulative through this date
  injured?: number;   // cumulative through this date (optional)
}

interface RawDailyEntry {
  report_date?: string;
  killed_cum?: number;
  injured_cum?: number;
  ext_killed_cum?: number;
  ext_injured_cum?: number;
}

async function fileExists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}

/** Coerce the upstream payload into the slim daily-toll shape. The upstream
 * sometimes reports `ext_killed_cum` (extrapolated when MoH bulletins were
 * suspended) — fall back to it when `killed_cum` is missing on a given day. */
export function normalizeDaily(raw: unknown): DailyCasualty[] {
  if (!Array.isArray(raw)) return [];
  const out: DailyCasualty[] = [];
  for (const r of raw as RawDailyEntry[]) {
    const date = typeof r.report_date === 'string' ? r.report_date : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const killed =
      typeof r.killed_cum === 'number' ? r.killed_cum :
      typeof r.ext_killed_cum === 'number' ? r.ext_killed_cum : null;
    if (killed === null) continue;
    const injured =
      typeof r.injured_cum === 'number' ? r.injured_cum :
      typeof r.ext_injured_cum === 'number' ? r.ext_injured_cum : undefined;
    const entry: DailyCasualty = { date, killed };
    if (injured !== undefined) entry.injured = injured;
    out.push(entry);
  }
  // Ensure ascending date order so downstream binary searches assume sorted.
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

export async function fetchCasualtyToll(opts: { refresh?: boolean } = {}): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const outPath = join(OUT_DIR, OUT_FILE);
  if (!opts.refresh && (await fileExists(outPath))) {
    console.log(`Casualty toll snapshot already exists at ${outPath} — pass --refresh to re-download.`);
    return;
  }

  console.log(`Fetching daily casualty toll from ${ENDPOINT}...`);
  const res = await fetch(ENDPOINT, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Casualty toll fetch failed: ${res.status} ${res.statusText}`);
  }
  const raw = (await res.json()) as unknown;
  const daily = normalizeDaily(raw);
  if (daily.length === 0) {
    throw new Error('Casualty toll fetch returned 0 valid daily entries — upstream schema may have changed.');
  }

  await writeFile(outPath, JSON.stringify(daily));
  const last = daily[daily.length - 1];
  console.log(`Wrote ${daily.length} daily casualty entries to ${outPath}`);
  console.log(`  Latest entry: ${last.date} — killed_cum=${last.killed}${last.injured !== undefined ? `, injured_cum=${last.injured}` : ''}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const refresh = process.argv.includes('--refresh');
  fetchCasualtyToll({ refresh }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
