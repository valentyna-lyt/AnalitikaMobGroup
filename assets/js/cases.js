// ---- cases.js ----

function escHTML(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function formatDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('uk-UA',{day:'2-digit',month:'2-digit',year:'numeric'}); }
  catch(e) { return d; }
}

// ============================================================
// API
// ============================================================

async function loadInspectionsForUnit(unitId) {
  return window.localAPI.fetch('/cases/' + encodeURIComponent(unitId));
}

// ============================================================
// ПЕРЕВІРКИ TAB
// ============================================================

window.loadSidebarChecks = async function(unitId, unitName) {
  var panel = document.getElementById('sidebar-checks-panel');
  if (!panel) return;
  panel.innerHTML = '<div class="loading" style="padding:24px;text-align:center">Завантаження...</div>';

  try {
    var items = await loadInspectionsForUnit(unitId);
    renderChecksList(panel, items, unitId, unitName);
  } catch(e) {
    panel.innerHTML = '<div class="error-msg" style="padding:16px">⚠️ ' + escHTML(e.message) + '</div>';
  }
};

function renderChecksList(panel, items, unitId, unitName) {
  // Sort by date desc
  var sorted = items.slice().sort(function(a,b){
    return new Date(b.case_date||0) - new Date(a.case_date||0);
  });

  var now = new Date();
  var ytd = sorted.filter(function(c){
    return c.case_date && new Date(c.case_date).getFullYear() === now.getFullYear();
  }).length;

  var html = '';

  // Admin: add form
  if (isAdmin()) {
    html += '<div class="insp-add-wrap">' +
      '<button class="btn-add-insp" id="insp-add-toggle">＋ Додати перевірку</button>' +
      '<div class="insp-add-form hidden" id="insp-add-form">' +
        '<div class="form-group">' +
          '<label class="form-label">📅 Дата перевірки *</label>' +
          '<input type="date" id="insp-date" class="form-control">' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">👤 Хто перевіряв *</label>' +
          '<input type="text" id="insp-inspector" class="form-control" placeholder="ПІБ або посада перевіряючого">' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">📝 Результати перевірки</label>' +
          '<textarea id="insp-notes" class="form-control" rows="3" placeholder="Короткі нотатки щодо результатів..."></textarea>' +
        '</div>' +
        '<div id="insp-err" class="error-msg" style="margin-bottom:6px"></div>' +
        '<div class="insp-form-actions">' +
          '<button id="insp-save" class="btn-primary-sm">Зберегти</button>' +
          '<button id="insp-cancel" class="btn-outline-sm">Скасувати</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // Summary
  html += '<div class="checks-summary">' +
    '<span class="checks-summary-label">Перевірок у ' + now.getFullYear() + ' р.:</span>' +
    '<span class="checks-summary-count">' + ytd + '</span>' +
  '</div>';

  // List
  if (!sorted.length) {
    html += '<div class="checks-empty">Перевірок не зафіксовано</div>';
  } else {
    html += '<div class="checks-list">';
    sorted.forEach(function(c, i) {
      html += renderCheckCard(c, i, items);
    });
    html += '</div>';
  }

  panel.innerHTML = html;
  bindChecksEvents(panel, items, unitId, unitName);
}

function renderCheckCard(c, idx, allItems) {
  var dateStr = c.case_date ? new Date(c.case_date).toLocaleDateString('uk-UA',{day:'2-digit',month:'long',year:'numeric'}) : '—';
  var delBtn = isAdmin()
    ? '<button class="check-del-btn" data-id="' + escHTML(c.id) + '" title="Видалити">🗑</button>'
    : '';

  return '<div class="check-card">' +
    '<div class="check-card-top">' +
      '<div class="check-date-badge">📅 ' + escHTML(dateStr) + '</div>' +
      delBtn +
    '</div>' +
    '<div class="check-inspector">👤 ' + escHTML(c.title || '—') + '</div>' +
    (c.description ? '<div class="check-notes">' + escHTML(c.description) + '</div>' : '') +
  '</div>';
}

function bindChecksEvents(panel, items, unitId, unitName) {
  // Toggle add form
  var toggleBtn = panel.querySelector('#insp-add-toggle');
  var addForm = panel.querySelector('#insp-add-form');
  if (toggleBtn && addForm) {
    toggleBtn.addEventListener('click', function() {
      addForm.classList.toggle('hidden');
      toggleBtn.textContent = addForm.classList.contains('hidden') ? '＋ Додати перевірку' : '✕ Скасувати';
    });
  }

  // Cancel
  var cancelBtn = panel.querySelector('#insp-cancel');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', function() {
      if (addForm) addForm.classList.add('hidden');
      if (toggleBtn) toggleBtn.textContent = '＋ Додати перевірку';
    });
  }

  // Save
  var saveBtn = panel.querySelector('#insp-save');
  if (saveBtn) {
    saveBtn.addEventListener('click', async function() {
      var date = panel.querySelector('#insp-date')?.value;
      var inspector = panel.querySelector('#insp-inspector')?.value.trim();
      var notes = panel.querySelector('#insp-notes')?.value.trim();
      var errEl = panel.querySelector('#insp-err');

      if (!date) { errEl.textContent = 'Вкажіть дату перевірки'; return; }
      if (!inspector) { errEl.textContent = 'Вкажіть хто перевіряв'; return; }
      errEl.textContent = '';
      saveBtn.disabled = true;
      saveBtn.textContent = 'Збереження...';

      try {
        await window.localAPI.fetch('/cases', {
          method: 'POST',
          body: JSON.stringify({
            unit_id: unitId,
            unit_name: unitName,
            title: inspector,
            description: notes || null,
            case_date: date
          })
        });
        var updated = await loadInspectionsForUnit(unitId);
        renderChecksList(panel, updated, unitId, unitName);
      } catch(err) {
        errEl.textContent = err.message;
        saveBtn.disabled = false;
        saveBtn.textContent = 'Зберегти';
      }
    });
  }

  // Delete
  panel.querySelectorAll('.check-del-btn').forEach(function(btn) {
    btn.addEventListener('click', async function() {
      if (!confirm('Видалити запис про перевірку?')) return;
      try {
        await window.localAPI.fetch('/cases/' + btn.dataset.id, { method: 'DELETE' });
        var updated = await loadInspectionsForUnit(unitId);
        renderChecksList(panel, updated, unitId, unitName);
      } catch(e) { alert('Помилка: ' + e.message); }
    });
  });
}

// Backward compat
window.showUnitCasesModal = function(unitId, unitName) {
  if (window.openUnitSidebar) {
    window.openUnitSidebar({ unitId: String(unitId), unitName: String(unitName) });
  }
};

document.addEventListener('click', function(e) {
  var btn = e.target.closest('.btn-unit-info');
  if (!btn) return;
  window.openUnitSidebar && window.openUnitSidebar({ unitId: btn.dataset.unitId, unitName: btn.dataset.unitName });
});
