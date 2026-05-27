import type { Incident } from '@shared/types';
import type { DailyCasualty } from '../data/loader';

export interface HeaderHandle {
  updateForDate(date: string): void;
}

interface Cumulative {
  // Parallel arrays: dateStrings[i] is the ISO date, counts[i] is cumulative count through that date.
  dateStrings: string[];
  cumCount: number[];
}

interface DamageCumulative {
  dateStrings: string[];
  cumCount: number[];
}

interface CasualtyLookup {
  // Casualty payload is ALREADY cumulative per-date. Same parallel-array
  // layout for binary-search reuse, but the values are read directly (not
  // accumulated by us).
  dateStrings: string[];
  killed: number[];
}

/**
 * Precompute parallel arrays of sorted unique dates and cumulative counts.
 * O(n log n) once; on every scrubber tick we do a binary search lookup which is O(log n).
 */
function buildIncidentCumulative(incidents: Incident[]): Cumulative {
  // Group counts per date.
  const byDate = new Map<string, number>();
  for (const inc of incidents) {
    byDate.set(inc.date, (byDate.get(inc.date) ?? 0) + 1);
  }
  const dates = [...byDate.keys()].sort();
  const cumCount: number[] = [];
  let cc = 0;
  for (const d of dates) {
    cc += byDate.get(d)!;
    cumCount.push(cc);
  }
  return { dateStrings: dates, cumCount };
}

function buildDamageCumulative(features: Array<{ properties?: { assessment_date?: string; status?: string } }>): DamageCumulative {
  const byDate = new Map<string, number>();
  for (const f of features) {
    if (f.properties?.status !== 'destroyed') continue;
    const d = f.properties?.assessment_date;
    if (!d) continue;
    byDate.set(d, (byDate.get(d) ?? 0) + 1);
  }
  const dates = [...byDate.keys()].sort();
  const cumCount: number[] = [];
  let cc = 0;
  for (const d of dates) {
    cc += byDate.get(d)!;
    cumCount.push(cc);
  }
  return { dateStrings: dates, cumCount };
}

/** Build a sorted parallel-array view over the daily MoH cumulative figures.
 * The upstream is already cumulative; we just need lookup by date. */
function buildCasualtyLookup(daily: DailyCasualty[]): CasualtyLookup {
  const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date));
  return {
    dateStrings: sorted.map((d) => d.date),
    killed: sorted.map((d) => d.killed),
  };
}

/** Binary search: largest index `i` where dates[i] <= target, or -1 if none. */
function lookupCum(dates: string[], counts: number[], target: string): number {
  if (dates.length === 0) return 0;
  let lo = 0;
  let hi = dates.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (dates[mid] <= target) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best === -1 ? 0 : counts[best];
}

/** Whole-day difference between two ISO YYYY-MM-DD dates, UTC anchored to
 * avoid DST drift. Negative if `end` precedes `start`. */
function daysBetween(start: string, end: string): number {
  const s = new Date(`${start}T00:00:00Z`).getTime();
  const e = new Date(`${end}T00:00:00Z`).getTime();
  return Math.round((e - s) / 86_400_000);
}

const CONFLICT_START = '2023-10-07';
const fmt = new Intl.NumberFormat('en-US');

export function mountHeader(
  parent: HTMLElement,
  opts: {
    incidents: Incident[];
    damageFeatures: Array<{ properties?: { assessment_date?: string; status?: string } }>;
    casualtyToll: DailyCasualty[];
  },
): HeaderHandle {
  const el = document.createElement('header');
  el.id = 'header';
  el.innerHTML = `
    <p class="subtitle">A geographic record of the war on Gaza since Oct 7, 2023.</p>
    <div class="day-counter"><span id="day-n">Day 1</span></div>
    <div class="stats">
      <div class="stat"><strong id="stat-killed" title="Cumulative deaths reported by the Gaza Ministry of Health, aggregated by Tech for Palestine.">0</strong>Killed (MoH)</div>
      <div class="stat"><strong id="stat-incidents">0</strong>Incidents</div>
      <div class="stat"><strong id="stat-damage">0</strong>Buildings destroyed</div>
    </div>
  `;
  parent.appendChild(el);

  const incidentCum = buildIncidentCumulative(opts.incidents);
  const damageCum = buildDamageCumulative(opts.damageFeatures);
  const casualtyLookup = buildCasualtyLookup(opts.casualtyToll);

  const elKilled = el.querySelector<HTMLElement>('#stat-killed')!;
  const elIncidents = el.querySelector<HTMLElement>('#stat-incidents')!;
  const elDamage = el.querySelector<HTMLElement>('#stat-damage')!;
  const elDayN = el.querySelector<HTMLElement>('#day-n')!;

  return {
    updateForDate(date: string) {
      // Killed: latest cumulative entry with date <= target. Values are
      // already a running MoH total, so we read directly (no accumulation).
      const killed = lookupCum(casualtyLookup.dateStrings, casualtyLookup.killed, date);
      elKilled.textContent = fmt.format(killed);

      const inc = lookupCum(incidentCum.dateStrings, incidentCum.cumCount, date);
      const dam = lookupCum(damageCum.dateStrings, damageCum.cumCount, date);
      elIncidents.textContent = fmt.format(inc);
      elDamage.textContent = fmt.format(dam);

      // Oct 7 2023 is Day 1 (inclusive), so add 1 to the day delta. Clamp
      // negatives in case the scrubber somehow lands before the war start.
      const daysSinceStart = Math.max(1, daysBetween(CONFLICT_START, date) + 1);
      elDayN.textContent = `Day ${daysSinceStart}`;
    },
  };
}
