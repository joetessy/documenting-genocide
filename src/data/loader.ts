import type { Incident, BuildMeta, DisplacementEvent } from '@shared/types';

export interface LoadedData {
  incidents: Incident[];
  meta: BuildMeta;
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
    id: string;
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
  const res = await fetch('/data/damage.geojson');
  if (!res.ok) throw new Error(`Failed to load damage.geojson: ${res.status}`);
  return (await res.json()) as DamageData;
}

export async function loadDisplacement(): Promise<DisplacementEvent[]> {
  const res = await fetch('/data/displacement.json');
  if (!res.ok) throw new Error(`Failed to load displacement.json: ${res.status}`);
  return (await res.json()) as DisplacementEvent[];
}
