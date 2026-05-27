import './style.css';
import { mountMap } from './map/map';
import { mountMarkers } from './map/marker-layer';
import { mountDamageLayer } from './map/damage-layer';
import { mountFacilityLayer } from './map/facility-layer';
import { loadIncidents, loadDamage, loadFacilities, loadCasualtyToll } from './data/loader';
import { TimeController } from './time/time-controller';
import { TourController } from './time/tour-controller';
import { mountScrubber } from './time/scrubber';
import { bucketByDay, bucketDamageByDay, renderHistogram } from './time/histogram';
import { mountTooltip } from './ui/tooltip';
import { mountSidePanel } from './ui/side-panel';
import { mountLoading } from './ui/loading';
import { mountLayerToggle } from './ui/layer-toggle';
import { mountHeader } from './ui/header';
import { mountAboutModal } from './ui/about-modal';
import { mountOnboarding } from './ui/onboarding-overlay';
import { parseHash, formatHash } from './url-state';
import { TIMELINE_EVENTS, type TimelineEvent } from './data/timeline-events';

async function start(): Promise<void> {
  const app = document.getElementById('app');
  if (!app) throw new Error('#app element not found');

  const loading = mountLoading(app);
  loading.setStatus('Loading map…');

  const mapEl = document.createElement('div');
  mapEl.id = 'map';
  app.appendChild(mapEl);

  const map = mountMap(mapEl);
  mountRotationHint(app);
  mountOnboarding(app);

  const aboutModal = mountAboutModal(app);
  const aboutBtn = document.createElement('button');
  aboutBtn.id = 'about-trigger';
  aboutBtn.type = 'button';
  aboutBtn.textContent = 'About';
  aboutBtn.setAttribute('aria-label', 'About this exhibit');
  aboutBtn.addEventListener('click', () => aboutModal.open());
  app.appendChild(aboutBtn);

  loading.setStatus('Loading incident data…');
  const { incidents, meta } = await loadIncidents();
  console.log(`Loaded ${incidents.length} incidents (${meta.unplotted_count} unplotted), build ${meta.build_date}`);

  loading.setStatus('Loading damage assessment…');
  const damageData = await loadDamage();
  console.log(`Loaded ${damageData.features.length} damage features`);

  loading.setStatus('Loading casualty figures…');
  const casualtyToll = await loadCasualtyToll();
  console.log(`Loaded ${casualtyToll.length} daily casualty data points`);

  loading.setStatus('Loading facilities…');
  const facilities = await loadFacilities();
  console.log(`Loaded ${facilities.length} facilities`);

  const header = mountHeader(app, {
    incidents,
    damageFeatures: damageData.features,
    casualtyToll,
  });

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
    const enabledCats = (Object.entries(s.incidentCategories) as [string, boolean][])
      .filter(([, v]) => v)
      .map(([k]) => k);
    markers.setCategoryFilter(enabledCats.length === 6 ? null : enabledCats);
  });

  // Anchor the timeline to the start of the war regardless of what the data
  // happens to contain. The build pipeline already filters pre-war records,
  // but this also covers the case where the earliest incident is a few days
  // after Oct 7 — we still want the slider to begin at Oct 7 itself.
  const firstDate = '2023-10-06';  // one day before the war so the initial state is fully empty
  const lastDate = incidents[incidents.length - 1]?.date ?? '2024-12-31';
  const initial = parseHash(location.hash);

  const timeCtrl = new TimeController({
    start: firstDate,
    end: lastDate,
    stepDaysPerSecond: 3,
    initialDate: initial.date ?? firstDate,
  });

  // Debounce the URL hash update — Safari rate-limits history.replaceState()
  // to 100 calls per 10 seconds, and a fast scrubber drag exceeds that in
  // a second or two. We only need the hash to reflect the *settled* date,
  // not every intermediate value during a drag.
  let hashUpdateTimer: ReturnType<typeof setTimeout> | undefined;
  let lastHashIncident: string | null = initial.incident ?? null;
  function scheduleHashUpdate(date: string): void {
    if (hashUpdateTimer) clearTimeout(hashUpdateTimer);
    hashUpdateTimer = setTimeout(() => {
      try {
        const newHash = formatHash({ date, incident: lastHashIncident ?? undefined });
        if (newHash !== location.hash) {
          history.replaceState(null, '', `${location.pathname}${location.search}${newHash}`);
        }
      } catch {
        // history APIs can still throw under extreme conditions; the visible
        // state is correct regardless of whether the URL caught up.
      }
    }, 300);
  }
  function setHashIncident(id: string | null): void {
    lastHashIncident = id;
    // Incident clicks are rare — update the hash immediately rather than waiting
    // for the scrubber debounce. Wrapped in try/catch for the same Safari reason.
    try {
      const newHash = formatHash({
        date: timeCtrl.currentDate,
        incident: lastHashIncident ?? undefined,
      });
      if (newHash !== location.hash) {
        history.replaceState(null, '', `${location.pathname}${location.search}${newHash}`);
      }
    } catch {
      // rate-limited; visible state is correct
    }
  }

  // Damage layer has 196K features — each setFilter call costs 50-300ms.
  // During a fast drag the layer can't keep up. Debounce so it updates
  // 120ms after the user pauses, leaving markers + header + URL hash
  // fully responsive in the meantime. Tour mode (5500ms per event) and
  // auto-play (333ms per tick) both clear this comfortably.
  let damageUpdateTimer: ReturnType<typeof setTimeout> | undefined;
  let pendingDamageDate: string | null = null;
  function scheduleDamageUpdate(date: string): void {
    pendingDamageDate = date;
    if (damageUpdateTimer) clearTimeout(damageUpdateTimer);
    damageUpdateTimer = setTimeout(() => {
      if (pendingDamageDate) damage.setVisibleDate(pendingDamageDate);
      damageUpdateTimer = undefined;
    }, 120);
  }

  timeCtrl.onChange((date) => {
    markers.setVisibleDate(date);
    scheduleDamageUpdate(date);
    header.updateForDate(date);
    scheduleHashUpdate(date);
  });
  markers.setVisibleDate(timeCtrl.currentDate);
  damage.setVisibleDate(timeCtrl.currentDate);
  header.updateForDate(timeCtrl.currentDate);

  // Deep-link: if the URL hash names an incident, open its side panel.
  // If no explicit date was in the hash, also jump the scrubber to that
  // incident's date so the marker is actually visible.
  if (initial.incident) {
    const incident = byId.get(initial.incident);
    if (incident) {
      sidePanel.openIncident(incident);
      if (!initial.date) timeCtrl.setDate(incident.date);
    }
  }

  const histogramHost = mountScrubber(app, timeCtrl);
  const incidentBuckets = bucketByDay(incidents, timeCtrl.start, timeCtrl.end);
  const damageBuckets = bucketDamageByDay(damageData.features, timeCtrl.start, timeCtrl.end);
  const drawHistogram = (): void => renderHistogram(
    histogramHost,
    incidentBuckets,
    damageBuckets,
    timeCtrl.start,
    TIMELINE_EVENTS,
    (ev) => { timeCtrl.setDate(ev.date); },
  );
  requestAnimationFrame(drawHistogram);
  window.addEventListener('resize', drawHistogram);

  // Narrator overlay — large title + description above the scrubber, visible
  // throughout each tour stop so the user can actually read the event context
  // (the side panel often gets obscured by the map / a click).
  const narrator = mountTourNarrator(app);

  // Tour controller — auto-advances through the 14 timeline events with a
  // brief pause + side-panel context at each. Click to start/stop.
  const tour = new TourController({
    events: TIMELINE_EVENTS,
    timeCtrl,
    panel: {
      showEventCard(ev) { sidePanel.openTimelineEvent(ev, `Tour stop · ${ev.date}`); },
      close() { sidePanel.close(); },
    },
    narrator,
    cameraEaseTo(target) {
      if (target) {
        map.easeTo({
          center: [target.lon, target.lat],
          zoom: target.zoom ?? 13,
          pitch: 30,
          duration: 1400,
        });
      } else {
        // Reset to default Gaza-wide flat view.
        map.easeTo({
          center: [34.40, 31.42],
          zoom: 11,
          pitch: 0,
          bearing: 0,
          duration: 1400,
        });
      }
    },
    perEventMs: 5500,
    onStateChange(isPlaying) {
      tourBtn.textContent = isPlaying ? '◼ Stop tour' : '▸ Tour';
      tourBtn.classList.toggle('is-playing', isPlaying);
    },
  });

  const tourBtn = document.createElement('button');
  tourBtn.id = 'tour-btn';
  tourBtn.type = 'button';
  tourBtn.textContent = '▸ Tour';
  tourBtn.setAttribute('aria-label', 'Start guided tour of major events');
  tourBtn.addEventListener('click', () => tour.toggle());
  app.appendChild(tourBtn);

  // Clicking the map during a tour cancels it (intent: user wants to explore on their own).
  map.on('click', () => { if (tour.isPlaying) tour.stop(); });

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

  const facilityById = new Map(facilities.map((f) => [f.id, f]));

  // One click handler that picks the topmost relevant layer at the click
  // point and routes to the right panel. Layer priority (highest wins):
  //   1. incidents-circles    — red dots, the most "story-bearing" markers
  //   2. facilities-health    — cyan dots, named civilian buildings
  //   3. facilities-education — violet dots, schools/universities
  //   4. damage-circles       — generic damage layer, lowest priority
  // This replaces the previous per-layer click handlers, which all fired
  // for the same click and let the last-registered handler (damage)
  // overwrite the panel that an earlier one (incidents) had set.
  const CLICK_LAYER_PRIORITY = [
    'incidents-circles',
    'facilities-health',
    'facilities-education',
    'damage-circles',
  ];

  map.on('click', (e) => {
    const activeLayers = CLICK_LAYER_PRIORITY.filter((l) => map.getLayer(l));
    const hits = map.queryRenderedFeatures(e.point, { layers: activeLayers });
    if (hits.length === 0) {
      sidePanel.close();
      setHashIncident(null);
      return;
    }
    for (const layerId of CLICK_LAYER_PRIORITY) {
      const hit = hits.find((h) => h.layer.id === layerId);
      if (!hit) continue;
      const id = hit.properties?.id as string | undefined;
      if (!id) return;
      if (layerId === 'incidents-circles') {
        const incident = byId.get(id);
        if (incident) {
          sidePanel.openIncident(incident);
          setHashIncident(incident.id);
        }
      } else if (layerId === 'damage-circles') {
        const damageFeat = damageById.get(id);
        if (damageFeat) {
          sidePanel.openDamage(damageFeat);
          setHashIncident(null);
        }
      } else if (layerId === 'facilities-health' || layerId === 'facilities-education') {
        const fac = facilityById.get(id);
        if (fac) {
          sidePanel.openFacility(fac);
          setHashIncident(null);
        }
      }
      return; // only handle the topmost hit
    }
  });

  // Cursor feedback when hovering any clickable layer.
  for (const layerId of CLICK_LAYER_PRIORITY) {
    map.on('mouseenter', layerId, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', layerId, () => {
      map.getCanvas().style.cursor = '';
    });
  }

  // Lift labels above data overlays for legibility. Keep incident markers
  // on top so the red dots dominate, and labels read clearly when they
  // overlap dense data clusters.
  function lift(): void {
    // Final stack order, top to bottom:
    //   place-city          (labels foreground)
    //   place-neighbourhood
    //   incidents-hovered   (red ring around hovered incident)
    //   incidents-circles   (red dots)
    //   facilities-health
    //   facilities-education
    //   damage-circles
    //   ... basemap roads / buildings / water ...
    // moveLayer(id) without a beforeId puts the layer at the very top, so
    // calling them in bottom-to-top order yields the stack above.
    for (const id of [
      'damage-circles',
      'facilities-education',
      'facilities-health',
      'incidents-circles',
      'incidents-hovered',
      'place-neighbourhood',
      'place-city',
    ]) {
      if (map.getLayer(id)) map.moveLayer(id);
    }
  }
  // Data layers are added asynchronously (after the 'load' event for some),
  // so lift twice — once after load, and once after a short delay as a
  // belt-and-suspenders.
  map.once('load', lift);
  setTimeout(lift, 600);

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


function mountRotationHint(parent: HTMLElement): void {
  const el = document.createElement('div');
  el.id = 'rotation-hint';
  el.innerHTML = 'Drag the compass to rotate &amp; tilt, or hold <kbd>Ctrl</kbd> while dragging the map.';
  parent.appendChild(el);
}

// Floating narrator block that sits above the scrubber during a tour. Shows
// the current event's date, title, and one-sentence description so the user
// has the context in their primary line of sight, not buried in the side panel.
function mountTourNarrator(parent: HTMLElement): { show(ev: TimelineEvent): void; hide(): void } {
  const el = document.createElement('div');
  el.id = 'tour-narrator';
  parent.appendChild(el);
  return {
    show(ev) {
      el.innerHTML = `
        <div class="tn-date">${ev.date}</div>
        <div class="tn-title">${escapeHtml(ev.title)}</div>
        <div class="tn-desc">${escapeHtml(ev.description)}</div>
      `;
      el.classList.add('is-open');
    },
    hide() {
      el.classList.remove('is-open');
    },
  };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

start().catch((err) => {
  console.error(err);
  document.body.textContent = `Error: ${err.message}`;
});
