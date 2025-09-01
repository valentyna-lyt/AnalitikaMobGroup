
import { state } from './state.js';
import { loadSettings, saveSettings } from './storage.js';
import { initMap, renderLayers } from './map.js';
import { bindUI } from './ui.js';
import { loadDemo, reapplyEdits } from './dataLoader.js';
import { initSettings } from './settings.js';
import { updateKPI, updateLevelChart } from './analytics.js';

async function boot(){
  loadSettings();
  if (state.theme==='light') document.body.classList.add('theme-light');

  initMap();
  initSettings();
  bindUI();

  try {
    state.dataSource = { type: 'demo', url: '' };
    await loadDemo();
  } catch(e){
    console.warn('Помилка при завантаженні даних (демо)', e);
  }

  reapplyEdits();
  renderLayers();
  updateKPI();
  updateLevelChart();
}

boot();
