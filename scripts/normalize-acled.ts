import type { Incident, IncidentCategory, SourceAttribution } from '../shared/types';

interface RawAcledRecord {
  event_id_cnty: string;
  event_date: string;
  sub_event_type?: string;
  latitude?: string;
  longitude?: string;
  location?: string;
  notes?: string;
  fatalities?: string;
  source?: string;
}

function isValidISODate(s: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(s);
}

function parseNumberOrNull(s: string | undefined): number | null {
  if (s === undefined || s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function isInGazaBbox(lat: number, lon: number): boolean {
  return lat >= 31.20 && lat <= 31.60 && lon >= 34.20 && lon <= 34.60;
}

const ACLED_TO_CATEGORY: Record<string, IncidentCategory> = {
  'Air/drone strike': 'airstrike',
  'Shelling/artillery/missile attack': 'shelling',
  'Armed clash': 'ground_op',
  'Grenade': 'shelling',
  'Remote explosive/landmine/IED': 'other',
  'Suicide bomb': 'other',
  'Arrests': 'detention',
  'Disrupted weapons use': 'other',
  'Mob violence': 'other',
  'Protest with intervention': 'other',
  'Peaceful protest': 'other',
  'Violent demonstration': 'other',
  'Attack': 'other',
  'Abduction/forced disappearance': 'detention',
  'Looting/property destruction': 'other',
  'Sexual violence': 'other',
  'Government regains territory': 'ground_op',
  'Non-state actor overtakes territory': 'ground_op',
  'Non-violent transfer of territory': 'other',
  'Change to group/activity': 'other',
  'Headquarters or base established': 'other',
  'Agreement': 'other',
  'Other': 'other',
};

export function mapAcledCategory(subEventType: string): IncidentCategory {
  return ACLED_TO_CATEGORY[subEventType] ?? 'other';
}

export function normalizeAcledRecord(raw: RawAcledRecord): Incident | null {
  if (!isValidISODate(raw.event_date)) return null;

  const lat = parseNumberOrNull(raw.latitude);
  const lon = parseNumberOrNull(raw.longitude);
  if (lat === null || lon === null) return null;
  if (!isInGazaBbox(lat, lon)) return null;

  const id = raw.event_id_cnty.trim();
  if (id.length === 0) return null;

  const source: SourceAttribution = {
    org: 'acled',
    id,
    url: `https://acleddata.com/data-export-tool/?event_id_cnty=${encodeURIComponent(id)}`,
  };

  const notes = raw.notes?.trim() ?? '';
  const description = notes.length > 0 ? [notes] : [];

  return {
    id: `acled:${id}`,
    date: raw.event_date,
    location: {
      lat,
      lon,
      name: raw.location || undefined,
    },
    category: mapAcledCategory(raw.sub_event_type ?? ''),
    casualties: {
      killed: parseNumberOrNull(raw.fatalities),
      injured: null,
      killed_children: null,
      killed_women: null,
    },
    description,
    sources: [source],
  };
}
