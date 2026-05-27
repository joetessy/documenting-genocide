import { mkdir, writeFile, access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Aid Worker Security Database — per-incident records of attacks on aid
// workers worldwide. We pull all Palestine (PS) incidents from 2023 onward;
// the year-range query params don't actually filter server-side so the CSV
// returns the full archive going back to ~2002. We keep the raw CSV intact
// and let normalize-awsd.ts drop rows older than the conflict start.
//
// Citation requirement (non-commercial): "Humanitarian Outcomes (year),
// Aid Worker Security Database, aidworkersecurity.org" — handled in the
// side-panel ORG_LABEL.
const CSV_URL =
  'https://www.aidworkersecurity.org/incidents/search?detail=1&country=PS&start_year=2023&end_year=2026&format=csv';
const OUT_DIR = 'data/raw/awsd';
const RAW_CSV_NAME = 'incidents.csv';
const PARSED_JSON_NAME = 'incidents.json';

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * State-machine CSV parser respecting RFC 4180-style quoted fields with
 * embedded commas, newlines, and escaped double quotes (""). AWSD's CSV
 * uses quotes around any cell containing punctuation, including the free-
 * text "Details" column which often contains commas.
 *
 * The second row of the AWSD CSV is a HXL (Humanitarian Exchange Language)
 * hashtag row — e.g. `#event+id,#date+year,...`. We skip it.
 */
export function csvToRows(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuote) {
      if (c === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuote = false;
      } else {
        cur += c;
      }
    } else {
      if (c === '"') {
        inQuote = true;
      } else if (c === ',') {
        row.push(cur);
        cur = '';
      } else if (c === '\r') {
        // ignore; \n handles the row break
      } else if (c === '\n') {
        row.push(cur);
        rows.push(row);
        row = [];
        cur = '';
      } else {
        cur += c;
      }
    }
  }
  // Flush trailing cell/row if file did not end with newline.
  if (cur.length > 0 || row.length > 0) {
    row.push(cur);
    rows.push(row);
  }

  if (rows.length === 0) return [];
  const header = rows[0];
  const out: Array<Record<string, string>> = [];
  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r];
    // Skip the HXL hashtag row that AWSD inserts as row index 1.
    if (cols.length > 0 && cols[0].startsWith('#')) continue;
    // Skip truly empty rows that can appear from trailing newlines.
    if (cols.length === 1 && cols[0].trim() === '') continue;
    const obj: Record<string, string> = {};
    for (let i = 0; i < header.length; i++) {
      obj[header[i]] = cols[i] ?? '';
    }
    out.push(obj);
  }
  return out;
}

async function download(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`AWSD download failed: status ${res.status}`);
  const text = await res.text();
  await writeFile(dest, text);
}

export async function fetchAwsd(opts: { refresh?: boolean } = {}): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const rawPath = join(OUT_DIR, RAW_CSV_NAME);
  const jsonPath = join(OUT_DIR, PARSED_JSON_NAME);

  if (!opts.refresh && (await fileExists(jsonPath))) {
    console.log(`AWSD snapshot already exists at ${jsonPath} — pass --refresh to re-download.`);
    return;
  }

  console.log(`Downloading AWSD CSV from ${CSV_URL}...`);
  await download(CSV_URL, rawPath);
  console.log(`Wrote raw CSV to ${rawPath}`);

  const text = await readFile(rawPath, 'utf8');
  const rows = csvToRows(text);
  console.log(`Parsed ${rows.length} AWSD rows`);
  await writeFile(jsonPath, JSON.stringify(rows));
  console.log(`Wrote ${jsonPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const refresh = process.argv.includes('--refresh');
  fetchAwsd({ refresh }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
