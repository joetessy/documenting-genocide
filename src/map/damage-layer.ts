import type { Map } from 'maplibre-gl';

const SOURCE_ID = 'damage';
const LAYER_ID = 'damage-circles';

const STATUS_COLORS: Record<string, string> = {
  destroyed: '#7a0e0e',         // deep blood red — most damaged, unchanged
  severe: '#c2470d',             // brighter rust — was muted #a8430b, now more visible
  moderate: '#856416',           // brighter olive — was #6b5424, +saturation
  possibly_damaged: '#4a4a4a',   // medium-dark grey — was #5a5a5a, deeper for legibility
};

export interface DamageLayerHandle {
  setVisible(visible: boolean): void;
  setVisibleDate(date: string): void;
}

export async function mountDamageLayer(
  map: Map,
  data: GeoJSON.FeatureCollection | string,
): Promise<DamageLayerHandle> {
  let pendingDate: string | null = null;
  let pendingVisible = false;
  let layerReady = false;

  function buildFilter(date: string | null): maplibregl.FilterSpecification {
    return [
      'all',
      ['!', ['has', 'point_count']],
      ['<=', ['get', 'assessment_date'], date ?? '1900-01-01'],
    ] as unknown as maplibregl.FilterSpecification;
  }

  let rafScheduled = false;
  function applyState(): void {
    // Coalesce filter + visibility updates within a single frame. With 196K
    // features setFilter is the dominant cost; calling it more than once per
    // paint just wastes work.
    if (rafScheduled) return;
    rafScheduled = true;
    requestAnimationFrame(() => {
      rafScheduled = false;
      if (!map.getLayer(LAYER_ID)) return;
      const vis = pendingVisible ? 'visible' : 'none';
      map.setLayoutProperty(LAYER_ID, 'visibility', vis);
      if (map.getLayer('damage-clusters')) map.setLayoutProperty('damage-clusters', 'visibility', vis);
      if (map.getLayer('damage-cluster-count')) map.setLayoutProperty('damage-cluster-count', 'visibility', vis);
      map.setFilter(LAYER_ID, buildFilter(pendingDate));
    });
  }

  const addLayer = (): void => {
    map.addSource(SOURCE_ID, {
      type: 'geojson',
      data,
      cluster: true,
      clusterRadius: 28,
      clusterMaxZoom: 11,   // above this zoom, render individual features
      clusterMinPoints: 8,  // require 8+ nearby points to cluster
    });
    map.addLayer(
      {
        id: LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        layout: { visibility: pendingVisible ? 'visible' : 'none' },
        filter: buildFilter(pendingDate),
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            9, 1.4,
            11, 1.9,
            13, 2.6,
            14, 3.4,
            17, 5.5,
          ],
          'circle-blur': 0.35,
          'circle-color': [
            'match',
            ['get', 'status'],
            'destroyed', STATUS_COLORS.destroyed,
            'severe', STATUS_COLORS.severe,
            'moderate', STATUS_COLORS.moderate,
            'possibly_damaged', STATUS_COLORS.possibly_damaged,
            '#888',
          ],
          'circle-opacity': 0.7,
        },
      },
      'incidents-circles',
    );

    // Cluster bubble — larger circle sized by point_count, at zooms < 12.
    // Cluster counts include ALL features regardless of scrub date — MapLibre's
    // clustering doesn't respect feature-level filters. Acceptable for low-zoom
    // orientation; a future pass could use clusterProperties to aggregate by date.
    map.addLayer(
      {
        id: 'damage-clusters',
        type: 'circle',
        source: SOURCE_ID,
        filter: ['has', 'point_count'] as never,
        layout: { visibility: pendingVisible ? 'visible' : 'none' },
        paint: {
          'circle-color': 'rgba(122, 14, 14, 0.55)',  // muted blood red, semi-transparent
          'circle-stroke-color': 'rgba(122, 14, 14, 0.9)',
          'circle-stroke-width': 1,
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            12, 50,
            16, 200,
            22, 1000,
            30, 5000,
            42,
          ],
        },
      },
      'incidents-circles',
    );

    // Cluster count label.
    map.addLayer(
      {
        id: 'damage-cluster-count',
        type: 'symbol',
        source: SOURCE_ID,
        filter: ['has', 'point_count'] as never,
        layout: {
          visibility: pendingVisible ? 'visible' : 'none',
          'text-field': '{point_count_abbreviated}',
          'text-font': ['Noto Sans Bold'],
          'text-size': 11,
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': 'rgba(122, 14, 14, 0.6)',
          'text-halo-width': 1,
        },
      },
      'incidents-circles',
    );

    layerReady = true;
  };

  if (map.isStyleLoaded()) addLayer();
  else map.once('load', addLayer);

  return {
    setVisible(visible) {
      pendingVisible = visible;
      if (layerReady) applyState();
    },
    setVisibleDate(date) {
      pendingDate = date;
      if (layerReady) applyState();
    },
  };
}
