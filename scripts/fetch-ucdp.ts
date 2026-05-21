import { mkdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { spawn } from 'node:child_process';

const CSV_URL = 'https://ucdp.uu.se/downloads/ged/ged251-csv.zip';
const OUT_DIR = 'data/raw/ucdp';
const RAW_ZIP = '/tmp/ged251.zip';
const RAW_CSV = '/tmp/GEDEvent_v25_1.csv';

const COUNTRY_ID_ISRAEL = '666';
const START_DATE = '2023-10-07';

interface UcdpRow {
  id: string;
  year: string;
  type_of_violence: string;
  dyad_name: string;
  side_a: string;
  side_b: string;
  source_article: string;
  source_headline: string;
  where_prec: string;
  where_coordinates: string;
  adm_1: string;
  adm_2: string;
  latitude: string;
  longitude: string;
  country_id: string;
  event_clarity: string;
  date_prec: string;
  date_start: string;
  deaths_civilians: string;
  best: string;
}

async function fileExists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}

async function download(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const body = res.body;
  if (!body) throw new Error('No response body');
  const out = createWriteStream(dest);
  await pipeline(body as unknown as NodeJS.ReadableStream, out);
}

async function unzipTo(zipPath: string, csvDest: string): Promise<void> {
  // Use system `unzip` for simplicity. macOS + Linux ship it.
  await new Promise<void>((resolve, reject) => {
    const p = spawn('unzip', ['-o', '-p', zipPath], { stdio: ['ignore', 'pipe', 'inherit'] });
    const out = createWriteStream(csvDest);
    p.stdout.pipe(out);
    p.on('error', reject);
    out.on('finish', resolve);
    out.on('error', reject);
  });
}

function parseCsvLine(line: string): string[] {
  // UCDP CSV uses quoted fields with embedded commas; needs proper CSV parsing.
  const out: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuote) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQuote = false;
      else cur += c;
    } else {
      if (c === ',') { out.push(cur); cur = ''; }
      else if (c === '"') inQuote = true;
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

async function filterToGaza(csvPath: string): Promise<UcdpRow[]> {
  const fs = await import('node:fs');
  const readline = await import('node:readline');
  const stream = fs.createReadStream(csvPath);
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let header: string[] | null = null;
  const out: UcdpRow[] = [];
  for await (const line of rl) {
    if (line.length === 0) continue;
    const cols = parseCsvLine(line);
    if (!header) { header = cols; continue; }
    const row = Object.fromEntries(header.map((k, i) => [k, cols[i] ?? ''])) as unknown as UcdpRow;
    if (row.country_id !== COUNTRY_ID_ISRAEL) continue;
    if (row.adm_1 !== 'Gaza Strip') continue;
    const dateStart = (row.date_start ?? '').slice(0, 10);
    if (dateStart < START_DATE) continue;
    out.push(row);
  }
  return out;
}

export async function fetchUcdp(opts: { refresh?: boolean } = {}): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const outPath = join(OUT_DIR, 'gaza-events.json');
  if (!opts.refresh && (await fileExists(outPath))) {
    console.log(`UCDP snapshot already exists at ${outPath} — pass --refresh to re-download.`);
    return;
  }
  if (!(await fileExists(RAW_ZIP))) {
    console.log(`Downloading UCDP CSV zip from ${CSV_URL}...`);
    await download(CSV_URL, RAW_ZIP);
  } else {
    console.log(`Reusing cached zip at ${RAW_ZIP}`);
  }
  if (!(await fileExists(RAW_CSV))) {
    console.log('Unzipping...');
    await unzipTo(RAW_ZIP, RAW_CSV);
  } else {
    console.log(`Reusing cached CSV at ${RAW_CSV}`);
  }
  console.log('Filtering to Gaza events...');
  const rows = await filterToGaza(RAW_CSV);
  console.log(`Kept ${rows.length} Gaza events from ${START_DATE} onward`);
  await writeFile(outPath, JSON.stringify(rows));
  console.log(`Wrote ${outPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const refresh = process.argv.includes('--refresh');
  fetchUcdp({ refresh }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
