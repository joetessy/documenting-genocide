import maplibregl, { Map } from 'maplibre-gl';
import { gazaStyle } from './style';
import { GAZA_MASK_POLYGON } from './gaza-boundary';

// Generous navigation bounds. The cream mask hides everything outside Gaza
// visually, so the user can rotate/tilt/pan freely without ever seeing Israel
// or Egypt. These bounds just prevent dragging the camera into the open
// Mediterranean or somewhere far away on accident.
const NAV_BOUNDS: [[number, number], [number, number]] = [
  [33.5, 30.5],
  [35.5, 32.5],
];

const GAZA_CENTER: [number, number] = [34.40, 31.45];

// Cream (same as our palette `paper`), used to mask everything outside Gaza.
const MASK_COLOR = '#f4ede0';

export function mountMap(container: HTMLElement): Map {
  const map = new maplibregl.Map({
    container,
    style: gazaStyle(),
    center: GAZA_CENTER,
    zoom: 11,
    pitch: 50,           // generous tilt so 3D buildings register on first load
    bearing: -15,        // slight angle for a less head-on, more inhabited feel
    maxBounds: NAV_BOUNDS,
    minZoom: 9,
    maxZoom: 18,
    maxPitch: 75,
  });

  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
  map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

  map.on('load', () => {
    addGazaMask(map);
  });

  return map;
}

// Inverse polygon: outer rectangle covers the eastern Mediterranean region,
// inner ring is Gaza's outline. The fill covers everywhere OUTSIDE Gaza in
// cream — so the only basemap visible is inside the strip. The cream covers
// flat ground content (roads, water, parks); buildings poking up via 3D
// extrusion past the Gaza boundary remain visible from the side, which we
// accept as an acceptable visual compromise (the user is centred on Gaza).
function addGazaMask(map: Map): void {
  map.addSource('gaza-mask', {
    type: 'geojson',
    data: { type: 'Feature', properties: {}, geometry: GAZA_MASK_POLYGON },
  });
  // Insert the mask just BEFORE the buildings-flat layer so that:
  //   - all the ground content (water, roads, landcover) outside Gaza is masked
  //   - buildings inside Gaza still draw on top (visible)
  // If the buildings-flat layer isn't present yet, fall back to default (top).
  const beforeId = map.getLayer('buildings-flat') ? 'buildings-flat' : undefined;
  map.addLayer(
    {
      id: 'gaza-mask-fill',
      type: 'fill',
      source: 'gaza-mask',
      paint: {
        'fill-color': MASK_COLOR,
        'fill-opacity': 1,
      },
    },
    beforeId,
  );
  // Subtle boundary line along Gaza's edge. Rendered on top of mask + buildings.
  map.addLayer({
    id: 'gaza-boundary-line',
    type: 'line',
    source: 'gaza-mask',
    paint: {
      'line-color': '#8a7f6e',
      'line-width': 1.4,
      'line-opacity': 0.7,
    },
  });
}
