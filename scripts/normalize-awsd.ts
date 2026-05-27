import type { Incident, IncidentCategory, SourceAttribution } from '../shared/types';
import { isInGazaPolygon } from '../shared/gaza-polygon';

// Aid Worker Security Database row → unified Incident.
//
// AWSD records every documented attack on aid workers since 1997. For the
// Gaza exhibit we keep records inside the Gaza polygon from 2023-10-07
// onward. The full CSV ships ~600 rows for Palestine spanning 2002-2026
// including West Bank events; both are filtered out here.

const CONFLICT_START = '2023-10-07';
const AWSD_HOME_URL = 'https://www.aidworkersecurity.org/incidents';

// Header names in the AWSD CSV (verified by curl). We accept the row as
// an opaque Record because that's what the CSV parser produces, but the
// keys we rely on are listed here for documentation.
type AwsdRow = Record<string, string>;
const COL = {
  id: 'Incident ID',
  year: 'Year',
  month: 'Month',
  day: 'Day',
  city: 'City',
  district: 'District',
  region: 'Region',
  means: 'Means of attack',
  context: 'Attack context',
  location: 'Location',
  lat: 'Latitude',
  lon: 'Longitude',
  totalKilled: 'Total killed',
  totalWounded: 'Total wounded',
  totalKidnapped: 'Total kidnapped',
  totalDetained: 'Total detained',
  details: 'Details',
  actorName: 'Actor name',
  source: 'Source',
} as const;

/**
 * Map AWSD "Means of attack" + "Attack context" to a unified IncidentCategory.
 *
 * AWSD's "Means of attack" enum (observed values) covers:
 *   Aerial bombardment, Bodily assault, Detention/arrest, Kidnap-killing,
 *   Kidnapping, Other Explosives, Shelling, Shooting, Unknown.
 *
 * "Attack context" can be Ambush / Combat/Crossfire / Detention /
 * Individual attack / Mob violence / Raid / Unknown.
 *
 * We prefer the most specific mapping. Detention beats everything else
 * because the dataset's "Detention" category is uniquely meaningful — an
 * arrest is qualitatively different from an airstrike. After detention,
 * the explicit weapon keywords win over context.
 */
export function mapAwsdCategory(opts: { meansOfAttack: string; context: string }): IncidentCategory {
  const m = (opts.meansOfAttack ?? '').toLowerCase();
  const c = (opts.context ?? '').toLowerCase();

  if (m.includes('kidnap') || m.includes('detain') || m.includes('detention') || c.includes('detention')) {
    return 'detention';
  }
  if (m.includes('aerial') || m.includes('drone') || m.includes('airstrike') || m.includes('air strike')) {
    return 'airstrike';
  }
  if (m.includes('shelling') || m.includes('shell') || m.includes('missile') || m.includes('rocket')) {
    return 'shelling';
  }
  if (c.includes('ambush') || c.includes('raid')) {
    return 'ground_op';
  }
  return 'attack_on_aid';
}

function pad2(s: string): string | null {
  const n = parseInt(s, 10);
  if (!Number.isFinite(n) || n < 1 || n > 31) return null;
  return n < 10 ? `0${n}` : `${n}`;
}

function buildIsoDate(row: AwsdRow): string | null {
  const y = (row[COL.year] ?? '').trim();
  if (!/^\d{4}$/.test(y)) return null;
  const month = pad2(row[COL.month] ?? '');
  const day = pad2(row[COL.day] ?? '');
  if (!month || !day) return null;
  const iso = `${y}-${month}-${day}`;
  // Final sanity check — pad2 already validated each piece, but a
  // belt-and-braces regex guards against unexpected input.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  return iso;
}

function parseIntOrNull(s: string): number | null {
  if (s === undefined || s === null) return null;
  const trimmed = String(s).trim();
  if (trimmed.length === 0) return null;
  const n = parseInt(trimmed, 10);
  if (!Number.isFinite(n)) return null;
  return n;
}

function buildLocationName(row: AwsdRow): string | undefined {
  // Prefer the most specific non-Unknown locality available.
  const candidates = [
    row[COL.location],
    row[COL.city],
    row[COL.district],
    row[COL.region],
  ];
  for (const raw of candidates) {
    const v = (raw ?? '').trim();
    if (v.length > 0 && v.toLowerCase() !== 'unknown') return v;
  }
  return undefined;
}

export function normalizeAwsdRow(row: AwsdRow): Incident | null {
  // 1. Build ISO date and reject pre-conflict / malformed dates.
  const date = buildIsoDate(row);
  if (date === null) return null;
  if (date < CONFLICT_START) return null;

  // 2. Parse lat/lon and reject anything outside the Gaza polygon. This
  //    also drops West Bank entries that the country=PS query returns.
  const lat = Number(row[COL.lat]);
  const lon = Number(row[COL.lon]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (!isInGazaPolygon(lat, lon)) return null;

  // 3. Build ID. AWSD records have a stable numeric "Incident ID" column;
  //    fall back to a date+coord composite if a row somehow lacks one.
  const rawId = (row[COL.id] ?? '').trim();
  const id = rawId.length > 0 ? rawId : `${date}-${lat.toFixed(4)}-${lon.toFixed(4)}`;

  // 4. Casualties — every field is optional; blank cells become null.
  const killed = parseIntOrNull(row[COL.totalKilled] ?? '');
  const injured = parseIntOrNull(row[COL.totalWounded] ?? '');

  // 5. Category mapping from means/context.
  const category = mapAwsdCategory({
    meansOfAttack: row[COL.means] ?? '',
    context: row[COL.context] ?? '',
  });

  // 6. Description — AWSD ships a single English-language summary per row.
  const details = (row[COL.details] ?? '').trim();
  const description = details.length > 0 ? [details] : [];

  // 7. Source attribution. AWSD's "Source" column is a label (e.g.
  //    "Media", "Official Report") — not a URL — so we link to the public
  //    AWSD incidents page. The verbatim citation lives in the side-panel
  //    ORG_LABEL per Humanitarian Outcomes' attribution rule.
  const source: SourceAttribution = {
    org: 'awsd',
    id,
    url: AWSD_HOME_URL,
  };

  return {
    id: `awsd:${id}`,
    date,
    location: {
      lat,
      lon,
      name: buildLocationName(row),
    },
    category,
    casualties: {
      killed,
      injured,
      killed_children: null,
      killed_women: null,
    },
    description,
    sources: [source],
  };
}
