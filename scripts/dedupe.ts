import type { Incident, Casualties, SourceAttribution } from '../shared/types';

export function groupKey(date: string, lat: number, lon: number): string {
  return `${date}:${lat.toFixed(3)}:${lon.toFixed(3)}`;
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

function hasAirwarsSource(inc: Incident): boolean {
  return inc.sources.some((s) => s.org === 'airwars');
}

function mergeTwo(a: Incident, b: Incident): Incident {
  const aIsAirwars = hasAirwarsSource(a);
  const bIsAirwars = hasAirwarsSource(b);
  const primary = aIsAirwars && !bIsAirwars ? a : (bIsAirwars && !aIsAirwars ? b : a);
  const secondary = primary === a ? b : a;

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
