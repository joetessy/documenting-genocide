export interface LayerToggleHandle {
  onChange(fn: (state: { incidents: boolean; damage: boolean }) => void): void;
}

export function mountLayerToggle(parent: HTMLElement): LayerToggleHandle {
  const el = document.createElement('div');
  el.id = 'layer-toggle';
  el.style.cssText = [
    'position: absolute',
    'top: 16px',
    'left: 16px',
    'background: rgba(255, 252, 245, 0.97)',
    'border: 1px solid #8a7f6e',
    'border-radius: 6px',
    'padding: 10px 12px',
    'font-size: 13px',
    'color: #3a3530',
    'z-index: 9',
    'box-shadow: 0 2px 6px rgba(0,0,0,0.08)',
    'min-width: 180px',
  ].join(';');
  el.innerHTML = `
    <div style="text-transform:uppercase;letter-spacing:0.05em;font-size:11px;color:#6e6660;margin-bottom:6px">Layers</div>
    <label style="display:block;margin-bottom:4px;cursor:pointer">
      <input type="checkbox" id="toggle-incidents" checked> Incidents
    </label>
    <label style="display:block;cursor:pointer">
      <input type="checkbox" id="toggle-damage"> Damage assessment
    </label>
    <div style="font-size:11px;color:#6e6660;margin-top:6px;line-height:1.4">
      Damage: UNOSAT comprehensive assessment, Oct 2025
    </div>
  `;
  parent.appendChild(el);

  const listeners: Array<(s: { incidents: boolean; damage: boolean }) => void> = [];
  const state = { incidents: true, damage: false };

  function notify(): void {
    for (const fn of listeners) fn({ ...state });
  }

  const incidentsBox = document.getElementById('toggle-incidents') as HTMLInputElement;
  const damageBox = document.getElementById('toggle-damage') as HTMLInputElement;
  incidentsBox.addEventListener('change', () => { state.incidents = incidentsBox.checked; notify(); });
  damageBox.addEventListener('change', () => { state.damage = damageBox.checked; notify(); });

  return {
    onChange(fn) { listeners.push(fn); },
  };
}
