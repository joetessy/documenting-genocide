import { describe, it, expect } from 'vitest';
import { bucketByDay, bucketDamageByDay } from '../src/time/histogram';
import type { Incident } from '../shared/types';

function makeIncident(date: string, id: string): Incident {
  return {
    id,
    date,
    location: { lat: 31.5, lon: 34.4 },
    category: 'airstrike',
    casualties: { killed: 1, injured: null, killed_children: null, killed_women: null },
    description: [],
    sources: [{ org: 'airwars', id, url: 'x' }],
  };
}

describe('bucketByDay', () => {
  it('counts incidents per day across the range', () => {
    const incidents: Incident[] = [
      makeIncident('2023-10-07', 'a'),
      makeIncident('2023-10-07', 'b'),
      makeIncident('2023-10-08', 'c'),
      makeIncident('2023-10-10', 'd'),
    ];
    const buckets = bucketByDay(incidents, '2023-10-07', '2023-10-10');
    expect(buckets).toEqual([2, 1, 0, 1]);
  });

  it('returns zeros for an empty input', () => {
    const buckets = bucketByDay([], '2023-10-07', '2023-10-09');
    expect(buckets).toEqual([0, 0, 0]);
  });

  it('ignores incidents outside the range', () => {
    const incidents: Incident[] = [
      makeIncident('2023-09-30', 'before'),
      makeIncident('2023-10-08', 'in'),
      makeIncident('2023-10-15', 'after'),
    ];
    const buckets = bucketByDay(incidents, '2023-10-07', '2023-10-10');
    expect(buckets).toEqual([0, 1, 0, 0]);
  });
});

describe('bucketDamageByDay', () => {
  it('counts features by their assessment_date property', () => {
    const features = [
      { properties: { assessment_date: '2023-10-07' } },
      { properties: { assessment_date: '2023-10-07' } },
      { properties: { assessment_date: '2023-10-09' } },
    ];
    const buckets = bucketDamageByDay(features, '2023-10-07', '2023-10-10');
    expect(buckets).toEqual([2, 0, 1, 0]);
  });

  it('ignores features without an assessment_date', () => {
    const features = [
      { properties: { assessment_date: '2023-10-08' } },
      { properties: {} },
      { properties: { assessment_date: undefined } },
    ];
    const buckets = bucketDamageByDay(features, '2023-10-07', '2023-10-09');
    expect(buckets).toEqual([0, 1, 0]);
  });
});
