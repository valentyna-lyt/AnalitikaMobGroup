
// ---- state.js ----
var state = {
  data: [],           // original + edits applied
  raw: [],            // original data received (before edits)
  edits: {},          // {id: {name, level, parent, lat, lon, color}}
  filters: { period: 'today', level: '', parent: '', query: '' },
  mapmode: 'points',
  theme: localStorage.getItem('theme') || 'dark',
  dataSource: { type: 'demo', url: '' },
  refreshMinutes: 0,
  refreshTimer: null,
};


// ---- storage.js ----

const KEY = 'gunp_map_settings_v1';

function saveSettings() {
  const payload = {
    edits: state.edits,
    theme: state.theme,
    dataSource: state.dataSource,
    refreshMinutes: state.refreshMinutes,
  };
  localStorage.setItem(KEY, JSON.stringify(payload));
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const obj = JSON.parse(raw);
    state.edits = obj.edits || {};
    state.theme = obj.theme || state.theme;
    state.dataSource = obj.dataSource || state.dataSource;
    state.refreshMinutes = typeof obj.refreshMinutes === 'number' ? obj.refreshMinutes : state.refreshMinutes;
  } catch(e){ console.warn('loadSettings error', e); }
}

function clearEdits() {
  state.edits = {};
  saveSettings();
}


// ---- utils.js ----
function debounce(fn, ms=250){
  let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), ms); };
}

function downloadJSON(data, filename='data.json'){
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function toCSV(rows){
  if (!rows || !rows.length) return '';
  const headers = Array.from(new Set(rows.flatMap(r=>Object.keys(r))));
  const esc = v => {
    if (v==null) return '';
    const s = String(v);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
    return s;
  };
  const lines = [];
  lines.push(headers.map(esc).join(','));
  for (const r of rows){
    lines.push(headers.map(h=>esc(r[h])).join(','));
  }
  return lines.join('\n');
}

function downloadCSV(rows, filename='data.csv'){
  const csv = toCSV(rows);
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function colorForValue(v){
  const n = Number(v);
  if (!isFinite(n) || n<=0) return '#1f78b4';
  if (n >= 80) return '#e31a1c';
  if (n >= 40) return '#fb9a99';
  if (n >= 20) return '#fdbf6f';
  if (n >= 10) return '#a6cee3';
  return '#1f78b4';
}

function radiusForValue(v){
  const n = Number(v);
  if (!isFinite(n) || n<=0) return 6;
  return Math.min(40, 6 + Math.log(1+n)*6);
}


// ---- filters.js ----

function filteredData(){
  const { level, parent, query } = state.filters;
  let items = state.data;
  if (level) items = items.filter(x => (x.level || '').toLowerCase() === level.toLowerCase());
  if (parent) items = items.filter(x => (x.parent || '').toLowerCase() === parent.toLowerCase());
  if (query){
    const q = query.toLowerCase();
    items = items.filter(x => (x.name||'').toLowerCase().includes(q) || (x.id||'').toLowerCase().includes(q));
  }
  return items;
}

function currentMetric(d){
  const p = state.filters.period || 'today';
  return Number(d[p] ?? 0);
}

function uniqueParents(levelFilter=''){
  const s = new Set();
  for (const d of state.data){
    if (levelFilter && d.level !== levelFilter) continue;
    const p = (d.parent||'').trim();
    if (p) s.add(p);
  }
  return Array.from(s).sort();
}


// ---- dataLoader.js ----


function coerceRecord(r){
  const copy = {...r};
  copy.id = String(copy.id ?? '').trim();
  copy.name = String(copy.name ?? '').trim();
  copy.level = String(copy.level ?? '').trim();
  copy.parent = String(copy.parent ?? '').trim();
  copy.lat = (copy.lat===''||copy.lat==null) ? NaN : Number(copy.lat);
  copy.lon = (copy.lon===''||copy.lon==null) ? NaN : Number(copy.lon);
  copy.today = Number(copy.today ?? 0);
  copy.m30 = Number(copy.m30 ?? 0);
  copy.ytd = Number(copy.ytd ?? 0);
  if (copy.color) copy.color = String(copy.color).trim();
  copy.inspectors = (copy.inspectors ?? '').toString().trim();
  copy.last_check = (copy.last_check ?? '').toString().trim();
  return copy;
}

function normalizeArray(rows){
  if (!Array.isArray(rows)) return [];
  return rows.map(coerceRecord);
}

async function loadDemo(){
  const res = await fetch('data/checks_formatted.csv', {cache:'no-cache'});
  const text = await res.text();
  const rows = parseCSV(text);
  state.dataSource = { type:'demo', url:'' };
  state.raw = Array.isArray(rows) ? rows : [];
  reapplyEdits();
}
async function loadFromURL(url){
  const res = await fetch(url, {cache:'no-cache'});
  const ct = res.headers.get('content-type')||'';
  let rows = [];
  if (ct.includes('application/json') || url.toLowerCase().endsWith('.json')){
    rows = await res.json();
  } else {
    const text = await res.text();
    rows = parseCSV(text);
  }
  state.dataSource = { type:'url', url };
  state.raw = rows;
  reapplyEdits();
  saveSettings();
}

async function loadFromFile(file){
  const name = (file?.name||'').toLowerCase();
  const buf = await file.arrayBuffer();
  const text = new TextDecoder().decode(buf);
  let rows = [];
  if (name.endsWith('.json')){
    rows = JSON.parse(text);
  } else if (name.endsWith('.csv')){
    rows = parseCSV(text);
  } else {
    alert('Підтримується лише JSON або CSV');
    return;
  }
  state.dataSource = { type:'file', url:'' };
  state.raw = rows;
  reapplyEdits();
}

function reapplyEdits(){
  const base = Array.isArray(state.raw) ? state.raw.slice() : [];
  let rows = normalizeArray(base);
  if (state.edits && Object.keys(state.edits).length){
    rows = rows.map(d=>{
      const e = state.edits[d.id];
      if (!e) return d;
      return {
        ...d,
        ...Object.fromEntries(Object.entries(e).filter(([k,v])=>v!=='' && v!=null)),
        lat: (e?.lat!==undefined && e.lat!=='') ? Number(e.lat) : d.lat,
        lon: (e?.lon!==undefined && e.lon!=='') ? Number(e.lon) : d.lon,
      };
    });
  }
  state.data = rows;
}

// Simple CSV with quotes support
function parseCSV(text){
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = smartSplit(lines.shift());
  const rows = [];
  for (const line of lines){
    const parts = smartSplit(line);
    const obj = {};
    for (let i=0;i<headers.length;i++){
      obj[headers[i]] = parts[i] ?? '';
    }
    rows.push(obj);
  }
  return rows;
}

function smartSplit(line){
  const out = []; let cur = ''; let inQ = false;
  for (let i=0;i<line.length;i++){
    const ch = line[i];
    if (ch === '"'){
      if (inQ && line[i+1]==='"'){ cur+='"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ){
      out.push(cur); cur='';
    } else {
      cur+=ch;
    }
  }
  out.push(cur);
  return out.map(s=>s.trim());
}


// ---- map.js ----

const KHARKIV_BOUNDS = [[48.75, 34.90],[50.55, 38.60]];



let map;
let clusterLayer;

function initMap(){
  map = L.map('map', { zoomControl: true });
  window.leaflet_map = map;
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  fetch('data/kharkiv_bounds.geojson')
    .then(r=>r.ok?r.json():Promise.reject('no geojson'))
    .then(gj=>{
      const g = L.geoJSON(gj);
      const bb = g.getBounds();
      if (bb.isValid()) map.fitBounds(bb.pad(0.05));
    })
    .catch(()=>{
      map.fitBounds(KHARKIV_BOUNDS);
    });

  clusterLayer = L.markerClusterGroup({ showCoverageOnHover:false, maxClusterRadius:60 });
  map.addLayer(clusterLayer);
  // Червоний контур меж Харківської області
  fetch('data/kharkiv_bounds.geojson')
    .then(r=>r.json())
    .then(gj=>{
      L.geoJSON(gj, { style:{ color:'red', weight:2, fill:false } }).addTo(map);
    })
    .catch(()=>{});

  // fallback центр Харкова, якщо geojson не спрацює
  map.setView([49.9935,36.2304], 9);
}

function renderLayers(){
  if (!map) return;
  clusterLayer.clearLayers();
  const rows = filteredData();
  rows.forEach(d=>{
    if (!Number.isFinite(d.lat) || !Number.isFinite(d.lon)) return;
    const val = currentMetric(d);
    const m = L.circleMarker([d.lat, d.lon], {
      radius: radiusForValue(val),
      fillColor: d.color || colorForValue(val),
      fillOpacity: 0.85,
      weight: 1,
      color: '#1f2937'
    }).bindPopup(popupHTML(d));
    clusterLayer.addLayer(m);
  });
}


function formatDate(str){
  if (!str) return '—';
  const d = new Date(str);
  if (isNaN(d)) return str;
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}


// Build a Google Drive 'view' URL from a file ID
function driveViewUrlFromId(fileId){
  if (!fileId) return '';
  return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`;
}

// Immediately show photo when popup opens
function attachHoverHandlersToPopup(popup){
  const el = popup.getElement()?.querySelector('.leaflet-popup-content');
  if (!el) return;
  const root = el.querySelector('.unit-popup');
  if (!root) return;
  const wrap = el.querySelector('.unit-photo-wrap');
  const img  = el.querySelector('.unit-photo-wrap img');
  const url  = root.getAttribute('data-photo-url');
  if (!url || !wrap || !img) return;
  img.src = url;
  wrap.classList.add('show');
  img.addEventListener('error', ()=>wrap.classList.remove('show'));
}

// Map specific unit names/aliases to a fixed photo URL
function photoUrlFor(d){
  const name = (d?.name || '').toLowerCase().trim();
  const aliases = [
    /харківський\s*руп\s*№?\s*1/,
    /хруп\s*№?\s*1/,
    /хруп\s*1/
  ];
  for (const rx of aliases){ if (rx.test(name)) return "assets/img/rup1.jpg"; }
  return '';
}
function popupHTML(d){
  let photoUrl = d.photoUrl || (d.photoId ? driveViewUrlFromId(d.photoId) : '');
  const fixed = photoUrlFor(d);
  if (fixed) photoUrl = fixed;
  return `<div class="popup unit-popup" data-photo-url="${photoUrl||''}">
    <strong>${d.name || '—'}</strong>
    <div style="margin-top:6px">
      <div>З початку року: <b>${Number(d.ytd||0)}</b></div>
      <div>Прізвища перевіряючих: <b>${d.inspectors || '—'}</b></div>
      <div>Дата останньої перевірки: <b>${formatDate(d.last_check)}</b></div>
    </div>
  </div>`;
}

function locateMe(){
  if (!map) return;
  map.locate({ setView: true, maxZoom: 12 });
}

function printMap(){
  try{ window.print(); }catch(e){ console.warn(e); }
}

if (typeof window!=='undefined'){
  window.addEventListener('resize', ()=>{
    try{ if (window.leaflet_map) window.leaflet_map.invalidateSize(); }catch{}
  });
}


// ---- analytics.js ----
function updateKPI(){
  const el = document.getElementById('kpi-box');
  if (!el) return;
  el.style.color = 'white';
  el.style.background = 'var(--card)';
  el.style.padding = '16px 20px';
  el.style.margin = '0 16px 12px';
  el.style.borderRadius = '8px';
  el.style.fontSize = '20px';
  el.style.fontWeight = 'bold';
  el.style.textAlign = 'center';
  el.innerHTML = `Загальна кількість територіальних підрозділів - 42<br>
  5 РУП, 4 РВП, 13 ВП, 11 ВнП, 8 СПД, 1 ВПД`;
}


// no-op to satisfy imports from main.js/settings.js
function updateLevelChart(){
  try{
    var canvas = document.getElementById('levelChart');
    if (!canvas) return;
    var chartBox = canvas.parentElement;
    if (window.state && state.loading){ if(chartBox){ chartBox.innerHTML = '<div class="skeleton chart-skeleton"></div>'; } return; }
    if (!window.Chart) return;
    if(chartBox){ chartBox.innerHTML = '<canvas id="levelChart"></canvas>'; canvas = chartBox.querySelector('#levelChart'); }
    var rows = Array.isArray(state && state.data) ? state.data.slice() : [];
    rows.sort(function(a,b){ return (Number(b.ytd||0) - Number(a.ytd||0)); });
    var top = rows.slice(0, Math.min(5, rows.length));
    var labels = top.map(function(r){
      const name = r.name || '—';
      if (name.includes('(')){
        const base = name.substring(0, name.indexOf('(')).trim();
        const extra = name.substring(name.indexOf('(')).trim();
        return [base, extra];
      }
      return name;
    });
    var values = top.map(function(r){ return Number(r.ytd||0); });
    if (window.__levelChart) { window.__levelChart.destroy(); }
    window.__levelChart = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{ 
          label: 'К-сть перевірок за рік',
          data: values,
          backgroundColor: ['#4e79a7','#f28e2b','#e15759','#76b7b2','#59a14f'].slice(0, values.length)
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { left: 20, right: 10, top: 10, bottom: 10 } },
          plugins: {
          legend: { display: false, labels: { color: (getComputedStyle(document.body).getPropertyValue('--text')||'#111').trim() } },
          title: { display: true, text: 'Найбільша кількість перевірок', align:'center', color: (getComputedStyle(document.body).getPropertyValue('--text')||'#111').trim(), font:{size:18, weight:'bold'} }
        },
        scales: {
          x: { ticks: { color: (getComputedStyle(document.body).getPropertyValue('--text')||'#111').trim() }, beginAtZero: true },
          y: { ticks: { color: (getComputedStyle(document.body).getPropertyValue('--text')||'#111').trim(), align: 'end', crossAlign: 'center', autoSkip: false } }
        }
      }
    });
  }catch(err){ console.warn('updateLevelChart failed', err); }
}
// ---- ui.js ----








function refreshParents(){
  const sel = document.getElementById('filter-parent');
  const levelSel = document.getElementById('filter-level');
  const level = levelSel.value || '';
  const parents = uniqueParents(level);
  const prev = sel.value;
  sel.innerHTML = '<option value="">Всі</option>' + parents.map(p=>`<option>${p}</option>`).join('');
  if (parents.includes(prev)) sel.value = prev;
}

function bindUI(){
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


// ---- settings.js ----
function initSettings(){ /* init settings header no-op; header will be reset in openSettings */ }





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

function openSettings(){
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
  btnApply?.addEventListener('click', async ()=>{
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


// ---- main.js ----







async // ---- Cloudflare D1 API bridge (injected) ----
async function loadFromAPI(){
  const base = (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || '';
  const res = await fetch(base + '/api/units', { cache: 'no-cache' });
  if (!res.ok) throw new Error('API list failed');
  const rows = await res.json();
  state.dataSource = { type:'api', url:'' };
  state.raw = Array.isArray(rows) ? rows : [];
}
async function syncEditsToAPI(){
  try{
    const base = (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || '';
    const token = (window.APP_CONFIG && window.APP_CONFIG.ADMIN_TOKEN) || '';
    const edits = state.edits || {};
    const payload = Object.entries(edits).map(([id, patch])=>({ id:Number(id), ...patch }));
    if (!payload.length) return;
    const res = await fetch(base + '/api/units/bulk', {
      method:'POST',
      headers: {'Content-Type':'application/json', ...(token?{'Authorization':'Bearer '+token}:{})},
      body: JSON.stringify({ edits: payload })
    });
    if (!res.ok) throw new Error('API bulk failed');
    state.edits = {};
  } catch(e){ console.warn('syncEditsToAPI failed', e); }
}

function boot(){
  loadSettings();
  if (state.theme==='light') document.body.classList.add('theme-light');

  initMap();
  initSettings();
  bindUI();

  try {
    try {
      await loadFromAPI();
    } catch(e){
      console.warn('API load failed, fallback to demo', e);
      state.dataSource = { type: 'demo', url: '' };
      await loadDemo();
    }
  } catch(e){
    console.warn('Помилка при завантаженні даних (демо)', e);
  }

  reapplyEdits();
  renderLayers();
  updateKPI();
  updateLevelChart();
}

boot().catch(e=>console.warn('Boot failed', e));

