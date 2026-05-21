import type { Incident } from '@shared/types';

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

export function renderHistogram(host: HTMLElement, buckets: number[]): void {
  host.innerHTML = '';
  const max = Math.max(1, ...buckets);
  const w = host.clientWidth;
  const h = host.clientHeight;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${buckets.length} ${h}`);
  svg.setAttribute('width', String(w));
  svg.setAttribute('height', String(h));
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.style.position = 'absolute';
  svg.style.inset = '0';

  for (let i = 0; i < buckets.length; i++) {
    if (buckets[i] === 0) continue;
    const bh = (buckets[i] / max) * h * 0.7;
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', String(i));
    rect.setAttribute('y', String(h - bh));
    rect.setAttribute('width', '1');
    rect.setAttribute('height', String(bh));
    rect.setAttribute('fill', '#8a7f6e');
    rect.setAttribute('fill-opacity', '0.35');
    svg.appendChild(rect);
  }
  host.appendChild(svg);
}
