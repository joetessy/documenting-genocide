import type { Incident, IncidentCategory, SourceAttribution } from '../shared/types';
import { isInGazaPolygon } from '../shared/gaza-polygon';
import type { WikidataEvent } from './fetch-wikidata';

export type { WikidataEvent };

// Conflict window. Pre-Oct-7 events are not part of the Gaza war exhibit's
// timeline and are dropped here (matches the floor in build-data.ts).
const CONFLICT_START = '2023-10-07';

// Keyword → category mapping. Ordered: airstrike before shelling before
// ground_op before aid before detention, with 'other' as the fallback.
const KEYWORDS: Array<{ pattern: RegExp; category: IncidentCategory }> = [
  { pattern: /\b(airstrike|airstrikes|drone strike|bombing|aerial)\b/i, category: 'airstrike' },
  { pattern: /\b(shelling|shell|artillery|mortar|missile|rocket)\b/i, category: 'shelling' },
  { pattern: /\b(ground (raid|operation|incursion|invasion|offensive)|raid|tank|infantry)\b/i, category: 'ground_op' },
  { pattern: /\b(aid|convoy|humanitarian|food)\b/i, category: 'attack_on_aid' },
  { pattern: /\b(detention|arrest|detained|kidnapped|hostage)\b/i, category: 'detention' },
];

export function mapWikidataCategory(label: string, description: string): IncidentCategory {
  const haystack = `${label ?? ''} ${description ?? ''}`;
  for (const { pattern, category } of KEYWORDS) {
    if (pattern.test(haystack)) return category;
  }
  return 'other';
}

/** Extract the Wikipedia article title from its URL — used as the source id
 * suffix for the Wikipedia attribution. */
function wikipediaTitleSlug(url: string): string {
  try {
    const u = new URL(url);
    const m = /^\/wiki\/(.+)$/.exec(u.pathname);
    if (!m) return url;
    return decodeURIComponent(m[1]);
  } catch { return url; }
}

export function normalizeWikidataEvent(e: WikidataEvent): Incident | null {
  // Reject obvious junk first.
  const id = (e.id ?? '').trim();
  if (id.length === 0) return null;

  // Accept ISO datetime or just YYYY-MM-DD; the truncate handles both.
  const date = (e.date ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (date < CONFLICT_START) return null;

  const lat = Number(e.lat);
  const lon = Number(e.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (!isInGazaPolygon(lat, lon)) return null;

  // Build attributions. Wikidata QID is always present; the Wikipedia article
  // attribution is added when the event has one. Both share the same SourceOrg
  // (`wikidata`) since the Wikipedia text enriches the Wikidata backbone — see
  // README. The Wikidata attribution must come first so consumers can rely on
  // sources[0] being the canonical id.
  const sources: SourceAttribution[] = [];
  if (e.wikidataUrl) {
    sources.push({ org: 'wikidata', id, url: e.wikidataUrl });
  } else {
    // Fallback for category-sourced events without a QID — point at the
    // Wikipedia URL so the source still resolves.
    sources.push({ org: 'wikidata', id, url: e.wikipediaUrl ?? '' });
  }
  if (e.wikipediaUrl) {
    const slug = wikipediaTitleSlug(e.wikipediaUrl);
    sources.push({ org: 'wikidata', id: `wp:${slug}`, url: e.wikipediaUrl });
  }

  const killed = typeof e.deaths === 'number' && Number.isFinite(e.deaths) ? e.deaths : null;
  const description = (e.description ?? '').trim();
  const name = (e.label ?? '').trim();

  return {
    id: `wikidata:${id}`,
    date,
    location: {
      lat,
      lon,
      name: name.length > 0 ? name : undefined,
    },
    category: mapWikidataCategory(name, description),
    casualties: {
      killed,
      injured: null,
      killed_children: null,
      killed_women: null,
    },
    description: description.length > 0 ? [description] : [],
    sources,
  };
}
