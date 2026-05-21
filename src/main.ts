import './style.css';
import { mountMap } from './map/map';
import { mountMarkers } from './map/marker-layer';
import { loadIncidents } from './data/loader';
import { mountTooltip } from './ui/tooltip';

async function start(): Promise<void> {
  const app = document.getElementById('app');
  if (!app) throw new Error('#app element not found');

  const mapEl = document.createElement('div');
  mapEl.id = 'map';
  app.appendChild(mapEl);

  const map = mountMap(mapEl);
  const { incidents, meta } = await loadIncidents();
  console.log(`Loaded ${incidents.length} incidents, build ${meta.build_date}`);

  const markers = mountMarkers(map, incidents);
  const tooltip = mountTooltip(app);
  const byId = new Map(incidents.map((i) => [i.id, i]));

  // Temporarily reveal everything until TimeController lands in Task 12.
  const latest = incidents[incidents.length - 1]?.date ?? '2026-01-01';
  markers.setVisibleDate(latest);

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
}

start().catch((err) => {
  console.error(err);
  document.body.textContent = `Error: ${err.message}`;
});
