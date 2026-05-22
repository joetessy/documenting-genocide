import type { DamageRecord, DamageStatus } from '../shared/types';

const HDX_URL = 'https://data.humdata.org/dataset/unosat-gaza-strip-comprehensive-damage-assessment-11-october-2025';

function isInGazaBbox(lat: number, lon: number): boolean {
  return lat >= 31.20 && lat <= 31.60 && lon >= 34.20 && lon <= 34.60;
}

const DAMAGE_MAP: Record<number, DamageStatus> = {
  1: 'destroyed',
  2: 'severe',
  3: 'moderate',
  4: 'possibly_damaged',
};

export function mapDamageClass(code: number | null | undefined): DamageStatus | null {
  if (code === null || code === undefined) return null;
  return DAMAGE_MAP[code] ?? null;
}

export function parseSensorDate(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  let d: Date;
  if (typeof v === 'number') d = new Date(v);
  else if (typeof v === 'string') d = new Date(v);
  else return null;
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

// Normalize a slim damage feature (the format produced by fetch-ocha.ts).
// Expected properties: { OBJECTID, first_damage_date, latest_damage_class, Grouped_Damage_Classes }.
export function normalizeOchaFeature(feat: GeoJSON.Feature): DamageRecord | null {
  const p = (feat.properties ?? {}) as Record<string, unknown>;
  const grouped = p.Grouped_Damage_Classes;
  if (grouped !== 1) return null;

  const cls = p.latest_damage_class;
  const status = mapDamageClass(typeof cls === 'number' ? cls : null);
  if (!status) return null;

  const id = p.OBJECTID;
  if (typeof id !== 'number') return null;

  if (feat.geometry?.type !== 'Point') return null;
  const [lon, lat] = feat.geometry.coordinates as [number, number];
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (!isInGazaBbox(lat, lon)) return null;

  const firstDate = p.first_damage_date;
  if (typeof firstDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(firstDate)) return null;

  return {
    id: `unosat-${id}`,
    location: { lat, lon },
    status,
    assessment_date: firstDate,    // semantically: the FIRST time this building was assessed damaged
    source: { org: 'ocha', url: HDX_URL },
  };
}
