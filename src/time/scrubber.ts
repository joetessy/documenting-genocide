import { TimeController, formatDate, addDays } from './time-controller';

function daysBetween(start: string, end: string): number {
  const s = new Date(`${start}T00:00:00Z`).getTime();
  const e = new Date(`${end}T00:00:00Z`).getTime();
  return Math.round((e - s) / 86_400_000);
}

const ICON_PLAY = '▶';
const ICON_PAUSE = '❚❚';

export function mountScrubber(parent: HTMLElement, ctrl: TimeController): HTMLElement {
  const container = document.createElement('div');
  container.id = 'scrubber';

  const playBtn = document.createElement('button');
  playBtn.className = 'play-btn';
  playBtn.textContent = ICON_PLAY;
  playBtn.setAttribute('aria-label', 'Play timeline');

  const trackWrap = document.createElement('div');
  trackWrap.className = 'track-wrap';

  const histogramHost = document.createElement('div');
  histogramHost.id = 'histogram-host';
  trackWrap.appendChild(histogramHost);

  const track = document.createElement('input');
  track.type = 'range';
  track.min = '0';
  track.max = String(daysBetween(ctrl.start, ctrl.end));
  track.value = String(daysBetween(ctrl.start, ctrl.currentDate));
  track.setAttribute('aria-label', 'Date scrubber');
  trackWrap.appendChild(track);

  const labelWrap = document.createElement('div');
  const label = document.createElement('div');
  label.className = 'date-label';
  label.textContent = formatDate(ctrl.currentDate);
  const labelSub = document.createElement('div');
  labelSub.className = 'date-sub';
  labelSub.textContent = 'CURRENT DATE';
  labelWrap.appendChild(label);
  labelWrap.appendChild(labelSub);

  container.appendChild(playBtn);
  container.appendChild(trackWrap);
  container.appendChild(labelWrap);
  parent.appendChild(container);

  function updatePlayBtn(): void {
    if (ctrl.isPlaying) {
      playBtn.textContent = ICON_PAUSE;
      playBtn.classList.add('is-playing');
      playBtn.setAttribute('aria-label', 'Pause timeline');
    } else {
      playBtn.textContent = ICON_PLAY;
      playBtn.classList.remove('is-playing');
      playBtn.setAttribute('aria-label', 'Play timeline');
    }
  }

  // Drag track → controller.
  track.addEventListener('input', () => {
    const date = addDays(ctrl.start, Number(track.value));
    ctrl.setDate(date);
  });

  playBtn.addEventListener('click', () => {
    ctrl.togglePlay();
    updatePlayBtn();
  });

  // Mirror controller state into UI on every change.
  ctrl.onChange((date) => {
    track.value = String(daysBetween(ctrl.start, date));
    label.textContent = formatDate(date);
    if (!ctrl.isPlaying) updatePlayBtn();
  });

  document.addEventListener('keydown', (e) => {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key === ' ') {
      e.preventDefault();
      ctrl.togglePlay();
      updatePlayBtn();
    } else if (e.key === 'ArrowLeft') {
      ctrl.step(e.shiftKey ? -7 : -1);
    } else if (e.key === 'ArrowRight') {
      ctrl.step(e.shiftKey ? 7 : 1);
    }
  });

  return histogramHost;
}
