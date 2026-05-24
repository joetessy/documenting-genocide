import './style.css';
import { mountMap } from './map/map';
import { mountMarkers } from './map/marker-layer';
import { mountDamageLayer } from './map/damage-layer';
import { mountFacilityLayer } from './map/facility-layer';
import { loadIncidents, loadDamage, loadFacilities } from './data/loader';
import { TimeController } from './time/time-controller';
import { mountScrubber } from './time/scrubber';
import { bucketByDay, bucketDamageByDay, renderHistogram } from './time/histogram';
import { mountTooltip } from './ui/tooltip';
import { mountSidePanel } from './ui/side-panel';
import { mountLoading } from './ui/loading';
import { mountLayerToggle } from './ui/layer-toggle';
import { mountHeader } from './ui/header';
import { parseHash, formatHash } from './url-state';

async function start(): Promise<void> {
  const app = document.getElementById('app');
  if (!app) throw new Error('#app element not found');

  const loading = mountLoading(app);
  loading.setStatus('Loading map…');

  const mapEl = document.createElement('div');
  mapEl.id = 'map';
  app.appendChild(mapEl);

  const map = mountMap(mapEl);

  // Custom 3D/2D toggle. The NavigationControl compass resets pitch to 0
  // but can't restore the previous tilt — this button gives users a
  // discoverable single-click way to flip between flat and tilted views.
  mountPitchToggle(app, map);

  loading.setStatus('Loading incident data…');
  const { incidents, meta } = await loadIncidents();
  console.log(`Loaded ${incidents.length} incidents (${meta.unplotted_count} unplotted), build ${meta.build_date}`);

  loading.setStatus('Loading damage assessment…');
  const damageData = await loadDamage();
  console.log(`Loaded ${damageData.features.length} damage features`);

  loading.setStatus('Loading facilities…');
  const facilities = await loadFacilities();
  console.log(`Loaded ${facilities.length} facilities`);

  const header = mountHeader(app, { incidents, damageFeatures: damageData.features });

  const markers = mountMarkers(map, incidents);
  const tooltip = mountTooltip(app);
  const sidePanel = mountSidePanel(app);
  const byId = new Map(incidents.map((i) => [i.id, i]));

  const damage = await mountDamageLayer(map, damageData as unknown as GeoJSON.FeatureCollection);
  damage.setVisible(true);

  const facilityLayer = await mountFacilityLayer(map, facilities);
  // Default off — facilities are a static reference overlay.

  const layerToggle = mountLayerToggle(app);
  layerToggle.onChange((s) => {
    damage.setVisible(s.damage);
    facilityLayer.setVisible('health', s.health);
    facilityLayer.setVisible('education', s.education);
    if (map.getLayer('incidents-circles')) {
      map.setLayoutProperty('incidents-circles', 'visibility', s.incidents ? 'visible' : 'none');
    }
  });

  // Anchor the timeline to the start of the war regardless of what the data
  // happens to contain. The build pipeline already filters pre-war records,
  // but this also covers the case where the earliest incident is a few days
  // after Oct 7 — we still want the slider to begin at Oct 7 itself.
  const firstDate = '2023-10-07';
  const lastDate = incidents[incidents.length - 1]?.date ?? '2024-12-31';
  const initial = parseHash(location.hash);

  const timeCtrl = new TimeController({
    start: firstDate,
    end: lastDate,
    stepDaysPerSecond: 3,
    initialDate: initial.date ?? firstDate,
  });

  timeCtrl.onChange((date) => {
    markers.setVisibleDate(date);
    damage.setVisibleDate(date);
    header.updateForDate(date);
    const newHash = formatHash({ date });
    if (newHash !== location.hash) {
      history.replaceState(null, '', `${location.pathname}${location.search}${newHash}`);
    }
  });
  markers.setVisibleDate(timeCtrl.currentDate);
  damage.setVisibleDate(timeCtrl.currentDate);
  header.updateForDate(timeCtrl.currentDate);

  const histogramHost = mountScrubber(app, timeCtrl);
  const incidentBuckets = bucketByDay(incidents, timeCtrl.start, timeCtrl.end);
  const damageBuckets = bucketDamageByDay(damageData.features, timeCtrl.start, timeCtrl.end);
  const drawHistogram = (): void => renderHistogram(histogramHost, incidentBuckets, damageBuckets);
  requestAnimationFrame(drawHistogram);
  window.addEventListener('resize', drawHistogram);

  map.on('mousemove', 'incidents-circles', (e) => {
    if (!e.features || e.features.length === 0) return;
    const id = e.features[0].properties?.id as string | undefined;
    if (!id) return;
    const incident = byId.get(id);
    if (!incident) return;
    map.getCanvas().style.cursor = 'pointer';
    markers.setHoveredId(id);
    tooltip.show(incident, e.originalEvent.clientX, e.originalEvent.clientY);
  });
  map.on('mouseleave', 'incidents-circles', () => {
    map.getCanvas().style.cursor = '';
    markers.setHoveredId(null);
    tooltip.hide();
  });

  // Build a quick lookup of damage features by id, so clicks can hydrate the panel.
  const damageById = new Map(damageData.features.map((f) => [f.properties.id, f]));

  map.on('click', 'incidents-circles', (e) => {
    if (!e.features || e.features.length === 0) return;
    const id = e.features[0].properties?.id as string | undefined;
    if (!id) return;
    const incident = byId.get(id);
    if (!incident) return;
    sidePanel.openIncident(incident);
  });

  map.on('click', 'damage-circles', (e) => {
    if (!e.features || e.features.length === 0) return;
    const id = e.features[0].properties?.id as string | undefined;
    if (!id) return;
    const damageFeat = damageById.get(id);
    if (!damageFeat) return;
    sidePanel.openDamage(damageFeat);
  });

  map.on('mouseenter', 'damage-circles', () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', 'damage-circles', () => {
    map.getCanvas().style.cursor = '';
  });

  const facilityById = new Map(facilities.map((f) => [f.id, f]));

  for (const layerId of ['facilities-health', 'facilities-education']) {
    map.on('click', layerId, (e) => {
      if (!e.features || e.features.length === 0) return;
      const id = e.features[0].properties?.id as string | undefined;
      if (!id) return;
      const fac = facilityById.get(id);
      if (!fac) return;
      sidePanel.openFacility(fac);
    });

    map.on('mouseenter', layerId, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', layerId, () => {
      map.getCanvas().style.cursor = '';
    });
  }

  map.on('click', (e) => {
    const hits = map.queryRenderedFeatures(e.point, {
      layers: ['incidents-circles', 'damage-circles', 'facilities-health', 'facilities-education']
        .filter((l) => map.getLayer(l)),
    });
    if (hits.length === 0) {
      sidePanel.close();
    }
  });

  // Wait for map's first paint before hiding loading. Use 'load' (fires once style
  // is parsed and visible tiles are requested) rather than 'idle' — 'idle' may
  // never fire if any tile request errors.
  function destroyLoadingAndResize(): void {
    loading.destroy();
    // Explicit resize because the canvas is sometimes created at the wrong
    // height when the loading overlay is still in the layout. Call after the
    // overlay's opacity transition (~400ms) so the layout has fully settled.
    requestAnimationFrame(() => map.resize());
    setTimeout(() => map.resize(), 450);
  }
  map.once('load', destroyLoadingAndResize);
  // Safety fallback: hide loading after 8s no matter what.
  setTimeout(destroyLoadingAndResize, 8000);

  // Extra resize on window 'load' (after all images/fonts settle) and on
  // window resize events. The first is a belt-and-suspenders fix for the
  // grey-canvas-bottom-half bug some users hit on initial load.
  window.addEventListener('load', () => map.resize());
  window.addEventListener('resize', () => map.resize());
}

function mountPitchToggle(parent: HTMLElement, map: import('maplibre-gl').Map): void {
  const DEFAULT_TILT = 50;
  let rememberedTilt = DEFAULT_TILT;

  const btn = document.createElement('button');
  btn.id = 'pitch-toggle';
  btn.type = 'button';
  btn.textContent = '3D';
  btn.setAttribute('aria-label', 'Toggle 3D view');
  parent.appendChild(btn);

  function render(): void {
    const isFlat = map.getPitch() < 1;
    btn.textContent = isFlat ? '3D' : '2D';
  }

  btn.addEventListener('click', () => {
    const isFlat = map.getPitch() < 1;
    if (isFlat) {
      map.easeTo({ pitch: rememberedTilt, duration: 300 });
    } else {
      rememberedTilt = map.getPitch();
      map.easeTo({ pitch: 0, duration: 300 });
    }
    setTimeout(render, 350);
  });

  // Keep the label in sync when the user tilts via gestures or NavControl.
  map.on('pitchend', render);
  render();
}

start().catch((err) => {
  console.error(err);
  document.body.textContent = `Error: ${err.message}`;
});
