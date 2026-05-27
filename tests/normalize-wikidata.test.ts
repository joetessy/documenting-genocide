import { describe, it, expect } from 'vitest';
import { normalizeWikidataEvent, mapWikidataCategory } from '../scripts/normalize-wikidata';
import type { WikidataEvent } from '../scripts/fetch-wikidata';

const GAZA_FULL_SAMPLE: WikidataEvent = {
  id: 'Q123109101',
  label: 'al-Ahli Arab Hospital explosion',
  date: '2023-10-17',
  lat: 31.5052,
  lon: 34.4614,
  deaths: 471,
  description: 'On 17 October 2023, an explosion took place in a courtyard of al-Ahli Arab Hospital in Gaza City, resulting in mass casualties among displaced Palestinians sheltering there.',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Al-Ahli_Arab_Hospital_explosion',
  wikidataUrl: 'http://www.wikidata.org/entity/Q123109101',
};

const WIKIDATA_ONLY_SAMPLE: WikidataEvent = {
  id: 'Q888',
  label: 'Drone strike on Khan Younis residential block',
  date: '2024-03-12',
  lat: 31.342,
  lon: 34.306,
  deaths: 8,
  description: '',
  wikipediaUrl: null,
  wikidataUrl: 'http://www.wikidata.org/entity/Q888',
};

describe('mapWikidataCategory', () => {
  it('maps airstrike keywords to airstrike', () => {
    expect(mapWikidataCategory('Jabalia airstrike', '')).toBe('airstrike');
    expect(mapWikidataCategory('Drone strike on convoy', '')).toBe('airstrike');
    expect(mapWikidataCategory('Aerial bombardment of Rafah', '')).toBe('airstrike');
  });
  it('maps shelling-related to shelling', () => {
    expect(mapWikidataCategory('Artillery shelling of school', '')).toBe('shelling');
    expect(mapWikidataCategory('Mortar attack', '')).toBe('shelling');
  });
  it('maps ground-related to ground_op', () => {
    expect(mapWikidataCategory('Israeli ground raid on hospital', '')).toBe('ground_op');
  });
  it('falls back to other for hospital-only labels with no airstrike/shelling words', () => {
    // "Al-Shifa Hospital raid" — 'raid' actually matches ground_op, so use something else.
    expect(mapWikidataCategory('Al-Shifa Hospital siege', '')).toBe('other');
  });
  it('falls back to other when no keywords match', () => {
    expect(mapWikidataCategory('Generic Gaza war incident', '')).toBe('other');
    expect(mapWikidataCategory('', '')).toBe('other');
  });
});

describe('normalizeWikidataEvent', () => {
  it('produces a complete Incident with both Wikidata + Wikipedia sources', () => {
    const r = normalizeWikidataEvent(GAZA_FULL_SAMPLE)!;
    expect(r.id).toBe('wikidata:Q123109101');
    expect(r.date).toBe('2023-10-17');
    expect(r.location.lat).toBeCloseTo(31.5052);
    expect(r.location.lon).toBeCloseTo(34.4614);
    expect(r.location.name).toBe('al-Ahli Arab Hospital explosion');
    expect(r.casualties.killed).toBe(471);
    expect(r.casualties.injured).toBeNull();
    expect(r.description).toHaveLength(1);
    expect(r.description[0]).toContain('al-Ahli');
    expect(r.sources).toHaveLength(2);
    expect(r.sources[0].org).toBe('wikidata');
    expect(r.sources[0].id).toBe('Q123109101');
    expect(r.sources[0].url).toBe('http://www.wikidata.org/entity/Q123109101');
    expect(r.sources[1].org).toBe('wikidata');
    expect(r.sources[1].id).toBe('wp:Al-Ahli_Arab_Hospital_explosion');
    expect(r.sources[1].url).toBe('https://en.wikipedia.org/wiki/Al-Ahli_Arab_Hospital_explosion');
  });

  it('produces a valid Incident with just one source when no Wikipedia URL', () => {
    const r = normalizeWikidataEvent(WIKIDATA_ONLY_SAMPLE)!;
    expect(r.id).toBe('wikidata:Q888');
    expect(r.sources).toHaveLength(1);
    expect(r.sources[0].org).toBe('wikidata');
    expect(r.sources[0].id).toBe('Q888');
    expect(r.description).toEqual([]);
  });

  it('infers airstrike category from airstrike keywords in the label', () => {
    const r = normalizeWikidataEvent({
      ...GAZA_FULL_SAMPLE,
      label: 'Jabalia refugee camp airstrike',
      description: '',
    })!;
    expect(r.category).toBe('airstrike');
  });

  it("falls back to 'other' for hospital labels without airstrike/shelling words", () => {
    const r = normalizeWikidataEvent({
      ...GAZA_FULL_SAMPLE,
      label: 'Al-Shifa Hospital siege',
      description: 'A multi-day Israeli siege of the largest hospital in Gaza.',
    })!;
    // siege/hospital aren't in any pattern → 'other'
    expect(r.category).toBe('other');
  });

  it("falls back to 'other' when no keywords match", () => {
    const r = normalizeWikidataEvent({
      ...GAZA_FULL_SAMPLE,
      label: 'Gaza war ceasefire',
      description: 'A truce was declared.',
    })!;
    expect(r.category).toBe('other');
  });

  it('rejects events whose coordinates fall outside the Gaza polygon', () => {
    // Tel Aviv-ish — well outside Gaza.
    const oob = { ...GAZA_FULL_SAMPLE, lat: 32.08, lon: 34.78 };
    expect(normalizeWikidataEvent(oob)).toBeNull();
  });

  it('rejects events whose date is before the conflict start (2023-10-07)', () => {
    const pre = { ...GAZA_FULL_SAMPLE, date: '2023-10-01' };
    expect(normalizeWikidataEvent(pre)).toBeNull();
  });

  it('rejects events with non-finite lat/lon', () => {
    const bad1 = { ...GAZA_FULL_SAMPLE, lat: Number.NaN };
    const bad2 = { ...GAZA_FULL_SAMPLE, lon: Number.POSITIVE_INFINITY };
    expect(normalizeWikidataEvent(bad1)).toBeNull();
    expect(normalizeWikidataEvent(bad2)).toBeNull();
  });

  it('handles missing deaths by mapping to casualties.killed = null', () => {
    const r = normalizeWikidataEvent({ ...GAZA_FULL_SAMPLE, deaths: null })!;
    expect(r.casualties.killed).toBeNull();
  });

  it('only emits one source attribution when wikipediaUrl is null', () => {
    const r = normalizeWikidataEvent({
      ...GAZA_FULL_SAMPLE,
      wikipediaUrl: null,
    })!;
    expect(r.sources).toHaveLength(1);
    expect(r.sources[0].id).toBe('Q123109101');
  });
});
