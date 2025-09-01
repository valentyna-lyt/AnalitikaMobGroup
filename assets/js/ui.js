
import { state } from './state.js';
import { loadDemo, loadFromFile, loadFromURL } from './dataLoader.js';
import { renderLayers, locateMe, printMap } from './map.js';
import { updateKPI, updateLevelChart } from './analytics.js';
import { debounce, downloadJSON, downloadCSV } from './utils.js';
import { uniqueParents } from './filters.js';
import { saveSettings } from './storage.js';
import { openSettings } from './settings.js';

function refreshParents(){
  const sel = document.getElementById('filter-parent');
  const levelSel = document.getElementById('filter-level');
  const level = levelSel.value || '';
  const parents = uniqueParents(level);
  const prev = sel.value;
  sel.innerHTML = '<option value="">Всі</option>' + parents.map(p=>`<option>${p}</option>`).join('');
  if (parents.includes(prev)) sel.value = prev;
}

export function bindUI(){
  const q = (id)=>document.getElementById(id);

  q('filter-level')?.addEventListener('change', e=>{
    state.filters.level = e.target.value || '';
    refreshParents();
    renderLayers(); updateKPI(); updateLevelChart();
  });
  q('filter-parent')?.addEventListener('change', e=>{
    state.filters.parent = e.target.value || '';
    renderLayers(); updateKPI(); updateLevelChart();
  });
  q('search-name')?.addEventListener('input', debounce(e=>{
    state.filters.query = e.target.value || '';
    renderLayers(); updateKPI(); updateLevelChart();
  }, 250));

  q('btn-load-demo')?.addEventListener('click', async ()=>{
    await loadDemo(); renderLayers(); updateKPI(); updateLevelChart(); refreshParents();
  });
  q('file-input')?.addEventListener('change', async (e)=>{
    if (e.target.files?.length){ await loadFromFile(e.target.files[0]); renderLayers(); updateKPI(); updateLevelChart(); refreshParents(); }
  });
  q('btn-load-url')?.addEventListener('click', async ()=>{
    const url = q('url-input')?.value?.trim();
    if (!url) return;
    await loadFromURL(url); saveSettings();
    renderLayers(); updateKPI(); updateLevelChart(); refreshParents();
  });

  q('btn-mypos')?.addEventListener('click', locateMe);
  q('btn-print')?.addEventListener('click', printMap);
  q('btn-settings')?.addEventListener('click', openSettings);
  q('btn-theme')?.addEventListener('click', ()=>{
    state.theme = (state.theme==='dark'?'light':'dark');
    document.body.classList.toggle('theme-light', state.theme==='light');
    saveSettings();
  });

  q('btn-export-json')?.addEventListener('click', ()=>downloadJSON(state.data, 'units_export.json'));
  q('btn-export-csv')?.addEventListener('click', ()=>downloadCSV(state.data, 'units_export.csv'));

  const inputRefresh = q('refresh-min');
  if (inputRefresh){
    inputRefresh.value = String(state.refreshMinutes||0);
    inputRefresh.addEventListener('change', ()=>{
      const v = Math.max(0, Number(inputRefresh.value || 0));
      state.refreshMinutes = v; saveSettings();
      setupAutoRefresh();
    });
  }
  setupAutoRefresh();
}

async function setupAutoRefresh(){
  if (state.refreshTimer) { clearInterval(state.refreshTimer); state.refreshTimer = null; }
  if (!state.refreshMinutes || state.refreshMinutes<=0) return;
  if (state.dataSource.type !== 'url' || !state.dataSource.url) return;
  const ms = state.refreshMinutes * 60 * 1000;
  state.refreshTimer = setInterval(async ()=>{
    try {
      await loadFromURL(state.dataSource.url);
      renderLayers(); updateKPI(); updateLevelChart();
      console.log('Auto-refreshed at', new Date().toISOString());
    } catch(e){ console.warn('Auto-refresh failed', e); }
  }, ms);
}
