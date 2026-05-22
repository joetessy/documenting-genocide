import type { Incident, BuildMeta } from '@shared/types';

export interface LoadedData {
  incidents: Incident[];
  meta: BuildMeta;
}

export interface DamageFeature {
  type: 'Feature';
  id: string;
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: { id: string; status: string; assessment_date: string };
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
  const res = await fetch('/data/damage.geojson');
  if (!res.ok) throw new Error(`Failed to load damage.geojson: ${res.status}`);
  return (await res.json()) as DamageData;
}
