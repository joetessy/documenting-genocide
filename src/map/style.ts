import type { StyleSpecification, LayerSpecification } from 'maplibre-gl';

// Muted cartographic palette — warm earth tones, the design spec's editorial look.
const COLORS = {
  paper: '#f4ede0',          // background / land
  paperShadow: '#ebe2d0',    // subtle landuse tint
  water: '#c8d4dc',          // sea + waterways
  waterDeep: '#b0bdc8',      // ocean shadow
  road: '#c8b88f',           // minor road hairline
  roadMajor: '#a09176',      // primary road
  roadCasing: '#8a7f6e',     // road outline
  buildingFlat: '#dcc8a0',
  buildingLow: '#d6c08f',
  buildingMid: '#b89c70',
  buildingHigh: '#9c7d4f',
  buildingStroke: '#8a7250',
  label: '#3a3530',          // dark warm grey
  labelLight: '#6e6660',
  border: '#8a7f6e',
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
      'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.3, 17, 1.4],
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
    'source-layer': 'place',
    filter: ['in', 'class', 'city', 'town'],
    minzoom: 9,
    layout: {
      'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
      'text-font': ['Noto Sans Bold'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 9, 13, 14, 22],
      'text-anchor': 'center',
      'text-padding': 4,
    },
    paint: {
      'text-color': COLORS.label,
      'text-halo-color': COLORS.paper,
      'text-halo-width': 2.5,
    },
  },
  {
    id: 'place-neighbourhood',
    type: 'symbol',
    source: 'openmaptiles',
    'source-layer': 'place',
    filter: ['in', 'class', 'neighbourhood', 'suburb', 'village'],
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
      'text-halo-width': 1.8,
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
      'sky-color': '#d8e0d8',
      'horizon-color': '#e8e2d0',
      'fog-color': '#f4ede0',
      'fog-ground-blend': 0.6,
      'horizon-fog-blend': 0.8,
      'sky-horizon-blend': 0.6,
      'atmosphere-blend': 0.5,
    },
  };
}
