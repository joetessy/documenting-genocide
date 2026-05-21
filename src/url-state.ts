export interface UrlState {
  date?: string;        // ISO YYYY-MM-DD
}

const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function parseHash(hash: string): UrlState {
  if (!hash || hash === '#') return {};
  const out: UrlState = {};
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const date = params.get('date');
  if (date && DATE_RE.test(date)) out.date = date;
  return out;
}

export function formatHash(state: UrlState): string {
  const params = new URLSearchParams();
  if (state.date) params.set('date', state.date);
  const s = params.toString();
  return s ? `#${s}` : '';
}
