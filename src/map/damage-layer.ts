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
}

export async function mountDamageLayer(map: Map, dataUrl: string): Promise<DamageLayerHandle> {
  const addLayer = (): void => {
    map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: dataUrl,
    });
    map.addLayer(
      {
        id: LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        layout: { visibility: 'none' },
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
          'circle-opacity': 0.65,
        },
      },
      // Insert below the incident layer so incidents render on top.
      'incidents-circles',
    );
  };
  if (map.isStyleLoaded()) addLayer();
  else map.once('load', addLayer);

  return {
    setVisible(visible) {
      if (map.getLayer(LAYER_ID)) {
        map.setLayoutProperty(LAYER_ID, 'visibility', visible ? 'visible' : 'none');
      }
    },
  };
}
