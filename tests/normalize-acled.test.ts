import { describe, it, expect } from 'vitest';
import { normalizeAcledRecord, mapAcledCategory } from '../scripts/normalize-acled';

const SAMPLE_RECORD = {
  event_id_cnty: 'PSE12345',
  event_date: '2023-10-15',
  year: '2023',
  disorder_type: 'Political violence',
  event_type: 'Explosions/Remote violence',
  sub_event_type: 'Air/drone strike',
  actor1: 'Military Forces of Israel (2022-)',
  actor2: 'Civilians (Palestine)',
  country: 'Palestine',
  admin1: 'Gaza Strip',
  admin2: 'Gaza',
  location: 'Gaza City',
  latitude: '31.5018',
  longitude: '34.4660',
  notes: 'On 15 October 2023, Israeli forces conducted an airstrike on a residential building in Gaza City, killing at least 8 civilians including 3 children.',
  fatalities: '8',
  source: 'Al Jazeera; Reuters',
  source_scale: 'International',
  timestamp: '1697500000',
};

describe('mapAcledCategory', () => {
  it('maps Air/drone strike to airstrike', () => {
    expect(mapAcledCategory('Air/drone strike')).toBe('airstrike');
  });

  it('maps Shelling/artillery/missile attack to shelling', () => {
    expect(mapAcledCategory('Shelling/artillery/missile attack')).toBe('shelling');
  });

  it('maps Armed clash to ground_op', () => {
    expect(mapAcledCategory('Armed clash')).toBe('ground_op');
  });

  it('maps Attack to other (too generic)', () => {
    expect(mapAcledCategory('Attack')).toBe('other');
  });

  it('maps unknown sub_event_type to other', () => {
    expect(mapAcledCategory('Some other event')).toBe('other');
  });
});

describe('normalizeAcledRecord', () => {
  it('produces a complete Incident from a well-formed record', () => {
    const r = normalizeAcledRecord(SAMPLE_RECORD)!;
    expect(r.id).toBe('acled:PSE12345');
    expect(r.date).toBe('2023-10-15');
    expect(r.location.lat).toBeCloseTo(31.5018);
    expect(r.location.lon).toBeCloseTo(34.4660);
    expect(r.location.name).toBe('Gaza City');
    expect(r.category).toBe('airstrike');
    expect(r.casualties.killed).toBe(8);
    expect(r.casualties.injured).toBeNull();
    expect(r.casualties.killed_children).toBeNull();
    expect(r.description).toHaveLength(1);
    expect(r.description[0]).toContain('Israeli forces conducted an airstrike');
    expect(r.sources).toHaveLength(1);
    expect(r.sources[0].org).toBe('acled');
    expect(r.sources[0].id).toBe('PSE12345');
    expect(r.sources[0].url).toContain('acleddata.com');
  });

  it('returns null when coordinates are missing', () => {
    const noLat = { ...SAMPLE_RECORD, latitude: '' };
    expect(normalizeAcledRecord(noLat)).toBeNull();
  });

  it('returns null when coordinates are outside Gaza bbox', () => {
    const outside = { ...SAMPLE_RECORD, latitude: '34.49', longitude: '31.50' };
    expect(normalizeAcledRecord(outside)).toBeNull();
  });

  it('returns null when date is malformed', () => {
    const badDate = { ...SAMPLE_RECORD, event_date: 'not a date' };
    expect(normalizeAcledRecord(badDate)).toBeNull();
  });

  it('parses string fatalities to number', () => {
    const r = normalizeAcledRecord({ ...SAMPLE_RECORD, fatalities: '12' })!;
    expect(r.casualties.killed).toBe(12);
  });

  it('handles fatalities of "0" as 0 (not null)', () => {
    const r = normalizeAcledRecord({ ...SAMPLE_RECORD, fatalities: '0' })!;
    expect(r.casualties.killed).toBe(0);
  });
});
