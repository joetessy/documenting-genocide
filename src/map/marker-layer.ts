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
      filter: ['<=', ['get', 'date'], '1900-01-01'],  // initially hide everything
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
      filter: ['==', ['get', 'id'], ''],
    });
  }

  if (map.isStyleLoaded()) addSourcesAndLayers();
  else map.once('load', addSourcesAndLayers);

  return {
    setVisibleDate(date: string): void {
      if (map.getLayer(LAYER_ID)) {
        map.setFilter(LAYER_ID, ['<=', ['get', 'date'], date]);
      }
    },
    setHoveredId(id: string | null): void {
      if (map.getLayer(HOVERED_ID)) {
        map.setFilter(HOVERED_ID, ['==', ['get', 'id'], id ?? '']);
      }
    },
  };
}
