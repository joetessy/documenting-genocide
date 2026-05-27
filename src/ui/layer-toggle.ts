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
    <div class="lt-heading">Layers</div>
    <div class="lt-group">
      <label class="lt-row">
        <input type="checkbox" id="toggle-incidents" checked />
        <span>Incidents</span>
        <button type="button" class="lt-disclosure" id="incidents-disclosure" aria-label="Toggle category filter" aria-expanded="false">▾</button>
      </label>
      <div class="lt-subrows" id="incident-cats" hidden>${catRows}</div>
    </div>
    <label class="lt-row"><input type="checkbox" id="toggle-damage" checked /><span>Damaged buildings</span></label>
    <label class="lt-row"><input type="checkbox" id="toggle-health" /><span>Health facilities</span></label>
    <label class="lt-row"><input type="checkbox" id="toggle-education" /><span>Education facilities</span></label>
  `;
  parent.appendChild(el);

  const listeners: Array<(s: LayerToggleState) => void> = [];
  const state: LayerToggleState = {
    incidents: true,
    damage: true,
    health: false,
    education: false,
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
  const disclosure = el.querySelector<HTMLButtonElement>('#incidents-disclosure')!;
  const subrowsEl = el.querySelector<HTMLDivElement>('#incident-cats')!;

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

  disclosure.addEventListener('click', (e) => {
    e.preventDefault();
    const isOpen = subrowsEl.hidden === false;
    subrowsEl.hidden = isOpen;
    disclosure.setAttribute('aria-expanded', String(!isOpen));
    disclosure.textContent = isOpen ? '▾' : '▴';
  });

  return {
    onChange(fn) { listeners.push(fn); },
  };
}
