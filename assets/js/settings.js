function initSettings(){ /* init settings header no-op; header will be reset in openSettings */ }

import { state } from './state.js';
import { reapplyEdits } from './dataLoader.js';
import { saveSettings, clearEdits } from './storage.js';
import { renderLayers } from './map.js';
import { updateKPI, updateLevelChart } from './analytics.js';

function rowTemplate(d){
  const e = state.edits[d.id] || {};
  const v = (k, def='') => (e[k]!==undefined ? e[k] : (d[k] ?? def));
  const esc = (s)=> (s==null?'':String(s).replace(/"/g,'&quot;'));
  return `
    <tr data-id="${d.id}">
      <td>${d.id}</td>
      <td><input type="text" data-k="name" value="${esc(v('name'))}"></td>
      <td><input type="text" data-k="level" value="${esc(v('level'))}"></td>
      <td><input type="text" data-k="parent" value="${esc(v('parent'))}"></td>
      <td><input type="number" step="0.000001" data-k="lat" value="${Number(v('lat')||'')}"></td>
      <td><input type="number" step="0.000001" data-k="lon" value="${Number(v('lon')||'')}"></td>
      <td><input type="text" data-k="color" value="${esc(v('color'))}" placeholder="#hex"></td>
      <td><input type="number" data-k="today" value="${Number(v('today')||0)}" min="0"></td>
      <td><input type="number" data-k="m30" value="${Number(v('m30')||0)}" min="0"></td>
      <td><input type="number" data-k="ytd" value="${Number(v('ytd')||0)}" min="0"></td>
      <td><input type="text" data-k="inspectors" value="${esc(v('inspectors'))}" placeholder="Прізвища перевіряючих"></td>
      <td><input type="date" data-k="last_check" value="${esc(v('last_check'))}"></td>
    </tr>`;
}

export function openSettings(){
  const dlg = document.getElementById('settings-dialog');
  const table = document.getElementById('settings-table') || document.querySelector('.settings-table');
  const tbody = document.getElementById('settings-tbody');
  const btnApply = document.getElementById('settings-apply');
  const btnReset = document.getElementById('settings-reset');
  const btnClose = document.getElementById('settings-close');

  // Ensure header has our columns
  const thead = table.querySelector('thead');
  if (thead && !thead.dataset.extended){
    thead.innerHTML = `
      <tr>
        <th>ID</th><th>Назва</th><th>Рівень</th><th>Батько</th>
        <th>lat</th><th>lon</th><th>Колір</th>
        <th>Сьогодні</th><th>30 днів</th><th>З поч. року</th>
        <th>Прізвища перевіряючих</th><th>Дата останньої перевірки</th>
      </tr>`;
    thead.dataset.extended = '1';
  }

  // Render rows
  const rows = Array.isArray(state.data) ? state.data : [];
  tbody.innerHTML = rows.map(rowTemplate).join('');

  // Wire inputs
  tbody.querySelectorAll('input').forEach(inp=>{
    inp.addEventListener('change', (e)=>{
      const tr = e.target.closest('tr[data-id]');
      const id = tr?.getAttribute('data-id');
      const key = e.target.getAttribute('data-k');
      if (!id || !key) return;
      if (!state.edits[id]) state.edits[id] = {};
      let val = e.target.value;
      if (key==='lat' || key==='lon' || key==='today' || key==='m30' || key==='ytd'){
        val = val==='' ? '' : Number(val);
      }
      state.edits[id][key] = val;
      saveSettings();
    });
  });

  // Buttons
  btnClose?.addEventListener('click', ()=>dlg?.close());
  btnApply?.addEventListener('click', ()=>{
    reapplyEdits(); saveSettings(); renderLayers(); updateKPI(); updateLevelChart && updateLevelChart(); dlg?.close();
  });
  btnReset?.addEventListener('click', ()=>{
    if (!confirm('Скинути всі локальні зміни?')) return;
    clearEdits(); reapplyEdits(); renderLayers(); updateKPI(); updateLevelChart && updateLevelChart(); openSettings();
  });

  dlg?.showModal();
}

window.initSettings = initSettings;

window.openSettings = openSettings;
