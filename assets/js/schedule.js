// ---- schedule.js : Графік роботи мобільних груп ----
(function(){
  var state = { year: 0, month: 0, officers: [], cells: {} };
  var MONTHS = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];

  function pad(n){ return n<10 ? '0'+n : ''+n; }
  function fmtDate(y,m,d){ return y+'-'+pad(m+1)+'-'+pad(d); }
  function isWeekend(y,m,d){ var w=new Date(y,m,d).getDay(); return w===0||w===6; }
  function daysInMonth(y,m){ return new Date(y,m+1,0).getDate(); }
  function weekendDays(y,m){
    var out=[]; var n=daysInMonth(y,m);
    for (var d=1; d<=n; d++) if (isWeekend(y,m,d)) out.push(d);
    return out;
  }

  function isAdmin(){ return !window.IS_MOBILE_VIEWER && window.currentUser && window.currentUser.role === 'admin'; }

  async function loadOfficers(){
    try { state.officers = await window.localAPI.fetch('/mg/officers'); }
    catch(e){ state.officers = []; }
  }
  async function loadSchedule(){
    var from = fmtDate(state.year, state.month, 1);
    var to   = fmtDate(state.year, state.month, daysInMonth(state.year,state.month));
    try {
      var rows = await window.localAPI.fetch('/mg/schedule?from='+from+'&to='+to);
      state.cells = {};
      rows.forEach(function(r){ state.cells[r.officer_id+'|'+r.work_date] = true; });
    } catch(e){ state.cells = {}; }
  }

  function render(){
    var t = document.getElementById('mg-table');
    if (!t) return;
    var title = document.getElementById('mg-title');
    if (title) title.textContent = MONTHS[state.month] + ' ' + state.year;

    var tb = document.getElementById('mg-admin-toolbar');
    if (tb) tb.style.display = isAdmin() ? 'flex' : 'none';

    var days = weekendDays(state.year, state.month);
    if (!state.officers.length) {
      t.innerHTML = '<tr><td class="mg-empty">' +
        (isAdmin() ? 'Додайте першого поліцейського вище ↑' : 'Список ще не сформовано') +
        '</td></tr>';
      return;
    }

    var html = '<thead><tr><th class="mg-name">Поліцейський</th>';
    days.forEach(function(d){
      var w = new Date(state.year,state.month,d).getDay();
      var label = ['Нд','Пн','Вт','Ср','Чт','Пт','Сб'][w];
      html += '<th class="mg-weekend">'+d+'<br><span style="font-size:9px;opacity:.85">'+label+'</span></th>';
    });
    if (isAdmin()) html += '<th style="width:30px"></th>';
    html += '</tr></thead><tbody>';

    state.officers.forEach(function(o){
      html += '<tr><td class="mg-name">'+escHTML(o.full_name)+'</td>';
      days.forEach(function(d){
        var key = o.id+'|'+fmtDate(state.year,state.month,d);
        var on = !!state.cells[key];
        html += '<td class="mg-cell'+(on?' on':'')+(isAdmin()?' editable':'')+
                '" data-officer="'+o.id+'" data-day="'+d+'"></td>';
      });
      if (isAdmin()) html += '<td><button class="mg-row-del" data-officer="'+o.id+'" title="Видалити">✕</button></td>';
      html += '</tr>';
    });
    html += '</tbody>';
    t.innerHTML = html;

    if (isAdmin()) {
      t.querySelectorAll('.mg-cell.editable').forEach(function(c){
        c.addEventListener('click', toggleCell);
      });
      t.querySelectorAll('.mg-row-del').forEach(function(b){
        b.addEventListener('click', deleteOfficer);
      });
    }
  }

  async function toggleCell(e){
    var c = e.currentTarget;
    var officer_id = c.dataset.officer;
    var d = parseInt(c.dataset.day);
    var date = fmtDate(state.year,state.month,d);
    var key = officer_id+'|'+date;
    var on = !!state.cells[key];
    try {
      if (on) {
        await window.localAPI.fetch('/mg/schedule', {
          method: 'DELETE',
          body: JSON.stringify({ officer_id: officer_id, work_date: date })
        });
        delete state.cells[key];
        c.classList.remove('on');
      } else {
        await window.localAPI.fetch('/mg/schedule', {
          method: 'POST',
          body: JSON.stringify({ officer_id: officer_id, work_date: date })
        });
        state.cells[key] = true;
        c.classList.add('on');
      }
    } catch(err) { alert('Помилка: '+err.message); }
  }

  async function addOfficer(){
    var inp = document.getElementById('mg-new-name');
    var name = (inp.value||'').trim();
    if (!name) return;
    try {
      var o = await window.localAPI.fetch('/mg/officers', {
        method:'POST', body: JSON.stringify({ full_name: name })
      });
      state.officers.push(o);
      inp.value = '';
      render();
    } catch(err){ alert('Помилка: '+err.message); }
  }

  async function deleteOfficer(e){
    var id = e.currentTarget.dataset.officer;
    if (!confirm('Видалити поліцейського зі списку?')) return;
    try {
      await window.localAPI.fetch('/mg/officers/'+id, { method:'DELETE' });
      state.officers = state.officers.filter(function(o){ return o.id !== id; });
      Object.keys(state.cells).forEach(function(k){ if (k.indexOf(id+'|')===0) delete state.cells[k]; });
      render();
    } catch(err){ alert('Помилка: '+err.message); }
  }

  async function savePdf(){
    var table = document.getElementById('mg-table');
    if (!table) return;
    var btn = document.getElementById('mg-save-pdf');
    var label = btn.textContent;
    btn.textContent = '⏳ Готую...'; btn.disabled = true;
    try {
      // Render in a wrapper with title
      var wrap = document.createElement('div');
      wrap.style.cssText = 'background:#fff;padding:24px;font-family:Arial,sans-serif;width:780px;';
      wrap.innerHTML =
        '<h2 style="margin:0 0 4px;color:#1f3d8a;font-size:22px">Графік роботи мобільних груп</h2>' +
        '<p style="margin:0 0 16px;color:#555;font-size:14px">' + MONTHS[state.month] + ' ' + state.year + ' · вихідні дні</p>';
      var clone = table.cloneNode(true);
      // Remove delete-button column
      clone.querySelectorAll('tr').forEach(function(tr){
        var last = tr.lastElementChild;
        if (last && (last.querySelector('.mg-row-del') || (last.tagName==='TH' && !last.textContent.trim()))) {
          last.remove();
        }
      });
      // Compact name column
      clone.querySelectorAll('.mg-name').forEach(function(c){
        c.style.minWidth = '170px'; c.style.width = '170px'; c.style.padding = '6px 10px';
      });
      wrap.appendChild(clone);
      document.body.appendChild(wrap);
      var canvas = await html2canvas(wrap, { scale: 2, backgroundColor: '#ffffff' });
      document.body.removeChild(wrap);
      var img = canvas.toDataURL('image/png');
      var jsPDF = window.jspdf.jsPDF;
      var pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      var pw = pdf.internal.pageSize.getWidth() - 20;
      var ph = canvas.height * pw / canvas.width;
      pdf.addImage(img, 'PNG', 10, 10, pw, ph);
      pdf.save('Графік_МГ_' + MONTHS[state.month] + '_' + state.year + '.pdf');
    } catch(e) {
      alert('Не вдалось створити PDF: ' + e.message);
    } finally {
      btn.textContent = label; btn.disabled = false;
    }
  }

  async function refresh(){
    await Promise.all([loadOfficers(), loadSchedule()]);
    render();
  }

  function shiftMonth(delta){
    var d = new Date(state.year, state.month+delta, 1);
    state.year = d.getFullYear(); state.month = d.getMonth();
    refresh();
  }

  function init(){
    var now = new Date();
    state.year = now.getFullYear(); state.month = now.getMonth();

    var prev = document.getElementById('mg-prev');
    var next = document.getElementById('mg-next');
    if (prev) prev.addEventListener('click', function(){ shiftMonth(-1); });
    if (next) next.addEventListener('click', function(){ shiftMonth(1); });

    var addBtn = document.getElementById('mg-add-officer');
    if (addBtn) addBtn.addEventListener('click', addOfficer);
    var pdfBtn = document.getElementById('mg-save-pdf');
    if (pdfBtn) pdfBtn.addEventListener('click', savePdf);
    var inp = document.getElementById('mg-new-name');
    if (inp) inp.addEventListener('keydown', function(e){ if (e.key==='Enter') addOfficer(); });

    // tab switcher
    document.querySelectorAll('.sb-tab').forEach(function(t){
      t.addEventListener('click', function(){
        document.querySelectorAll('.sb-tab').forEach(function(x){ x.classList.remove('active'); });
        t.classList.add('active');
        var v = t.dataset.view;
        document.getElementById('view-units').classList.toggle('hidden', v!=='units');
        document.getElementById('view-schedule').classList.toggle('hidden', v!=='schedule');
        if (v==='schedule') refresh();
      });
    });

    document.addEventListener('userSignedIn', refresh);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
