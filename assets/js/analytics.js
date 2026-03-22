export function updateKPI(){
  const el = document.getElementById('kpi-box');
  if (!el) return;
  if (window.state && state.loading){
    el.innerHTML = '<div class="skeleton kpi-skeleton"></div>';
    return;
  }
  el.innerHTML = [
    `<div style="font-weight:bold; line-height:1.4;">ЗАГАЛЬНА КІЛЬКІСТЬ ТЕРИТОРІАЛЬНИХ ПІДРОЗДІЛІВ — <span style="color:#ffd700">42</span></div>`,
    `<div style="margin-top:1em; font-style:italic; font-weight:normal; font-size:0.82em; opacity:0.85;">5 РУП, 4 РВП, 13 ВП, 11 ВнП, 8 СПД, 1 ВПД</div>`
  ].join('');
}

// no-op — chart rendering handled in app.bundle.js
export function updateLevelChart(){ /* noop in source */ }
