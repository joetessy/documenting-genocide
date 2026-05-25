import { describe, it, expect } from 'vitest';
import { TIMELINE_EVENTS } from '../src/data/timeline-events';

describe('TIMELINE_EVENTS', () => {
  it('has 12 or more events', () => {
    expect(TIMELINE_EVENTS.length).toBeGreaterThanOrEqual(12);
  });

  it('every event has an ISO date in YYYY-MM-DD format', () => {
    for (const e of TIMELINE_EVENTS) {
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('every event date is on or after 2023-10-07', () => {
    for (const e of TIMELINE_EVENTS) {
      expect(e.date >= '2023-10-07').toBe(true);
    }
  });

  it('every event has a non-empty title', () => {
    for (const e of TIMELINE_EVENTS) {
      expect(e.title.trim().length).toBeGreaterThan(0);
    }
  });

  it('every event has a non-empty description', () => {
    for (const e of TIMELINE_EVENTS) {
      expect(e.description.trim().length).toBeGreaterThan(0);
    }
  });

  it('descriptions are short enough to fit a tooltip (under 220 chars)', () => {
    for (const e of TIMELINE_EVENTS) {
      expect(e.description.length).toBeLessThanOrEqual(220);
    }
  });

  it('events are in chronological order', () => {
    for (let i = 1; i < TIMELINE_EVENTS.length; i++) {
      expect(TIMELINE_EVENTS[i].date >= TIMELINE_EVENTS[i - 1].date).toBe(true);
    }
  });

  it('no duplicate dates', () => {
    const dates = TIMELINE_EVENTS.map((e) => e.date);
    expect(new Set(dates).size).toBe(dates.length);
  });
});
