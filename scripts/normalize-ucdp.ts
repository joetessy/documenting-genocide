import type { Incident, IncidentCategory, SourceAttribution } from '../shared/types';
import { isInGazaPolygon } from '../shared/gaza-polygon';

interface UcdpRow {
  id: string;
  date_start: string;
  latitude: string;
  longitude: string;
  where_prec: string;
  where_coordinates: string;
  adm_2: string;
  best: string;
  source_headline: string;
  dyad_name: string;
}

const HEADLINE_KEYWORDS: Array<{ pattern: RegExp; category: IncidentCategory }> = [
  { pattern: /\b(air ?strike|airstrikes?|drone strike|aerial bombardment|bombing)\b/i, category: 'airstrike' },
  { pattern: /\b(shelling|shelled|artillery|mortar|missile|rocket)\b/i, category: 'shelling' },
  { pattern: /\b(ground (operation|incursion|invasion|offensive)|clash|raid|tank|troops|infantry)\b/i, category: 'ground_op' },
  { pattern: /\b(aid|convoy|humanitarian|food)\b/i, category: 'attack_on_aid' },
];

export function mapUcdpCategory(opts: { headline: string }): IncidentCategory {
  const h = opts.headline ?? '';
  for (const { pattern, category } of HEADLINE_KEYWORDS) {
    if (pattern.test(h)) return category;
  }
  return 'other';
}

export function ucdpDescription(row: UcdpRow): string[] {
  const headline = (row.source_headline ?? '').trim();
  const place = (row.where_coordinates || row.adm_2 || '').trim();
  const dyad = (row.dyad_name ?? '').trim();
  const parts: string[] = [];
  if (headline) parts.push(headline);
  if (place && !headline.toLowerCase().includes(place.toLowerCase())) parts.push(`Location: ${place}.`);
  if (dyad) parts.push(`Reported by UCDP. Parties: ${dyad}.`);
  return parts.length === 0 ? [] : [parts.join(' ')];
}

export function normalizeUcdpRecord(row: UcdpRow): Incident | null {
  const id = (row.id ?? '').trim();
  if (id.length === 0) return null;

  const date = (row.date_start ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const wherePrec = Number(row.where_prec ?? '99');
  if (wherePrec >= 3) return null;       // 1 = exact, 2 = town/city; 3+ = vague

  const lat = Number(row.latitude);
  const lon = Number(row.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (!isInGazaPolygon(lat, lon)) return null;

  const best = Number(row.best);
  const killed = Number.isFinite(best) ? best : null;

  const source: SourceAttribution = {
    org: 'ucdp',
    id,
    url: `https://ucdp.uu.se/encyclopedia/event/${encodeURIComponent(id)}`,
  };

  return {
    id: `ucdp:${id}`,
    date,
    location: {
      lat,
      lon,
      name: (row.where_coordinates || row.adm_2 || undefined) ?? undefined,
    },
    category: mapUcdpCategory({ headline: row.source_headline ?? '' }),
    casualties: {
      killed,
      injured: null,
      killed_children: null,
      killed_women: null,
    },
    description: ucdpDescription(row),
    sources: [source],
  };
}
