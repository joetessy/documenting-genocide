import { TimeController, formatDate, addDays } from './time-controller';

function daysBetween(start: string, end: string): number {
  const s = new Date(`${start}T00:00:00Z`).getTime();
  const e = new Date(`${end}T00:00:00Z`).getTime();
  return Math.round((e - s) / 86_400_000);
}

export function mountScrubber(parent: HTMLElement, ctrl: TimeController): HTMLElement {
  const container = document.createElement('div');
  container.id = 'scrubber';
  container.style.cssText = [
    'position: absolute',
    'bottom: 16px',
    'left: 50%',
    'transform: translateX(-50%)',
    'width: min(900px, calc(100vw - 32px))',
    'background: rgba(255, 252, 245, 0.97)',
    'border: 1px solid #8a7f6e',
    'border-radius: 6px',
    'padding: 14px 18px',
    'display: grid',
    'grid-template-columns: auto 1fr auto',
    'gap: 16px',
    'align-items: center',
    'z-index: 8',
    'box-shadow: 0 2px 8px rgba(0,0,0,0.1)',
  ].join(';');

  const playBtn = document.createElement('button');
  playBtn.textContent = '▶';
  playBtn.style.cssText = 'background:none;border:1px solid #8a7f6e;color:#3a3530;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:14px';
  playBtn.setAttribute('aria-label', 'Play timeline');

  const trackWrap = document.createElement('div');
  trackWrap.style.cssText = 'position: relative; height: 32px';

  const histogramHost = document.createElement('div');
  histogramHost.id = 'histogram-host';
  histogramHost.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  trackWrap.appendChild(histogramHost);

  const track = document.createElement('input');
  track.type = 'range';
  track.min = '0';
  track.max = String(daysBetween(ctrl.start, ctrl.end));
  track.value = String(daysBetween(ctrl.start, ctrl.currentDate));
  track.style.cssText = 'width:100%;position:relative;z-index:2;cursor:pointer;accent-color:#e63946';
  track.setAttribute('aria-label', 'Date scrubber');
  trackWrap.appendChild(track);

  const label = document.createElement('div');
  label.id = 'scrubber-label';
  label.style.cssText = 'font-size:13px;font-weight:500;color:#3a3530;min-width:120px;text-align:right;font-variant-numeric:tabular-nums';
  label.textContent = formatDate(ctrl.currentDate);

  container.appendChild(playBtn);
  container.appendChild(trackWrap);
  container.appendChild(label);
  parent.appendChild(container);

  // Wire interactions.
  track.addEventListener('input', () => {
    const date = addDays(ctrl.start, Number(track.value));
    ctrl.setDate(date);
  });

  playBtn.addEventListener('click', () => {
    ctrl.togglePlay();
    playBtn.textContent = ctrl.isPlaying ? '⏸' : '▶';
  });

  // Keep the UI in sync if anything else changes the date (URL, keyboard).
  ctrl.onChange((date) => {
    track.value = String(daysBetween(ctrl.start, date));
    label.textContent = formatDate(date);
    if (!ctrl.isPlaying) playBtn.textContent = '▶';
  });

  // Keyboard shortcuts.
  document.addEventListener('keydown', (e) => {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key === ' ') {
      e.preventDefault();
      ctrl.togglePlay();
      playBtn.textContent = ctrl.isPlaying ? '⏸' : '▶';
    } else if (e.key === 'ArrowLeft') {
      ctrl.step(e.shiftKey ? -7 : -1);
    } else if (e.key === 'ArrowRight') {
      ctrl.step(e.shiftKey ? 7 : 1);
    }
  });

  return histogramHost;
}
