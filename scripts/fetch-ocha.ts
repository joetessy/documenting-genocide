import { mkdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const FEATURE_SERVER = 'https://services-eu1.arcgis.com/KgFmfkCUnPS3UIlL/arcgis/rest/services/OCHA_CBPF_OPT_031_UNOSAT_Gaza_Strip_CDA_11October2025_GDB_vista/FeatureServer/0';
const PAGE_SIZE = 2000;
const OUT_DIR = 'data/raw/ocha';

// UNOSAT's CDA layer stores up to 14 assessment passes per building. Each pass
// has a (SensorDate_N, Main_Damage_Site_Class_N) pair. The latest pass is _14;
// older passes from _1 (oldest) to _13. We pull all of them so we can extract
// the FIRST date each building was assessed as damaged, not just the most
// recent class — that's what enables time-correlated rendering against the
// incident timeline.
const SENSOR_FIELDS: string[] = (() => {
  const fields: string[] = ['OBJECTID', 'Grouped_Damage_Classes', 'Governorate'];
  fields.push('SensorDate', 'Main_Damage_Site_Class');
  for (let i = 2; i <= 14; i++) {
    fields.push(`SensorDate_${i}`, `Main_Damage_Site_Class_${i}`);
  }
  return fields;
})();

const FIELDS_PARAM = SENSOR_FIELDS.join(',');

// Codes 1-4 mean the building was damaged at that pass; 5+ are other classes.
const DAMAGE_CODES = new Set([1, 2, 3, 4]);

interface SlimFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: {
    OBJECTID: number;
    first_damage_date: string;
    latest_damage_class: number;
    Grouped_Damage_Classes: number;
  };
}

async function fileExists(p: string): Promise<boolean> {
  try { await access(p); return true; } catch { return false; }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function fetchPage(offset: number): Promise<GeoJSON.FeatureCollection> {
  const params = new URLSearchParams({
    where: '1=1',
    outFields: FIELDS_PARAM,
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

function epochToIso(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  let d: Date;
  if (typeof v === 'number') d = new Date(v);
  else if (typeof v === 'string') d = new Date(v);
  else return null;
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

// Extract the EARLIEST sensor pass at which this building was classified as
// damaged (codes 1-4), plus the most recent damage code. Returns null if the
// building was never damaged.
export function extractDamageTimeline(props: Record<string, unknown>): { first: string; latest: number } | null {
  const passes: Array<{ date: unknown; code: unknown }> = [
    { date: props.SensorDate, code: props.Main_Damage_Site_Class },
  ];
  for (let i = 2; i <= 14; i++) {
    passes.push({ date: props[`SensorDate_${i}`], code: props[`Main_Damage_Site_Class_${i}`] });
  }

  type Pass = { dateIso: string; code: number };
  const dated: Pass[] = [];
  for (const p of passes) {
    const iso = epochToIso(p.date);
    if (!iso) continue;
    if (typeof p.code !== 'number') continue;
    dated.push({ dateIso: iso, code: p.code });
  }
  dated.sort((a, b) => a.dateIso.localeCompare(b.dateIso));

  let firstDate: string | null = null;
  let latestCode: number | null = null;
  for (const p of dated) {
    if (DAMAGE_CODES.has(p.code)) {
      if (firstDate === null) firstDate = p.dateIso;
      latestCode = p.code;
    }
  }
  if (firstDate === null || latestCode === null) return null;
  return { first: firstDate, latest: latestCode };
}

export async function fetchOcha(opts: { refresh?: boolean } = {}): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const outPath = join(OUT_DIR, 'damage.geojson');
  if (!opts.refresh && (await fileExists(outPath))) {
    console.log(`OCHA snapshot already exists at ${outPath} — pass --refresh to re-download.`);
    return;
  }

  const all: SlimFeature[] = [];
  let offset = 0;
  let totalSeen = 0;

  while (true) {
    const page = await fetchPage(offset);
    const feats = page.features ?? [];
    totalSeen += feats.length;

    for (const feat of feats) {
      if (feat.geometry?.type !== 'Point') continue;
      const coords = feat.geometry.coordinates as [number, number];
      const props = (feat.properties ?? {}) as Record<string, unknown>;
      const timeline = extractDamageTimeline(props);
      if (!timeline) continue;

      const grouped = props.Grouped_Damage_Classes;
      if (grouped !== 1) continue;  // buildings only

      const id = props.OBJECTID;
      if (typeof id !== 'number') continue;

      all.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: coords },
        properties: {
          OBJECTID: id,
          first_damage_date: timeline.first,
          latest_damage_class: timeline.latest,
          Grouped_Damage_Classes: 1,
        },
      });
    }

    console.log(`Fetched offset=${offset} (${feats.length} raw, ${all.length} kept, total seen ${totalSeen})`);
    if (feats.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    await sleep(300);
  }

  const fc: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: all };
  await writeFile(outPath, JSON.stringify(fc));
  console.log(`Wrote ${all.length} damaged-building features to ${outPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const refresh = process.argv.includes('--refresh');
  fetchOcha({ refresh }).catch((err) => { console.error(err); process.exit(1); });
}
