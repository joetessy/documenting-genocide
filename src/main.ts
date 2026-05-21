import './style.css';
import { mountMap } from './map/map';
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
  // Marker rendering wired up in Task 9.
  void map;
}

start().catch((err) => {
  console.error(err);
  document.body.textContent = `Error: ${err.message}`;
});
