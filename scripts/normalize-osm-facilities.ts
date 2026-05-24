import type { Feature } from 'geojson';
import type {
  FacilityRecord,
  FacilityCategory,
  SourceAttribution,
} from '../shared/types';

const HEALTH_AMENITIES = new Set([
  'hospital',
  'clinic',
  'pharmacy',
  'doctors',
  'dentist',
  'nursing_home',
]);

const HEALTH_HEALTHCARE = new Set([
  'hospital',
  'clinic',
  'pharmacy',
  'doctor',
  'dentist',
  'laboratory',
  'rehabilitation',
  'centre',
  'physiotherapist',
]);

const EDUCATION_AMENITIES = new Set([
  'school',
  'kindergarten',
  'college',
  'university',
]);

function isInGazaBbox(lat: number, lon: number): boolean {
  return lat >= 31.20 && lat <= 31.60 && lon >= 34.20 && lon <= 34.60;
}

function osmIdToUrl(osmId: string): string {
  // OSM ids are like 'node/505095722' or 'way/12345'. The OSM browse URL pattern is
  // https://www.openstreetmap.org/<type>/<id>
  return `https://www.openstreetmap.org/${osmId}`;
}

function classify(props: Record<string, unknown>): { category: FacilityCategory; subtype: string } | null {
  const amenity = typeof props.amenity === 'string' ? props.amenity : '';
  const healthcare = typeof props.healthcare === 'string' ? props.healthcare : '';

  if (amenity && EDUCATION_AMENITIES.has(amenity)) {
    return { category: 'education', subtype: amenity };
  }
  if (amenity && HEALTH_AMENITIES.has(amenity)) {
    return { category: 'health', subtype: amenity };
  }
  if (healthcare && HEALTH_HEALTHCARE.has(healthcare)) {
    return { category: 'health', subtype: healthcare };
  }
  return null;
}

export function normalizeOsmFacility(feat: Feature): FacilityRecord | null {
  if (feat.geometry?.type !== 'Point') return null;

  const coords = feat.geometry.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const [lon, lat] = coords as [number, number];
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (!isInGazaBbox(lat, lon)) return null;

  const props = (feat.properties ?? {}) as Record<string, unknown>;

  const rawId = typeof props.id === 'string' ? props.id : '';
  if (rawId.length === 0) return null;

  const name = typeof props.name === 'string' ? props.name.trim() : '';
  if (name.length === 0) return null;

  const classification = classify(props);
  if (classification === null) return null;

  const name_ar = typeof props.name_ar === 'string' && props.name_ar.trim().length > 0
    ? props.name_ar.trim()
    : undefined;
  const governorate = typeof props.adm2_name === 'string' && props.adm2_name.trim().length > 0
    ? props.adm2_name.trim()
    : undefined;

  const source: SourceAttribution = {
    org: 'osm',
    id: rawId,
    url: osmIdToUrl(rawId),
  };

  return {
    id: `osm:${rawId}`,
    category: classification.category,
    subtype: classification.subtype,
    location: { lat, lon },
    name,
    name_ar,
    governorate,
    source,
  };
}
