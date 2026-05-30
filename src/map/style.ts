import type { StyleSpecification, LayerSpecification } from 'maplibre-gl';

// Stamen Toner-inspired pen-and-ink palette — pure white "paper",
// black "ink" for roads/borders/buildings, near-black labels with
// white halos. High contrast so the red incident markers dominate.
const COLORS = {
  paper: '#ffffff',          // background / land — pure white
  paperShadow: '#f3f3f3',    // very subtle landuse depression (parks, etc.)
  water: '#ffffff',          // water bodies in white, defined only by their outline
  waterDeep: '#cccccc',      // thin grey outline for water
  road: '#1a1a1a',           // near-black for minor roads
  roadMajor: '#000000',      // pure black for major roads (varies in line-width too)
  roadCasing: '#000000',     // pure black casing
  buildingFlat: '#bdb8ae',     // light grey 2D fill (zoomed-in), warm cream tint
  buildingLow: '#b5b0a6',      // 3D buildings low-floor color, warm cream tint
  buildingMid: '#9d9990',      // 3D mid-floor color, warm cream tint
  buildingHigh: '#7b766d',     // 3D top-floor color (darker = deeper roof shadow), warm cream tint
  buildingStroke: '#7b766d',   // building outline, warm cream tint
  label: '#000000',          // pure black labels
  labelLight: '#3a3a3a',     // dark grey for secondary / minor labels
  border: '#000000',         // pure black for admin borders
} as const;

// OpenFreeMap serves the openmaptiles vector schema at this URL; we don't use
// their stock style — we author our own layers below.
const TILE_SOURCE_URL = 'https://tiles.openfreemap.org/planet';
const GLYPHS_URL = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';

const LAYERS: LayerSpecification[] = [
  // ── Base ─────────────────────────────────────────────────────────────────
  {
    id: 'background',
    type: 'background',
    paint: { 'background-color': COLORS.paper },
  },

  // ── Water ────────────────────────────────────────────────────────────────
  {
    id: 'water',
    type: 'fill',
    source: 'openmaptiles',
    'source-layer': 'water',
    paint: {
      'fill-color': COLORS.water,
      'fill-opacity': 0.9,
    },
  },
  {
    id: 'waterway',
    type: 'line',
    source: 'openmaptiles',
    'source-layer': 'waterway',
    paint: {
      'line-color': COLORS.waterDeep,
      'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.3, 16, 1.5],
      'line-opacity': 0.5,
    },
  },

  // ── Subtle landcover (only forested / parks, not aggressive) ─────────────
  {
    id: 'landcover-park',
    type: 'fill',
    source: 'openmaptiles',
    'source-layer': 'landcover',
    filter: ['in', 'class', 'wood', 'grass'],
    paint: {
      'fill-color': COLORS.paperShadow,
      'fill-opacity': 0.5,
    },
  },

  // ── Roads ────────────────────────────────────────────────────────────────
  {
    id: 'roads-casing-major',
    type: 'line',
    source: 'openmaptiles',
    'source-layer': 'transportation',
    filter: ['in', 'class', 'motorway', 'trunk', 'primary'],
    minzoom: 10,
    paint: {
      'line-color': COLORS.roadCasing,
      'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.2, 17, 4.5],
      'line-opacity': 0.5,
    },
  },
  {
    id: 'roads-major',
    type: 'line',
    source: 'openmaptiles',
    'source-layer': 'transportation',
    filter: ['in', 'class', 'motorway', 'trunk', 'primary'],
    minzoom: 10,
    paint: {
      'line-color': COLORS.roadMajor,
      'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.8, 17, 3],
    },
  },
  {
    id: 'roads-minor',
    type: 'line',
    source: 'openmaptiles',
    'source-layer': 'transportation',
    filter: ['in', 'class', 'secondary', 'tertiary', 'minor'],
    minzoom: 12,
    paint: {
      'line-color': COLORS.road,
      'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.8, 17, 2.5],
    },
  },
  {
    id: 'roads-service',
    type: 'line',
    source: 'openmaptiles',
    'source-layer': 'transportation',
    filter: ['in', 'class', 'service', 'pedestrian', 'path'],
    minzoom: 14,
    paint: {
      'line-color': COLORS.road,
      'line-width': ['interpolate', ['linear'], ['zoom'], 14, 0.2, 17, 0.8],
      'line-opacity': 0.7,
    },
  },

  // ── Buildings ────────────────────────────────────────────────────────────
  // Flat shapes for the printed-atlas look — visible at moderate zoom.
  {
    id: 'buildings-flat',
    type: 'fill',
    source: 'openmaptiles',
    'source-layer': 'building',
    minzoom: 13,
    paint: {
      'fill-color': COLORS.buildingFlat,
      'fill-outline-color': COLORS.buildingStroke,
      'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0.5, 15, 0.85],
    },
  },
  // 3D extrusion — OpenMapTiles often has null render_height for individual
  // buildings, so we fall back to a 6m default (~2 stories). Buildings extrude
  // smoothly in as the user zooms past z14.
  {
    id: 'buildings-3d',
    type: 'fill-extrusion',
    source: 'openmaptiles',
    'source-layer': 'building',
    minzoom: 14,
    paint: {
      'fill-extrusion-color': [
        'interpolate',
        ['linear'],
        ['coalesce', ['get', 'render_height'], ['get', 'height'], 6],
        0, COLORS.buildingLow,
        15, COLORS.buildingFlat,
        30, COLORS.buildingMid,
        60, COLORS.buildingHigh,
      ],
      'fill-extrusion-height': [
        'interpolate', ['linear'], ['zoom'],
        14, 0,
        15.5, ['coalesce', ['get', 'render_height'], ['get', 'height'], 6],
      ],
      'fill-extrusion-base': [
        'coalesce', ['get', 'render_min_height'], ['get', 'min_height'], 0,
      ],
      'fill-extrusion-opacity': 0.92,
    },
  },

  // ── Place labels (only cities/towns; no POIs, no transit, no addresses) ──
  {
    id: 'place-city',
    type: 'symbol',
    source: 'openmaptiles',
    // OSM tags several self-standing Gaza settlements as `village` (Bani
    // Suheila, Abasan, Khuza'a, some refugee-camp towns). Treat them like
    // cities/towns so all independent places render at the same size — only
    // genuine subdivisions of a city (neighbourhood/suburb) drop to the
    // smaller secondary style below.
    'source-layer': 'place',
    filter: ['in', 'class', 'city', 'town', 'village'],
    minzoom: 9,
    layout: {
      'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
      'text-font': ['Noto Sans Bold'],
      'text-size': 16,    // constant across zoom — keeps city labels consistent as you pan/zoom
      'text-anchor': 'center',
      'text-padding': 4,
    },
    paint: {
      'text-color': COLORS.label,
      'text-halo-color': COLORS.paper,
      'text-halo-width': 2.5,
      'text-halo-blur': 1,
    },
  },
  {
    id: 'place-neighbourhood',
    type: 'symbol',
    source: 'openmaptiles',
    'source-layer': 'place',
    filter: ['in', 'class', 'neighbourhood', 'suburb'],
    minzoom: 12,
    layout: {
      'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
      'text-font': ['Noto Sans Regular'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 12, 10, 16, 14],
      'text-anchor': 'center',
      'text-padding': 3,
    },
    paint: {
      'text-color': COLORS.labelLight,
      'text-halo-color': COLORS.paper,
      'text-halo-width': 3,
      'text-halo-blur': 1,
    },
  },
];

export function gazaStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: GLYPHS_URL,
    sources: {
      openmaptiles: {
        type: 'vector',
        url: TILE_SOURCE_URL,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &middot; ' +
          '<a href="https://openfreemap.org/">OpenFreeMap</a>',
      },
    },
    layers: LAYERS,
    sky: {
      'sky-color': '#2b2826',
      'horizon-color': '#3a3530',
      'fog-color': '#2b2826',
      'fog-ground-blend': 0.6,
      'horizon-fog-blend': 0.85,
      'sky-horizon-blend': 0.6,
      'atmosphere-blend': 0.5,
    },
  };
}
