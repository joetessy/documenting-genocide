import { describe, it, expect } from 'vitest';
import { parseHash, formatHash } from '../src/url-state';

describe('parseHash', () => {
  it('parses a date hash', () => {
    expect(parseHash('#date=2024-03-12')).toEqual({ date: '2024-03-12' });
  });
  it('returns empty for no hash', () => {
    expect(parseHash('')).toEqual({});
    expect(parseHash('#')).toEqual({});
  });
  it('ignores malformed dates', () => {
    expect(parseHash('#date=not-a-date')).toEqual({});
    expect(parseHash('#date=2024-13-50')).toEqual({});
  });
});

describe('formatHash', () => {
  it('formats a date into the hash', () => {
    expect(formatHash({ date: '2024-03-12' })).toBe('#date=2024-03-12');
  });
  it('returns empty hash for empty input', () => {
    expect(formatHash({})).toBe('');
  });
});
