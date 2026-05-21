import './style.css';
import { mountMap } from './map/map';
import { mountMarkers } from './map/marker-layer';
import { loadIncidents } from './data/loader';
import { mountTooltip } from './ui/tooltip';
import { mountSidePanel } from './ui/side-panel';
import { TimeController } from './time/time-controller';

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
  const sidePanel = mountSidePanel(app);
  const byId = new Map(incidents.map((i) => [i.id, i]));

  const firstDate = incidents[0]?.date ?? '2023-10-07';
  const lastDate = incidents[incidents.length - 1]?.date ?? '2024-12-31';

  const timeCtrl = new TimeController({
    start: firstDate,
    end: lastDate,
    stepDaysPerSecond: 3,
    initialDate: lastDate,
  });

  timeCtrl.onChange((date) => markers.setVisibleDate(date));
  markers.setVisibleDate(timeCtrl.currentDate);

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

  map.on('click', 'incidents-circles', (e) => {
    if (!e.features || e.features.length === 0) return;
    const id = e.features[0].properties?.id as string | undefined;
    if (!id) return;
    const incident = byId.get(id);
    if (!incident) return;
    sidePanel.open(incident);
  });
}

start().catch((err) => {
  console.error(err);
  document.body.textContent = `Error: ${err.message}`;
});
