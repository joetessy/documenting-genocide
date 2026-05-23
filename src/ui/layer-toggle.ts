export interface LayerToggleState {
  incidents: boolean;
  damage: boolean;
  displacement: boolean;
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
    <label><input type="checkbox" id="toggle-displacement" /> Displacement</label>
  `;
  parent.appendChild(el);

  const listeners: Array<(s: LayerToggleState) => void> = [];
  const state: LayerToggleState = { incidents: true, damage: true, displacement: false };

  function notify(): void {
    for (const fn of listeners) fn({ ...state });
  }

  const incidentsBox = el.querySelector<HTMLInputElement>('#toggle-incidents')!;
  const damageBox = el.querySelector<HTMLInputElement>('#toggle-damage')!;
  const displacementBox = el.querySelector<HTMLInputElement>('#toggle-displacement')!;
  incidentsBox.addEventListener('change', () => { state.incidents = incidentsBox.checked; notify(); });
  damageBox.addEventListener('change', () => { state.damage = damageBox.checked; notify(); });
  displacementBox.addEventListener('change', () => { state.displacement = displacementBox.checked; notify(); });

  return {
    onChange(fn) { listeners.push(fn); },
  };
}
