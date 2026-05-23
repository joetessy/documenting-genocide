import { describe, it, expect } from 'vitest';
import { normalizeIdmcRow } from '../scripts/normalize-idmc';

const GAZA_CONFLICT_SAMPLE: Record<string, string> = {
  id: '246143',
  country: 'Palestine',
  iso3: 'PSE',
  latitude: '31.43317',
  longitude: '34.37793',
  role: 'Recommended figure',
  displacement_type: 'Conflict',
  qualifier: 'total',
  figure: '12500',
  displacement_start_date: '2025-04-12',
  displacement_end_date: '2025-04-12',
  event_id: '41769',
  event_name: 'Palestine: International armed conflict - Gaza - 12/04/2025',
  sources: 'Office for the Coordination of Humanitarian Affairs (OCHA)',
  locations_name: 'Gaza Strip, Palestinian Territories',
  description: 'Palestine: 12500 displacements, 12 April. Conflict in Gaza Strip displaced 12500 people, according to OCHA.',
};

const WEST_BANK_SAMPLE: Record<string, string> = {
  ...GAZA_CONFLICT_SAMPLE,
  id: '243265',
  latitude: '32.19080',
  longitude: '35.32328',
  locations_name: 'Nablus Governorate, Judea and Samaria, Palestinian Territories',
};

const TRIANGULATION_SAMPLE: Record<string, string> = {
  ...GAZA_CONFLICT_SAMPLE,
  id: '246144',
  role: 'Triangulation',
};

const GAZA_DISASTER_SAMPLE: Record<string, string> = {
  ...GAZA_CONFLICT_SAMPLE,
  id: '246145',
  displacement_type: 'Disaster',
  figure: '147',
  description: 'Sand/dust storm displaced 147 people in Gaza Strip.',
};

describe('normalizeIdmcRow', () => {
  it('produces a complete DisplacementEvent from a well-formed Gaza conflict row', () => {
    const r = normalizeIdmcRow(GAZA_CONFLICT_SAMPLE)!;
    expect(r.id).toBe('idmc:246143');
    expect(r.date).toBe('2025-04-12');
    expect(r.location.lat).toBeCloseTo(31.43317);
    expect(r.location.lon).toBeCloseTo(34.37793);
    expect(r.location.name).toBe('Gaza Strip, Palestinian Territories');
    expect(r.figure).toBe(12500);
    expect(r.displacement_type).toBe('conflict');
    expect(r.qualifier).toBe('total');
    expect(r.description).toContain('12500 displacements');
    expect(r.sources).toHaveLength(1);
    expect(r.sources[0].org).toBe('idmc');
    expect(r.sources[0].id).toBe('246143');
    expect(r.sources[0].url).toContain('data.humdata.org');
  });

  it('lowercases Disaster displacement_type', () => {
    const r = normalizeIdmcRow(GAZA_DISASTER_SAMPLE)!;
    expect(r.displacement_type).toBe('disaster');
    expect(r.figure).toBe(147);
  });

  it('rejects West Bank rows (outside Gaza bbox)', () => {
    expect(normalizeIdmcRow(WEST_BANK_SAMPLE)).toBeNull();
  });

  it('rejects rows with role=Triangulation (duplicates of Recommended figure)', () => {
    expect(normalizeIdmcRow(TRIANGULATION_SAMPLE)).toBeNull();
  });

  it('rejects rows missing latitude/longitude', () => {
    const noCoords = { ...GAZA_CONFLICT_SAMPLE, latitude: '', longitude: '' };
    expect(normalizeIdmcRow(noCoords)).toBeNull();
  });

  it('rejects rows with non-finite latitude/longitude', () => {
    const bad = { ...GAZA_CONFLICT_SAMPLE, latitude: 'NaN', longitude: 'abc' };
    expect(normalizeIdmcRow(bad)).toBeNull();
  });

  it('rejects rows with non-ISO displacement_start_date', () => {
    const bad = { ...GAZA_CONFLICT_SAMPLE, displacement_start_date: '14/03/2026' };
    expect(normalizeIdmcRow(bad)).toBeNull();
  });

  it('rejects rows with figure of zero or non-numeric', () => {
    expect(normalizeIdmcRow({ ...GAZA_CONFLICT_SAMPLE, figure: '0' })).toBeNull();
    expect(normalizeIdmcRow({ ...GAZA_CONFLICT_SAMPLE, figure: 'unknown' })).toBeNull();
  });

  it('rejects rows with unknown displacement_type', () => {
    const weird = { ...GAZA_CONFLICT_SAMPLE, displacement_type: 'Unknown' };
    expect(normalizeIdmcRow(weird)).toBeNull();
  });
});
