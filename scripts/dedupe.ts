import type { Incident, Casualties, SourceAttribution } from '../shared/types';

// 0.0005° latitude ≈ 55m, 0.0005° longitude ≈ 47m at Gaza's latitude.
// Tighter than the original 0.001° (110m) which merged ~30% of records — too
// aggressive. With ~55m precision we surface more individually-documented
// incidents while still catching same-strike duplicates between sources.
const PRECISION = 0.0005;

function round(n: number, step: number): number {
  return Math.round(n / step) * step;
}

export function groupKey(date: string, lat: number, lon: number): string {
  const latR = round(lat, PRECISION).toFixed(4);
  const lonR = round(lon, PRECISION).toFixed(4);
  return `${date}:${latR}:${lonR}`;
}

function descriptionLength(desc: string[]): number {
  return desc.reduce((acc, p) => acc + p.length, 0);
}

function maxN(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.max(a, b);
}

function mergeCasualties(a: Casualties, b: Casualties): Casualties {
  return {
    killed: maxN(a.killed, b.killed),
    injured: maxN(a.injured, b.injured),
    killed_children: maxN(a.killed_children, b.killed_children),
    killed_women: maxN(a.killed_women, b.killed_women),
  };
}

function unionSources(a: SourceAttribution[], b: SourceAttribution[]): SourceAttribution[] {
  const seen = new Set<string>();
  const out: SourceAttribution[] = [];
  for (const s of [...a, ...b]) {
    const k = `${s.org}:${s.id}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

// Score a record on how much information it contributes. Used by mergeTwo to
// pick which of two duplicate records becomes "primary" — the one whose id,
// coordinates, location name, governorate, and category survive the merge.
// Description length, casualty granularity, and source-link count all
// contribute. Tie → first arg wins (deterministic across builds).
export function richnessScore(inc: Incident): number {
  let score = 0;

  // Description: 1 point per 100 chars, capped at 20. A 2,000-char Airwars
  // narrative gives the full 20; a 100-char UCDP headline gives 1.
  const descChars = inc.description.reduce((acc, p) => acc + p.length, 0);
  score += Math.min(20, Math.floor(descChars / 100));

  // Source URLs: 2 points each. More sources = more verifiable.
  score += inc.sources.length * 2;

  // Casualty granularity: 3 points per non-null field. A record that
  // distinguishes killed_children / killed_women from killed scores higher
  // than one that just says killed=N.
  if (inc.casualties.killed !== null) score += 3;
  if (inc.casualties.injured !== null) score += 3;
  if (inc.casualties.killed_children !== null) score += 3;
  if (inc.casualties.killed_women !== null) score += 3;

  // Place metadata.
  if (inc.location.name) score += 2;
  if (inc.location.governorate) score += 1;

  // Specific category beats the 'other' fallback.
  if (inc.category !== 'other') score += 2;

  // Credibility rating (Airwars-only field today): 5 once if any source
  // carries 'fair' or 'confirmed'.
  for (const s of inc.sources) {
    if (s.rating === 'fair' || s.rating === 'confirmed') {
      score += 5;
      break;
    }
  }

  return score;
}

function mergeTwo(a: Incident, b: Incident): Incident {
  // Higher-scoring record becomes primary. Ties (including identical
  // scores) keep `a` for determinism across re-runs.
  const aScore = richnessScore(a);
  const bScore = richnessScore(b);
  const primary = aScore >= bScore ? a : b;
  const secondary = primary === a ? b : a;

  // Description is independent: longest wins regardless of which is primary,
  // since a verbose UCDP record can carry useful narrative even if Airwars
  // is otherwise richer in metadata.
  const longerDescription =
    descriptionLength(a.description) >= descriptionLength(b.description) ? a.description : b.description;

  return {
    id: primary.id,
    date: a.date,
    location: {
      lat: primary.location.lat,
      lon: primary.location.lon,
      name: primary.location.name ?? secondary.location.name,
      governorate: primary.location.governorate ?? secondary.location.governorate,
    },
    category: primary.category !== 'other' ? primary.category : secondary.category,
    casualties: mergeCasualties(a.casualties, b.casualties),
    description: longerDescription,
    sources: unionSources(a.sources, b.sources),
  };
}

export interface DedupResult {
  incidents: Incident[];
  merges: number;
}

export function dedupeIncidents(incidents: Incident[]): DedupResult {
  const groups = new Map<string, Incident>();
  let merges = 0;
  for (const inc of incidents) {
    const key = groupKey(inc.date, inc.location.lat, inc.location.lon);
    const existing = groups.get(key);
    if (existing) {
      groups.set(key, mergeTwo(existing, inc));
      merges++;
    } else {
      groups.set(key, inc);
    }
  }
  return { incidents: [...groups.values()], merges };
}
