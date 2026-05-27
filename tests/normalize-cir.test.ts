import { describe, it, expect } from 'vitest';
import { normalizeCirFeature, mapCirCategory } from '../scripts/normalize-cir';
import type { Feature } from 'geojson';

const GAZA_AIRSTRIKE_SAMPLE: Feature = {
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [34.4955, 31.5425] },
  properties: {
    OBJECTID: 1,
    Location: 'Jabalia',
    Incident_Date: '2023-11-18',
    Sub_Category: 'Damage to education facilities',
    Main_Category_: 'Damage',
    Description: 'Minor structural damage to Al-Fakhoura School with at least 19 casualties visible, including seven minors.',
    Link_1: 'https://twitter.com/qudsn/status/1725847147126325678',
    Link_2: 'None',
    Link_3: 'None',
    Link_4: 'None',
    Link_5: 'None',
    Link_6: 'None',
    Link_7: 'None',
    Casualties_: 'Yes',
    Minor_Casualties: 'Yes',
    Location_Zone: 'OPT - Gaza Strip',
    Incident_Number: 'IPIN0001',
    Violence: '5 – Graphic',
  },
};

const WEST_BANK_SAMPLE: Feature = {
  ...GAZA_AIRSTRIKE_SAMPLE,
  geometry: { type: 'Point', coordinates: [35.20, 32.00] },
  properties: { ...GAZA_AIRSTRIKE_SAMPLE.properties, Location: 'Jenin', Location_Zone: 'OPT - West Bank' } as never,
};

const MULTI_LINK_SAMPLE: Feature = {
  ...GAZA_AIRSTRIKE_SAMPLE,
  properties: {
    ...GAZA_AIRSTRIKE_SAMPLE.properties,
    Link_1: 'https://a.example/1',
    Link_2: 'https://b.example/2',
    Link_3: 'https://c.example/3',
    Link_4: 'None',
  } as never,
};

describe('mapCirCategory', () => {
  it('maps airstrike-related sub-categories to airstrike', () => {
    expect(mapCirCategory({ sub: 'Airstrike on residential building', main: 'Casualties' })).toBe('airstrike');
    expect(mapCirCategory({ sub: 'Drone strike on vehicle', main: 'Casualties' })).toBe('airstrike');
  });
  it('maps shelling-related sub-categories to shelling', () => {
    expect(mapCirCategory({ sub: 'Artillery shelling of neighborhood', main: 'Damage' })).toBe('shelling');
    expect(mapCirCategory({ sub: 'Mortar fire on market', main: 'Damage' })).toBe('shelling');
  });
  it('maps ground-related to ground_op', () => {
    expect(mapCirCategory({ sub: 'Ground raid on hospital', main: 'Damage' })).toBe('ground_op');
  });
  it('maps aid-related to attack_on_aid', () => {
    expect(mapCirCategory({ sub: 'Strike on aid convoy', main: 'Casualties' })).toBe('attack_on_aid');
  });
  it('falls back to other for unmatched categories', () => {
    expect(mapCirCategory({ sub: 'Damage to education facilities', main: 'Damage' })).toBe('other');
    expect(mapCirCategory({ sub: '', main: '' })).toBe('other');
  });
});

describe('normalizeCirFeature', () => {
  it('produces a complete Incident from a well-formed Gaza feature', () => {
    const r = normalizeCirFeature(GAZA_AIRSTRIKE_SAMPLE)!;
    expect(r.id).toBe('cir:IPIN0001');
    expect(r.date).toBe('2023-11-18');
    expect(r.location.lat).toBeCloseTo(31.5425);
    expect(r.location.lon).toBeCloseTo(34.4955);
    expect(r.location.name).toBe('Jabalia');
    expect(r.casualties.killed).toBeNull();
    expect(r.casualties.injured).toBeNull();
    expect(r.description).toHaveLength(1);
    expect(r.description[0]).toContain('Al-Fakhoura');
    expect(r.sources).toHaveLength(1);
    expect(r.sources[0].org).toBe('cir');
    expect(r.sources[0].id).toBe('IPIN0001');
    expect(r.sources[0].url).toBe('https://twitter.com/qudsn/status/1725847147126325678');
  });

  it('aggregates multiple non-None links into multiple SourceAttributions', () => {
    const r = normalizeCirFeature(MULTI_LINK_SAMPLE)!;
    expect(r.sources).toHaveLength(3);
    expect(r.sources.map((s) => s.url)).toEqual([
      'https://a.example/1',
      'https://b.example/2',
      'https://c.example/3',
    ]);
  });

  it('rejects features outside the Gaza bbox', () => {
    expect(normalizeCirFeature(WEST_BANK_SAMPLE)).toBeNull();
  });

  it('rejects features missing Incident_Date', () => {
    const noDate = { ...GAZA_AIRSTRIKE_SAMPLE, properties: { ...GAZA_AIRSTRIKE_SAMPLE.properties, Incident_Date: null } as never };
    expect(normalizeCirFeature(noDate)).toBeNull();
  });

  it('rejects features with non-Point geometry', () => {
    const polygon = { ...GAZA_AIRSTRIKE_SAMPLE, geometry: { type: 'Polygon', coordinates: [] } as never };
    expect(normalizeCirFeature(polygon)).toBeNull();
  });

  it('rejects features with Incident_Date before 2023-10-07', () => {
    const old = { ...GAZA_AIRSTRIKE_SAMPLE, properties: { ...GAZA_AIRSTRIKE_SAMPLE.properties, Incident_Date: '2023-09-01' } as never };
    expect(normalizeCirFeature(old)).toBeNull();
  });

  it('handles missing Incident_Number by falling back to OBJECTID', () => {
    const noNum = { ...GAZA_AIRSTRIKE_SAMPLE, properties: { ...GAZA_AIRSTRIKE_SAMPLE.properties, Incident_Number: null } as never };
    const r = normalizeCirFeature(noNum)!;
    expect(r.id).toBe('cir:1');
    expect(r.sources[0].id).toBe('1');
  });
});
