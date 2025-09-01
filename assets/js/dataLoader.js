import { state } from './state.js';
import { saveSettings } from './storage.js';

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

export async function loadDemo(){ state.loading = true; updateKPI(); updateLevelChart();
  const res = await fetch('data/checks_formatted.csv', {cache:'no-cache'});
  const text = await res.text();
  const rows = parseCSV(text);
  state.dataSource = { type:'demo', url:'' }; state.loading = false;
  state.raw = Array.isArray(rows) ? rows : [];
  reapplyEdits();
}
export async function loadFromURL(url){ state.loading = true; updateKPI(); updateLevelChart();
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
  state.loading = false;
  reapplyEdits();
  saveSettings();
}

export async function loadFromFile(file){ state.loading = true; updateKPI(); updateLevelChart();
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
  state.loading = false;
  reapplyEdits();
}

export function reapplyEdits(){
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
