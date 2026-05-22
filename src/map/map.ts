import maplibregl, { Map, type StyleSpecification } from 'maplibre-gl';

const GAZA_BOUNDS: [[number, number], [number, number]] = [
  [34.20, 31.20],
  [34.60, 31.60],
];

const GAZA_CENTER: [number, number] = [34.40, 31.45];

// Basemap: OpenStreetMap raster tiles. The protomaps demo PMTiles URL
// we originally targeted has been retired upstream; we fall back to OSM raster
// + a CSS desaturation filter (see #map in style.css) to retain the muted feel.
// Migration to self-hosted PMTiles or a free vector tile provider is Phase 4 polish.
function baseStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      'osm-raster': {
        type: 'raster',
        tiles: [
          'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#f4ede0' } },
      {
        id: 'osm-tiles',
        type: 'raster',
        source: 'osm-raster',
        // Mute OSM's default palette toward our cartographic-editorial aesthetic.
        // Layer-level paint props apply only to the raster, not to incident/damage
        // layers drawn on top, so the red markers stay crisp.
        paint: {
          'raster-saturation': -0.4,
          'raster-contrast': -0.05,
          'raster-opacity': 0.72,
        },
      },
    ],
  };
}

export function mountMap(container: HTMLElement): Map {
  const map = new maplibregl.Map({
    container,
    style: baseStyle(),
    center: GAZA_CENTER,
    zoom: 10,
    pitch: 30,
    bearing: 0,
    maxBounds: GAZA_BOUNDS,
    minZoom: 9,
    maxZoom: 17,
  });

  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
  return map;
}
