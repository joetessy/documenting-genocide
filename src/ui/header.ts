import type { BuildMeta } from '@shared/types';

export function mountHeader(parent: HTMLElement, opts: { meta: BuildMeta; incidentCount: number }): void {
  const el = document.createElement('header');
  el.id = 'header';
  const fmt = new Intl.NumberFormat('en-US');
  const damage = opts.meta.damage_count ?? 0;
  el.innerHTML = `
    <h1 class="title">The Gaza Exhibit</h1>
    <p class="subtitle">A geographic record of the war on Gaza since October 2023. Every marker is a documented incident with verifiable sources.</p>
    <div class="stats">
      <div class="stat"><strong>${fmt.format(opts.incidentCount)}</strong>Documented incidents</div>
      <div class="stat"><strong>${fmt.format(damage)}</strong>Damaged structures</div>
    </div>
  `;
  parent.appendChild(el);
}
