// Geoconfirmed publishes a bulk KMZ export of every verified placemark for
// the Israel/Gaza/Lebanon map. Their OpenAPI doc states the data is
// "freely available for research, journalism, and analytical use" — no
// per-fetch permission required. We cache the KMZ on disk and re-extract
// only when --refresh is passed.
//
// The KMZ is a zipped KML. Each <Placemark> looks roughly like:
//
//   <Placemark>
//     <name><![CDATA[22 NOV 2023]]></name>
//     <description><![CDATA[Short headline.
//
//   Source(s):
//   https://twitter.com/...
//
//   Geolocation(s):
//   https://twitter.com/GeoConfirmed/...]]></description>
//     <styleUrl><![CDATA[#api/icons/FF6666/False/template/50.png]]></styleUrl>
//     <Point><coordinates><![CDATA[34.285978,31.341917,0]]></coordinates></Point>
//   </Placemark>
//
// Notable: no <TimeStamp>, no <ExtendedData>, no Placemark id attribute.
// Date is encoded in <name> as `DD MON YYYY`. We derive a stable id from
// the lon/lat + date + description-hash so consumers can deduplicate.

import { mkdir, writeFile, access, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';

const KMZ_URL = 'https://geoconfirmed.org/api/Map/export/israel';
const OUT_DIR = 'data/raw/geoconfirmed';
const OUT_FILE = 'incidents.json';
const RAW_KMZ = '/tmp/geoconfirmed-israel.kmz';
const RAW_KML = '/tmp/geoconfirmed-israel.kml';
const USER_AGENT = 'GazaExhibit/1.0 (educational; +https://github.com/anonymous/gaza-exhibit)';

export interface GeoconfirmedPlacemark {
  id: string;
  name: string;
  description: string;
  date: string;         // ISO YYYY-MM-DD, or '' if unparseable
  lat: number;
  lon: number;
  faction?: string;
  sources: string[];    // URLs extracted from the description's Source(s) block
}

async function fileExists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}

async function downloadKmz(dest: string): Promise<void> {
  const res = await fetch(KMZ_URL, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Geoconfirmed fetch failed: ${res.status} ${res.statusText}`);
  const body = res.body;
  if (!body) throw new Error('Geoconfirmed response has no body');
  const out = createWriteStream(dest);
  await pipeline(body as unknown as NodeJS.ReadableStream, out);
}

async function unzipKmz(kmzPath: string, kmlDest: string): Promise<void> {
  // KMZ contains a single doc.kml plus icon PNGs. Pipe the kml entry out
  // via system `unzip` — same approach used in scripts/fetch-ucdp.ts.
  await new Promise<void>((resolve, reject) => {
    const p = spawn('unzip', ['-o', '-p', kmzPath, 'doc.kml'], { stdio: ['ignore', 'pipe', 'inherit'] });
    const out = createWriteStream(kmlDest);
    p.stdout.pipe(out);
    p.on('error', reject);
    out.on('finish', resolve);
    out.on('error', reject);
  });
}

const MONTHS: Record<string, string> = {
  JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
  JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
};

export function parsePlacemarkDate(name: string): string {
  // Geoconfirmed encodes the incident date in <name> as `DD MON YYYY`,
  // e.g. "22 NOV 2023". Return ISO YYYY-MM-DD or '' if it doesn't match.
  const m = name.trim().match(/^(\d{1,2})\s+([A-Z]{3})\s+(\d{4})$/i);
  if (!m) return '';
  const day = m[1].padStart(2, '0');
  const mon = MONTHS[m[2].toUpperCase()];
  const year = m[3];
  if (!mon) return '';
  const dn = Number(day);
  if (dn < 1 || dn > 31) return '';
  return `${year}-${mon}-${day}`;
}

const URL_RE = /https?:\/\/[^\s,)]+/g;

export function extractSources(description: string): string[] {
  // The description has a "Source(s):" block followed by URLs (sometimes
  // prefixed with "Vid1 " or "(2/4)"). Stop at the next labeled block
  // such as "Geolocation(s):", "Geolocations:", or end-of-string.
  if (!description) return [];
  const idx = description.search(/Sources?\s*\(s\)?\s*:|Source\s*:/i);
  if (idx === -1) return [];
  const after = description.slice(idx);
  // Cut off at the next labeled block. We treat any line that starts with
  // a known label (Geolocation, Note, Vid Confirmation, etc.) as a stop
  // marker. Conservative: stop at Geolocation(s) which is the consistent
  // sibling section. Anything else inside Source(s) is still a URL hit.
  const stop = after.search(/\n\s*(Geolocation\(s\)|Geolocations?|Geo\s*Location)\b/i);
  const block = stop === -1 ? after : after.slice(0, stop);
  const urls = block.match(URL_RE) ?? [];
  // Trim trailing punctuation that frequently follows tweet links.
  const cleaned = urls.map((u) => u.replace(/[),.;:]+$/, ''));
  // De-duplicate while preserving order.
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of cleaned) {
    if (!seen.has(u)) { seen.add(u); out.push(u); }
  }
  return out;
}

function stableId(opts: { name: string; description: string; lat: number; lon: number }): string {
  // No GUID in the KMZ, so derive a deterministic short id from the
  // content. SHA-1 of `name|lat|lon|description` truncated to 16 hex chars
  // gives us a stable handle across re-fetches and enough entropy for the
  // ~6.8K placemarks in the dataset.
  const h = createHash('sha1');
  h.update(opts.name);
  h.update('|');
  h.update(opts.lat.toFixed(6));
  h.update('|');
  h.update(opts.lon.toFixed(6));
  h.update('|');
  h.update(opts.description);
  return h.digest('hex').slice(0, 16);
}

function decodeCdata(s: string): string {
  // Strip a single wrapping <![CDATA[ ... ]]> if present.
  const trimmed = s.trim();
  const m = trimmed.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return m ? m[1] : trimmed;
}

function firstTagInner(block: string, tag: string): string {
  // Return the inner text of the first <tag>...</tag> in `block`, with any
  // CDATA wrapper stripped. Returns '' if the tag isn't present.
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`);
  const m = block.match(re);
  if (!m) return '';
  return decodeCdata(m[1]);
}

export function parsePlacemarks(kml: string): GeoconfirmedPlacemark[] {
  const out: GeoconfirmedPlacemark[] = [];
  // Iterate every <Placemark>...</Placemark> block. Regex is fine here —
  // KML is well-formed in this export and Placemarks don't nest.
  const blockRe = /<Placemark[^>]*>([\s\S]*?)<\/Placemark>/g;
  let match: RegExpExecArray | null;
  while ((match = blockRe.exec(kml)) !== null) {
    const inner = match[1];

    const name = firstTagInner(inner, 'name');
    const description = firstTagInner(inner, 'description');

    // Point coordinates live at <Point><coordinates>lon,lat,alt</coordinates></Point>.
    const coordsTxt = firstTagInner(inner, 'coordinates');
    if (!coordsTxt) continue;
    const parts = coordsTxt.split(',').map((s) => Number(s.trim()));
    if (parts.length < 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) continue;
    const lon = parts[0];
    const lat = parts[1];

    const date = parsePlacemarkDate(name);
    const sources = extractSources(description);
    const id = stableId({ name, description, lat, lon });

    out.push({
      id,
      name: name.trim(),
      description: description.trim(),
      date,
      lat,
      lon,
      sources,
    });
  }
  return out;
}

export async function fetchGeoconfirmed(opts: { refresh?: boolean } = {}): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const outPath = join(OUT_DIR, OUT_FILE);
  if (!opts.refresh && (await fileExists(outPath))) {
    console.log(`Geoconfirmed snapshot already exists at ${outPath} — pass --refresh to re-download.`);
    return;
  }

  if (opts.refresh && (await fileExists(RAW_KMZ))) {
    await rm(RAW_KMZ, { force: true });
  }
  if (opts.refresh && (await fileExists(RAW_KML))) {
    await rm(RAW_KML, { force: true });
  }

  if (!(await fileExists(RAW_KMZ))) {
    console.log(`Downloading Geoconfirmed KMZ from ${KMZ_URL}...`);
    await downloadKmz(RAW_KMZ);
  } else {
    console.log(`Reusing cached KMZ at ${RAW_KMZ}`);
  }

  if (!(await fileExists(RAW_KML))) {
    console.log('Unzipping KMZ...');
    await unzipKmz(RAW_KMZ, RAW_KML);
  } else {
    console.log(`Reusing cached KML at ${RAW_KML}`);
  }

  console.log('Parsing placemarks...');
  const kml = await readFile(RAW_KML, 'utf8');
  const placemarks = parsePlacemarks(kml);

  await writeFile(outPath, JSON.stringify(placemarks));
  console.log(`Wrote ${placemarks.length} Geoconfirmed placemarks to ${outPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const refresh = process.argv.includes('--refresh');
  fetchGeoconfirmed({ refresh }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
