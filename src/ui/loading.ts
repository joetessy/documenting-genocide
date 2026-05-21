export interface LoadingHandle {
  setStatus(text: string): void;
  destroy(): void;
}

export function mountLoading(parent: HTMLElement): LoadingHandle {
  const el = document.createElement('div');
  el.id = 'loading';
  el.style.cssText = [
    'position: absolute',
    'inset: 0',
    'background: #f4ede0',
    'display: flex',
    'align-items: center',
    'justify-content: center',
    'flex-direction: column',
    'gap: 12px',
    'z-index: 100',
    'transition: opacity 300ms',
    'font-family: ui-sans-serif, system-ui, sans-serif',
    'color: #3a3530',
  ].join(';');
  el.innerHTML = `
    <div style="font-size:18px;font-weight:500">The Gaza Exhibit</div>
    <div id="loading-status" style="font-size:13px;color:#6e6660">Loading…</div>
  `;
  parent.appendChild(el);

  return {
    setStatus(text) {
      const s = document.getElementById('loading-status');
      if (s) s.textContent = text;
    },
    destroy() {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 300);
    },
  };
}
