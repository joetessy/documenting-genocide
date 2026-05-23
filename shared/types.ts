// Unified types shared between build scripts and client.
// The Incident type is the lingua franca: every source (Airwars now,
// ACLED/OCHA later) normalizes into this shape.

export type Governorate =
  | 'gaza_city'
  | 'north_gaza'
  | 'deir_al_balah'
  | 'khan_younis'
  | 'rafah';

export type IncidentCategory =
  | 'airstrike'
  | 'shelling'
  | 'ground_op'
  | 'attack_on_aid'
  | 'detention'
  | 'other';

export type SourceOrg = 'airwars' | 'acled' | 'ocha' | 'ucdp' | 'idmc';

export type CredibilityRating = 'fair' | 'weak' | 'contested' | 'confirmed';

export interface SourceAttribution {
  org: SourceOrg;
  id: string;
  url: string;
  rating?: CredibilityRating;
}

export type DamageStatus = 'destroyed' | 'severe' | 'moderate' | 'possibly_damaged';

export interface DamageRecord {
  id: string;
  location: { lat: number; lon: number };
  status: DamageStatus;
  assessment_date: string;      // ISO YYYY-MM-DD
  source: { org: 'ocha'; url: string };
}

export interface Casualties {
  killed: number | null;
  injured: number | null;
  killed_children: number | null;
  killed_women: number | null;
}

export interface IncidentLocation {
  lat: number;
  lon: number;
  name?: string;
  governorate?: Governorate;
}

export interface Incident {
  id: string;
  date: string;          // ISO YYYY-MM-DD
  location: IncidentLocation;
  category: IncidentCategory;
  casualties: Casualties;
  description: string[];  // Array of paragraphs. Phase 1 sources may produce a single-element array.
  sources: SourceAttribution[];
}

export type DisplacementType = 'conflict' | 'disaster';

export interface DisplacementEvent {
  id: string;                         // e.g. 'idmc:246143'
  date: string;                       // ISO YYYY-MM-DD — displacement_start_date
  location: {
    lat: number;
    lon: number;
    name?: string;                    // e.g. 'Gaza Strip, Palestinian Territories'
  };
  figure: number;                     // people displaced
  displacement_type: DisplacementType;
  qualifier: string;                  // 'total', 'more than or equal to', etc — raw IDMC qualifier text
  description: string;                // single paragraph from IDMC `description` field
  sources: SourceAttribution[];
}

export interface BuildMeta {
  build_date: string;          // ISO datetime
  source_counts: Partial<Record<SourceOrg, number>>;
  dedup_merges: number;
  unplotted_count: number;     // records discarded for missing coordinates
  damage_count?: number;
  displacement_count?: number;
}
