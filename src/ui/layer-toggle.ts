export type IncidentCategoryFilter = 'airstrike' | 'shelling' | 'ground_op' | 'attack_on_aid' | 'detention' | 'other';

export interface LayerToggleState {
  incidents: boolean;
  damage: boolean;
  health: boolean;
  education: boolean;
  incidentCategories: Record<IncidentCategoryFilter, boolean>;
}

export interface LayerToggleHandle {
  onChange(fn: (state: LayerToggleState) => void): void;
}

const CATEGORY_LABELS: Record<IncidentCategoryFilter, string> = {
  airstrike: 'Airstrike',
  shelling: 'Shelling',
  ground_op: 'Ground op',
  attack_on_aid: 'Attack on aid',
  detention: 'Detention',
  other: 'Other',
};

export function mountLayerToggle(parent: HTMLElement): LayerToggleHandle {
  const el = document.createElement('div');
  el.id = 'layer-toggle';

  const catRows = (Object.keys(CATEGORY_LABELS) as IncidentCategoryFilter[]).map((k) =>
    `<label class="lt-subrow">
       <input type="checkbox" id="toggle-cat-${k}" checked />
       <span>${CATEGORY_LABELS[k]}</span>
     </label>`
  ).join('');

  el.innerHTML = `
    <button type="button" class="lt-heading" id="lt-collapse" aria-expanded="true" aria-controls="lt-body">
      <span class="lt-heading-label">Layers &amp; legend</span>
      <span class="lt-heading-caret" aria-hidden="true">▾</span>
    </button>

    <div class="lt-body" id="lt-body">
      <div class="lt-group">
        <label class="lt-row">
          <input type="checkbox" id="toggle-incidents" checked />
          <span class="lt-swatch lt-swatch-incidents" aria-hidden="true"></span>
          <span class="lt-label">Incidents</span>
          <button type="button" class="lt-disclosure" id="incidents-disclosure" aria-label="Toggle incident type filters" aria-expanded="false">▾</button>
        </label>
        <div class="lt-tier-block" aria-label="Marker size by people killed">
          <div class="lt-tier-col"><span class="lt-tier-dot lt-tier-dot-1"></span><span class="lt-tier-num">&lt;10</span></div>
          <div class="lt-tier-col"><span class="lt-tier-dot lt-tier-dot-2"></span><span class="lt-tier-num">10–49</span></div>
          <div class="lt-tier-col"><span class="lt-tier-dot lt-tier-dot-3"></span><span class="lt-tier-num">50–99</span></div>
          <div class="lt-tier-col"><span class="lt-tier-dot lt-tier-dot-4"></span><span class="lt-tier-num">100+</span></div>
        </div>
        <div class="lt-detail" id="incident-cats" hidden>
          <div class="lt-detail-title">By type</div>
          ${catRows}
        </div>
      </div>

      <div class="lt-group">
        <label class="lt-row">
          <input type="checkbox" id="toggle-damage" checked />
          <span class="lt-swatch lt-swatch-damage" aria-hidden="true"></span>
          <span class="lt-label">Damaged buildings</span>
          <button type="button" class="lt-disclosure" id="damage-disclosure" aria-label="Toggle damage palette" aria-expanded="false">▾</button>
        </label>
        <div class="lt-detail" id="damage-detail" hidden>
          <div class="lt-status-row"><span class="lt-status-dot" style="background:#7a0e0e"></span><span>Destroyed</span></div>
          <div class="lt-status-row"><span class="lt-status-dot" style="background:#c2470d"></span><span>Severely damaged</span></div>
          <div class="lt-status-row"><span class="lt-status-dot" style="background:#856416"></span><span>Moderately damaged</span></div>
          <div class="lt-status-row"><span class="lt-status-dot" style="background:#4a4a4a"></span><span>Possibly damaged</span></div>
        </div>
      </div>

      <label class="lt-row">
        <input type="checkbox" id="toggle-health" checked />
        <span class="lt-swatch lt-swatch-health" aria-hidden="true"></span>
        <span class="lt-label">Health facilities</span>
      </label>
      <label class="lt-row">
        <input type="checkbox" id="toggle-education" checked />
        <span class="lt-swatch lt-swatch-education" aria-hidden="true"></span>
        <span class="lt-label">Education facilities</span>
      </label>

      <div class="lt-footnote">
        <span class="lt-tick" aria-hidden="true"></span>
        <span>Major event marker (on timeline)</span>
      </div>

      <div class="lt-controls">
        <div class="lt-controls-title">Controls</div>
        <ul class="lt-controls-list">
          <li><span class="lt-controls-key">Drag</span> to pan</li>
          <li><span class="lt-controls-key">Scroll</span> to zoom</li>
          <li><span class="lt-controls-key">Ctrl + drag</span> to rotate / tilt</li>
        </ul>
      </div>
    </div>
  `;
  parent.appendChild(el);

  const listeners: Array<(s: LayerToggleState) => void> = [];
  const state: LayerToggleState = {
    incidents: true,
    damage: true,
    health: true,
    education: true,
    incidentCategories: {
      airstrike: true,
      shelling: true,
      ground_op: true,
      attack_on_aid: true,
      detention: true,
      other: true,
    },
  };

  function notify(): void {
    for (const fn of listeners) fn({ ...state, incidentCategories: { ...state.incidentCategories } });
  }

  const incidentsBox = el.querySelector<HTMLInputElement>('#toggle-incidents')!;
  const damageBox = el.querySelector<HTMLInputElement>('#toggle-damage')!;
  const healthBox = el.querySelector<HTMLInputElement>('#toggle-health')!;
  const educationBox = el.querySelector<HTMLInputElement>('#toggle-education')!;
  const incidentsDisclosure = el.querySelector<HTMLButtonElement>('#incidents-disclosure')!;
  const incidentsDetail = el.querySelector<HTMLDivElement>('#incident-cats')!;
  const damageDisclosure = el.querySelector<HTMLButtonElement>('#damage-disclosure')!;
  const damageDetail = el.querySelector<HTMLDivElement>('#damage-detail')!;

  incidentsBox.addEventListener('change', () => { state.incidents = incidentsBox.checked; notify(); });
  damageBox.addEventListener('change', () => { state.damage = damageBox.checked; notify(); });
  healthBox.addEventListener('change', () => { state.health = healthBox.checked; notify(); });
  educationBox.addEventListener('change', () => { state.education = educationBox.checked; notify(); });

  for (const k of Object.keys(CATEGORY_LABELS) as IncidentCategoryFilter[]) {
    const box = el.querySelector<HTMLInputElement>(`#toggle-cat-${k}`)!;
    box.addEventListener('change', () => {
      state.incidentCategories[k] = box.checked;
      notify();
    });
  }

  function wireDisclosure(btn: HTMLButtonElement, panel: HTMLDivElement): void {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const isOpen = panel.hidden === false;
      panel.hidden = isOpen;
      btn.setAttribute('aria-expanded', String(!isOpen));
      btn.textContent = isOpen ? '▾' : '▴';
    });
  }
  wireDisclosure(incidentsDisclosure, incidentsDetail);
  wireDisclosure(damageDisclosure, damageDetail);

  // Collapse the whole panel to just the heading when the user clicks it.
  const collapseBtn = el.querySelector<HTMLButtonElement>('#lt-collapse')!;
  const body = el.querySelector<HTMLDivElement>('#lt-body')!;
  const caret = collapseBtn.querySelector<HTMLSpanElement>('.lt-heading-caret')!;
  collapseBtn.addEventListener('click', () => {
    const isOpen = !el.classList.contains('is-collapsed');
    el.classList.toggle('is-collapsed', isOpen);
    collapseBtn.setAttribute('aria-expanded', String(!isOpen));
    body.hidden = isOpen;
    caret.textContent = isOpen ? '▸' : '▾';
  });

  return {
    onChange(fn) { listeners.push(fn); },
  };
}
