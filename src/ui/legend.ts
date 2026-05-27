export interface LegendHandle {
  open(): void;
  close(): void;
  toggle(): void;
}

export function mountLegend(parent: HTMLElement): LegendHandle {
  const btn = document.createElement('button');
  btn.id = 'legend-trigger';
  btn.type = 'button';
  btn.textContent = 'Legend';
  btn.setAttribute('aria-label', 'Show legend');
  btn.setAttribute('aria-expanded', 'false');

  const panel = document.createElement('div');
  panel.id = 'legend-panel';
  panel.setAttribute('aria-hidden', 'true');
  panel.innerHTML = `
    <div class="legend-section">
      <div class="legend-section-title">Incidents</div>
      <div class="legend-row">
        <span class="legend-swatch legend-dot" style="background:#e63946; border-color:#000;"></span>
        <span>Documented incident</span>
      </div>
      <div class="legend-row legend-row-sub">
        <span class="legend-swatch legend-dot legend-dot-sm" style="background:#e63946; border-color:#000;"></span>
        <span>&lt; 10 killed</span>
      </div>
      <div class="legend-row legend-row-sub">
        <span class="legend-swatch legend-dot legend-dot-md" style="background:#e63946; border-color:#000;"></span>
        <span>10–49 killed</span>
      </div>
      <div class="legend-row legend-row-sub">
        <span class="legend-swatch legend-dot legend-dot-lg" style="background:#e63946; border-color:#000;"></span>
        <span>50–99 killed</span>
      </div>
      <div class="legend-row legend-row-sub">
        <span class="legend-swatch legend-dot legend-dot-xl" style="background:#e63946; border-color:#000;"></span>
        <span>100+ killed</span>
      </div>
    </div>

    <div class="legend-section">
      <div class="legend-section-title">Damaged buildings (UNOSAT)</div>
      <div class="legend-row">
        <span class="legend-swatch legend-dot" style="background:#7a0e0e;"></span>
        <span>Destroyed</span>
      </div>
      <div class="legend-row">
        <span class="legend-swatch legend-dot" style="background:#c2470d;"></span>
        <span>Severely damaged</span>
      </div>
      <div class="legend-row">
        <span class="legend-swatch legend-dot" style="background:#856416;"></span>
        <span>Moderately damaged</span>
      </div>
      <div class="legend-row">
        <span class="legend-swatch legend-dot" style="background:#4a4a4a;"></span>
        <span>Possibly damaged</span>
      </div>
    </div>

    <div class="legend-section">
      <div class="legend-section-title">Civilian facilities</div>
      <div class="legend-row">
        <span class="legend-swatch legend-dot" style="background:#0891b2; border-color:#fff; box-shadow: 0 0 0 1px #888;"></span>
        <span>Health facility</span>
      </div>
      <div class="legend-row">
        <span class="legend-swatch legend-dot" style="background:#8b5cf6; border-color:#fff; box-shadow: 0 0 0 1px #888;"></span>
        <span>Education facility</span>
      </div>
    </div>

    <div class="legend-section">
      <div class="legend-section-title">Timeline</div>
      <div class="legend-row">
        <span class="legend-swatch legend-tick"></span>
        <span>Major event marker</span>
      </div>
    </div>
  `;

  parent.appendChild(btn);
  parent.appendChild(panel);

  let isOpen = false;
  function setOpen(open: boolean): void {
    isOpen = open;
    panel.classList.toggle('is-open', open);
    btn.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', String(open));
    panel.setAttribute('aria-hidden', String(!open));
  }

  btn.addEventListener('click', () => setOpen(!isOpen));

  return {
    open() { setOpen(true); },
    close() { setOpen(false); },
    toggle() { setOpen(!isOpen); },
  };
}
