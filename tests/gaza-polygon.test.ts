import { describe, it, expect } from 'vitest';
import { isInGazaPolygon } from '../shared/gaza-polygon';

describe('isInGazaPolygon', () => {
  it('returns true for central Gaza City', () => {
    expect(isInGazaPolygon(31.5017, 34.4668)).toBe(true);
  });

  it('returns true for Khan Younis', () => {
    expect(isInGazaPolygon(31.3401, 34.3036)).toBe(true);
  });

  it('returns true for Rafah', () => {
    expect(isInGazaPolygon(31.2966, 34.2433)).toBe(true);
  });

  it("returns false for Be'eri (Israeli kibbutz east of Gaza)", () => {
    expect(isInGazaPolygon(31.4215, 34.4940)).toBe(false);
  });

  it('returns false for Kfar Aza (Israeli kibbutz east of Gaza)', () => {
    expect(isInGazaPolygon(31.4844, 34.5380)).toBe(false);
  });

  it('returns false for Sderot (Israeli town northeast of Gaza)', () => {
    expect(isInGazaPolygon(31.5215, 34.5972)).toBe(false);
  });

  it('returns false for points south of the Egyptian border', () => {
    expect(isInGazaPolygon(31.18, 34.30)).toBe(false);
  });

  it('returns false for points well outside the bbox', () => {
    expect(isInGazaPolygon(32.0, 35.0)).toBe(false);    // West Bank
    expect(isInGazaPolygon(0, 0)).toBe(false);          // off the map
  });
});
