// Normalize a Geoconfirmed KMZ placemark to the unified `Incident` shape.
// Geoconfirmed records don't carry casualty counts in any structured form
// — the descriptions are free text — so we leave every casualty field
// null. We do, however, extract:
//   - a stable id (computed at fetch time from coords + description hash)
//   - the date (parsed from <name> at fetch time)
//   - the lat/lon (filtered to the Gaza polygon here)
//   - one SourceAttribution per URL in the placemark's Source(s) block
//
// Category mapping mirrors the keyword approach in normalize-cir.ts and
// normalize-ucdp.ts: look at description + name + faction for any of the
// canonical incident-category keywords.

import type {
  Incident,
  IncidentCategory,
  SourceAttribution,
} from '../shared/types';
import { isInGazaPolygon } from '../shared/gaza-polygon';
import type { GeoconfirmedPlacemark } from './fetch-geoconfirmed';

const CONFLICT_START = '2023-10-07';
const GEOCONFIRMED_HOMEPAGE = 'https://geoconfirmed.org';

// Order matters: aid and detention are domain-specific tags that should
// win over the more generic strike/shelling patterns when the text
// mentions both (e.g. "food distribution site shelled" → attack_on_aid).
const KEYWORDS: Array<{ pattern: RegExp; category: IncidentCategory }> = [
  { pattern: /\b(aid|convoy|humanitarian|food)\b/i, category: 'attack_on_aid' },
  { pattern: /\b(detention|arrest|detained|arrested|kidnapped|hostage)\b/i, category: 'detention' },
  { pattern: /\b(air ?strike|airstrikes?|drone strike|aerial bombardment|bombing)\b/i, category: 'airstrike' },
  { pattern: /\b(shelling|shelled|artillery|mortar|missile|rocket)\b/i, category: 'shelling' },
  { pattern: /\b(ground (raid|operation|incursion|invasion|offensive)|tank|troops|infantry)\b/i, category: 'ground_op' },
];

export function mapGeoconfirmedCategory(opts: {
  name: string;
  description: string;
  faction: string;
}): IncidentCategory {
  const haystack = `${opts.name ?? ''} ${opts.description ?? ''} ${opts.faction ?? ''}`;
  for (const { pattern, category } of KEYWORDS) {
    if (pattern.test(haystack)) return category;
  }
  return 'other';
}

export function normalizeGeoconfirmedRecord(
  p: GeoconfirmedPlacemark,
): Incident | null {
  const id = (p.id ?? '').trim();
  if (id.length === 0) return null;

  const date = (p.date ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (date < CONFLICT_START) return null;

  const lat = Number(p.lat);
  const lon = Number(p.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (!isInGazaPolygon(lat, lon)) return null;

  const category = mapGeoconfirmedCategory({
    name: p.name ?? '',
    description: p.description ?? '',
    faction: p.faction ?? '',
  });

  const sources: SourceAttribution[] =
    p.sources.length > 0
      ? p.sources.map((url) => ({ org: 'geoconfirmed', id, url }))
      : [{ org: 'geoconfirmed', id, url: GEOCONFIRMED_HOMEPAGE }];

  const descriptionTrim = (p.description ?? '').trim();
  const description = descriptionTrim.length > 0 ? [descriptionTrim] : [];

  const locationName = (p.name ?? '').trim() || undefined;

  return {
    id: `geoconfirmed:${id}`,
    date,
    location: { lat, lon, name: locationName },
    category,
    casualties: {
      killed: null,
      injured: null,
      killed_children: null,
      killed_women: null,
    },
    description,
    sources,
  };
}
