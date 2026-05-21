import type {
  Incident,
  IncidentCategory,
  CredibilityRating,
  SourceAttribution,
} from '../shared/types';

export interface AirwarsTaxonomies {
  civilian_harm_status: Record<string, { name: string; slug: string }>;
  strike_type: Record<string, { name: string; slug: string }>;
  casualty: Record<string, { name: string; slug: string }>;
}

interface RawGeo {
  latitude: number | string;
  longitude: number | string;
  primary_coordinate?: boolean;
  geolocation_accuracy?: string;
}

interface RawCasualtyBucket {
  killed_min?: number | string;
  killed_max?: number | string;
  injured_min?: number | string;
  injured_max?: number | string;
}

interface RawAirwarsRecord {
  id: number;
  link: string;
  title: { rendered: string };
  civilian_harm_status: number[];
  strike_type: number[];
  acf: {
    unique_reference_code?: string;
    incident_date?: string;
    location_name?: string;
    region?: string;
    governorate?: string;
    geolocations?: RawGeo[];
    killed_injured_civilian_non_combatants?: RawCasualtyBucket;
    killed_injured_children?: RawCasualtyBucket;
    killed_injured_women?: RawCasualtyBucket;
    killed_injured_men?: RawCasualtyBucket;
  };
}

export function parseAirwarsDate(yyyymmdd: string): string | null {
  if (!/^\d{8}$/.test(yyyymmdd)) return null;
  const y = yyyymmdd.slice(0, 4);
  const m = yyyymmdd.slice(4, 6);
  const d = yyyymmdd.slice(6, 8);
  const mn = Number(m);
  const dn = Number(d);
  if (mn < 1 || mn > 12 || dn < 1 || dn > 31) return null;
  return `${y}-${m}-${d}`;
}

export function pickPrimaryCoord(geos: RawGeo[]): { lat: number; lon: number } | null {
  if (!geos || geos.length === 0) return null;
  const primary = geos.find((g) => g.primary_coordinate === true) ?? geos[0];
  const lat = Number(primary.latitude);
  const lon = Number(primary.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat === 0 && lon === 0) return null;
  // World-range validation: reject anything physically impossible.
  if (lat < -90 || lat > 90) return null;
  if (lon < -180 || lon > 180) return null;
  return { lat, lon };
}

export function isInGazaBbox(lat: number, lon: number): boolean {
  return lat >= 31.20 && lat <= 31.60 && lon >= 34.20 && lon <= 34.60;
}

function pickCasualtyMax(bucket: RawCasualtyBucket | undefined, key: 'killed_max' | 'injured_max'): number | null {
  if (!bucket) return null;
  const v = bucket[key];
  if (v === '' || v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

export function decodeHtmlEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      const code = parseInt(body.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (body.startsWith('#')) {
      const code = parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[body] ?? match;
  });
}

// Strike-type slugs from data/raw/airwars/taxonomies.json. Map each real slug
// to one of the six IncidentCategory values. Anything genuinely ambiguous
// (e.g. unknown) falls through to 'other'.
const STRIKE_TYPE_TO_CATEGORY: Record<string, IncidentCategory> = {
  'airstrike': 'airstrike',
  'airstrike-and-or-artillery': 'airstrike',
  'drone-strike': 'airstrike',
  'artillery': 'shelling',
  'naval-bombardment': 'shelling',
  'ground-operation': 'ground_op',
  'counter-terrorism-action-ground': 'ground_op',
  'mine': 'other',
  'sea-drone': 'other',
  'unknown': 'other',
};

function mapCategory(strikeTypeIds: number[], tax: AirwarsTaxonomies): IncidentCategory {
  for (const id of strikeTypeIds) {
    const term = tax.strike_type[String(id)];
    if (!term) continue;
    const mapped = STRIKE_TYPE_TO_CATEGORY[term.slug];
    if (mapped) return mapped;
  }
  return 'other';
}

const RATING_SLUGS: Record<string, CredibilityRating> = {
  fair: 'fair',
  weak: 'weak',
  contested: 'contested',
  confirmed: 'confirmed',
};

function mapRating(statusIds: number[], tax: AirwarsTaxonomies): CredibilityRating | undefined {
  for (const id of statusIds) {
    const term = tax.civilian_harm_status[String(id)];
    if (!term) continue;
    const slug = term.slug.toLowerCase();
    if (RATING_SLUGS[slug]) return RATING_SLUGS[slug];
  }
  return undefined;
}

export function normalizeAirwarsRecord(raw: RawAirwarsRecord, tax: AirwarsTaxonomies): Incident | null {
  const date = parseAirwarsDate(raw.acf?.incident_date ?? '');
  if (!date) return null;

  const coord = pickPrimaryCoord(raw.acf?.geolocations ?? []);
  if (!coord) return null;
  if (!isInGazaBbox(coord.lat, coord.lon)) return null;

  // Raw refCode may have surrounding whitespace ("ISPT0097 ") — always trim.
  const rawRefCode = (raw.acf?.unique_reference_code ?? '').trim();
  const refCode = rawRefCode || String(raw.id);
  const rating = mapRating(raw.civilian_harm_status ?? [], tax);

  const source: SourceAttribution = {
    org: 'airwars',
    id: refCode,
    url: raw.link,
    ...(rating ? { rating } : {}),
  };

  return {
    // WP post id is numeric and guaranteed unique; unique_reference_code is
    // reused across distinct raw records in the snapshot, so it's only safe
    // for the human-facing source citation, not the Incident's primary id.
    id: `airwars:${raw.id}`,
    date,
    location: {
      lat: coord.lat,
      lon: coord.lon,
      name: raw.acf?.location_name || raw.acf?.region || undefined,
    },
    category: mapCategory(raw.strike_type ?? [], tax),
    casualties: {
      killed: pickCasualtyMax(raw.acf?.killed_injured_civilian_non_combatants, 'killed_max'),
      injured: pickCasualtyMax(raw.acf?.killed_injured_civilian_non_combatants, 'injured_max'),
      killed_children: pickCasualtyMax(raw.acf?.killed_injured_children, 'killed_max'),
      killed_women: pickCasualtyMax(raw.acf?.killed_injured_women, 'killed_max'),
    },
    description: decodeHtmlEntities(raw.title?.rendered ?? ''),
    sources: [source],
  };
}
