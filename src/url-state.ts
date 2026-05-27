export interface HashState {
  date?: string;        // ISO YYYY-MM-DD
  incident?: string;
}

// Kept as an alias so existing imports of UrlState don't break.
export type UrlState = HashState;

const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function parseHash(hash: string): HashState {
  const out: HashState = {};
  if (!hash || hash === '#') return out;
  const trimmed = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(trimmed);
  const date = params.get('date');
  const incident = params.get('incident');
  if (date && DATE_RE.test(date)) out.date = date;
  if (incident && incident.length > 0 && incident.length < 200) out.incident = incident;
  return out;
}

export function formatHash(state: HashState): string {
  const parts: string[] = [];
  if (state.date) parts.push(`date=${encodeURIComponent(state.date)}`);
  if (state.incident) parts.push(`incident=${encodeURIComponent(state.incident)}`);
  return parts.length === 0 ? '' : `#${parts.join('&')}`;
}
