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

// Shape the side panel renders for a clicked damage building. Built on the fly
// from a clicked vector-tile feature's properties (see the click router in
// main.ts) — there's no longer a full GeoJSON of these in memory.
export interface DamageFeature {
  type: 'Feature';
  id: string;
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: {
    id?: string;
    status: string;
    assessment_date: string;
    governorate?: string;
    progression?: DamagePass[];
  };
}

// Precomputed cumulative "destroyed" counts by assessment date, for the header
// counter. Replaces iterating the full 196K-feature GeoJSON on the client.
export interface DamageStats {
  dateStrings: string[];                          // assessment dates (for cumCount)
  cumCount: number[];                             // cumulative destroyed buildings
  perDate: { date: string; count: number }[];     // total assessed per date (histogram)
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

export async function loadDamageStats(): Promise<DamageStats> {
  // Tiny precomputed file (committed alongside damage.pmtiles). The damage
  // features themselves are served as PMTiles vector tiles and rendered/queried
  // straight from the map — the client never loads the full GeoJSON.
  const res = await fetch('/damage-stats.json');
  if (!res.ok) throw new Error(`Failed to load damage-stats.json: ${res.status}`);
  return (await res.json()) as DamageStats;
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
