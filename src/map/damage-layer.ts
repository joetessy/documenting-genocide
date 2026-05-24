import type { Map } from 'maplibre-gl';

const SOURCE_ID = 'damage';
const LAYER_ID = 'damage-circles';

const STATUS_COLORS: Record<string, string> = {
  destroyed: '#8b1a1a',
  severe: '#d97706',
  moderate: '#eab308',
  possibly_damaged: '#9ca3af',
};

const VISIBLE_OPACITY = 0.7;
const TRANSITION_MS = 200;

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

  function buildOpacityExpr(date: string | null): maplibregl.DataDrivenPropertyValueSpecification<number> {
    // Features become opaque (0.7) the moment the scrub date crosses their
    // assessment_date. Because this is a paint-property change rather than a
    // filter change, MapLibre's circle-opacity-transition kicks in and the
    // dots fade in/out smoothly over TRANSITION_MS.
    return [
      'case',
      ['<=', ['get', 'assessment_date'], date ?? '1900-01-01'],
      VISIBLE_OPACITY,
      0,
    ] as unknown as maplibregl.DataDrivenPropertyValueSpecification<number>;
  }

  let rafScheduled = false;
  function applyState(): void {
    // Coalesce updates across a frame. With 196K features each
    // setPaintProperty re-evaluates the expression per feature, so never call
    // it more than once per paint.
    if (rafScheduled) return;
    rafScheduled = true;
    requestAnimationFrame(() => {
      rafScheduled = false;
      if (!map.getLayer(LAYER_ID)) return;
      map.setLayoutProperty(LAYER_ID, 'visibility', pendingVisible ? 'visible' : 'none');
      map.setPaintProperty(LAYER_ID, 'circle-opacity', buildOpacityExpr(pendingDate));
    });
  }

  const addLayer = (): void => {
    map.addSource(SOURCE_ID, { type: 'geojson', data });
    map.addLayer(
      {
        id: LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        layout: { visibility: pendingVisible ? 'visible' : 'none' },
        paint: {
          // Larger radii (above 1px at every zoom) so the GPU doesn't antialias
          // dots into nothing — that was the cause of the "in and out at random"
          // flicker the user saw at default zoom.
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            9, 1.4,
            11, 1.9,
            13, 2.6,
            14, 3.4,
            17, 5.5,
          ],
          'circle-blur': 0.35,        // soft watercolor edge — overlapping dots blend
          'circle-color': [
            'match',
            ['get', 'status'],
            'destroyed', STATUS_COLORS.destroyed,
            'severe', STATUS_COLORS.severe,
            'moderate', STATUS_COLORS.moderate,
            'possibly_damaged', STATUS_COLORS.possibly_damaged,
            '#888',
          ],
          'circle-opacity': buildOpacityExpr(pendingDate),
        },
      },
      'incidents-circles',
    );
    // Apply opacity transition via setPaintProperty (the TS types reject
    // transition keys inside the initial paint block, but the runtime accepts).
    map.setPaintProperty(LAYER_ID, 'circle-opacity-transition' as never, { duration: TRANSITION_MS } as never);
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
