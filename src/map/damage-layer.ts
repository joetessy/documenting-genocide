import type { Map } from 'maplibre-gl';
import { registerDamagePmtiles } from './map';

const SOURCE_ID = 'damage';
const SOURCE_LAYER = 'damage';   // tippecanoe layer name (-l damage)
const LAYER_ID = 'damage-circles';

const STATUS_COLORS: Record<string, string> = {
  destroyed: '#7a0e0e',         // deep blood red — most damaged
  severe: '#c2470d',             // brighter rust
  moderate: '#856416',           // brighter olive
  possibly_damaged: '#4a4a4a',   // medium-dark grey
};

export interface DamageLayerHandle {
  setVisible(visible: boolean): void;
  setVisibleDate(date: string): void;
  // Exposed so the click-priority list + z-order lift in main.ts can address
  // the damage layer. A single id now (vector tiles make a per-date date
  // filter cheap, so we no longer need one layer per assessment date).
  layerIds: string[];
}

export async function mountDamageLayer(map: Map): Promise<DamageLayerHandle> {
  let pendingDate: string | null = null;
  let pendingVisible = false;
  let layerReady = false;

  function buildFilter(date: string | null): maplibregl.FilterSpecification {
    return ['<=', ['get', 'assessment_date'], date ?? '1900-01-01'] as unknown as maplibregl.FilterSpecification;
  }

  function applyState(): void {
    if (!layerReady || !map.getLayer(LAYER_ID)) return;
    map.setLayoutProperty(LAYER_ID, 'visibility', pendingVisible ? 'visible' : 'none');
    map.setFilter(LAYER_ID, buildFilter(pendingDate));
  }

  const addLayer = async (): Promise<void> => {
    // Downloads the archive into memory + registers it; resolves to the
    // in-memory source URL (pmtiles://damage). Awaited here so the source is
    // only added once the archive is ready. Doesn't block mountDamageLayer's
    // return, so the rest of the UI mounts while the archive downloads.
    const sourceUrl = await registerDamagePmtiles();
    if (map.getSource(SOURCE_ID)) return;
    map.addSource(SOURCE_ID, {
      type: 'vector',
      url: sourceUrl,
    });
    map.addLayer(
      {
        id: LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        'source-layer': SOURCE_LAYER,
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
    void addLayer();
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
    layerIds: [LAYER_ID],
  };
}
