import type { Feature } from 'geojson';
import type { Incident, IncidentCategory, SourceAttribution } from '../shared/types';

function isInGazaBbox(lat: number, lon: number): boolean {
  return lat >= 31.20 && lat <= 31.60 && lon >= 34.20 && lon <= 34.60;
}

const KEYWORDS: Array<{ pattern: RegExp; category: IncidentCategory }> = [
  { pattern: /\b(air ?strike|airstrikes?|drone strike|aerial bombardment|bombing)\b/i, category: 'airstrike' },
  { pattern: /\b(shelling|shelled|artillery|mortar|missile|rocket)\b/i, category: 'shelling' },
  { pattern: /\b(ground (raid|operation|incursion|invasion|offensive)|raid|tank|troops|infantry)\b/i, category: 'ground_op' },
  { pattern: /\b(aid|convoy|humanitarian|food)\b/i, category: 'attack_on_aid' },
  { pattern: /\b(detention|arrest|detained|arrested)\b/i, category: 'detention' },
];

export function mapCirCategory(opts: { sub: string; main: string }): IncidentCategory {
  const haystack = `${opts.sub ?? ''} ${opts.main ?? ''}`;
  for (const { pattern, category } of KEYWORDS) {
    if (pattern.test(haystack)) return category;
  }
  return 'other';
}

function collectLinks(props: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (let i = 1; i <= 7; i++) {
    const v = props[`Link_${i}`];
    if (typeof v === 'string' && v.length > 0 && v !== 'None' && v.startsWith('http')) {
      out.push(v);
    }
  }
  return out;
}

const CONFLICT_START = '2023-10-07';

export function normalizeCirFeature(feat: Feature): Incident | null {
  if (feat.geometry?.type !== 'Point') return null;

  const coords = (feat.geometry as GeoJSON.Point).coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const [lon, lat] = coords as [number, number];
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (!isInGazaBbox(lat, lon)) return null;

  const props = (feat.properties ?? {}) as Record<string, unknown>;

  const date = typeof props.Incident_Date === 'string' ? props.Incident_Date.trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (date < CONFLICT_START) return null;

  const incidentNumber = typeof props.Incident_Number === 'string' && props.Incident_Number.length > 0
    ? props.Incident_Number
    : String(props.OBJECTID ?? '');
  if (incidentNumber.length === 0) return null;

  const sub = typeof props.Sub_Category === 'string' ? props.Sub_Category : '';
  const main = typeof props.Main_Category_ === 'string' ? props.Main_Category_ : '';
  const category = mapCirCategory({ sub, main });

  const locationName = typeof props.Location === 'string' && props.Location.trim().length > 0
    ? props.Location.trim()
    : undefined;

  const description = typeof props.Description === 'string' ? props.Description.trim() : '';

  const links = collectLinks(props);
  const sources: SourceAttribution[] = links.length > 0
    ? links.map((url) => ({ org: 'cir', id: incidentNumber, url }))
    : [{ org: 'cir', id: incidentNumber, url: 'https://www.info-res.org/israel-gaza-war/maps/israel-gaza-conflict-map/' }];

  return {
    id: `cir:${incidentNumber}`,
    date,
    location: { lat, lon, name: locationName },
    category,
    casualties: {
      killed: null,
      injured: null,
      killed_children: null,
      killed_women: null,
    },
    description: description.length > 0 ? [description] : [],
    sources,
  };
}
