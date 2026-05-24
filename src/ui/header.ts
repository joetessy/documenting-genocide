import type { Incident } from '@shared/types';

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

function buildDamageCumulative(features: Array<{ properties?: { assessment_date?: string } }>): DamageCumulative {
  const byDate = new Map<string, number>();
  for (const f of features) {
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

const fmt = new Intl.NumberFormat('en-US');

export function mountHeader(
  parent: HTMLElement,
  opts: {
    incidents: Incident[];
    damageFeatures: Array<{ properties?: { assessment_date?: string } }>;
  },
): HeaderHandle {
  const el = document.createElement('header');
  el.id = 'header';
  el.innerHTML = `
    <h1 class="title">The Gaza Exhibit</h1>
    <p class="subtitle">A geographic record of the war on Gaza since Oct 7, 2023.</p>
    <div class="stats">
      <div class="stat"><strong id="stat-incidents">0</strong>Incidents</div>
      <div class="stat"><strong id="stat-damage">0</strong>Buildings</div>
    </div>
  `;
  parent.appendChild(el);

  const incidentCum = buildIncidentCumulative(opts.incidents);
  const damageCum = buildDamageCumulative(opts.damageFeatures);

  const elIncidents = el.querySelector<HTMLElement>('#stat-incidents')!;
  const elDamage = el.querySelector<HTMLElement>('#stat-damage')!;

  return {
    updateForDate(date: string) {
      const inc = lookupCum(incidentCum.dateStrings, incidentCum.cumCount, date);
      const dam = lookupCum(damageCum.dateStrings, damageCum.cumCount, date);
      elIncidents.textContent = fmt.format(inc);
      elDamage.textContent = fmt.format(dam);
    },
  };
}
