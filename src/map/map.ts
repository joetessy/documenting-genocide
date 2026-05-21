import maplibregl, { Map } from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import { gazaStyle } from './style';

const GAZA_BOUNDS: [[number, number], [number, number]] = [
  [34.20, 31.20],
  [34.60, 31.60],
];

const GAZA_CENTER: [number, number] = [34.40, 31.45];

export function mountMap(container: HTMLElement): Map {
  const protocol = new Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);

  const map = new maplibregl.Map({
    container,
    style: gazaStyle(),
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
