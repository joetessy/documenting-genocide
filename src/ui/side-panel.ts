import type { Incident, CredibilityRating, SourceOrg } from '@shared/types';

const RATING_LABELS: Record<CredibilityRating, string> = {
  fair: 'Fair',
  weak: 'Weak',
  contested: 'Contested',
  confirmed: 'Confirmed',
};

const ORG_LABEL: Record<SourceOrg, string> = {
  airwars: 'Airwars',
  acled: 'ACLED',
  ocha: 'OCHA',
  ucdp: 'UCDP',
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

function formatN(n: number | null): string {
  return n === null ? '–' : new Intl.NumberFormat('en-US').format(n);
}

export interface SidePanelHandle {
  open(incident: Incident): void;
  close(): void;
}

export function mountSidePanel(parent: HTMLElement): SidePanelHandle {
  const el = document.createElement('aside');
  el.id = 'side-panel';
  parent.appendChild(el);

  function render(incident: Incident): void {
    const dateLabel = new Date(`${incident.date}T00:00:00Z`).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    });
    const govLabel = incident.location.governorate
      ? incident.location.governorate.replace(/_/g, ' ')
      : null;

    const killed = incident.casualties.killed;
    const injured = incident.casualties.injured;
    const children = incident.casualties.killed_children;
    const women = incident.casualties.killed_women;

    const sourcesHtml = incident.sources
      .map((s) => {
        const rating = s.rating
          ? `<span class="sp-rating sp-rating-${s.rating}">${RATING_LABELS[s.rating]}</span>`
          : '';
        return `<div class="sp-source">
          <span class="sp-source-org">${ORG_LABEL[s.org] ?? s.org.toUpperCase()}</span>
          <a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.id)}</a>
          ${rating}
        </div>`;
      })
      .join('');

    const demoBits: string[] = [];
    if (children !== null && children > 0) demoBits.push(`${children} ${children === 1 ? 'child' : 'children'}`);
    if (women !== null && women > 0) demoBits.push(`${women} ${women === 1 ? 'woman' : 'women'}`);

    el.innerHTML = `
      <button class="sp-close" aria-label="Close panel">✕</button>
      <div class="sp-body">
        <div class="sp-cat">${escapeHtml(incident.category.replace(/_/g, ' '))}</div>
        <h2 class="sp-title">${escapeHtml(incident.location.name ?? 'Incident')}</h2>
        <div class="sp-meta">${dateLabel}${govLabel ? ' &middot; ' + escapeHtml(govLabel) : ''}</div>

        <div class="sp-casualties">
          <div class="sp-casualty">
            <div class="sp-casualty-n is-killed">${formatN(killed)}</div>
            <div class="sp-casualty-label">Killed</div>
          </div>
          <div class="sp-casualty">
            <div class="sp-casualty-n">${formatN(injured)}</div>
            <div class="sp-casualty-label">Injured</div>
          </div>
        </div>

        ${demoBits.length > 0
          ? `<div class="sp-demo">Including ${demoBits.join(' and ')}.</div>`
          : ''}

        <div class="sp-desc">
          ${incident.description
            .map((p) => `<p>${escapeHtml(p)}</p>`)
            .join('')}
        </div>

        <div class="sp-sources-label">Sources (${incident.sources.length})</div>
        <div class="sp-sources">${sourcesHtml}</div>
      </div>
    `;
    el.classList.add('is-open');
    el.scrollTop = 0;

    const closeBtn = el.querySelector('.sp-close');
    closeBtn?.addEventListener('click', () => el.classList.remove('is-open'));
  }

  return {
    open: render,
    close() {
      el.classList.remove('is-open');
    },
  };
}
