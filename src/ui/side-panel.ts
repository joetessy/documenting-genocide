import type { Incident, CredibilityRating } from '@shared/types';

const RATING_LABELS: Record<CredibilityRating, string> = {
  fair: 'Fair',
  weak: 'Weak',
  contested: 'Contested',
  confirmed: 'Confirmed',
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

function formatCasualtyLine(killed: number | null, injured: number | null): string {
  const parts: string[] = [];
  if (killed !== null) parts.push(`${killed} killed`);
  if (injured !== null) parts.push(`${injured} injured`);
  return parts.length > 0 ? parts.join(' · ') : 'Casualty figures unavailable';
}

export interface SidePanelHandle {
  open(incident: Incident): void;
  close(): void;
}

export function mountSidePanel(parent: HTMLElement): SidePanelHandle {
  const el = document.createElement('aside');
  el.id = 'side-panel';
  el.style.cssText = [
    'position: absolute',
    'top: 16px',
    'right: 16px',
    'width: 360px',
    'max-height: calc(100vh - 32px)',
    'overflow-y: auto',
    'background: rgba(255, 252, 245, 0.98)',
    'border: 1px solid #8a7f6e',
    'border-radius: 6px',
    'padding: 20px',
    'font-size: 14px',
    'color: #3a3530',
    'box-shadow: 0 4px 16px rgba(0,0,0,0.15)',
    'transform: translateX(calc(100% + 24px))',
    'transition: transform 200ms ease',
    'z-index: 9',
  ].join(';');
  parent.appendChild(el);

  return {
    open(incident) {
      const subBits: string[] = [incident.date];
      if (incident.location.governorate) subBits.push(incident.location.governorate.replace(/_/g, ' '));

      const sourcesHtml = incident.sources
        .map((s) => {
          const rating = s.rating ? ` <span style="color:#6e6660">(rated: ${RATING_LABELS[s.rating]})</span>` : '';
          const label = s.org === 'airwars' ? `Airwars ${escapeHtml(s.id)}` : `${s.org.toUpperCase()} ${escapeHtml(s.id)}`;
          return `<li><a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer" style="color:#3a3530">${label}</a>${rating}</li>`;
        })
        .join('');

      const children = incident.casualties.killed_children;
      const women = incident.casualties.killed_women;
      const demoLine: string[] = [];
      if (children !== null) demoLine.push(`${children} ${children === 1 ? 'child' : 'children'}`);
      if (women !== null) demoLine.push(`${women} ${women === 1 ? 'woman' : 'women'}`);

      el.innerHTML = `
        <button id="side-panel-close" style="position:absolute;top:12px;right:12px;background:none;border:none;font-size:20px;cursor:pointer;color:#6e6660">×</button>
        <div style="text-transform:uppercase;letter-spacing:0.05em;font-size:11px;color:#6e6660;margin-bottom:4px">${escapeHtml(incident.category.replace(/_/g, ' '))}</div>
        <h2 style="margin:0 0 4px 0;font-size:18px;font-weight:600">${escapeHtml(incident.location.name ?? 'Incident')}</h2>
        <div style="color:#6e6660;font-size:13px;margin-bottom:16px">${subBits.join(' · ')}</div>
        <div style="margin-bottom:16px;font-size:15px;font-weight:500">${formatCasualtyLine(incident.casualties.killed, incident.casualties.injured)}</div>
        ${demoLine.length > 0 ? `<div style="margin-bottom:16px;font-size:13px;color:#6e6660">Including ${demoLine.join(', ')}</div>` : ''}
        <div style="margin-bottom:16px;line-height:1.5">${incident.description.map((p) => `<p style="margin:0 0 8px 0">${escapeHtml(p)}</p>`).join('')}</div>
        <div style="text-transform:uppercase;letter-spacing:0.05em;font-size:11px;color:#6e6660;margin-bottom:6px">Sources (${incident.sources.length})</div>
        <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.6">${sourcesHtml}</ul>
      `;
      el.style.transform = 'translateX(0)';
      const closeBtn = document.getElementById('side-panel-close');
      closeBtn?.addEventListener('click', () => {
        el.style.transform = 'translateX(calc(100% + 24px))';
      });
    },
    close() {
      el.style.transform = 'translateX(calc(100% + 24px))';
    },
  };
}
