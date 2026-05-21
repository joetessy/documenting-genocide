import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TimeController, addDays, formatDate } from '../src/time/time-controller';

describe('addDays', () => {
  it('handles same-month addition', () => {
    expect(addDays('2024-03-05', 3)).toBe('2024-03-08');
  });
  it('rolls over months', () => {
    expect(addDays('2024-03-30', 5)).toBe('2024-04-04');
  });
  it('handles negative deltas', () => {
    expect(addDays('2024-03-05', -7)).toBe('2024-02-27');
  });
});

describe('formatDate', () => {
  it('formats ISO into a human label', () => {
    expect(formatDate('2024-03-12')).toBe('Mar 12, 2024');
  });
});

describe('TimeController', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('initializes at the start date', () => {
    const tc = new TimeController({ start: '2023-10-07', end: '2024-06-01' });
    expect(tc.currentDate).toBe('2023-10-07');
  });

  it('notifies listeners when the date changes', () => {
    const tc = new TimeController({ start: '2023-10-07', end: '2024-06-01' });
    const spy = vi.fn();
    tc.onChange(spy);
    tc.setDate('2023-10-15');
    expect(spy).toHaveBeenCalledWith('2023-10-15');
  });

  it('clamps setDate to range', () => {
    const tc = new TimeController({ start: '2023-10-07', end: '2024-06-01' });
    tc.setDate('2020-01-01');
    expect(tc.currentDate).toBe('2023-10-07');
    tc.setDate('2030-01-01');
    expect(tc.currentDate).toBe('2024-06-01');
  });

  it('does not notify if setDate is a no-op', () => {
    const tc = new TimeController({ start: '2023-10-07', end: '2024-06-01' });
    const spy = vi.fn();
    tc.onChange(spy);
    tc.setDate('2023-10-07');
    expect(spy).not.toHaveBeenCalled();
  });

  it('play() advances the date on a timer', () => {
    const tc = new TimeController({ start: '2023-10-07', end: '2024-06-01', stepDaysPerSecond: 10 });
    const spy = vi.fn();
    tc.onChange(spy);
    tc.play();
    vi.advanceTimersByTime(1000);
    expect(tc.currentDate).toBe('2023-10-17');
    expect(spy).toHaveBeenCalled();
  });

  it('pause() stops advancing', () => {
    const tc = new TimeController({ start: '2023-10-07', end: '2024-06-01', stepDaysPerSecond: 10 });
    tc.play();
    vi.advanceTimersByTime(500);
    tc.pause();
    const at = tc.currentDate;
    vi.advanceTimersByTime(2000);
    expect(tc.currentDate).toBe(at);
  });

  it('play() stops at the end date', () => {
    const tc = new TimeController({ start: '2023-10-07', end: '2023-10-10', stepDaysPerSecond: 10 });
    tc.play();
    vi.advanceTimersByTime(10000);
    expect(tc.currentDate).toBe('2023-10-10');
    expect(tc.isPlaying).toBe(false);
  });
});
