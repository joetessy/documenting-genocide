import { TimeController, formatDate, addDays } from './time-controller';

function daysBetween(start: string, end: string): number {
  const s = new Date(`${start}T00:00:00Z`).getTime();
  const e = new Date(`${end}T00:00:00Z`).getTime();
  return Math.round((e - s) / 86_400_000);
}

const ICON_PLAY = '<svg viewBox="0 0 10 10" width="9" height="9" aria-hidden="true"><polygon points="2,1 2,9 9,5" fill="currentColor"/></svg>';
const ICON_PAUSE = '<svg viewBox="0 0 10 10" width="9" height="9" aria-hidden="true"><rect x="2" y="1.5" width="2" height="7" fill="currentColor"/><rect x="6" y="1.5" width="2" height="7" fill="currentColor"/></svg>';

export function mountScrubber(parent: HTMLElement, ctrl: TimeController): HTMLElement {
  const container = document.createElement('div');
  container.id = 'scrubber';

  const playBtn = document.createElement('button');
  playBtn.className = 'play-btn';
  playBtn.innerHTML = ICON_PLAY;
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

  // Custom playhead. The native range thumb is clamped inside the track, so at
  // the extremes its centre sits half-a-thumb in — misaligned from the
  // histogram (and event ticks), which span the full width. We hide the native
  // thumb (see CSS) and position this ball at the exact date fraction with a
  // translate(-50%) centre, so it lines up with the bars and ticks everywhere.
  const playhead = document.createElement('div');
  playhead.className = 'sb-playhead';
  playhead.setAttribute('aria-hidden', 'true');
  trackWrap.appendChild(playhead);

  function syncPlayhead(): void {
    const max = Number(track.max) || 1;
    playhead.style.left = `${(Number(track.value) / max) * 100}%`;
  }
  syncPlayhead();

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
      playBtn.innerHTML = ICON_PAUSE;
      playBtn.classList.add('is-playing');
      playBtn.setAttribute('aria-label', 'Pause timeline');
    } else {
      playBtn.innerHTML = ICON_PLAY;
      playBtn.classList.remove('is-playing');
      playBtn.setAttribute('aria-label', 'Play timeline');
    }
  }

  // Drag track → controller, batched to once per animation frame.
  // Without rAF batching, an `input` event during drag can fire 60-120 times
  // per second, asking MapLibre to re-filter the 196K-feature damage layer on
  // every event. The visible result is choppy filling and missed frames.
  // With batching, we only act on the LAST value within a frame.
  let rafPending = false;
  let latestValue = track.value;
  track.addEventListener('input', () => {
    latestValue = track.value;
    syncPlayhead();   // immediate visual feedback, ahead of the rAF-batched filter
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      const date = addDays(ctrl.start, Number(latestValue));
      ctrl.setDate(date);
    });
  });

  playBtn.addEventListener('click', () => {
    ctrl.togglePlay();
    updatePlayBtn();
  });

  // Mirror controller state into UI on every change.
  ctrl.onChange((date) => {
    track.value = String(daysBetween(ctrl.start, date));
    syncPlayhead();
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
