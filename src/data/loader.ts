import type { Incident, BuildMeta, FacilityRecord } from '@shared/types';

export interface LoadedData {
  incidents: Incident[];
  meta: BuildMeta;
}

export interface DailyCasualty {
  date: string;       // ISO YYYY-MM-DD
  killed: number;     // cumulative through this date
  injured?: number;   // cumulative through this date (optional)
}

export interface DamagePass {
  date: string;
  class: number;     // 1=destroyed 2=severe 3=moderate 4=possibly_damaged
}

export interface DamageFeature {
  type: 'Feature';
  id: string;
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: {
    id?: string;          // copied from the top-level id at load time (see loadDamage)
    status: string;
    assessment_date: string;
    governorate?: string;
    progression?: DamagePass[];
  };
}

export interface DamageData {
  type: 'FeatureCollection';
  features: DamageFeature[];
}

export async function loadIncidents(): Promise<LoadedData> {
  const [incidentsRes, metaRes] = await Promise.all([
    fetch('/data/incidents.json'),
    fetch('/data/meta.json'),
  ]);
  if (!incidentsRes.ok) throw new Error(`Failed to load incidents.json: ${incidentsRes.status}`);
  if (!metaRes.ok) throw new Error(`Failed to load meta.json: ${metaRes.status}`);
  const incidents = (await incidentsRes.json()) as Incident[];
  const meta = (await metaRes.json()) as BuildMeta;
  return { incidents, meta };
}

export async function loadDamage(): Promise<DamageData> {
  // Pre-gzipped to fit Cloudflare's 25MiB per-asset limit (raw ~43MB, gzipped ~2MB).
  // We decompress in the browser rather than relying on Content-Encoding because
  // Cloudflare Workers Static Assets ignores _headers' Content-Encoding directive
  // (the edge manages compression itself). Detecting the gzip magic bytes lets
  // this work in dev (Vite serves the raw .gz with Content-Encoding: gzip, which
  // the browser pre-decodes for us) and in prod (raw gzip bytes reach the client).
  const res = await fetch('/data/damage.geojson.gz');
  if (!res.ok) throw new Error(`Failed to load damage.geojson.gz: ${res.status}`);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const isGzipped = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  const text = isGzipped
    ? await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
    : new TextDecoder().decode(buf);
  const fc = JSON.parse(text) as DamageData;
  // Each feature's id lives at the top level (the build pipeline drops the
  // redundant properties.id to shave bytes). MapLibre does not expose a
  // string top-level id through queryRenderedFeatures, so click hit-testing
  // can't recover it. Copy it into properties here so clicks can look the
  // feature up in damageById. Kept out of the wire format to stay small.
  for (const f of fc.features) {
    f.properties.id = f.id;
  }
  return fc;
}

export async function loadFacilities(): Promise<FacilityRecord[]> {
  const res = await fetch('/data/facilities.json');
  if (!res.ok) throw new Error(`Failed to load facilities.json: ${res.status}`);
  return (await res.json()) as FacilityRecord[];
}

export async function loadCasualtyToll(): Promise<DailyCasualty[]> {
  const res = await fetch('/data/casualty-toll.json');
  if (!res.ok) throw new Error(`Failed to load casualty-toll.json: ${res.status}`);
  return (await res.json()) as DailyCasualty[];
}
