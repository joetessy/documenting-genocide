import type { Map } from 'maplibre-gl';

const SOURCE_ID = 'damage';
const LAYER_ID = 'damage-circles';

const STATUS_COLORS: Record<string, string> = {
  destroyed: '#8b1a1a',
  severe: '#d97706',
  moderate: '#eab308',
  possibly_damaged: '#9ca3af',
};

export interface DamageLayerHandle {
  setVisible(visible: boolean): void;
  setVisibleDate(date: string): void;  // ISO YYYY-MM-DD; only buildings damaged on/before this date render
}

export async function mountDamageLayer(map: Map, dataUrl: string): Promise<DamageLayerHandle> {
  let pendingDate: string | null = null;
  let pendingVisible = false;
  let layerReady = false;

  function buildFilter(date: string | null): maplibregl.FilterSpecification {
    // properties.assessment_date holds the FIRST damage date for each building.
    // Show only buildings whose first-damage date is on or before the current scrubber date.
    return ['<=', ['get', 'assessment_date'], date ?? '1900-01-01'] as unknown as maplibregl.FilterSpecification;
  }

  function applyState(): void {
    if (!map.getLayer(LAYER_ID)) return;
    map.setLayoutProperty(LAYER_ID, 'visibility', pendingVisible ? 'visible' : 'none');
    map.setFilter(LAYER_ID, buildFilter(pendingDate));
  }

  const addLayer = (): void => {
    map.addSource(SOURCE_ID, { type: 'geojson', data: dataUrl });
    map.addLayer(
      {
        id: LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        layout: { visibility: pendingVisible ? 'visible' : 'none' },
        filter: buildFilter(pendingDate),
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 0.4, 14, 1.5, 17, 3.5],
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
      // Insert below the incident layer so incident markers render on top.
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
