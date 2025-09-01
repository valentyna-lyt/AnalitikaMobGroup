
const KHARKIV_BOUNDS = [[48.75, 34.90],[50.55, 38.60]];

import { state } from './state.js';
import { filteredData, currentMetric } from './filters.js';
import { colorForValue, radiusForValue } from './utils.js';

let map;
let clusterLayer;

export function initMap(){
  map = L.map('map', { zoomControl: true });
  map.on('popupopen', (e)=>{ try{ attachHoverHandlersToPopup(e.popup); }catch(err){ console.warn(err); } });
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

export function renderLayers(){
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
    <div class="unit-photo-wrap"><img alt="Фото підрозділу" loading="lazy"></div>
  </div>`;
}

export function locateMe(){
  if (!map) return;
  map.locate({ setView: true, maxZoom: 12 });
}

export function printMap(){
  try{ window.print(); }catch(e){ console.warn(e); }
}

if (typeof window!=='undefined'){
  window.addEventListener('resize', ()=>{
    try{ if (window.leaflet_map) window.leaflet_map.invalidateSize(); }catch{}
  });
}
