import { describe, it, expect } from 'vitest';
import {
  normalizeGeoconfirmedRecord,
  mapGeoconfirmedCategory,
} from '../scripts/normalize-geoconfirmed';
import type { GeoconfirmedPlacemark } from '../scripts/fetch-geoconfirmed';

const GAZA_SAMPLE: GeoconfirmedPlacemark = {
  id: 'abc123def456',
  name: '22 NOV 2023',
  description:
    'IDF airstrike on a residential building in Khan Younis.\n\nSource(s):\nhttps://twitter.com/example/status/1\nhttps://twitter.com/example/status/2',
  date: '2023-11-22',
  lat: 31.341917,
  lon: 34.285978,
  sources: [
    'https://twitter.com/example/status/1',
    'https://twitter.com/example/status/2',
  ],
};

describe('mapGeoconfirmedCategory', () => {
  it('maps airstrike keywords to airstrike', () => {
    expect(
      mapGeoconfirmedCategory({
        name: '',
        description: 'IDF airstrike on residential building',
        faction: '',
      }),
    ).toBe('airstrike');
    expect(
      mapGeoconfirmedCategory({
        name: '',
        description: 'Drone strike on vehicle in Rafah',
        faction: '',
      }),
    ).toBe('airstrike');
    expect(
      mapGeoconfirmedCategory({
        name: '',
        description: 'Aerial bombardment of refugee camp',
        faction: '',
      }),
    ).toBe('airstrike');
  });

  it('maps shelling keywords to shelling', () => {
    expect(
      mapGeoconfirmedCategory({
        name: '',
        description: 'Artillery shelling of Khan Younis',
        faction: '',
      }),
    ).toBe('shelling');
    expect(
      mapGeoconfirmedCategory({
        name: '',
        description: 'Mortar fire hits hospital',
        faction: '',
      }),
    ).toBe('shelling');
    expect(
      mapGeoconfirmedCategory({
        name: '',
        description: 'Missile launched at Tel Aviv',
        faction: '',
      }),
    ).toBe('shelling');
  });

  it('maps ground operation keywords to ground_op', () => {
    expect(
      mapGeoconfirmedCategory({
        name: '',
        description: 'IDF ground incursion into Jabalia',
        faction: '',
      }),
    ).toBe('ground_op');
    expect(
      mapGeoconfirmedCategory({
        name: '',
        description: 'Tank column advancing on Gaza City',
        faction: '',
      }),
    ).toBe('ground_op');
  });

  it('maps aid keywords to attack_on_aid', () => {
    expect(
      mapGeoconfirmedCategory({
        name: '',
        description: 'Strike on humanitarian aid convoy at Rashid Street',
        faction: '',
      }),
    ).toBe('attack_on_aid');
    expect(
      mapGeoconfirmedCategory({
        name: '',
        description: 'Food distribution site shelled',
        faction: '',
      }),
    ).toBe('attack_on_aid');
  });

  it('maps detention keywords to detention', () => {
    expect(
      mapGeoconfirmedCategory({
        name: '',
        description: 'Palestinians detained by IDF forces',
        faction: '',
      }),
    ).toBe('detention');
    expect(
      mapGeoconfirmedCategory({
        name: '',
        description: 'Israeli hostage being taken into Gaza',
        faction: '',
      }),
    ).toBe('detention');
  });

  it('falls back to other for unrecognized', () => {
    expect(
      mapGeoconfirmedCategory({
        name: '',
        description: 'Civilians evacuating an area',
        faction: '',
      }),
    ).toBe('other');
    expect(
      mapGeoconfirmedCategory({ name: '', description: '', faction: '' }),
    ).toBe('other');
  });
});

describe('normalizeGeoconfirmedRecord', () => {
  it('produces a complete Incident from a well-formed Gaza placemark', () => {
    const r = normalizeGeoconfirmedRecord(GAZA_SAMPLE)!;
    expect(r).not.toBeNull();
    expect(r.id).toBe('geoconfirmed:abc123def456');
    expect(r.date).toBe('2023-11-22');
    expect(r.location.lat).toBeCloseTo(31.341917);
    expect(r.location.lon).toBeCloseTo(34.285978);
    expect(r.location.name).toBe('22 NOV 2023');
    expect(r.category).toBe('airstrike');
    expect(r.casualties.killed).toBeNull();
    expect(r.casualties.injured).toBeNull();
    expect(r.casualties.killed_children).toBeNull();
    expect(r.casualties.killed_women).toBeNull();
    expect(r.description).toHaveLength(1);
    expect(r.description[0]).toContain('Khan Younis');
    expect(r.sources).toHaveLength(2);
    expect(r.sources[0].org).toBe('geoconfirmed');
    expect(r.sources[0].id).toBe('abc123def456');
    expect(r.sources[0].url).toBe('https://twitter.com/example/status/1');
  });

  it('builds one SourceAttribution per URL in sources', () => {
    const multi: GeoconfirmedPlacemark = {
      ...GAZA_SAMPLE,
      sources: [
        'https://a.example/1',
        'https://b.example/2',
        'https://c.example/3',
      ],
    };
    const r = normalizeGeoconfirmedRecord(multi)!;
    expect(r.sources).toHaveLength(3);
    expect(r.sources.map((s) => s.url)).toEqual([
      'https://a.example/1',
      'https://b.example/2',
      'https://c.example/3',
    ]);
    for (const s of r.sources) {
      expect(s.org).toBe('geoconfirmed');
      expect(s.id).toBe(multi.id);
    }
  });

  it('falls back to the Geoconfirmed homepage URL when sources is empty', () => {
    const noSrc: GeoconfirmedPlacemark = { ...GAZA_SAMPLE, sources: [] };
    const r = normalizeGeoconfirmedRecord(noSrc)!;
    expect(r.sources).toHaveLength(1);
    expect(r.sources[0].org).toBe('geoconfirmed');
    expect(r.sources[0].id).toBe(noSrc.id);
    expect(r.sources[0].url).toBe('https://geoconfirmed.org');
  });

  it('rejects placemarks with West Bank coordinates', () => {
    const westBank: GeoconfirmedPlacemark = {
      ...GAZA_SAMPLE,
      lat: 32.0,
      lon: 35.2,
    };
    expect(normalizeGeoconfirmedRecord(westBank)).toBeNull();
  });

  it('rejects placemarks dated before the conflict start', () => {
    const old: GeoconfirmedPlacemark = {
      ...GAZA_SAMPLE,
      date: '2022-01-01',
    };
    expect(normalizeGeoconfirmedRecord(old)).toBeNull();
  });

  it('rejects placemarks with NaN or non-finite coordinates', () => {
    const nanLat: GeoconfirmedPlacemark = { ...GAZA_SAMPLE, lat: Number.NaN };
    const nanLon: GeoconfirmedPlacemark = { ...GAZA_SAMPLE, lon: Number.NaN };
    const infLat: GeoconfirmedPlacemark = {
      ...GAZA_SAMPLE,
      lat: Number.POSITIVE_INFINITY,
    };
    expect(normalizeGeoconfirmedRecord(nanLat)).toBeNull();
    expect(normalizeGeoconfirmedRecord(nanLon)).toBeNull();
    expect(normalizeGeoconfirmedRecord(infLat)).toBeNull();
  });

  it('rejects placemarks with empty id', () => {
    const noId: GeoconfirmedPlacemark = { ...GAZA_SAMPLE, id: '' };
    expect(normalizeGeoconfirmedRecord(noId)).toBeNull();
  });

  it('rejects placemarks with non-ISO dates', () => {
    const bad: GeoconfirmedPlacemark = { ...GAZA_SAMPLE, date: '22 NOV 2023' };
    expect(normalizeGeoconfirmedRecord(bad)).toBeNull();
    const empty: GeoconfirmedPlacemark = { ...GAZA_SAMPLE, date: '' };
    expect(normalizeGeoconfirmedRecord(empty)).toBeNull();
  });
});
