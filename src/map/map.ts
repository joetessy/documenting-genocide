import maplibregl, { Map, NavigationControl } from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import { gazaStyle } from './style';
import { GAZA_OUTLINE, GAZA_MASK_POLYGON } from './gaza-boundary';

// Register the pmtiles:// protocol once so the damage vector source can read
// the single-file PMTiles archive via HTTP range requests (only the visible
// tiles are fetched, instead of the whole 43MB GeoJSON up front).
const pmtilesProtocol = new Protocol();
maplibregl.addProtocol('pmtiles', pmtilesProtocol.tile);

// Tighter navigation bounds. The cream wall+mask combination hides everything
// outside Gaza, but we also keep the camera centered so the user can't lose
// the strip out of frame.
const NAV_BOUNDS: [[number, number], [number, number]] = [
  [33.70, 30.80],
  [35.10, 32.00],
];

const GAZA_CENTER: [number, number] = [34.40, 31.42];

// Warm dark charcoal for both the flat mask + the 3D "containment wall" that
// occludes anything outside Gaza when tilted. Inverts the cream/paper tones of
// the basemap so Gaza floats as a brighter island against a darker frame.
const MASK_COLOR = '#2b2826';

export function mountMap(container: HTMLElement): Map {
  const map = new maplibregl.Map({
    container,
    style: gazaStyle(),
    center: GAZA_CENTER,
    zoom: 11,
    pitch: 0,
    bearing: -15,
    maxBounds: NAV_BOUNDS,
    minZoom: 8,
    maxZoom: 18,
    maxPitch: 75,
    attributionControl: false,
    dragRotate: true,
    pitchWithRotate: true,
    touchPitch: true,
    touchZoomRotate: true,
  });

  map.addControl(
    new NavigationControl({
      visualizePitch: true,
      showCompass: true,
      showZoom: true,
    }),
    'bottom-right',
  );
  // Attribution is intentionally suppressed on the map surface (it was
  // visually obscuring content) and surfaced instead in the About modal,
  // which lists every data source plus the basemap provider.

  map.on('load', () => {
    addGazaMask(map);
    filterLabelsToGaza(map);
  });

  return map;
}

// Two-part Gaza isolation:
//
// 1) A 3D fill-extrusion "wall" that rises from -10m to 1500m outside Gaza.
//    This OCCLUDES any 3D building extrusions outside Gaza when the camera is
//    tilted — a flat 2D polygon can't do that.
//
// 2) A flat mask polygon ON TOP of labels for any 2D content (labels, symbols)
//    that the extrusion can't reach.
function addGazaMask(map: Map): void {
  map.addSource('gaza-mask', {
    type: 'geojson',
    data: { type: 'Feature', properties: {}, geometry: GAZA_MASK_POLYGON },
  });

  // 3D occlusion wall — inserted near the bottom of the layer stack so it
  // composites correctly with 3D buildings via the GPU depth buffer.
  const beforeBuildings = map.getLayer('buildings-flat') ? 'buildings-flat' : undefined;
  map.addLayer(
    {
      id: 'gaza-mask-wall',
      type: 'fill-extrusion',
      source: 'gaza-mask',
      paint: {
        'fill-extrusion-color': MASK_COLOR,
        'fill-extrusion-height': 1500,
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 1,
        'fill-extrusion-vertical-gradient': false,
      },
    },
    beforeBuildings,
  );

  // Flat mask on top for labels/symbols that render after fill-extrusion.
  map.addLayer({
    id: 'gaza-mask-fill',
    type: 'fill',
    source: 'gaza-mask',
    paint: {
      'fill-color': MASK_COLOR,
      'fill-opacity': 1,
    },
  });

  // Hairline Gaza boundary, kept very subtle so the geometry of the strip
  // reads without competing with the markers.
  map.addLayer({
    id: 'gaza-boundary-line',
    type: 'line',
    source: 'gaza-mask',
    paint: {
      'line-color': '#6c6760',
      'line-width': 0.8,
      'line-opacity': 0.5,
    },
  });
}

// Hide place labels that fall outside Gaza so the cream void isn't broken up
// by "Sderot" or "Ashkelon" floating in the corner.
function filterLabelsToGaza(map: Map): void {
  // Set the filter to the within-expression directly. MapLibre's `within`
  // operator only works in expression-format filters; combining with the
  // existing legacy filter throws "within not allowed". Since the goal is
  // strictly geographic constraint, replacing is fine.
  const gazaPolygon: GeoJSON.Polygon = { type: 'Polygon', coordinates: [GAZA_OUTLINE] };
  const withinFilter = ['within', gazaPolygon] as unknown as maplibregl.FilterSpecification;
  for (const id of ['place-city', 'place-neighbourhood']) {
    if (map.getLayer(id)) {
      try {
        map.setFilter(id, withinFilter);
      } catch {
        /* ignore */
      }
    }
  }
}
