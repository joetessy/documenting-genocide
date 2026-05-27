import { mkdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const FEATURE_SERVER =
  'https://services-eu1.arcgis.com/06WOSMGHsCnaFyMp/arcgis/rest/services/' +
  'Indigo_Incidents_Layer_view/FeatureServer/0';
const PAGE_SIZE = 1000;
const OUT_DIR = 'data/raw/cir';
const OUT_FILE = 'incidents.geojson';

async function fileExists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function fetchPage(offset: number): Promise<GeoJSON.Feature[]> {
  const params = new URLSearchParams({
    where: '1=1',
    outFields: '*',
    f: 'geojson',
    resultRecordCount: String(PAGE_SIZE),
    resultOffset: String(offset),
    outSR: '4326',
  });
  const url = `${FEATURE_SERVER}/query?${params}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CIR fetch failed (${res.status}) at offset ${offset}`);
  const fc = (await res.json()) as GeoJSON.FeatureCollection;
  if (!Array.isArray(fc.features)) {
    throw new Error(`CIR response missing 'features' array at offset ${offset}`);
  }
  return fc.features;
}

export async function fetchCir(opts: { refresh?: boolean } = {}): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const outPath = join(OUT_DIR, OUT_FILE);
  if (!opts.refresh && (await fileExists(outPath))) {
    console.log(`CIR snapshot already exists at ${outPath} — pass --refresh to re-download.`);
    return;
  }

  console.log(`Downloading CIR incidents from ${FEATURE_SERVER}...`);
  const all: GeoJSON.Feature[] = [];
  let offset = 0;
  while (true) {
    await sleep(250);
    const page = await fetchPage(offset);
    console.log(`  page offset=${offset}: ${page.length} features`);
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  const fc: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: all };
  await writeFile(outPath, JSON.stringify(fc));
  console.log(`Wrote ${all.length} CIR features to ${outPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const refresh = process.argv.includes('--refresh');
  fetchCir({ refresh }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
