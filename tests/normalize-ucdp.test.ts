import { describe, it, expect } from 'vitest';
import { normalizeUcdpRecord, mapUcdpCategory, ucdpDescription } from '../scripts/normalize-ucdp';

const SAMPLE: Record<string, string> = {
  id: '498841',
  year: '2023',
  type_of_violence: '1',
  dyad_name: 'Government of Israel - Hamas',
  side_a: 'Government of Israel',
  side_b: 'Hamas',
  source_article: 'Reuters News,2023-11-01,Headline;AFP,2023-11-02,Another',
  source_headline: 'Israeli airstrike hits Khan Younis residential building',
  where_prec: '2',
  where_coordinates: 'Khan Younis town',
  adm_1: 'Gaza Strip',
  adm_2: 'Khan Younis governorate',
  latitude: '31.3400',
  longitude: '34.3000',
  country_id: '666',
  event_clarity: '1',
  date_prec: '1',
  date_start: '2023-10-07 00:00:00.000',
  deaths_civilians: '5',
  best: '10',
};

describe('mapUcdpCategory', () => {
  it('infers airstrike from headline keywords', () => {
    expect(mapUcdpCategory({ headline: 'Israeli airstrike hits residential area' })).toBe('airstrike');
    expect(mapUcdpCategory({ headline: 'IDF drone strike kills three' })).toBe('airstrike');
  });
  it('infers shelling', () => {
    expect(mapUcdpCategory({ headline: 'Shelling kills six' })).toBe('shelling');
    expect(mapUcdpCategory({ headline: 'Artillery fire on Gaza City' })).toBe('shelling');
  });
  it('infers ground_op', () => {
    expect(mapUcdpCategory({ headline: 'IDF ground operation in Rafah' })).toBe('ground_op');
    expect(mapUcdpCategory({ headline: 'Clashes between militants and troops' })).toBe('ground_op');
  });
  it('falls back to other', () => {
    expect(mapUcdpCategory({ headline: 'Unspecified incident' })).toBe('other');
  });
});

describe('ucdpDescription', () => {
  it('builds a one-paragraph description from headline + location', () => {
    const desc = ucdpDescription(SAMPLE as never);
    expect(desc).toHaveLength(1);
    expect(desc[0]).toContain('Khan Younis');
    expect(desc[0]).toContain('Israeli airstrike');
  });
});

describe('normalizeUcdpRecord', () => {
  it('produces a complete Incident from a well-formed row', () => {
    const r = normalizeUcdpRecord(SAMPLE as never)!;
    expect(r.id).toBe('ucdp:498841');
    expect(r.date).toBe('2023-10-07');
    expect(r.location.lat).toBeCloseTo(31.34);
    expect(r.location.lon).toBeCloseTo(34.30);
    expect(r.location.name).toBe('Khan Younis town');
    expect(r.category).toBe('airstrike');
    expect(r.casualties.killed).toBe(10);     // uses `best`, not deaths_civilians
    expect(r.casualties.injured).toBeNull();
    expect(r.casualties.killed_children).toBeNull();
    expect(r.casualties.killed_women).toBeNull();
    expect(r.sources).toHaveLength(1);
    expect(r.sources[0].org).toBe('ucdp');
    expect(r.sources[0].id).toBe('498841');
    expect(r.sources[0].url).toContain('ucdp.uu.se');
  });

  it('rejects coarse where_prec >= 3', () => {
    const coarse = { ...SAMPLE, where_prec: '3' };
    expect(normalizeUcdpRecord(coarse as never)).toBeNull();
  });

  it('rejects out-of-bbox coords', () => {
    const oob = { ...SAMPLE, latitude: '34.5', longitude: '31.3' };
    expect(normalizeUcdpRecord(oob as never)).toBeNull();
  });

  it('rejects missing lat/lon', () => {
    const empty = { ...SAMPLE, latitude: '', longitude: '' };
    expect(normalizeUcdpRecord(empty as never)).toBeNull();
  });

  it('parses date_start with timestamp suffix', () => {
    const r = normalizeUcdpRecord({ ...SAMPLE, date_start: '2024-03-12 13:45:00.000' } as never)!;
    expect(r.date).toBe('2024-03-12');
  });
});
