import type { Incident } from '@shared/types';

function formatN(n: number | null): string {
  if (n === null) return '–';
  return new Intl.NumberFormat('en-US').format(n);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

export interface TooltipHandle {
  show(incident: Incident, clientX: number, clientY: number): void;
  hide(): void;
}

export function mountTooltip(parent: HTMLElement): TooltipHandle {
  const el = document.createElement('div');
  el.id = 'tooltip';
  parent.appendChild(el);

  return {
    show(incident, clientX, clientY) {
      const dateLabel = new Date(`${incident.date}T00:00:00Z`).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      });
      const place = escapeHtml(incident.location.name ?? 'Gaza');
      const killed = incident.casualties.killed;
      const injured = incident.casualties.injured;
      const sources = incident.sources.length;
      el.innerHTML = `
        <div class="tt-date">${dateLabel}</div>
        <div class="tt-place">${place}</div>
        <div>
          ${killed !== null ? `<span class="tt-casualty is-killed">${formatN(killed)} killed</span>` : ''}
          ${killed !== null && injured !== null ? `<span class="tt-sep">·</span>` : ''}
          ${injured !== null ? `<span class="tt-casualty">${formatN(injured)} injured</span>` : ''}
        </div>
        <div class="tt-sources">${sources} ${sources === 1 ? 'source' : 'sources'}</div>
      `;
      el.style.left = `${clientX + 16}px`;
      el.style.top = `${clientY + 16}px`;
      el.style.opacity = '1';
    },
    hide() {
      el.style.opacity = '0';
    },
  };
}
