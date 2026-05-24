export interface LayerToggleState {
  incidents: boolean;
  damage: boolean;
  health: boolean;
  education: boolean;
}

export interface LayerToggleHandle {
  onChange(fn: (state: LayerToggleState) => void): void;
}

export function mountLayerToggle(parent: HTMLElement): LayerToggleHandle {
  const el = document.createElement('div');
  el.id = 'layer-toggle';
  el.innerHTML = `
    <div class="lt-heading">Layers</div>
    <label><input type="checkbox" id="toggle-incidents" checked /> Incidents</label>
    <label><input type="checkbox" id="toggle-damage" checked /> Damaged buildings</label>
    <label><input type="checkbox" id="toggle-health" /> Health facilities</label>
    <label><input type="checkbox" id="toggle-education" /> Education facilities</label>
  `;
  parent.appendChild(el);

  const listeners: Array<(s: LayerToggleState) => void> = [];
  const state: LayerToggleState = {
    incidents: true,
    damage: true,
    health: false,
    education: false,
  };

  function notify(): void {
    for (const fn of listeners) fn({ ...state });
  }

  const incidentsBox = el.querySelector<HTMLInputElement>('#toggle-incidents')!;
  const damageBox = el.querySelector<HTMLInputElement>('#toggle-damage')!;
  const healthBox = el.querySelector<HTMLInputElement>('#toggle-health')!;
  const educationBox = el.querySelector<HTMLInputElement>('#toggle-education')!;

  incidentsBox.addEventListener('change', () => { state.incidents = incidentsBox.checked; notify(); });
  damageBox.addEventListener('change', () => { state.damage = damageBox.checked; notify(); });
  healthBox.addEventListener('change', () => { state.health = healthBox.checked; notify(); });
  educationBox.addEventListener('change', () => { state.education = educationBox.checked; notify(); });

  return {
    onChange(fn) { listeners.push(fn); },
  };
}
