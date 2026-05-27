import { describe, it, expect } from 'vitest';
import { normalizeOsmFacility } from '../scripts/normalize-osm-facilities';
import type { Feature } from 'geojson';

const GAZA_HEALTH_FEATURE: Feature = {
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [34.2450104, 31.3095378] },
  properties: {
    id: 'node/505095722',
    name: 'Bader Pharmacy',
    name_ar: 'صيدلية بدر',
    amenity: 'pharmacy',
    healthcare: 'pharmacy',
    adm2_name: 'Rafah',
  },
};

const GAZA_EDUCATION_FEATURE: Feature = {
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [34.4500, 31.5000] },
  properties: {
    id: 'node/123456',
    name: 'Test School',
    name_ar: 'مدرسة اختبار',
    amenity: 'school',
    adm2_name: 'Gaza',
  },
};

const WEST_BANK_FEATURE: Feature = {
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [35.2000, 32.0000] },
  properties: { id: 'node/9', name: 'WB Hospital', amenity: 'hospital' },
};

const UNNAMED_FEATURE: Feature = {
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [34.45, 31.4] },
  properties: { id: 'node/10', name: null, amenity: 'pharmacy' },
};

const POLYGON_FEATURE: Feature = {
  type: 'Feature',
  geometry: { type: 'Polygon', coordinates: [[[34.45, 31.4], [34.46, 31.4], [34.46, 31.41], [34.45, 31.4]]] },
  properties: { id: 'way/100', name: 'Polygon School', amenity: 'school' },
};

const FALLBACK_HEALTHCARE_FEATURE: Feature = {
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [34.38, 31.41] },
  properties: { id: 'node/77', name: 'Healthcare Center', amenity: null, healthcare: 'clinic', adm2_name: 'Khan Younis' },
};

describe('normalizeOsmFacility', () => {
  it('produces a complete FacilityRecord from a Gaza health Point', () => {
    const r = normalizeOsmFacility(GAZA_HEALTH_FEATURE)!;
    expect(r.id).toBe('osm:node/505095722');
    expect(r.category).toBe('health');
    expect(r.subtype).toBe('pharmacy');
    expect(r.location.lat).toBeCloseTo(31.3095378);
    expect(r.location.lon).toBeCloseTo(34.2450104);
    expect(r.name).toBe('Bader Pharmacy');
    expect(r.name_ar).toBe('صيدلية بدر');
    expect(r.governorate).toBe('Rafah');
    expect(r.source.org).toBe('osm');
    expect(r.source.id).toBe('node/505095722');
    expect(r.source.url).toContain('openstreetmap.org/node/505095722');
  });

  it('produces a complete FacilityRecord from a Gaza education Point', () => {
    const r = normalizeOsmFacility(GAZA_EDUCATION_FEATURE)!;
    expect(r.category).toBe('education');
    expect(r.subtype).toBe('school');
    expect(r.name).toBe('Test School');
  });

  it('rejects West Bank features (outside Gaza bbox)', () => {
    expect(normalizeOsmFacility(WEST_BANK_FEATURE)).toBeNull();
  });

  it('rejects unnamed features', () => {
    expect(normalizeOsmFacility(UNNAMED_FEATURE)).toBeNull();
  });

  it('rejects non-Point geometries (polygons/lines)', () => {
    expect(normalizeOsmFacility(POLYGON_FEATURE)).toBeNull();
  });

  it('falls back to healthcare tag when amenity is missing (health category)', () => {
    const r = normalizeOsmFacility(FALLBACK_HEALTHCARE_FEATURE)!;
    expect(r.category).toBe('health');
    expect(r.subtype).toBe('clinic');
  });

  it('rejects amenity values that are neither health nor education', () => {
    const bad: Feature = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [34.45, 31.4] },
      properties: { id: 'node/11', name: 'Bus Stop', amenity: 'bus_station' },
    };
    expect(normalizeOsmFacility(bad)).toBeNull();
  });

  it('handles missing name_ar gracefully (returns record without it)', () => {
    const noAr: Feature = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [34.38, 31.41] },
      properties: { id: 'node/12', name: 'English Only', amenity: 'hospital' },
    };
    const r = normalizeOsmFacility(noAr)!;
    expect(r.name).toBe('English Only');
    expect(r.name_ar).toBeUndefined();
  });

  it('handles missing governorate gracefully', () => {
    const noGov: Feature = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [34.38, 31.41] },
      properties: { id: 'node/13', name: 'Mystery Clinic', amenity: 'clinic' },
    };
    const r = normalizeOsmFacility(noGov)!;
    expect(r.governorate).toBeUndefined();
  });
});
