import { describe, it, expect } from 'vitest';
import { normalizeAirwarsRecord, parseAirwarsDate, pickPrimaryCoord } from '../scripts/normalize-airwars';

const TAXONOMIES = {
  civilian_harm_status: {
    '837': { name: 'Fair', slug: 'fair' },
    '838': { name: 'Weak', slug: 'weak' },
    '839': { name: 'Contested', slug: 'contested' },
    '840': { name: 'Confirmed', slug: 'confirmed' },
  },
  strike_type: {
    '432': { name: 'Airstrike and/or Artillery', slug: 'airstrike-artillery' },
    '433': { name: 'Ground operation', slug: 'ground-operation' },
  },
  casualty: {},
};

const SAMPLE_RECORD = {
  id: 93656,
  link: 'https://airwars.org/civilian-casualties/ispt0097-october-10-2023/',
  title: { rendered: 'ISPT0097 – October 10, 2023' },
  civilian_harm_status: [837],
  strike_type: [432],
  acf: {
    unique_reference_code: 'ISPT0097',
    incident_date: '20231010',
    location_name: "Dr. Nasr Al-Tatar's home",
    region: 'Gaza Strip',
    governorate: '',
    latitude: '',
    longitude: '',
    geolocations: [
      {
        latitude: 31.344261,
        longitude: 34.291017,
        geolocation_accuracy: 'exact_location',
        primary_coordinate: true,
      },
    ],
    killed_injured_civilian_non_combatants: { killed_min: 2, killed_max: 2, injured_min: '', injured_max: '' },
    killed_injured_children: { killed_min: 0, killed_max: 1, injured_min: '', injured_max: '' },
    killed_injured_women: { killed_min: 1, killed_max: 1, injured_min: '', injured_max: '' },
    killed_injured_men: { killed_min: 0, killed_max: 1, injured_min: '', injured_max: '' },
  },
};

describe('parseAirwarsDate', () => {
  it('converts YYYYMMDD to ISO YYYY-MM-DD', () => {
    expect(parseAirwarsDate('20231010')).toBe('2023-10-10');
    expect(parseAirwarsDate('20240301')).toBe('2024-03-01');
  });

  it('returns null for malformed input', () => {
    expect(parseAirwarsDate('')).toBeNull();
    expect(parseAirwarsDate('2023-10-10')).toBeNull();
    expect(parseAirwarsDate('not a date')).toBeNull();
  });
});

describe('pickPrimaryCoord', () => {
  it('picks the entry with primary_coordinate=true', () => {
    const geos = [
      { latitude: 1, longitude: 1, primary_coordinate: false },
      { latitude: 2, longitude: 2, primary_coordinate: true },
      { latitude: 3, longitude: 3, primary_coordinate: false },
    ];
    expect(pickPrimaryCoord(geos)).toEqual({ lat: 2, lon: 2 });
  });

  it('falls back to first entry if none are primary', () => {
    const geos = [
      { latitude: 5, longitude: 6, primary_coordinate: false },
      { latitude: 7, longitude: 8, primary_coordinate: false },
    ];
    expect(pickPrimaryCoord(geos)).toEqual({ lat: 5, lon: 6 });
  });

  it('returns null for empty array', () => {
    expect(pickPrimaryCoord([])).toBeNull();
  });
});

describe('normalizeAirwarsRecord', () => {
  it('produces a complete Incident from a well-formed record', () => {
    const result = normalizeAirwarsRecord(SAMPLE_RECORD, TAXONOMIES);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('airwars:ISPT0097');
    expect(result!.date).toBe('2023-10-10');
    expect(result!.location.lat).toBeCloseTo(31.344261);
    expect(result!.location.lon).toBeCloseTo(34.291017);
    expect(result!.location.name).toBe("Dr. Nasr Al-Tatar's home");
    expect(result!.category).toBe('airstrike');
    expect(result!.casualties.killed).toBe(2);
    expect(result!.casualties.killed_children).toBe(1);
    expect(result!.casualties.killed_women).toBe(1);
    expect(result!.sources).toHaveLength(1);
    expect(result!.sources[0].org).toBe('airwars');
    expect(result!.sources[0].id).toBe('ISPT0097');
    expect(result!.sources[0].rating).toBe('fair');
    expect(result!.sources[0].url).toBe('https://airwars.org/civilian-casualties/ispt0097-october-10-2023/');
  });

  it('returns null when coordinates are missing (record is unplotted)', () => {
    const noGeo = { ...SAMPLE_RECORD, acf: { ...SAMPLE_RECORD.acf, geolocations: [] } };
    expect(normalizeAirwarsRecord(noGeo, TAXONOMIES)).toBeNull();
  });

  it('returns null when date is malformed', () => {
    const badDate = { ...SAMPLE_RECORD, acf: { ...SAMPLE_RECORD.acf, incident_date: '' } };
    expect(normalizeAirwarsRecord(badDate, TAXONOMIES)).toBeNull();
  });

  it('uses casualty max when min < max (conservative count)', () => {
    const range = {
      ...SAMPLE_RECORD,
      acf: {
        ...SAMPLE_RECORD.acf,
        killed_injured_civilian_non_combatants: { killed_min: 2, killed_max: 5, injured_min: 1, injured_max: 8 },
      },
    };
    const r = normalizeAirwarsRecord(range, TAXONOMIES)!;
    expect(r.casualties.killed).toBe(5);
    expect(r.casualties.injured).toBe(8);
  });

  it('maps unknown strike_type to "other"', () => {
    const unknown = { ...SAMPLE_RECORD, strike_type: [99999] };
    const r = normalizeAirwarsRecord(unknown, TAXONOMIES)!;
    expect(r.category).toBe('other');
  });

  it('maps ground-operation slug to ground_op category', () => {
    const ground = { ...SAMPLE_RECORD, strike_type: [433] };
    const r = normalizeAirwarsRecord(ground, TAXONOMIES)!;
    expect(r.category).toBe('ground_op');
  });
});
