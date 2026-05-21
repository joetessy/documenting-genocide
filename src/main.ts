import './style.css';
import { mountMap } from './map/map';

const app = document.getElementById('app');
if (!app) throw new Error('#app element not found');

const mapEl = document.createElement('div');
mapEl.id = 'map';
app.appendChild(mapEl);

mountMap(mapEl);
