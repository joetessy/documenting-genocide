import { mkdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const CSV_URL =
  'https://data.humdata.org/dataset/a641dda7-9b19-4103-b811-76a3963d29d2' +
  '/resource/e6e48083-1276-4dce-a827-a12b21f3dbac/download/pse_idmc_idu_events.csv';
const OUT_DIR = 'data/raw/idmc';

async function fileExists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}

function csvToRows(text: string): Array<Record<string, string>> {
  // IDMC's description field contains embedded newlines, so we parse with a
  // state machine that respects quoted fields across newlines rather than
  // splitting by line first.
  const rows: string[][] = [];
  let inQuote = false;
  let line: string[] = [];
  let field = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuote) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuote = false;
      else field += c;
    } else {
      if (c === '"') inQuote = true;
      else if (c === ',') { line.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        line.push(field); field = '';
        if (line.length > 1 || line[0] !== '') rows.push(line);
        line = [];
      } else field += c;
    }
  }
  if (field.length > 0 || line.length > 0) { line.push(field); rows.push(line); }
  if (rows.length === 0) return [];
  const header = rows[0];
  return rows.slice(1).map((r) => Object.fromEntries(header.map((k, j) => [k, r[j] ?? ''])));
}

export async function fetchIdmc(opts: { refresh?: boolean } = {}): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const csvPath = join(OUT_DIR, 'idu-events.csv');
  const jsonPath = join(OUT_DIR, 'idu-events.json');

  if (!opts.refresh && (await fileExists(jsonPath))) {
    console.log(`IDMC snapshot already exists at ${jsonPath} — pass --refresh to re-download.`);
    return;
  }

  console.log(`Downloading IDMC IDU CSV from ${CSV_URL}...`);
  const res = await fetch(CSV_URL, { redirect: 'follow' });
  if (!res.ok) throw new Error(`IDMC fetch failed: ${res.status}`);
  const text = await res.text();
  await writeFile(csvPath, text, 'utf8');

  const rows = csvToRows(text);
  await writeFile(jsonPath, JSON.stringify(rows));
  console.log(`Wrote ${rows.length} IDMC rows to ${jsonPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const refresh = process.argv.includes('--refresh');
  fetchIdmc({ refresh }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
