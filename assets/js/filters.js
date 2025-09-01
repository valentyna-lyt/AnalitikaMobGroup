import { state } from './state.js';

export function filteredData(){
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

export function currentMetric(d){
  const p = state.filters.period || 'today';
  return Number(d[p] ?? 0);
}

export function uniqueParents(levelFilter=''){
  const s = new Set();
  for (const d of state.data){
    if (levelFilter && d.level !== levelFilter) continue;
    const p = (d.parent||'').trim();
    if (p) s.add(p);
  }
  return Array.from(s).sort();
}
