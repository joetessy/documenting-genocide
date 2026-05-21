import maplibregl, { Map } from 'maplibre-gl';
import { Protocol } from 'pmtiles';

const PROTOMAPS_TILES = 'https://demo-bucket.protomaps.com/v3.pmtiles';

// Gaza Strip bounding box (a little generous so the user can pan the edges in).
// SW corner, NE corner.
const GAZA_BOUNDS: [[number, number], [number, number]] = [
  [34.20, 31.20],  // SW: south of Rafah, west of coast
  [34.60, 31.60],  // NE: north of Beit Hanoun, east of border
];

const GAZA_CENTER: [number, number] = [34.40, 31.45];

export function mountMap(container: HTMLElement): Map {
  const protocol = new Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);

  const map = new maplibregl.Map({
    container,
    style: {
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
      // Placeholder layers — Task 8 replaces with the muted cartographic style.
      layers: [
        { id: 'background', type: 'background', paint: { 'background-color': '#f4ede0' } },
        {
          id: 'water',
          type: 'fill',
          source: 'protomaps',
          'source-layer': 'water',
          paint: { 'fill-color': '#c8d4dc' },
        },
        {
          id: 'land',
          type: 'fill',
          source: 'protomaps',
          'source-layer': 'landuse',
          paint: { 'fill-color': '#dcc8a0', 'fill-opacity': 0.3 },
        },
      ],
    },
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
