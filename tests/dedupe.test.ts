import { describe, it, expect } from 'vitest';
import { dedupeIncidents, groupKey, richnessScore } from '../scripts/dedupe';
import type { Incident } from '../shared/types';

function makeIncident(overrides: Partial<Incident> & { id: string }): Incident {
  return {
    id: overrides.id,
    date: overrides.date ?? '2023-10-15',
    location: overrides.location ?? { lat: 31.5018, lon: 34.466 },
    category: overrides.category ?? 'airstrike',
    casualties: overrides.casualties ?? { killed: null, injured: null, killed_children: null, killed_women: null },
    description: overrides.description ?? [],
    sources: overrides.sources ?? [{ org: 'airwars', id: 'X', url: 'x' }],
  };
}

describe('groupKey', () => {
  it('rounds lat/lon to 3 decimal places', () => {
    expect(groupKey('2023-10-15', 31.50189, 34.46591)).toBe('2023-10-15:31.5020:34.4660');
  });
  it('returns the same key for points within ~55m', () => {
    // 0.0001° lat = ~11m at Gaza latitude. 0.0001° lon = ~9m.
    const k1 = groupKey('2023-10-15', 31.5018, 34.4660);
    const k2 = groupKey('2023-10-15', 31.5020, 34.4661);
    expect(k1).toBe(k2);
  });
  it('returns different keys for points >55m apart', () => {
    const k1 = groupKey('2023-10-15', 31.5018, 34.4660);
    const k2 = groupKey('2023-10-15', 31.5050, 34.4660);
    expect(k1).not.toBe(k2);
  });
  it('returns different keys for different dates', () => {
    expect(groupKey('2023-10-15', 31.5, 34.4)).not.toBe(groupKey('2023-10-16', 31.5, 34.4));
  });
});

describe('dedupeIncidents', () => {
  it('returns input unchanged when no duplicates', () => {
    const a = makeIncident({ id: 'a', location: { lat: 31.5, lon: 34.4 } });
    const b = makeIncident({ id: 'b', location: { lat: 31.55, lon: 34.45 } });
    const { incidents, merges } = dedupeIncidents([a, b]);
    expect(incidents).toHaveLength(2);
    expect(merges).toBe(0);
  });

  it('merges two incidents at the same location and date', () => {
    const a = makeIncident({
      id: 'airwars:1',
      casualties: { killed: 5, injured: null, killed_children: 2, killed_women: null },
      description: ['Airwars narrative paragraph one.', 'Paragraph two.'],
      sources: [{ org: 'airwars', id: 'A1', url: 'a' }],
    });
    const b = makeIncident({
      id: 'acled:1',
      casualties: { killed: 7, injured: 3, killed_children: null, killed_women: null },
      description: ['Short ACLED note.'],
      sources: [{ org: 'acled', id: 'B1', url: 'b' }],
    });
    const { incidents, merges } = dedupeIncidents([a, b]);
    expect(incidents).toHaveLength(1);
    expect(merges).toBe(1);
    const merged = incidents[0];
    expect(merged.casualties.killed).toBe(7);
    expect(merged.casualties.injured).toBe(3);
    expect(merged.casualties.killed_children).toBe(2);
    expect(merged.description).toHaveLength(2);
    expect(merged.description[0]).toContain('Airwars');
    expect(merged.sources).toHaveLength(2);
    expect(merged.sources.map((s) => s.org).sort()).toEqual(['acled', 'airwars']);
  });

  it('keeps Airwars location.name when both sources have one', () => {
    const a = makeIncident({
      id: 'airwars:1',
      location: { lat: 31.5, lon: 34.4, name: "Al-Tatar's home" },
      sources: [{ org: 'airwars', id: 'A1', url: 'a' }],
    });
    const b = makeIncident({
      id: 'acled:1',
      location: { lat: 31.5, lon: 34.4, name: 'Gaza City' },
      sources: [{ org: 'acled', id: 'B1', url: 'b' }],
    });
    const { incidents } = dedupeIncidents([a, b]);
    expect(incidents[0].location.name).toBe("Al-Tatar's home");
  });

  it('handles 3+ incidents at the same location', () => {
    const a = makeIncident({ id: 'airwars:1', casualties: { killed: 5, injured: null, killed_children: null, killed_women: null }, sources: [{ org: 'airwars', id: 'A', url: 'a' }] });
    const b = makeIncident({ id: 'acled:1', casualties: { killed: 7, injured: null, killed_children: null, killed_women: null }, sources: [{ org: 'acled', id: 'B', url: 'b' }] });
    const c = makeIncident({ id: 'acled:2', casualties: { killed: 6, injured: null, killed_children: null, killed_women: null }, sources: [{ org: 'acled', id: 'C', url: 'c' }] });
    const { incidents, merges } = dedupeIncidents([a, b, c]);
    expect(incidents).toHaveLength(1);
    expect(merges).toBe(2);
    expect(incidents[0].casualties.killed).toBe(7);
    expect(incidents[0].sources).toHaveLength(3);
  });

  it('preserves Airwars id as the merged incident id when present', () => {
    const a = makeIncident({ id: 'airwars:1' });
    const b = makeIncident({ id: 'acled:1' });
    const { incidents } = dedupeIncidents([a, b]);
    expect(incidents[0].id).toBe('airwars:1');
  });
});

describe('richnessScore', () => {
  function baseIncident(overrides: Partial<Incident> = {}): Incident {
    return {
      id: 'test:1',
      date: '2024-01-01',
      location: { lat: 31.4, lon: 34.4 },
      category: 'other',
      casualties: { killed: null, injured: null, killed_children: null, killed_women: null },
      description: [],
      sources: [],
      ...overrides,
    };
  }

  it('returns 0 for a bare record', () => {
    expect(richnessScore(baseIncident())).toBe(0);
  });

  it('awards points for description length', () => {
    const sparse = baseIncident({ description: ['short'] });
    const rich = baseIncident({ description: ['x'.repeat(2000)] });
    expect(richnessScore(rich)).toBeGreaterThan(richnessScore(sparse));
    // Cap at 20 points
    const huge = baseIncident({ description: ['x'.repeat(10000)] });
    expect(richnessScore(huge)).toBe(20);
  });

  it('awards 2 points per source', () => {
    const oneSource = baseIncident({ sources: [{ org: 'cir', id: 'a', url: 'https://a' }] });
    const threeSources = baseIncident({
      sources: [
        { org: 'cir', id: 'a', url: 'https://a' },
        { org: 'ucdp', id: 'b', url: 'https://b' },
        { org: 'airwars', id: 'c', url: 'https://c' },
      ],
    });
    expect(richnessScore(threeSources) - richnessScore(oneSource)).toBe(4);
  });

  it('awards 3 points per filled casualty field', () => {
    const empty = baseIncident();
    const full = baseIncident({
      casualties: { killed: 5, injured: 10, killed_children: 2, killed_women: 1 },
    });
    expect(richnessScore(full) - richnessScore(empty)).toBe(12);
  });

  it('awards points for location metadata and specific category', () => {
    const bare = baseIncident();
    const enriched = baseIncident({
      location: { lat: 31.4, lon: 34.4, name: 'Khan Younis', governorate: 'khan_younis' },
      category: 'airstrike',
    });
    expect(richnessScore(enriched) - richnessScore(bare)).toBe(2 + 1 + 2);
  });

  it('awards 5 points once for any rated source', () => {
    const unrated = baseIncident({
      sources: [{ org: 'cir', id: 'a', url: 'https://a' }],
    });
    const rated = baseIncident({
      sources: [
        { org: 'airwars', id: 'a', url: 'https://a', rating: 'fair' },
        { org: 'airwars', id: 'b', url: 'https://b', rating: 'confirmed' },
      ],
    });
    // 2 sources × 2 + 5 rating bonus (once) - 1 source × 2 = 7
    expect(richnessScore(rated) - richnessScore(unrated)).toBe(7);
  });
});
