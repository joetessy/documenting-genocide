import { describe, it, expect } from 'vitest';
import { normalizeOchaFeature, mapDamageClass, parseSensorDate } from '../scripts/normalize-ocha';

describe('mapDamageClass', () => {
  it('maps 1 to destroyed', () => expect(mapDamageClass(1)).toBe('destroyed'));
  it('maps 2 to severe', () => expect(mapDamageClass(2)).toBe('severe'));
  it('maps 3 to moderate', () => expect(mapDamageClass(3)).toBe('moderate'));
  it('maps 4 to possibly_damaged', () => expect(mapDamageClass(4)).toBe('possibly_damaged'));
  it('returns null for other codes', () => {
    expect(mapDamageClass(5)).toBeNull();
    expect(mapDamageClass(6)).toBeNull();
    expect(mapDamageClass(null)).toBeNull();
  });
});

describe('parseSensorDate', () => {
  it('parses epoch milliseconds', () => {
    expect(parseSensorDate(1697500800000)).toBe('2023-10-17');
  });
  it('parses ISO strings', () => {
    expect(parseSensorDate('2025-10-11T00:00:00.000Z')).toBe('2025-10-11');
  });
  it('returns null on bad input', () => {
    expect(parseSensorDate(null)).toBeNull();
    expect(parseSensorDate('not a date')).toBeNull();
  });
});

describe('normalizeOchaFeature', () => {
  const SAMPLE_FEATURE: GeoJSON.Feature = {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [34.4500, 31.5200] },
    properties: {
      OBJECTID: 12345,
      Main_Damage_Site_Class_14: 1,
      SensorDate_14: 1697500800000,
      Grouped_Damage_Classes: 1,
      Governorate: 'Gaza',
    },
  };

  it('produces a DamageRecord from a destroyed building feature', () => {
    const r = normalizeOchaFeature(SAMPLE_FEATURE)!;
    expect(r.id).toBe('unosat-12345');
    expect(r.location.lat).toBeCloseTo(31.52);
    expect(r.location.lon).toBeCloseTo(34.45);
    expect(r.status).toBe('destroyed');
    expect(r.assessment_date).toBe('2023-10-17');
    expect(r.source.org).toBe('ocha');
    expect(r.source.url).toContain('humdata.org');
  });

  it('rejects non-building features (Grouped_Damage_Classes != 1)', () => {
    const road = {
      ...SAMPLE_FEATURE,
      properties: { ...SAMPLE_FEATURE.properties, Grouped_Damage_Classes: 3 },
    };
    expect(normalizeOchaFeature(road)).toBeNull();
  });

  it('rejects unmappable damage codes (5, 6, etc.)', () => {
    const noDamage = {
      ...SAMPLE_FEATURE,
      properties: { ...SAMPLE_FEATURE.properties, Main_Damage_Site_Class_14: 6 },
    };
    expect(normalizeOchaFeature(noDamage)).toBeNull();
  });

  it('rejects out-of-Gaza-bbox features', () => {
    const oob = {
      ...SAMPLE_FEATURE,
      geometry: { type: 'Point' as const, coordinates: [100.0, 31.5] },
    };
    expect(normalizeOchaFeature(oob)).toBeNull();
  });
});
