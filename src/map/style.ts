import type { StyleSpecification, LayerSpecification } from 'maplibre-gl';

// Muted cartographic palette from the design spec.
const COLORS = {
  land: '#f4ede0',
  builtArea: '#dcc8a0',
  water: '#c8d4dc',
  border: '#8a7f6e',
  road: '#b8a785',
  roadMajor: '#9c8d6f',
  label: '#3a3530',
  labelLight: '#6e6660',
} as const;

const PROTOMAPS_TILES = 'https://demo-bucket.protomaps.com/v3.pmtiles';

const LAYERS: LayerSpecification[] = [
  { id: 'background', type: 'background', paint: { 'background-color': COLORS.land } },
  {
    id: 'landuse',
    type: 'fill',
    source: 'protomaps',
    'source-layer': 'landuse',
    paint: { 'fill-color': COLORS.builtArea, 'fill-opacity': 0.45 },
  },
  {
    id: 'water',
    type: 'fill',
    source: 'protomaps',
    'source-layer': 'water',
    paint: { 'fill-color': COLORS.water },
  },
  {
    id: 'roads-minor',
    type: 'line',
    source: 'protomaps',
    'source-layer': 'roads',
    filter: ['in', 'kind', 'minor_road', 'path'],
    paint: { 'line-color': COLORS.road, 'line-width': 0.4 },
  },
  {
    id: 'roads-major',
    type: 'line',
    source: 'protomaps',
    'source-layer': 'roads',
    filter: ['in', 'kind', 'highway', 'major_road', 'medium_road'],
    paint: { 'line-color': COLORS.roadMajor, 'line-width': 0.8 },
  },
  {
    id: 'admin-borders',
    type: 'line',
    source: 'protomaps',
    'source-layer': 'boundaries',
    paint: { 'line-color': COLORS.border, 'line-width': 0.6, 'line-dasharray': [2, 2] },
  },
  {
    id: 'place-labels',
    type: 'symbol',
    source: 'protomaps',
    'source-layer': 'places',
    minzoom: 9,
    filter: ['in', 'kind', 'city', 'town', 'locality', 'neighbourhood'],
    layout: {
      'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
      'text-font': ['Noto Sans Regular'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 9, 11, 14, 16],
      'text-anchor': 'center',
    },
    paint: {
      'text-color': COLORS.label,
      'text-halo-color': COLORS.land,
      'text-halo-width': 1.2,
    },
  },
];

export function gazaStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      protomaps: {
        type: 'vector',
        url: `pmtiles://${PROTOMAPS_TILES}`,
        attribution:
          '<a href="https://protomaps.com">Protomaps</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      },
    },
    layers: LAYERS,
  };
}
