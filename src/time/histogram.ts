import type { Incident } from '@shared/types';
import type { TimelineEvent } from '../data/timeline-events';

const MS_PER_DAY = 86_400_000;

function daysBetween(start: string, end: string): number {
  const s = new Date(`${start}T00:00:00Z`).getTime();
  const e = new Date(`${end}T00:00:00Z`).getTime();
  return Math.round((e - s) / MS_PER_DAY);
}

export function bucketByDay(incidents: Incident[], start: string, end: string): number[] {
  const days = daysBetween(start, end) + 1;
  const buckets = new Array<number>(days).fill(0);
  const startMs = new Date(`${start}T00:00:00Z`).getTime();
  const endMs = new Date(`${end}T00:00:00Z`).getTime();
  for (const inc of incidents) {
    const t = new Date(`${inc.date}T00:00:00Z`).getTime();
    if (t < startMs || t > endMs) continue;
    const idx = Math.round((t - startMs) / MS_PER_DAY);
    buckets[idx]++;
  }
  return buckets;
}

// Bucket damage features by their first-damage date. Same shape as bucketByDay
// but pulls from a GeoJSON feature list (feature.properties.assessment_date).
export function bucketDamageByDay(
  features: Array<{ properties?: { assessment_date?: string } }>,
  start: string,
  end: string,
): number[] {
  const days = daysBetween(start, end) + 1;
  const buckets = new Array<number>(days).fill(0);
  const startMs = new Date(`${start}T00:00:00Z`).getTime();
  const endMs = new Date(`${end}T00:00:00Z`).getTime();
  for (const f of features) {
    const date = f.properties?.assessment_date;
    if (!date) continue;
    const t = new Date(`${date}T00:00:00Z`).getTime();
    if (t < startMs || t > endMs) continue;
    const idx = Math.round((t - startMs) / MS_PER_DAY);
    buckets[idx]++;
  }
  return buckets;
}

// Render two stacked density series in the histogram host: damage on top (tan,
// big numbers), incidents below (red, small numbers). Each series uses its own
// max so both register visually despite the ~1000x scale difference.
// Optional `events` renders thin vertical markers at major dates; clicking
// one calls `onEventClick` with the event, which the caller uses to jump the
// scrubber to that date.
export function renderHistogram(
  host: HTMLElement,
  incidents: number[],
  damage: number[] | undefined,
  start: string,
  events?: TimelineEvent[],
  onEventClick?: (event: TimelineEvent) => void,
): void {
  host.innerHTML = '';
  const w = host.clientWidth;
  const h = host.clientHeight;
  const days = Math.max(incidents.length, damage?.length ?? 0);
  if (days === 0) return;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${days} ${h}`);
  svg.setAttribute('width', String(w));
  svg.setAttribute('height', String(h));
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.style.position = 'absolute';
  svg.style.inset = '0';

  // Damage bars: top half of the host, tan/cream gradient, fade with opacity.
  if (damage && damage.length > 0) {
    const damageMax = Math.max(1, ...damage);
    const damageMaxH = h * 0.55;
    for (let i = 0; i < damage.length; i++) {
      const v = damage[i];
      if (v === 0) continue;
      const bh = (v / damageMax) * damageMaxH;
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', String(i));
      rect.setAttribute('y', String(h - bh));
      rect.setAttribute('width', '1');
      rect.setAttribute('height', String(bh));
      rect.setAttribute('fill', '#8a7250');
      rect.setAttribute('fill-opacity', '0.22');
      svg.appendChild(rect);
    }
  }

  // Incident bars: render on top with the editorial red.
  const incidentMax = Math.max(1, ...incidents);
  const incidentMaxH = h * 0.55;
  for (let i = 0; i < incidents.length; i++) {
    const v = incidents[i];
    if (v === 0) continue;
    const bh = (v / incidentMax) * incidentMaxH;
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', String(i));
    rect.setAttribute('y', String(h - bh));
    rect.setAttribute('width', '1');
    rect.setAttribute('height', String(bh));
    rect.setAttribute('fill', '#c5152c');
    rect.setAttribute('fill-opacity', '0.55');
    svg.appendChild(rect);
  }

  // Event markers: thin vertical lines at major dates with a wider transparent
  // hit area for hover and click. A native <title> provides the browser tooltip.
  if (events && events.length > 0) {
    const eventGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    eventGroup.setAttribute('class', 'hist-events');
    for (const ev of events) {
      const xDays = daysBetween(start, ev.date);
      if (xDays < 0 || xDays > days) continue;

      const markerGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      markerGroup.setAttribute('class', 'hist-event');

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(xDays + 0.5));
      line.setAttribute('y1', '0');
      line.setAttribute('x2', String(xDays + 0.5));
      line.setAttribute('y2', String(h));
      line.setAttribute('stroke', '#e63946');
      line.setAttribute('stroke-width', '0.5');
      line.setAttribute('opacity', '0.85');
      line.setAttribute('vector-effect', 'non-scaling-stroke');

      const hit = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      hit.setAttribute('x', String(xDays - 1.5));
      hit.setAttribute('y', '0');
      hit.setAttribute('width', '3');
      hit.setAttribute('height', String(h));
      hit.setAttribute('fill', 'transparent');
      hit.style.cursor = 'pointer';

      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = `${ev.date} — ${ev.title}`;

      hit.addEventListener('click', () => {
        if (onEventClick) onEventClick(ev);
      });

      markerGroup.appendChild(line);
      markerGroup.appendChild(hit);
      markerGroup.appendChild(title);
      eventGroup.appendChild(markerGroup);
    }
    svg.appendChild(eventGroup);
  }

  host.appendChild(svg);
}
