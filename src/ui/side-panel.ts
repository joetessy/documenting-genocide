import type { Incident, CredibilityRating, SourceOrg, DamageStatus } from '@shared/types';
import type { DamageFeature } from '../data/loader';

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
  idmc: 'IDMC',
};

const DAMAGE_CLASS_LABEL: Record<number, DamageStatus> = {
  1: 'destroyed',
  2: 'severe',
  3: 'moderate',
  4: 'possibly_damaged',
};

const DAMAGE_STATUS_LABEL: Record<DamageStatus, string> = {
  destroyed: 'Destroyed',
  severe: 'Severely damaged',
  moderate: 'Moderately damaged',
  possibly_damaged: 'Possibly damaged',
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

function formatN(n: number | null): string {
  return n === null ? '–' : new Intl.NumberFormat('en-US').format(n);
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function formatDateShort(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export interface SidePanelHandle {
  openIncident(incident: Incident): void;
  openDamage(feature: DamageFeature): void;
  close(): void;
}

export function mountSidePanel(parent: HTMLElement): SidePanelHandle {
  const el = document.createElement('aside');
  el.id = 'side-panel';
  parent.appendChild(el);

  function attachCloseHandler(): void {
    const closeBtn = el.querySelector('.sp-close');
    closeBtn?.addEventListener('click', () => el.classList.remove('is-open'));
  }

  function renderIncident(incident: Incident): void {
    const dateLabel = formatDate(incident.date);
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
          ${incident.description.map((p) => `<p>${escapeHtml(p)}</p>`).join('')}
        </div>

        <div class="sp-sources-label">Sources (${incident.sources.length})</div>
        <div class="sp-sources">${sourcesHtml}</div>
      </div>
    `;
    el.classList.add('is-open');
    el.scrollTop = 0;
    attachCloseHandler();
  }

  function renderDamage(feat: DamageFeature): void {
    const p = feat.properties;
    const status = p.status as DamageStatus;
    const statusLabel = DAMAGE_STATUS_LABEL[status] ?? p.status;
    const firstDate = formatDate(p.assessment_date);

    const progression = p.progression ?? [];
    const progressionHtml = progression.length > 1
      ? `
        <div class="sp-sources-label">Damage progression</div>
        <ol class="sp-timeline">
          ${progression.map((pass) => {
            const cls = DAMAGE_CLASS_LABEL[pass.class];
            const label = cls ? DAMAGE_STATUS_LABEL[cls] : `class ${pass.class}`;
            return `<li>
              <span class="sp-tl-date">${formatDateShort(pass.date)}</span>
              <span class="sp-tl-marker sp-tl-${cls ?? 'other'}"></span>
              <span class="sp-tl-label">${escapeHtml(label)}</span>
            </li>`;
          }).join('')}
        </ol>
      `
      : '';

    const hdxUrl = 'https://data.humdata.org/dataset/unosat-gaza-strip-comprehensive-damage-assessment-11-october-2025';

    el.innerHTML = `
      <button class="sp-close" aria-label="Close panel">✕</button>
      <div class="sp-body">
        <div class="sp-cat">Damage assessment</div>
        <h2 class="sp-title">${escapeHtml(statusLabel)}</h2>
        <div class="sp-meta">First assessed ${firstDate}${p.governorate ? ' &middot; ' + escapeHtml(p.governorate) : ''}</div>

        <div class="sp-casualties">
          <div class="sp-casualty">
            <div class="sp-casualty-n is-killed">${escapeHtml(statusLabel.split(' ')[0])}</div>
            <div class="sp-casualty-label">Latest status</div>
          </div>
          <div class="sp-casualty">
            <div class="sp-casualty-n">${progression.length}</div>
            <div class="sp-casualty-label">Sensor passes</div>
          </div>
        </div>

        <div class="sp-desc">
          <p>This building was satellite-assessed as <strong>${escapeHtml(statusLabel.toLowerCase())}</strong> by UNOSAT, the United Nations Operational Satellite Applications Programme.</p>
          <p>Records reflect interpretation of high-resolution imagery; UNOSAT notes these are preliminary, not field-validated.</p>
        </div>

        ${progressionHtml}

        <div class="sp-sources-label">Source</div>
        <div class="sp-sources">
          <div class="sp-source">
            <span class="sp-source-org">UNOSAT</span>
            <a href="${hdxUrl}" target="_blank" rel="noopener noreferrer">CDA 11 October 2025</a>
          </div>
        </div>
      </div>
    `;
    el.classList.add('is-open');
    el.scrollTop = 0;
    attachCloseHandler();
  }

  return {
    openIncident: renderIncident,
    openDamage: renderDamage,
    close() {
      el.classList.remove('is-open');
    },
  };
}
