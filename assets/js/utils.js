export function debounce(fn, ms=250){
  let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), ms); };
}

export function downloadJSON(data, filename='data.json'){
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function toCSV(rows){
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

export function downloadCSV(rows, filename='data.csv'){
  const csv = toCSV(rows);
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function colorForValue(v){
  const n = Number(v);
  if (!isFinite(n) || n<=0) return '#1f78b4';
  if (n >= 80) return '#e31a1c';
  if (n >= 40) return '#fb9a99';
  if (n >= 20) return '#fdbf6f';
  if (n >= 10) return '#a6cee3';
  return '#1f78b4';
}

export function radiusForValue(v){
  const n = Number(v);
  if (!isFinite(n) || n<=0) return 6;
  return Math.min(40, 6 + Math.log(1+n)*6);
}
