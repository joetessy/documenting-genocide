import { mkdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const FEATURE_SERVER = 'https://services-eu1.arcgis.com/KgFmfkCUnPS3UIlL/arcgis/rest/services/OCHA_CBPF_OPT_031_UNOSAT_Gaza_Strip_CDA_11October2025_GDB_vista/FeatureServer/0';
const PAGE_SIZE = 2000;
const OUT_DIR = 'data/raw/ocha';
const FIELDS = 'OBJECTID,Main_Damage_Site_Class_14,SensorDate_14,Governorate,Grouped_Damage_Classes';

async function fileExists(p: string): Promise<boolean> {
  try { await access(p); return true; } catch { return false; }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function fetchPage(offset: number): Promise<GeoJSON.FeatureCollection> {
  const params = new URLSearchParams({
    where: '1=1',
    outFields: FIELDS,
    outSR: '4326',
    resultRecordCount: String(PAGE_SIZE),
    resultOffset: String(offset),
    f: 'geojson',
  });
  const url = `${FEATURE_SERVER}/query?${params}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OCHA fetch failed at offset ${offset}: ${res.status}`);
  return (await res.json()) as GeoJSON.FeatureCollection;
}

export async function fetchOcha(opts: { refresh?: boolean } = {}): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const outPath = join(OUT_DIR, 'damage.geojson');
  if (!opts.refresh && (await fileExists(outPath))) {
    console.log(`OCHA snapshot already exists at ${outPath} — pass --refresh to re-download.`);
    return;
  }
  const all: GeoJSON.Feature[] = [];
  let offset = 0;
  while (true) {
    const page = await fetchPage(offset);
    const feats = page.features ?? [];
    all.push(...feats);
    console.log(`Fetched offset=${offset} (${feats.length} features, total ${all.length})`);
    if (feats.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    await sleep(300);
  }
  const fc: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: all };
  await writeFile(outPath, JSON.stringify(fc));
  console.log(`Wrote ${all.length} features to ${outPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const refresh = process.argv.includes('--refresh');
  fetchOcha({ refresh }).catch((err) => { console.error(err); process.exit(1); });
}
