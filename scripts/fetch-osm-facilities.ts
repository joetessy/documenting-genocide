import { mkdir, access, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { spawn } from 'node:child_process';

const HEALTH_URL =
  'https://production-raw-data-api.s3.amazonaws.com/ISO3/PSE/health_facilities/' +
  'hotosm_pse_health_facilities_osm_geojson.zip';
const EDUCATION_URL =
  'https://production-raw-data-api.s3.amazonaws.com/ISO3/PSE/education_facilities/' +
  'hotosm_pse_education_facilities_osm_geojson.zip';
const OUT_DIR = 'data/raw/osm';

async function fileExists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}

async function download(url: string, dest: string): Promise<void> {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
  const body = res.body;
  if (!body) throw new Error('No response body');
  const out = createWriteStream(dest);
  await pipeline(body as unknown as NodeJS.ReadableStream, out);
}

async function unzipFirstGeojson(zipPath: string, destPath: string): Promise<void> {
  // The HOT/OSM zip contains: <name>.geojson + README.txt + config.yaml + metadata.json
  // We extract just the geojson by name.
  await new Promise<void>((resolve, reject) => {
    const p = spawn('unzip', ['-o', '-j', zipPath, '*.geojson', '-d', OUT_DIR], {
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    p.on('error', reject);
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`unzip exited ${code}`))));
  });
  // unzip writes to <OUT_DIR>/<original-name>.geojson. We don't know the exact name,
  // so move the most recently extracted .geojson to the canonical destPath.
  const { readdir, stat } = await import('node:fs/promises');
  const entries = await readdir(OUT_DIR);
  const destName = destPath.split('/').pop()!;
  const geojsons = entries.filter((e) => e.endsWith('.geojson') && e !== destName && e !== 'health.geojson' && e !== 'education.geojson');
  // Find the most recently modified one (just extracted)
  let newest: { name: string; mtime: number } | null = null;
  for (const e of geojsons) {
    const s = await stat(join(OUT_DIR, e));
    if (!newest || s.mtimeMs > newest.mtime) newest = { name: e, mtime: s.mtimeMs };
  }
  if (!newest) throw new Error('No geojson found after unzip');
  await rename(join(OUT_DIR, newest.name), destPath);
}

async function fetchOne(url: string, kind: 'health' | 'education'): Promise<void> {
  const zipPath = join(OUT_DIR, `${kind}.zip`);
  const geojsonPath = join(OUT_DIR, `${kind}.geojson`);
  console.log(`Downloading HOT/OSM ${kind} from ${url}...`);
  await download(url, zipPath);
  await unzipFirstGeojson(zipPath, geojsonPath);
  await rm(zipPath);
  console.log(`Wrote ${geojsonPath}`);
}

export async function fetchOsmFacilities(opts: { refresh?: boolean } = {}): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const healthPath = join(OUT_DIR, 'health.geojson');
  const educationPath = join(OUT_DIR, 'education.geojson');

  if (!opts.refresh && (await fileExists(healthPath)) && (await fileExists(educationPath))) {
    console.log(`HOT/OSM snapshots already exist in ${OUT_DIR} — pass --refresh to re-download.`);
    return;
  }

  await fetchOne(HEALTH_URL, 'health');
  await fetchOne(EDUCATION_URL, 'education');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const refresh = process.argv.includes('--refresh');
  fetchOsmFacilities({ refresh }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
