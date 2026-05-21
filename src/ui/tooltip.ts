import type { Incident } from '@shared/types';

const TT_ID = 'tooltip';

function formatCount(n: number | null): string {
  if (n === null) return '–';
  return String(n);
}

export interface TooltipHandle {
  show(incident: Incident, clientX: number, clientY: number): void;
  hide(): void;
}

export function mountTooltip(parent: HTMLElement): TooltipHandle {
  const el = document.createElement('div');
  el.id = TT_ID;
  el.style.cssText = [
    'position: absolute',
    'pointer-events: none',
    'background: rgba(255, 252, 245, 0.97)',
    'border: 1px solid #8a7f6e',
    'border-radius: 4px',
    'padding: 8px 10px',
    'font-size: 12px',
    'line-height: 1.4',
    'color: #3a3530',
    'box-shadow: 0 2px 8px rgba(0,0,0,0.15)',
    'max-width: 260px',
    'z-index: 10',
    'opacity: 0',
    'transition: opacity 120ms',
  ].join(';');
  parent.appendChild(el);

  return {
    show(incident, clientX, clientY) {
      el.innerHTML = `
        <div style="font-weight: 600">${incident.date}</div>
        <div>${incident.location.name ?? incident.location.governorate ?? 'Gaza'}</div>
        <div style="margin-top: 4px">
          Killed: ${formatCount(incident.casualties.killed)} · Injured: ${formatCount(incident.casualties.injured)}
        </div>
        <div style="margin-top: 4px; color: #6e6660">${incident.sources.length} source${incident.sources.length === 1 ? '' : 's'}</div>
      `;
      el.style.left = `${clientX + 14}px`;
      el.style.top = `${clientY + 14}px`;
      el.style.opacity = '1';
    },
    hide() {
      el.style.opacity = '0';
    },
  };
}
