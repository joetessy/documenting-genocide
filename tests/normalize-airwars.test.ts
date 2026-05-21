import { describe, it, expect } from 'vitest';
import {
  normalizeAirwarsRecord,
  parseAirwarsDate,
  pickPrimaryCoord,
  decodeHtmlEntities,
  isInGazaBbox,
} from '../scripts/normalize-airwars';

const TAXONOMIES = {
  civilian_harm_status: {
    '836': { name: 'Confirmed', slug: 'confirmed' },
    '837': { name: 'Fair', slug: 'fair' },
    '838': { name: 'Weak', slug: 'weak' },
    '839': { name: 'Contested', slug: 'contested' },
    '840': { name: 'Discounted', slug: 'discounted' },
    '1057': { name: 'Unknown', slug: 'unknown' },
  },
  strike_type: {
    '431': { name: 'Airstrike', slug: 'airstrike' },
    '432': { name: 'Airstrike and/or Artillery', slug: 'airstrike-and-or-artillery' },
    '433': { name: 'Artillery', slug: 'artillery' },
    '434': { name: 'Drone Strike', slug: 'drone-strike' },
    '439': { name: 'Counter-Terrorism Action (Ground)', slug: 'counter-terrorism-action-ground' },
    '643': { name: 'Naval bombardment', slug: 'naval-bombardment' },
    '752': { name: 'Ground operation', slug: 'ground-operation' },
    '1025': { name: 'Unknown', slug: 'unknown' },
    '1351': { name: 'Mine', slug: 'mine' },
    '1352': { name: 'Sea Drone', slug: 'sea-drone' },
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

  it('returns null for out-of-range latitude', () => {
    expect(pickPrimaryCoord([{ latitude: 91, longitude: 0 }])).toBeNull();
    expect(pickPrimaryCoord([{ latitude: -91, longitude: 0 }])).toBeNull();
  });

  it('returns null for out-of-range longitude', () => {
    expect(pickPrimaryCoord([{ latitude: 31, longitude: 181 }])).toBeNull();
    expect(pickPrimaryCoord([{ latitude: 31, longitude: -181 }])).toBeNull();
  });
});

describe('isInGazaBbox', () => {
  it('accepts points inside Gaza', () => {
    expect(isInGazaBbox(31.5, 34.4)).toBe(true);     // Gaza City area
    expect(isInGazaBbox(31.21, 34.21)).toBe(true);   // SW corner
    expect(isInGazaBbox(31.59, 34.59)).toBe(true);   // NE corner
  });

  it('rejects points outside Gaza', () => {
    expect(isInGazaBbox(34.49, 31.50)).toBe(false);  // the swapped-coord case
    expect(isInGazaBbox(31.7, 34.4)).toBe(false);    // north of Gaza
    expect(isInGazaBbox(31.5, 34.7)).toBe(false);    // east of Gaza
    expect(isInGazaBbox(0, 0)).toBe(false);
  });
});

describe('decodeHtmlEntities', () => {
  it('decodes named entities', () => {
    expect(decodeHtmlEntities('AT&amp;T')).toBe('AT&T');
    expect(decodeHtmlEntities('1 &lt; 2 &gt; 0')).toBe('1 < 2 > 0');
    expect(decodeHtmlEntities('&quot;hi&quot;')).toBe('"hi"');
    expect(decodeHtmlEntities('it&apos;s')).toBe("it's");
  });

  it('decodes numeric decimal entities', () => {
    expect(decodeHtmlEntities('a &#8211; b')).toBe('a – b');
    expect(decodeHtmlEntities('&#39;')).toBe("'");
  });

  it('decodes numeric hex entities', () => {
    expect(decodeHtmlEntities('a &#x2013; b')).toBe('a – b');
  });

  it('leaves unknown named entities alone', () => {
    expect(decodeHtmlEntities('&bogusentity;')).toBe('&bogusentity;');
  });
});

describe('normalizeAirwarsRecord', () => {
  it('produces a complete Incident from a well-formed record', () => {
    const result = normalizeAirwarsRecord(SAMPLE_RECORD, TAXONOMIES);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('airwars:93656');
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
    expect(result!.description).toEqual(['ISPT0097 – October 10, 2023']);
  });

  it('trims whitespace in unique_reference_code for sources[0].id', () => {
    const padded = {
      ...SAMPLE_RECORD,
      acf: { ...SAMPLE_RECORD.acf, unique_reference_code: '  ISPT0097 ' },
    };
    const r = normalizeAirwarsRecord(padded, TAXONOMIES)!;
    expect(r.sources[0].id).toBe('ISPT0097');
  });

  it('decodes HTML entities in title.rendered into the description', () => {
    const entity = {
      ...SAMPLE_RECORD,
      title: { rendered: 'ISPT0097 &#8211; October 10, 2023' },
    };
    const r = normalizeAirwarsRecord(entity, TAXONOMIES)!;
    expect(r.description).toEqual(['ISPT0097 – October 10, 2023']);
  });

  it('returns null when coordinates are missing (record is unplotted)', () => {
    const noGeo = { ...SAMPLE_RECORD, acf: { ...SAMPLE_RECORD.acf, geolocations: [] } };
    expect(normalizeAirwarsRecord(noGeo, TAXONOMIES)).toBeNull();
  });

  it('returns null when coordinates are outside Gaza bbox', () => {
    const outOfBbox = {
      ...SAMPLE_RECORD,
      acf: {
        ...SAMPLE_RECORD.acf,
        geolocations: [{ latitude: 34.49, longitude: 31.50, primary_coordinate: true }],
      },
    };
    expect(normalizeAirwarsRecord(outOfBbox, TAXONOMIES)).toBeNull();
  });

  it('returns null when coordinates are out of world range', () => {
    const badCoord = {
      ...SAMPLE_RECORD,
      acf: {
        ...SAMPLE_RECORD.acf,
        geolocations: [{ latitude: 91, longitude: 0, primary_coordinate: true }],
      },
    };
    expect(normalizeAirwarsRecord(badCoord, TAXONOMIES)).toBeNull();
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

  it('maps unknown strike_type id to "other"', () => {
    const unknown = { ...SAMPLE_RECORD, strike_type: [99999] };
    const r = normalizeAirwarsRecord(unknown, TAXONOMIES)!;
    expect(r.category).toBe('other');
  });

  it('maps airstrike-and-or-artillery slug to airstrike category', () => {
    const r = normalizeAirwarsRecord({ ...SAMPLE_RECORD, strike_type: [432] }, TAXONOMIES)!;
    expect(r.category).toBe('airstrike');
  });

  it('maps drone-strike slug to airstrike category', () => {
    const r = normalizeAirwarsRecord({ ...SAMPLE_RECORD, strike_type: [434] }, TAXONOMIES)!;
    expect(r.category).toBe('airstrike');
  });

  it('maps naval-bombardment slug to shelling category', () => {
    const r = normalizeAirwarsRecord({ ...SAMPLE_RECORD, strike_type: [643] }, TAXONOMIES)!;
    expect(r.category).toBe('shelling');
  });

  it('maps ground-operation slug to ground_op category', () => {
    const r = normalizeAirwarsRecord({ ...SAMPLE_RECORD, strike_type: [752] }, TAXONOMIES)!;
    expect(r.category).toBe('ground_op');
  });
});

describe('normalizeAirwarsRecord with article narratives', () => {
  it('uses article paragraphs when status is "assessed"', () => {
    const articles = new Map([
      ['ispt0097-october-10-2023', {
        slug: 'ispt0097-october-10-2023',
        status: 'assessed' as const,
        paragraphs: [
          'On October 10th 2023, at least 2 civilians were killed when a residential building was struck.',
          'Sources on social media identified the victims as members of the Al-Tatar family.',
        ],
      }],
    ]);
    const r = normalizeAirwarsRecord(SAMPLE_RECORD, TAXONOMIES, articles)!;
    expect(r.description).toEqual([
      'On October 10th 2023, at least 2 civilians were killed when a residential building was struck.',
      'Sources on social media identified the victims as members of the Al-Tatar family.',
    ]);
  });

  it('falls back to title when article status is "stub"', () => {
    const articles = new Map([
      ['ispt0097-october-10-2023', {
        slug: 'ispt0097-october-10-2023',
        status: 'stub' as const,
        paragraphs: [],
      }],
    ]);
    const r = normalizeAirwarsRecord(SAMPLE_RECORD, TAXONOMIES, articles)!;
    expect(r.description).toEqual(['ISPT0097 – October 10, 2023']);
  });

  it('falls back to title when no article is found in the map', () => {
    const r = normalizeAirwarsRecord(SAMPLE_RECORD, TAXONOMIES, new Map())!;
    expect(r.description).toEqual(['ISPT0097 – October 10, 2023']);
  });

  it('still works with no articles argument (backwards compatible)', () => {
    const r = normalizeAirwarsRecord(SAMPLE_RECORD, TAXONOMIES)!;
    expect(r.description).toEqual(['ISPT0097 – October 10, 2023']);
  });
});
