import type { Map } from 'maplibre-gl';
import type { Incident } from '@shared/types';

const SOURCE_ID = 'incidents';
const LAYER_ID = 'incidents-circles';
const HOVERED_ID = 'incidents-hovered';

function toGeoJSON(incidents: Incident[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: incidents.map((i) => ({
      type: 'Feature',
      id: i.id,
      geometry: { type: 'Point', coordinates: [i.location.lon, i.location.lat] },
      properties: {
        id: i.id,
        date: i.date,
        name: i.location.name ?? '',
        killed: i.casualties.killed ?? 0,
        injured: i.casualties.injured ?? 0,
        category: i.category,
      },
    })),
  };
}

export interface MarkerLayerHandle {
  setVisibleDate(date: string): void;        // ISO YYYY-MM-DD; shows incidents on or before this date
  setHoveredId(id: string | null): void;
}

export function mountMarkers(map: Map, incidents: Incident[]): MarkerLayerHandle {
  const features = toGeoJSON(incidents);
  // Track desired filter state so we can apply it as soon as the layer exists.
  // Without this, calls before the style 'load' event silently no-op and the
  // layer ends up with the placeholder '1900-01-01' filter — no markers visible.
  let pendingDate: string | null = null;
  let pendingHoveredId: string | null = null;
  let layerReady = false;

  function applyPending(): void {
    if (pendingDate !== null && map.getLayer(LAYER_ID)) {
      map.setFilter(LAYER_ID, ['<=', ['get', 'date'], pendingDate]);
    }
    if (map.getLayer(HOVERED_ID)) {
      map.setFilter(HOVERED_ID, ['==', ['get', 'id'], pendingHoveredId ?? '']);
    }
  }

  function addSourcesAndLayers(): void {
    map.addSource(SOURCE_ID, { type: 'geojson', data: features });

    map.addLayer({
      id: LAYER_ID,
      type: 'circle',
      source: SOURCE_ID,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 3, 14, 6, 17, 9],
        'circle-color': '#e63946',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.5,
        'circle-opacity': 0.9,
      },
      // Use pendingDate if set; otherwise hide everything until the controller
      // calls setVisibleDate with a real date.
      filter: pendingDate
        ? ['<=', ['get', 'date'], pendingDate]
        : ['<=', ['get', 'date'], '1900-01-01'],
    });

    map.addLayer({
      id: HOVERED_ID,
      type: 'circle',
      source: SOURCE_ID,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 6, 14, 10, 17, 14],
        'circle-color': '#e63946',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
        'circle-opacity': 1,
      },
      filter: ['==', ['get', 'id'], pendingHoveredId ?? ''],
    });

    layerReady = true;
  }

  if (map.isStyleLoaded()) addSourcesAndLayers();
  else map.once('load', addSourcesAndLayers);

  return {
    setVisibleDate(date: string): void {
      pendingDate = date;
      if (layerReady) applyPending();
    },
    setHoveredId(id: string | null): void {
      pendingHoveredId = id;
      if (layerReady) applyPending();
    },
  };
}
