export interface LayerToggleHandle {
  onChange(fn: (state: { incidents: boolean; damage: boolean }) => void): void;
}

export function mountLayerToggle(parent: HTMLElement): LayerToggleHandle {
  const el = document.createElement('div');
  el.id = 'layer-toggle';
  el.innerHTML = `
    <div class="lt-heading">Layers</div>
    <label><input type="checkbox" id="toggle-incidents" checked /> Incidents</label>
    <label><input type="checkbox" id="toggle-damage" checked /> Damaged buildings</label>
  `;
  parent.appendChild(el);

  const listeners: Array<(s: { incidents: boolean; damage: boolean }) => void> = [];
  const state = { incidents: true, damage: true };

  function notify(): void {
    for (const fn of listeners) fn({ ...state });
  }

  const incidentsBox = el.querySelector<HTMLInputElement>('#toggle-incidents')!;
  const damageBox = el.querySelector<HTMLInputElement>('#toggle-damage')!;
  incidentsBox.addEventListener('change', () => { state.incidents = incidentsBox.checked; notify(); });
  damageBox.addEventListener('change', () => { state.damage = damageBox.checked; notify(); });

  return {
    onChange(fn) { listeners.push(fn); },
  };
}
