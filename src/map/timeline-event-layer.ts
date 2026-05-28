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
            // Casualty count drives the tier-step radius (matches incident markers).
            // Default 0 for events that don't carry a per-marker casualty figure.
            killed: e.casualties?.killed ?? 0,
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

// Curated major-event markers — visually identical to regular incident dots
// so they sit naturally inside the data. They remain a distinct layer because
// clicks route them to the timeline-event side panel (with curated
// description + sources) rather than the incident panel. One marker per
// event that has a `focus` coordinate, gated by the scrubber so an event
// only appears at or after its date.
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
        // Match marker-layer.ts incident styling exactly — same color, stroke,
        // and tiered radius by `killed` count.
        'circle-radius': [
          'interpolate', ['linear'], ['zoom'],
          9,  ['step', ['number', ['get', 'killed'], 0], 3,    10, 4.5,  50, 6.5,  100, 9],
          14, ['step', ['number', ['get', 'killed'], 0], 6,    10, 9,    50, 13,   100, 18],
          17, ['step', ['number', ['get', 'killed'], 0], 9,    10, 13,   50, 18,   100, 24],
        ],
        'circle-color': '#e63946',
        'circle-stroke-color': '#000000',
        'circle-stroke-width': 1.5,
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

  // See damage-layer.ts for the rationale on this pattern.
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
