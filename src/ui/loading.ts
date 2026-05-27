export interface LoadingHandle {
  setStatus(text: string): void;
  destroy(): void;
}

export function mountLoading(parent: HTMLElement): LoadingHandle {
  const el = document.createElement('div');
  el.id = 'loading';
  el.innerHTML = `
    <div class="loading-title">A geographic record of the Genocide on Gaza</div>
    <div class="loading-subtitle" id="loading-status">Loading…</div>
    <div class="loading-bar" aria-hidden="true"></div>
  `;
  parent.appendChild(el);

  let destroyed = false;
  return {
    setStatus(text) {
      const s = document.getElementById('loading-status');
      if (s) s.textContent = text;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 400);
    },
  };
}
