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
  // Pre-gzipped to fit Cloudflare Pages' 25MiB per-asset limit (raw ~43MB, gzipped ~2MB).
  // Served with Content-Encoding: gzip (Vite handles this automatically for .gz files;
  // Cloudflare Pages uses public/_headers). The browser decompresses transparently.
  const res = await fetch('/data/damage.geojson.gz');
  if (!res.ok) throw new Error(`Failed to load damage.geojson.gz: ${res.status}`);
  return (await res.json()) as DamageData;
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
