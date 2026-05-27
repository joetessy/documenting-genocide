import type { Map } from 'maplibre-gl';
import type { TimelineEvent } from '../data/timeline-events';

const SOURCE_ID = 'timeline-events';
const LAYER_ID = 'timeline-event-circles';

function toGeoJSON(events: TimelineEvent[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: events
      .map((e, i): GeoJSON.Feature | null => {
        if (!e.focus) return null;
        return {
          type: 'Feature',
          id: `tle-${i}`,
          geometry: { type: 'Point', coordinates: [e.focus.lon, e.focus.lat] },
          properties: {
            id: `tle-${i}`,
            date: e.date,
            title: e.title,
            eventIndex: i,
          },
        };
      })
      .filter((f): f is GeoJSON.Feature => f !== null),
  };
}

export interface TimelineEventLayerHandle {
  setVisibleDate(date: string): void;
  setVisible(visible: boolean): void;
}

// Curated major-event markers — distinct white-centre / red-ring "target"
// look so they stand out from regular incident dots. One marker per event
// that has a `focus` coordinate, gated by the scrubber so an event only
// appears at or after its date.
export function mountTimelineEventLayer(map: Map, events: TimelineEvent[]): TimelineEventLayerHandle {
  let pendingDate: string | null = null;
  let layerReady = false;

  function applyFilter(): void {
    if (!layerReady || pendingDate === null) return;
    if (map.getLayer(LAYER_ID)) {
      map.setFilter(LAYER_ID, ['<=', ['get', 'date'], pendingDate] as never);
    }
  }

  const data = toGeoJSON(events);

  const addLayer = (): void => {
    map.addSource(SOURCE_ID, { type: 'geojson', data });
    map.addLayer({
      id: LAYER_ID,
      type: 'circle',
      source: SOURCE_ID,
      paint: {
        'circle-radius': [
          'interpolate', ['linear'], ['zoom'],
          9, 7,
          14, 13,
          17, 18,
        ],
        'circle-color': '#ffffff',
        'circle-stroke-color': '#d3091e',
        'circle-stroke-width': 2.5,
        'circle-opacity': 1,
        'circle-stroke-opacity': 1,
      },
      filter: pendingDate
        ? (['<=', ['get', 'date'], pendingDate] as never)
        : (['<=', ['get', 'date'], '1900-01-01'] as never),
    });
    layerReady = true;
    applyFilter();
  };

  if (map.isStyleLoaded()) addLayer();
  else map.once('load', addLayer);

  return {
    setVisibleDate(date) {
      pendingDate = date;
      applyFilter();
    },
    setVisible(visible) {
      if (map.getLayer(LAYER_ID)) {
        map.setLayoutProperty(LAYER_ID, 'visibility', visible ? 'visible' : 'none');
      }
    },
  };
}
