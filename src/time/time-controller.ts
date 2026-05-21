const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export function clampDate(iso: string, min: string, max: string): string {
  if (iso < min) return min;
  if (iso > max) return max;
  return iso;
}

export interface TimeControllerOptions {
  start: string;                   // ISO YYYY-MM-DD
  end: string;
  stepDaysPerSecond?: number;      // playback rate
  initialDate?: string;
}

export type DateChangeListener = (date: string) => void;

export class TimeController {
  readonly start: string;
  readonly end: string;
  readonly stepDaysPerSecond: number;
  private _currentDate: string;
  private listeners: DateChangeListener[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(opts: TimeControllerOptions) {
    this.start = opts.start;
    this.end = opts.end;
    this.stepDaysPerSecond = opts.stepDaysPerSecond ?? 3;
    this._currentDate = clampDate(opts.initialDate ?? opts.start, opts.start, opts.end);
  }

  get currentDate(): string {
    return this._currentDate;
  }

  get isPlaying(): boolean {
    return this.timer !== null;
  }

  onChange(fn: DateChangeListener): () => void {
    this.listeners.push(fn);
    return () => {
      const i = this.listeners.indexOf(fn);
      if (i >= 0) this.listeners.splice(i, 1);
    };
  }

  setDate(date: string): void {
    const clamped = clampDate(date, this.start, this.end);
    if (clamped === this._currentDate) return;
    this._currentDate = clamped;
    for (const l of this.listeners) l(clamped);
  }

  step(deltaDays: number): void {
    this.setDate(addDays(this._currentDate, deltaDays));
  }

  play(): void {
    if (this.timer !== null) return;
    const tickMs = 100;
    const daysPerTick = (this.stepDaysPerSecond * tickMs) / 1000;
    let accumulator = 0;
    this.timer = setInterval(() => {
      accumulator += daysPerTick;
      const stepN = Math.floor(accumulator);
      if (stepN < 1) return;
      accumulator -= stepN;
      const next = addDays(this._currentDate, stepN);
      this.setDate(next);
      if (this._currentDate === this.end) this.pause();
    }, tickMs);
  }

  pause(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  togglePlay(): void {
    if (this.isPlaying) this.pause();
    else this.play();
  }
}
