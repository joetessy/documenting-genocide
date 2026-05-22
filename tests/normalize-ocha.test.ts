import { describe, it, expect } from 'vitest';
import { normalizeOchaFeature, mapDamageClass, parseSensorDate } from '../scripts/normalize-ocha';
import { extractDamageTimeline } from '../scripts/fetch-ocha';

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

describe('extractDamageTimeline', () => {
  it('returns first damage date and latest damage code', () => {
    // Building: pass 1 was undamaged (code 6), pass 2 became moderate (3), pass 3 became destroyed (1).
    const props = {
      SensorDate: 1683676800000,     // 2023-05-10 undamaged
      Main_Damage_Site_Class: 6,
      SensorDate_2: 1697500800000,   // 2023-10-17 — first damage
      Main_Damage_Site_Class_2: 3,
      SensorDate_3: 1728604800000,   // 2024-10-11 — final state
      Main_Damage_Site_Class_3: 1,
    };
    const t = extractDamageTimeline(props as never)!;
    expect(t.first).toBe('2023-10-17');
    expect(t.latest).toBe(1);
  });

  it('returns null if the building was never damaged', () => {
    const props = {
      SensorDate: 1683676800000,
      Main_Damage_Site_Class: 6,
      SensorDate_2: 1697500800000,
      Main_Damage_Site_Class_2: 6,
    };
    expect(extractDamageTimeline(props as never)).toBeNull();
  });

  it('orders passes by date, not by index', () => {
    // Passes are stored out of chronological order; should pick by earliest date.
    const props = {
      SensorDate: 1728604800000,        // 2024-10-11 — listed first but later in time
      Main_Damage_Site_Class: 1,
      SensorDate_2: 1697500800000,      // 2023-10-17 — earlier
      Main_Damage_Site_Class_2: 3,
    };
    const t = extractDamageTimeline(props as never)!;
    expect(t.first).toBe('2023-10-17');
    expect(t.latest).toBe(1);
  });
});

describe('normalizeOchaFeature (slim format)', () => {
  const SAMPLE_FEATURE: GeoJSON.Feature = {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [34.4500, 31.5200] },
    properties: {
      OBJECTID: 12345,
      first_damage_date: '2023-10-17',
      latest_damage_class: 1,
      Grouped_Damage_Classes: 1,
    },
  };

  it('produces a DamageRecord from a slim feature', () => {
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
      properties: { ...SAMPLE_FEATURE.properties, latest_damage_class: 6 },
    };
    expect(normalizeOchaFeature(noDamage)).toBeNull();
  });

  it('rejects features missing first_damage_date', () => {
    const noDate = {
      ...SAMPLE_FEATURE,
      properties: { ...SAMPLE_FEATURE.properties, first_damage_date: undefined },
    };
    expect(normalizeOchaFeature(noDate)).toBeNull();
  });

  it('rejects out-of-Gaza-bbox features', () => {
    const oob = {
      ...SAMPLE_FEATURE,
      geometry: { type: 'Point' as const, coordinates: [100.0, 31.5] },
    };
    expect(normalizeOchaFeature(oob)).toBeNull();
  });
});
