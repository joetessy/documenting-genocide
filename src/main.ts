import './style.css';
import { mountMap } from './map/map';
import { mountMarkers } from './map/marker-layer';
import { loadIncidents } from './data/loader';

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

  // Temporarily reveal everything until TimeController lands in Task 12.
  const latest = incidents[incidents.length - 1]?.date ?? '2026-01-01';
  markers.setVisibleDate(latest);
}

start().catch((err) => {
  console.error(err);
  document.body.textContent = `Error: ${err.message}`;
});
