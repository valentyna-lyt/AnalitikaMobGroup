export function updateKPI(){
  const el = document.getElementById('kpi-box');
  if (!el) return;
  el.style.background = 'var(--card)';
  el.style.borderRadius = '12px';
  el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)';
  el.style.padding = '24px';
  el.style.margin = '20px auto';
  el.style.textAlign = 'center';
  el.style.fontSize = '26px';
  el.style.fontWeight = 'bold';
  el.style.color = 'var(--text)';
  el.style.textTransform = 'uppercase';
  if (window.state && state.loading){
    el.innerHTML = `<div class="skeleton kpi-skeleton"></div>`;
    return;
  }
  el.innerHTML = [
    `<div style="font-weight: bold;">ЗАГАЛЬНА КІЛЬКІСТЬ ТЕРИТОРІАЛЬНИХ ПІДРОЗДІЛІВ - <span style="color:#ffd700">42</span></div>`,
    `<div style="margin-top: 2em; font-style: italic; font-weight: normal; font-size: 20px;">5 РУП, 4 РВП, 13 ВП, 11 ВнП, 8 СПД, 1 ВПД</div>`
  ].join('');
}
el.innerHTML = [
    `<div>ЗАГАЛЬНА КІЛЬКІСТЬ ТЕРИТОРІАЛЬНИХ ПІДРОЗДІЛІВ - <span style="color:#ffd700">42</span></div>`,
    `<div style="margin-top: 2em; font-style: italic;">5 РУП, 4 РВП, 13 ВП, 11 ВнП, 8 СПД, 1 ВПД</div>`
  ].join('');
}
el.innerHTML = [
    `<div>Загальна кількість територіальних підрозділів - <span style="color:#ffd700">42</span></div>`,
    `<div style="margin-top: 1.8em">5 РУП, 4 РВП, 13 ВП, 11 ВнП, 8 СПД, 1 ВПД</div>`
  ].join('');
}
// no-op to satisfy imports from main.js/settings.js
export function updateLevelChart(){ /* noop */ }
