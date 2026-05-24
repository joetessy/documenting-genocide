import type { Map } from 'maplibre-gl';
import type { FacilityRecord, FacilityCategory } from '@shared/types';

const SOURCE_ID = 'facilities';
const HEALTH_LAYER_ID = 'facilities-health';
const EDUCATION_LAYER_ID = 'facilities-education';

const COLOR_HEALTH = '#0891b2';      // cyan-600
const COLOR_EDUCATION = '#8b5cf6';   // violet-500

export interface FacilityLayerHandle {
  setVisible(category: FacilityCategory, visible: boolean): void;
}

function toFeatureCollection(records: FacilityRecord[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: records.map((r) => ({
      type: 'Feature',
      id: r.id,
      geometry: { type: 'Point', coordinates: [r.location.lon, r.location.lat] },
      properties: {
        id: r.id,
        category: r.category,
        subtype: r.subtype,
      },
    })),
  };
}

export async function mountFacilityLayer(
  map: Map,
  records: FacilityRecord[],
): Promise<FacilityLayerHandle> {
  const visible: Record<FacilityCategory, boolean> = { health: false, education: false };
  let layerReady = false;

  function applyVisibility(): void {
    if (!layerReady) return;
    if (map.getLayer(HEALTH_LAYER_ID)) {
      map.setLayoutProperty(HEALTH_LAYER_ID, 'visibility', visible.health ? 'visible' : 'none');
    }
    if (map.getLayer(EDUCATION_LAYER_ID)) {
      map.setLayoutProperty(EDUCATION_LAYER_ID, 'visibility', visible.education ? 'visible' : 'none');
    }
  }

  const data = toFeatureCollection(records);

  const addLayers = (): void => {
    map.addSource(SOURCE_ID, { type: 'geojson', data });

    const paintFor = (color: string) => ({
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        10, 2.5,
        13, 4,
        17, 7,
      ] as unknown as maplibregl.DataDrivenPropertyValueSpecification<number>,
      'circle-color': color,
      'circle-stroke-width': 1.2,
      'circle-stroke-color': '#ffffff',
      'circle-opacity': 0.85,
      'circle-stroke-opacity': 0.9,
    });

    map.addLayer(
      {
        id: HEALTH_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        layout: { visibility: visible.health ? 'visible' : 'none' },
        filter: ['==', ['get', 'category'], 'health'] as unknown as maplibregl.FilterSpecification,
        paint: paintFor(COLOR_HEALTH),
      },
      'incidents-circles',
    );
    map.addLayer(
      {
        id: EDUCATION_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        layout: { visibility: visible.education ? 'visible' : 'none' },
        filter: ['==', ['get', 'category'], 'education'] as unknown as maplibregl.FilterSpecification,
        paint: paintFor(COLOR_EDUCATION),
      },
      'incidents-circles',
    );
    layerReady = true;
  };

  if (map.isStyleLoaded()) addLayers();
  else map.once('load', addLayers);

  return {
    setVisible(category, v) {
      visible[category] = v;
      applyVisibility();
    },
  };
}
