import type { Map } from 'maplibre-gl';
import type { DisplacementEvent } from '@shared/types';

const SOURCE_ID = 'displacement';
const LAYER_ID = 'displacement-circles';

const COLOR_CONFLICT = '#0f766e';   // teal-700
const COLOR_DISASTER = '#a16207';   // amber-700

export interface DisplacementLayerHandle {
  setVisible(visible: boolean): void;
  setVisibleDate(date: string): void;
}

function toFeatureCollection(events: DisplacementEvent[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: events.map((e) => ({
      type: 'Feature',
      id: e.id,
      geometry: { type: 'Point', coordinates: [e.location.lon, e.location.lat] },
      properties: {
        id: e.id,
        date: e.date,
        figure: e.figure,
        displacement_type: e.displacement_type,
      },
    })),
  };
}

export async function mountDisplacementLayer(
  map: Map,
  events: DisplacementEvent[],
): Promise<DisplacementLayerHandle> {
  let pendingDate: string | null = null;
  let pendingVisible = false;
  let layerReady = false;

  function buildFilter(date: string | null): maplibregl.FilterSpecification {
    return ['<=', ['get', 'date'], date ?? '1900-01-01'] as unknown as maplibregl.FilterSpecification;
  }

  let rafScheduled = false;
  function applyState(): void {
    if (rafScheduled) return;
    rafScheduled = true;
    requestAnimationFrame(() => {
      rafScheduled = false;
      if (!map.getLayer(LAYER_ID)) return;
      map.setLayoutProperty(LAYER_ID, 'visibility', pendingVisible ? 'visible' : 'none');
      map.setFilter(LAYER_ID, buildFilter(pendingDate));
    });
  }

  const data = toFeatureCollection(events);

  const addLayer = (): void => {
    map.addSource(SOURCE_ID, { type: 'geojson', data });
    map.addLayer(
      {
        id: LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        layout: { visibility: pendingVisible ? 'visible' : 'none' },
        filter: buildFilter(pendingDate),
        paint: {
          // Scale radius by sqrt(figure) so area is proportional to people displaced.
          // Clamp so a 1-person event is still visible and a 100k-person event doesn't dwarf the strip.
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            9,  ['max', 3, ['min', 22, ['*', 0.04, ['sqrt', ['get', 'figure']]]]],
            13, ['max', 5, ['min', 36, ['*', 0.07, ['sqrt', ['get', 'figure']]]]],
            17, ['max', 8, ['min', 60, ['*', 0.12, ['sqrt', ['get', 'figure']]]]],
          ],
          'circle-color': [
            'match',
            ['get', 'displacement_type'],
            'conflict', COLOR_CONFLICT,
            'disaster', COLOR_DISASTER,
            COLOR_CONFLICT,
          ],
          'circle-opacity': 0.35,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-opacity': 0.7,
        },
      },
      'incidents-circles',
    );
    map.setPaintProperty(LAYER_ID, 'circle-opacity-transition' as never, { duration: 400 } as never);
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
