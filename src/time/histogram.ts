import type { Incident } from '@shared/types';
import type { TimelineEvent } from '../data/timeline-events';

const MS_PER_DAY = 86_400_000;

// Pointer-proximity thresholds for the scrubber. PROX_PX is the radius around
// an event marker (in CSS pixels) that counts as "near" for tooltip + tap-to-
// jump. DRAG_PX is the movement threshold past which a pointerdown→pointerup
// pair stops counting as a click and is treated as a scrubber drag instead.
const PROX_PX = 6;
const DRAG_PX = 4;

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

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

// Bucket pre-aggregated per-date damage counts into the day-indexed array the
// histogram renders. Used in place of bucketDamageByDay now that the client
// holds per-assessment-date totals (from damage-stats.json) rather than the
// full set of damage features.
export function bucketDamageByDate(
  perDate: Array<{ date: string; count: number }>,
  start: string,
  end: string,
): number[] {
  const days = daysBetween(start, end) + 1;
  const buckets = new Array<number>(days).fill(0);
  const startMs = new Date(`${start}T00:00:00Z`).getTime();
  const endMs = new Date(`${end}T00:00:00Z`).getTime();
  for (const { date, count } of perDate) {
    const t = new Date(`${date}T00:00:00Z`).getTime();
    if (t < startMs || t > endMs) continue;
    const idx = Math.round((t - startMs) / MS_PER_DAY);
    buckets[idx] += count;
  }
  return buckets;
}

// Module-level interaction state so the pointer listeners on the track-wrap
// (attached once) can read the latest event positions + callback after each
// re-render. Previously each event marker carried its own listeners via a
// transparent SVG hit-rect (pointer-events: auto), which captured drags
// intended for the underlying range slider — particularly on mobile where the
// finger contact patch easily lands on a marker. Now the slider always wins
// for pointer input, and the track-wrap synthesises hover/tap-to-jump from
// pointer coordinates instead.
interface EventHit {
  ev: TimelineEvent;
  xFrac: number;       // 0..1 across the track-wrap width
  marker: SVGGElement; // for the visual "is-near" highlight
}
let eventHits: EventHit[] = [];
let onEventActivate: ((ev: TimelineEvent) => void) | undefined;
let trackWrapInstrumented: HTMLElement | null = null;
let tooltipEl: HTMLDivElement | null = null;
let highlightedMarker: SVGGElement | null = null;

function findEventNear(trackWrap: HTMLElement, clientX: number): EventHit | null {
  const rect = trackWrap.getBoundingClientRect();
  const xPx = clientX - rect.left;
  const w = rect.width;
  let best: EventHit | null = null;
  let bestDist = PROX_PX;
  for (const hit of eventHits) {
    const dist = Math.abs(xPx - hit.xFrac * w);
    if (dist <= bestDist) {
      best = hit;
      bestDist = dist;
    }
  }
  return best;
}

function attachTrackWrapInteractions(trackWrap: HTMLElement): void {
  if (trackWrapInstrumented === trackWrap) return;
  trackWrapInstrumented = trackWrap;

  const setHighlight = (el: SVGGElement | null): void => {
    if (highlightedMarker && highlightedMarker !== el) {
      highlightedMarker.classList.remove('is-near');
    }
    if (el) el.classList.add('is-near');
    highlightedMarker = el;
  };

  const showTooltip = (hit: EventHit): void => {
    if (!tooltipEl) return;
    tooltipEl.innerHTML =
      `<span class="hist-event-tooltip-date">${hit.ev.date}</span>` +
      `<span class="hist-event-tooltip-title">${escapeHtml(hit.ev.title)}</span>` +
      `<span class="hist-event-tooltip-desc">${escapeHtml(hit.ev.description)}</span>`;
    tooltipEl.style.left = `${hit.xFrac * trackWrap.clientWidth}px`;
    tooltipEl.style.display = 'block';
  };

  const hideTooltip = (): void => {
    if (tooltipEl) tooltipEl.style.display = 'none';
  };

  let downX: number | null = null;
  let dragging = false;

  trackWrap.addEventListener('pointerdown', (e) => {
    downX = e.clientX;
    dragging = false;
  });

  trackWrap.addEventListener('pointermove', (e) => {
    if (downX !== null && Math.abs(e.clientX - downX) > DRAG_PX) dragging = true;
    if (dragging) {
      hideTooltip();
      setHighlight(null);
      return;
    }
    const hit = findEventNear(trackWrap, e.clientX);
    if (hit) {
      showTooltip(hit);
      setHighlight(hit.marker);
    } else {
      hideTooltip();
      setHighlight(null);
    }
  });

  trackWrap.addEventListener('pointerleave', () => {
    hideTooltip();
    setHighlight(null);
  });

  trackWrap.addEventListener('pointerup', (e) => {
    const startedHere = downX !== null;
    const moved = startedHere ? Math.abs(e.clientX - (downX as number)) : 0;
    downX = null;
    dragging = false;
    if (!startedHere || moved > DRAG_PX) return;
    const hit = findEventNear(trackWrap, e.clientX);
    if (hit && onEventActivate) onEventActivate(hit.ev);
  });

  trackWrap.addEventListener('pointercancel', () => {
    downX = null;
    dragging = false;
  });
}

// Render two stacked density series in the histogram host: damage on top (tan,
// big numbers), incidents below (red, small numbers). Each series uses its own
// max so both register visually despite the ~1000x scale difference.
// Optional `events` renders thin vertical markers at major dates; clicking
// near one (≤ PROX_PX) with no drag calls `onEventClick`, used by the caller
// to jump the scrubber and focus the camera on that event.
export function renderHistogram(
  host: HTMLElement,
  incidents: number[],
  damage: number[] | undefined,
  start: string,
  events?: TimelineEvent[],
  onEventClick?: (event: TimelineEvent) => void,
): void {
  host.innerHTML = '';

  // Custom tooltip for event markers — driven by pointermove on the track-wrap.
  const tooltip = document.createElement('div');
  tooltip.className = 'hist-event-tooltip';
  tooltip.style.display = 'none';
  host.appendChild(tooltip);
  tooltipEl = tooltip;
  highlightedMarker = null;

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

  // Event markers: thin vertical lines at major dates. The lines are purely
  // visual — interactivity (hover tooltip, tap-to-jump) lives on the track-
  // wrap parent so the underlying range-slider keeps full pointer control of
  // the drag, even directly over a marker. See attachTrackWrapInteractions.
  const newHits: EventHit[] = [];
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
      markerGroup.appendChild(line);
      eventGroup.appendChild(markerGroup);

      newHits.push({ ev, xFrac: (xDays + 0.5) / days, marker: markerGroup });
    }
    svg.appendChild(eventGroup);
  }

  host.appendChild(svg);

  eventHits = newHits;
  onEventActivate = onEventClick;

  const trackWrap = host.parentElement;
  if (trackWrap) attachTrackWrapInteractions(trackWrap);
}
