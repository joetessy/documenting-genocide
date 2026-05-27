import type { TimeController } from './time-controller';
import type { TimelineEvent } from '../data/timeline-events';

export interface TourSidePanel {
  showEventCard(ev: TimelineEvent): void;
  close(): void;
}

export interface TourNarrator {
  show(ev: TimelineEvent): void;
  hide(): void;
}

export interface TourControllerOpts {
  events: TimelineEvent[];
  timeCtrl: TimeController;
  panel: TourSidePanel;
  narrator: TourNarrator;
  // Move the map camera. Receives the event's focus (lat/lon/zoom) or `null`
  // for "reset to the default Gaza-wide view".
  cameraEaseTo: (target: { lat: number; lon: number; zoom?: number } | null) => void;
  perEventMs?: number;  // default 5500
  onStateChange?: (isPlaying: boolean) => void;
}

export class TourController {
  private events: TimelineEvent[];
  private timeCtrl: TimeController;
  private panel: TourSidePanel;
  private narrator: TourNarrator;
  private cameraEaseTo: (target: { lat: number; lon: number; zoom?: number } | null) => void;
  private perEventMs: number;
  private onStateChange?: (isPlaying: boolean) => void;
  private currentIdx = -1;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private _isPlaying = false;

  constructor(opts: TourControllerOpts) {
    this.events = [...opts.events].sort((a, b) => a.date.localeCompare(b.date));
    this.timeCtrl = opts.timeCtrl;
    this.panel = opts.panel;
    this.narrator = opts.narrator;
    this.cameraEaseTo = opts.cameraEaseTo;
    this.perEventMs = opts.perEventMs ?? 5500;
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
    this.panel.close();
    this.narrator.hide();
    this.cameraEaseTo(null);
    this._isPlaying = false;
    this.onStateChange?.(false);
  }

  toggle(): void {
    if (this._isPlaying) this.stop();
    else this.start();
  }

  private next(): void {
    this.currentIdx++;
    if (this.currentIdx >= this.events.length) {
      // After last event, sweep to the end and stop
      this.panel.close();
      this.narrator.hide();
      this.cameraEaseTo(null);
      const finalDate = this.timeCtrl.end;
      this.timeCtrl.setDate(finalDate);
      this._isPlaying = false;
      this.onStateChange?.(false);
      return;
    }
    const ev = this.events[this.currentIdx];
    this.timeCtrl.setDate(ev.date);
    // Fly to the event's focus if one is set, else reset to the wide view.
    // Gaza-wide events (ceasefires, broad offensives) intentionally have no
    // focus so the camera stays / returns to the strip-wide flat angle.
    this.cameraEaseTo(ev.focus ?? null);
    this.panel.showEventCard(ev);
    this.narrator.show(ev);
    this.timer = setTimeout(() => {
      if (!this._isPlaying) return; // cancelled
      this.next();
    }, this.perEventMs);
  }
}
