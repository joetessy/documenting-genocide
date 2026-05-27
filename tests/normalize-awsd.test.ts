import { describe, it, expect } from 'vitest';
import { normalizeAwsdRow, mapAwsdCategory } from '../scripts/normalize-awsd';

// Sample row mirrors the AWSD CSV header keys exactly (verified by curl).
// Coordinates point at Deir al Balah — well inside the Gaza polygon.
const GAZA_AERIAL_SAMPLE: Record<string, string> = {
  'Incident ID': '5717',
  Year: '2025',
  Month: '9',
  Day: '27',
  'Country Code': 'PS',
  Country: 'Occupied Palestinian Territories',
  Region: 'Gaza Strip',
  District: 'Deir Al Balah',
  City: '',
  UN: '1',
  INGO: '0',
  ICRC: '0',
  'NRCS and IFRC': '0',
  NNGO: '0',
  Other: '0',
  'Nationals killed': '1',
  'Nationals wounded': '0',
  'Nationals kidnapped': '0',
  'Nationals detained': '0',
  'Total nationals': '1',
  'Internationals killed': '0',
  'Internationals wounded': '0',
  'Internationals kidnapped': '0',
  'Internationals detained': '0',
  'Total internationals': '0',
  'Total killed': '1',
  'Total wounded': '0',
  'Total kidnapped': '0',
  'Total detained': '0',
  'Total affected': '1',
  'Gender Male': '1',
  'Gender Female': '0',
  'Gender Unknown': '0',
  'Means of attack': 'Aerial bombardment',
  'Attack context': 'Unknown',
  Location: 'Unknown',
  Latitude: '31.437171',
  Longitude: '34.381183',
  Motive: 'Incidental',
  'Actor type': 'Host state',
  'Actor name': 'Israel Defense Forces (IDF)',
  Details: 'One male UN aid worker was killed during an aerial bombardment in Central Gaza, Gaza Strip.',
  Verified: 'Yes',
  Source: 'Focal Point',
};

describe('mapAwsdCategory', () => {
  it('maps aerial bombardment / drone to airstrike', () => {
    expect(mapAwsdCategory({ meansOfAttack: 'Aerial bombardment', context: 'Unknown' })).toBe('airstrike');
    expect(mapAwsdCategory({ meansOfAttack: 'Drone strike', context: '' })).toBe('airstrike');
    expect(mapAwsdCategory({ meansOfAttack: 'Air strike', context: '' })).toBe('airstrike');
  });
  it('maps shelling / missile / rocket to shelling', () => {
    expect(mapAwsdCategory({ meansOfAttack: 'Shelling', context: 'Combat/Crossfire' })).toBe('shelling');
    expect(mapAwsdCategory({ meansOfAttack: 'Missile attack', context: '' })).toBe('shelling');
    expect(mapAwsdCategory({ meansOfAttack: 'Rocket fire', context: '' })).toBe('shelling');
  });
  it('maps kidnap / detain to detention', () => {
    expect(mapAwsdCategory({ meansOfAttack: 'Detention/arrest', context: 'Detention' })).toBe('detention');
    expect(mapAwsdCategory({ meansOfAttack: 'Kidnapping', context: 'Unknown' })).toBe('detention');
    expect(mapAwsdCategory({ meansOfAttack: 'Kidnap-killing', context: 'Unknown' })).toBe('detention');
  });
  it('falls back to attack_on_aid for unrecognized means', () => {
    expect(mapAwsdCategory({ meansOfAttack: 'Shooting', context: 'Combat/Crossfire' })).toBe('attack_on_aid');
    expect(mapAwsdCategory({ meansOfAttack: 'Bodily assault', context: 'Mob violence' })).toBe('attack_on_aid');
    expect(mapAwsdCategory({ meansOfAttack: 'Unknown', context: 'Unknown' })).toBe('attack_on_aid');
    expect(mapAwsdCategory({ meansOfAttack: '', context: '' })).toBe('attack_on_aid');
  });
});

describe('normalizeAwsdRow', () => {
  it('produces a complete Incident from a well-formed Gaza row', () => {
    const r = normalizeAwsdRow(GAZA_AERIAL_SAMPLE)!;
    expect(r).not.toBeNull();
    expect(r.id).toBe('awsd:5717');
    expect(r.date).toBe('2025-09-27');
    expect(r.location.lat).toBeCloseTo(31.437171);
    expect(r.location.lon).toBeCloseTo(34.381183);
    // 'Location' and 'City' are empty/'Unknown' so the District should win.
    expect(r.location.name).toBe('Deir Al Balah');
    expect(r.category).toBe('airstrike');
    expect(r.casualties.killed).toBe(1);
    expect(r.casualties.injured).toBe(0);
    expect(r.casualties.killed_children).toBeNull();
    expect(r.casualties.killed_women).toBeNull();
    expect(r.description).toHaveLength(1);
    expect(r.description[0]).toContain('aerial bombardment');
    expect(r.sources).toHaveLength(1);
    expect(r.sources[0].org).toBe('awsd');
    expect(r.sources[0].id).toBe('5717');
    expect(r.sources[0].url).toContain('aidworkersecurity.org');
  });

  it('maps shelling means to shelling category', () => {
    const r = normalizeAwsdRow({
      ...GAZA_AERIAL_SAMPLE,
      'Means of attack': 'Shelling',
      'Attack context': 'Combat/Crossfire',
    })!;
    expect(r.category).toBe('shelling');
  });

  it('maps detention/arrest means to detention category', () => {
    const r = normalizeAwsdRow({
      ...GAZA_AERIAL_SAMPLE,
      'Means of attack': 'Detention/arrest',
      'Attack context': 'Detention',
    })!;
    expect(r.category).toBe('detention');
  });

  it('falls back to attack_on_aid for shooting / other unmatched means', () => {
    const r = normalizeAwsdRow({
      ...GAZA_AERIAL_SAMPLE,
      'Means of attack': 'Shooting',
      'Attack context': 'Combat/Crossfire',
    })!;
    expect(r.category).toBe('attack_on_aid');
  });

  it('rejects rows with West Bank coords (outside Gaza polygon)', () => {
    const westBank = {
      ...GAZA_AERIAL_SAMPLE,
      Latitude: '32.31037',
      Longitude: '35.02863',
      District: 'Tulkarm',
    };
    expect(normalizeAwsdRow(westBank)).toBeNull();
  });

  it('rejects pre-conflict dates (before 2023-10-07)', () => {
    expect(normalizeAwsdRow({ ...GAZA_AERIAL_SAMPLE, Year: '2023', Month: '1', Day: '1' })).toBeNull();
    expect(normalizeAwsdRow({ ...GAZA_AERIAL_SAMPLE, Year: '2022', Month: '6', Day: '15' })).toBeNull();
  });

  it('rejects rows with missing or non-numeric lat/lon', () => {
    expect(normalizeAwsdRow({ ...GAZA_AERIAL_SAMPLE, Latitude: '', Longitude: '' })).toBeNull();
    expect(normalizeAwsdRow({ ...GAZA_AERIAL_SAMPLE, Latitude: 'NA', Longitude: 'NA' })).toBeNull();
  });

  it('rejects rows with missing or malformed date components', () => {
    expect(normalizeAwsdRow({ ...GAZA_AERIAL_SAMPLE, Month: '', Day: '' })).toBeNull();
    expect(normalizeAwsdRow({ ...GAZA_AERIAL_SAMPLE, Year: '', Month: '9', Day: '27' })).toBeNull();
    // AWSD sometimes records a year + month but no day (e.g. for archived
    // bulk-report entries). Without a day we can't place the event on the
    // timeline, so we reject.
    expect(normalizeAwsdRow({ ...GAZA_AERIAL_SAMPLE, Day: '' })).toBeNull();
  });

  it('parses casualty counts (killed and wounded) correctly', () => {
    const r = normalizeAwsdRow({
      ...GAZA_AERIAL_SAMPLE,
      'Total killed': '2',
      'Total wounded': '5',
    })!;
    expect(r.casualties.killed).toBe(2);
    expect(r.casualties.injured).toBe(5);
  });

  it('handles blank or non-numeric casualty fields gracefully (null)', () => {
    const r = normalizeAwsdRow({
      ...GAZA_AERIAL_SAMPLE,
      'Total killed': '',
      'Total wounded': '   ',
    })!;
    expect(r.casualties.killed).toBeNull();
    expect(r.casualties.injured).toBeNull();
  });

  it('pads single-digit month and day to two digits in the ISO date', () => {
    const r = normalizeAwsdRow({
      ...GAZA_AERIAL_SAMPLE,
      Year: '2024',
      Month: '3',
      Day: '7',
    })!;
    expect(r.date).toBe('2024-03-07');
  });
});
