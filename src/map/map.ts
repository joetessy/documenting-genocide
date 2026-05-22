import maplibregl, { Map } from 'maplibre-gl';
import { GAZA_OUTLINE, GAZA_MASK_POLYGON } from './gaza-boundary';

// Generous navigation bounds. The cream mask hides everything outside Gaza
// visually, so the user can rotate/tilt/pan freely without ever seeing Israel
// or Egypt. These bounds just prevent dragging the camera into the open
// Mediterranean or somewhere far away on accident.
const NAV_BOUNDS: [[number, number], [number, number]] = [
  [33.5, 30.5],
  [35.5, 32.5],
];

const GAZA_CENTER: [number, number] = [34.40, 31.45];

// OpenFreeMap "liberty" — free vector tiles, no API key. Includes a
// `building-3d` fill-extrusion layer on the `openmaptiles` source by default.
const BASE_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

// Cream (same as our palette `land`), used to mask everything outside Gaza.
const MASK_COLOR = '#f4ede0';

export function mountMap(container: HTMLElement): Map {
  const map = new maplibregl.Map({
    container,
    style: BASE_STYLE_URL,
    center: GAZA_CENTER,
    zoom: 10.5,
    pitch: 45,           // generous tilt so 3D buildings register on first load
    bearing: 0,
    maxBounds: NAV_BOUNDS,
    minZoom: 9,
    maxZoom: 17,
    maxPitch: 70,
  });

  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

  map.on('load', () => {
    addGazaMask(map);
    softenBasemap(map);
  });

  return map;
}

// Inverse polygon: outer rectangle covers the eastern Mediterranean region,
// inner ring is Gaza's outline. The fill covers everywhere OUTSIDE Gaza in
// cream — so the only basemap visible is inside the strip.
//
// We add this on top of the OpenFreeMap style layers (no beforeId) but the
// incident/damage layers added later by main.ts go on top of this, which is
// what we want: mask covers basemap, markers render above.
function addGazaMask(map: Map): void {
  map.addSource('gaza-mask', {
    type: 'geojson',
    data: { type: 'Feature', properties: {}, geometry: GAZA_MASK_POLYGON },
  });
  map.addLayer({
    id: 'gaza-mask-fill',
    type: 'fill',
    source: 'gaza-mask',
    paint: {
      'fill-color': MASK_COLOR,
      'fill-opacity': 1,
    },
  });
  // Subtle outline along the Gaza boundary for definition.
  map.addLayer({
    id: 'gaza-boundary-line',
    type: 'line',
    source: 'gaza-mask',
    paint: {
      'line-color': '#8a7f6e',
      'line-width': 1.2,
      'line-opacity': 0.65,
    },
  });
}

// OpenFreeMap liberty's stock palette is colorful; mute the most prominent
// surface layers so the red incident markers stay the visual focal point.
function softenBasemap(map: Map): void {
  // Re-tint the background to our cream so any gaps don't flash bright.
  if (map.getLayer('background')) {
    try {
      map.setPaintProperty('background', 'background-color', MASK_COLOR);
    } catch {
      /* ignore */
    }
  }
  // Drop saturation on prominent fill layers if they exist.
  const softFills = ['park', 'landcover_wood', 'landcover_grass', 'landuse_residential', 'landuse_pitch'];
  for (const id of softFills) {
    if (map.getLayer(id)) {
      try {
        map.setPaintProperty(id, 'fill-opacity', 0.45);
      } catch {
        /* ignore */
      }
    }
  }
  // Tint buildings into the cartographic palette AND constrain them to inside Gaza.
  // A 2D mask polygon doesn't occlude 3D-extruded buildings (which rise above the
  // flat mask plane), so we filter the layer to only render features WITHIN the
  // Gaza outline polygon.
  const gazaPolygon: GeoJSON.Polygon = { type: 'Polygon', coordinates: [GAZA_OUTLINE] };
  const withinGaza: maplibregl.FilterSpecification = ['within', gazaPolygon];
  if (map.getLayer('building-3d')) {
    try {
      map.setPaintProperty('building-3d', 'fill-extrusion-color', '#d4c2a0');
      map.setPaintProperty('building-3d', 'fill-extrusion-opacity', 0.9);
      map.setFilter('building-3d', withinGaza);
    } catch {
      /* ignore */
    }
  }
  if (map.getLayer('building')) {
    try {
      map.setPaintProperty('building', 'fill-color', '#dcc8a0');
      map.setFilter('building', withinGaza);
    } catch {
      /* ignore */
    }
  }
}
