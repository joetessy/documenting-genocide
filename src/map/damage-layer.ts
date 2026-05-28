import type { Map } from 'maplibre-gl';

const SOURCE_ID = 'damage';
const LAYER_PREFIX = 'damage-';

const STATUS_COLORS: Record<string, string> = {
  destroyed: '#7a0e0e',         // deep blood red — most damaged, unchanged
  severe: '#c2470d',             // brighter rust — was muted #a8430b, now more visible
  moderate: '#856416',           // brighter olive — was #6b5424, +saturation
  possibly_damaged: '#4a4a4a',   // medium-dark grey — was #5a5a5a, deeper for legibility
};

export interface DamageLayerHandle {
  setVisible(visible: boolean): void;
  setVisibleDate(date: string): void;
  // Layer IDs in render order — exposed so the click-priority list and the
  // z-order lift logic in main.ts can address every damage layer.
  layerIds: string[];
}

interface DamageFeatureCollection extends GeoJSON.FeatureCollection {
  features: Array<GeoJSON.Feature<GeoJSON.Point, { assessment_date: string; status?: string }>>;
}

export async function mountDamageLayer(
  map: Map,
  data: GeoJSON.FeatureCollection | string,
): Promise<DamageLayerHandle> {
  let pendingDate: string | null = null;
  let pendingVisible = false;
  let layerReady = false;

  // The OCHA UNOSAT dataset uses ~18 discrete assessment passes. Splitting the
  // single layer into one-layer-per-date lets the scrubber show/hide each pass
  // with a layout-property toggle (essentially free), instead of calling
  // setFilter on 196K features (50-300ms per scrub, plus GPU buffer rebuilds).
  // The total feature count, paint, and rendering stay the same.
  const fc = (typeof data === 'string' ? JSON.parse(data) : data) as DamageFeatureCollection;
  const dates = Array.from(
    new Set(fc.features.map((f) => f.properties?.assessment_date).filter(Boolean)),
  ).sort();
  const layerIds = dates.map((d) => `${LAYER_PREFIX}${d}`);

  const paint: maplibregl.CircleLayerSpecification['paint'] = {
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
  };

  function applyState(): void {
    if (!layerReady) return;
    for (const date of dates) {
      const lid = `${LAYER_PREFIX}${date}`;
      if (!map.getLayer(lid)) continue;
      // A layer shows if the master toggle is on AND its date is at or before
      // the scrubber. With no date set yet, hide everything (matches the
      // previous "empty until first setVisibleDate" behavior).
      const shouldShow = pendingVisible && pendingDate !== null && date <= pendingDate;
      map.setLayoutProperty(lid, 'visibility', shouldShow ? 'visible' : 'none');
    }
  }

  const addLayer = (): void => {
    map.addSource(SOURCE_ID, { type: 'geojson', data });
    for (const date of dates) {
      map.addLayer(
        {
          id: `${LAYER_PREFIX}${date}`,
          type: 'circle',
          source: SOURCE_ID,
          layout: { visibility: 'none' },
          // Fixed equality filter — evaluated once per tile at source-tile
          // time, then cached. No per-scrub work.
          filter: ['==', ['get', 'assessment_date'], date] as unknown as maplibregl.FilterSpecification,
          paint,
        },
        'incidents-circles',
      );
    }
    layerReady = true;
    applyState();
  };

  // See marker-layer.ts for the rationale on this pattern — 'load' is a
  // one-shot and may have already fired before this function runs.
  let added = false;
  const tryAdd = (): void => {
    if (added || !map.isStyleLoaded()) return;
    added = true;
    map.off('idle', tryAdd);
    addLayer();
  };
  if (map.isStyleLoaded()) tryAdd();
  else map.on('idle', tryAdd);

  return {
    setVisible(visible) {
      pendingVisible = visible;
      applyState();
    },
    setVisibleDate(date) {
      pendingDate = date;
      applyState();
    },
    layerIds,
  };
}
