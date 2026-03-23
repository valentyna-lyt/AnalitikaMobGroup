// ---- cases.js ----

function escHTML(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function formatDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('uk-UA'); } catch(e) { return d; }
}

async function loadCasesForUnit(unitId) {
  return window.localAPI.fetch('/cases/' + encodeURIComponent(unitId));
}

function getCasesPanel() {
  return document.getElementById('sidebar-cases-panel');
}

function renderCasesList(cases, unitId, unitName) {
  var panel = getCasesPanel();
  if (!panel) return;

  var addBtn = isAdmin()
    ? '<button class="btn btn-primary btn-sm" id="cases-add-btn" style="margin-bottom:12px">+ Додати справу</button>'
    : '';

  if (!cases.length) {
    panel.innerHTML = addBtn + '<div class="no-data">Кураторські справи відсутні</div>';
  } else {
    panel.innerHTML = addBtn + cases.map(function(c) {
      return '<div class="case-item">' +
        '<div class="case-header">' +
        '<span class="case-title">' + escHTML(c.title) + '</span>' +
        '<span class="case-date">' + (c.case_date ? formatDate(c.case_date) : '—') + '</span>' +
        '</div>' +
        (c.description ? '<div class="case-desc">' + escHTML(c.description) + '</div>' : '') +
        (isAdmin() ? '<div class="case-actions">' +
          '<button class="btn-sm btn-edit-case" data-id="' + escHTML(c.id) + '">✏️</button>' +
          '<button class="btn-sm btn-danger btn-delete-case" data-id="' + escHTML(c.id) + '">🗑️</button>' +
          '</div>' : '') +
        '</div>';
    }).join('');
  }

  panel.querySelector('#cases-add-btn')?.addEventListener('click', function() {
    showCaseEditForm(null, unitId, unitName);
  });

  if (isAdmin()) {
    panel.querySelectorAll('.btn-edit-case').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var c = cases.find(function(x) { return String(x.id) === String(btn.dataset.id); });
        if (c) showCaseEditForm(c, unitId, unitName);
      });
    });
    panel.querySelectorAll('.btn-delete-case').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        if (!confirm('Видалити справу?')) return;
        try {
          await window.localAPI.fetch('/cases/' + btn.dataset.id, { method: 'DELETE' });
          var updated = await loadCasesForUnit(unitId);
          renderCasesList(updated, unitId, unitName);
        } catch(e) { alert('Помилка: ' + e.message); }
      });
    });
  }
}

function showCaseEditForm(existing, unitId, unitName) {
  var panel = getCasesPanel();
  if (!panel) return;

  panel.innerHTML =
    '<div class="case-edit-form">' +
    '<h4 style="margin:0 0 12px;font-size:13px;color:var(--accent)">' + (existing ? 'Редагувати справу' : 'Нова справа') + '</h4>' +
    '<div class="form-group"><label>Назва *</label>' +
    '<input type="text" id="ce-title" class="form-control" value="' + escHTML(existing?.title||'') + '" placeholder="Назва справи..."></div>' +
    '<div class="form-group"><label>Дата</label>' +
    '<input type="date" id="ce-date" class="form-control" value="' + escHTML(existing?.case_date ? existing.case_date.slice(0,10) : '') + '"></div>' +
    '<div class="form-group"><label>Опис</label>' +
    '<textarea id="ce-desc" class="form-control" rows="3" placeholder="Деталі...">' + escHTML(existing?.description||'') + '</textarea></div>' +
    '<div id="ce-error" class="error-msg" style="margin-bottom:8px"></div>' +
    '<div style="display:flex;gap:8px">' +
    '<button id="ce-save" class="btn btn-primary btn-sm">Зберегти</button>' +
    '<button id="ce-cancel" class="btn btn-outline btn-sm">Скасувати</button>' +
    '</div></div>';

  panel.querySelector('#ce-cancel').addEventListener('click', async function() {
    var cases = await loadCasesForUnit(unitId);
    renderCasesList(cases, unitId, unitName);
  });

  panel.querySelector('#ce-save').addEventListener('click', async function() {
    var title = panel.querySelector('#ce-title').value.trim();
    var errEl = panel.querySelector('#ce-error');
    if (!title) { errEl.textContent = "Назва є обов'язковою"; return; }
    errEl.textContent = '';
    var saveBtn = panel.querySelector('#ce-save');
    saveBtn.disabled = true;

    var payload = {
      unit_id: unitId, unit_name: unitName,
      title: title,
      description: panel.querySelector('#ce-desc').value.trim() || null,
      case_date: panel.querySelector('#ce-date').value || null
    };

    try {
      if (existing?.id) {
        await window.localAPI.fetch('/cases/' + existing.id, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await window.localAPI.fetch('/cases', { method: 'POST', body: JSON.stringify(payload) });
      }
      var cases = await loadCasesForUnit(unitId);
      renderCasesList(cases, unitId, unitName);
    } catch(err) {
      errEl.textContent = err.message;
      saveBtn.disabled = false;
    }
  });
}

window.loadSidebarCases = async function(unitId, unitName) {
  var panel = getCasesPanel();
  if (!panel) return;
  panel.innerHTML = '<div class="loading">Завантаження...</div>';
  try {
    var cases = await loadCasesForUnit(unitId);
    renderCasesList(cases, unitId, unitName);
  } catch(e) {
    panel.innerHTML = '<div class="error-msg">' + escHTML(e.message) + '</div>';
  }
};

// ============================================================
// INSPECTIONS TAB — sorted by date, read-only
// ============================================================

window.loadSidebarChecks = async function(unitId, unitName) {
  var panel = document.getElementById('sidebar-checks-panel');
  if (!panel) return;
  panel.innerHTML = '<div class="loading" style="padding:20px;text-align:center">Завантаження...</div>';
  try {
    var cases = await loadCasesForUnit(unitId);
    if (!cases.length) {
      panel.innerHTML = '<div class="checks-empty">Перевірок не зафіксовано</div>';
      return;
    }
    // Sort by date descending
    cases.sort(function(a, b) {
      return new Date(b.case_date || 0) - new Date(a.case_date || 0);
    });
    // Count ytd
    var now = new Date();
    var ytdCount = cases.filter(function(c) {
      if (!c.case_date) return false;
      return new Date(c.case_date).getFullYear() === now.getFullYear();
    }).length;

    var html = '<div class="checks-summary">Всього за рік: <strong>' + ytdCount + '</strong> перевірок</div>';
    html += '<div class="checks-list">';
    cases.forEach(function(c) {
      var dateStr = c.case_date ? new Date(c.case_date).toLocaleDateString('uk-UA') : '—';
      html += '<div class="check-card">' +
        '<div class="check-date">' + dateStr + '</div>' +
        '<div class="check-inspectors">' + escHTML(c.title || '') + '</div>' +
        (c.description ? '<div class="check-desc">' + escHTML(c.description) + '</div>' : '') +
        '</div>';
    });
    html += '</div>';

    if (isAdmin()) {
      html += '<button class="btn btn-primary btn-sm checks-add-btn" style="margin:12px 0 0">+ Додати перевірку</button>';
    }
    panel.innerHTML = html;

    panel.querySelector('.checks-add-btn')?.addEventListener('click', function() {
      window.switchSidebarTab('cases');
      var _casesLoaded = true;
      if (typeof window.loadSidebarCases === 'function') window.loadSidebarCases(unitId, unitName);
      // Trigger add form
      setTimeout(function() {
        document.getElementById('cases-add-btn')?.click();
      }, 300);
    });
  } catch(e) {
    panel.innerHTML = '<div class="error-msg" style="padding:16px">' + escHTML(e.message) + '</div>';
  }
};

// Backward compat — now opens sidebar instead of modal
window.showUnitCasesModal = function(unitId, unitName) {
  if (window.openUnitSidebar) {
    window.openUnitSidebar({ unitId: String(unitId), unitName: String(unitName) });
  }
};

// Click on .btn-unit-info (from popup) — handled via onclick attr now, but keep for compat
document.addEventListener('click', function(e) {
  var btn = e.target.closest('.btn-unit-info');
  if (!btn) return;
  window.openUnitSidebar && window.openUnitSidebar({ unitId: btn.dataset.unitId, unitName: btn.dataset.unitName });
});
