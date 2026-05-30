import type { TimeController } from './time-controller';
import type { TimelineEvent } from '../data/timeline-events';

export interface TourNarrator {
  show(ev: TimelineEvent): void;
  hide(): void;
}

export interface TourControllerOpts {
  events: TimelineEvent[];
  timeCtrl: TimeController;
  narrator: TourNarrator;
  // Move the map camera. Receives the event's focus (lat/lon + optional
  // zoom/pitch/bearing) or `null` for "reset to the default Gaza-wide view".
  cameraEaseTo: (target: { lat: number; lon: number; zoom?: number; pitch?: number; bearing?: number } | null) => void;
  // Show or hide the pulsing landmark ring at the focused location. Called
  // with the focus point at each tour stop, and with `null` on stop / end.
  highlightLandmark: (target: { lat: number; lon: number } | null) => void;
  perEventMs?: number;  // default 7500
  onStateChange?: (isPlaying: boolean) => void;
}

export class TourController {
  private events: TimelineEvent[];
  private timeCtrl: TimeController;
  private narrator: TourNarrator;
  private cameraEaseTo: (target: { lat: number; lon: number; zoom?: number; pitch?: number; bearing?: number } | null) => void;
  private highlightLandmark: (target: { lat: number; lon: number } | null) => void;
  private perEventMs: number;
  private onStateChange?: (isPlaying: boolean) => void;
  private currentIdx = -1;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private _isPlaying = false;

  constructor(opts: TourControllerOpts) {
    this.events = [...opts.events].sort((a, b) => a.date.localeCompare(b.date));
    this.timeCtrl = opts.timeCtrl;
    this.narrator = opts.narrator;
    this.cameraEaseTo = opts.cameraEaseTo;
    this.highlightLandmark = opts.highlightLandmark;
    this.perEventMs = opts.perEventMs ?? 7500;
    this.onStateChange = opts.onStateChange;
  }

  get isPlaying(): boolean { return this._isPlaying; }

  start(): void {
    if (this._isPlaying) return;
    // Make sure regular play isn't running concurrently
    if (this.timeCtrl.isPlaying) this.timeCtrl.pause();
    this._isPlaying = true;
    this.currentIdx = -1;
    this.onStateChange?.(true);
    this.next();
  }

  stop(): void {
    if (!this._isPlaying) return;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    this.narrator.hide();
    this.cameraEaseTo(null);
    this.highlightLandmark(null);
    this._isPlaying = false;
    this.onStateChange?.(false);
  }

  toggle(): void {
    if (this._isPlaying) this.stop();
    else this.start();
  }

  // Skip to the next event immediately (clear the auto-advance timer).
  // No-op when not playing. The internal next() handles wrap-around.
  goNext(): void {
    if (!this._isPlaying) return;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    this.next();
  }

  // Skip to the previous event immediately. Wraps to the last event when at
  // the first. No-op when not playing.
  goPrev(): void {
    if (!this._isPlaying) return;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    const n = this.events.length;
    if (n === 0) return;
    // (currentIdx - 1) mod n, then -1 so next()'s ++ lands on the target.
    this.currentIdx = ((this.currentIdx - 1 + n) % n) - 1;
    this.next();
  }

  private next(): void {
    this.currentIdx++;
    // Wrap back to the first event so the guided tour loops continuously
    // until the user stops it.
    if (this.currentIdx >= this.events.length) {
      if (this.events.length === 0) return;
      this.currentIdx = 0;
    }
    const ev = this.events[this.currentIdx];
    this.timeCtrl.setDate(ev.date);
    this.cameraEaseTo(ev.focus ?? null);
    this.highlightLandmark(ev.focus ? { lat: ev.focus.lat, lon: ev.focus.lon } : null);
    this.narrator.show(ev);
    this.timer = setTimeout(() => {
      if (!this._isPlaying) return;
      this.next();
    }, this.perEventMs);
  }
}
