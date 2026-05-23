import type {
  DisplacementEvent,
  DisplacementType,
  SourceAttribution,
} from '../shared/types';

interface IdmcRow {
  id: string;
  latitude: string;
  longitude: string;
  role: string;
  displacement_type: string;
  qualifier: string;
  figure: string;
  displacement_start_date: string;
  locations_name: string;
  description: string;
}

const DATASET_URL = 'https://data.humdata.org/dataset/pse-idmc-idu-events';

function isInGazaBbox(lat: number, lon: number): boolean {
  return lat >= 31.20 && lat <= 31.60 && lon >= 34.20 && lon <= 34.60;
}

function parseDisplacementType(raw: string): DisplacementType | null {
  const t = raw.trim().toLowerCase();
  if (t === 'conflict') return 'conflict';
  if (t === 'disaster') return 'disaster';
  return null;
}

export function normalizeIdmcRow(row: Record<string, string>): DisplacementEvent | null {
  const r = row as unknown as IdmcRow;
  const id = (r.id ?? '').trim();
  if (id.length === 0) return null;

  // IDMC publishes both 'Recommended figure' (canonical) and 'Triangulation'
  // (a sanity-check from a second source) rows for the same event_id. We
  // keep only the canonical one to avoid double-counting.
  if ((r.role ?? '').trim() !== 'Recommended figure') return null;

  const date = (r.displacement_start_date ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const lat = Number(r.latitude);
  const lon = Number(r.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (!isInGazaBbox(lat, lon)) return null;

  const figure = Number(r.figure);
  if (!Number.isFinite(figure) || figure <= 0) return null;

  const displacement_type = parseDisplacementType(r.displacement_type ?? '');
  if (displacement_type === null) return null;

  const source: SourceAttribution = {
    org: 'idmc',
    id,
    url: DATASET_URL,
  };

  return {
    id: `idmc:${id}`,
    date,
    location: {
      lat,
      lon,
      name: (r.locations_name ?? '').trim() || undefined,
    },
    figure: Math.round(figure),
    displacement_type,
    qualifier: (r.qualifier ?? '').trim(),
    description: (r.description ?? '').trim(),
    sources: [source],
  };
}
