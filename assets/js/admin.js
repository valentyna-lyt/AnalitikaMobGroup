// ---- admin.js ----

// ============================================================
// ADMIN PANEL
// ============================================================

async function openAdminPanel(tab, preselectUnitId) {
  if (!isAdmin()) { alert('Доступ заборонено'); return; }
  var modal = document.getElementById('admin-modal');
  modal.showModal();

  if (tab === 'files') {
    switchAdminTab('files');
    if (preselectUnitId) {
      var sel = document.getElementById('admin-upload-unit-sel');
      if (sel) sel.value = String(preselectUnitId);
      await refreshAdminFilesList(preselectUnitId);
    }
  } else {
    switchAdminTab('cases');
    await refreshAdminTable();
  }
}
window.openAdminPanel = openAdminPanel;

function switchAdminTab(tab) {
  var tabs = ['cases', 'files', 'users'];
  tabs.forEach(function(t) {
    var btn = document.getElementById('admin-tab-' + t);
    var panel = document.getElementById('admin-' + t + '-panel');
    if (!btn || !panel) return;
    if (t === tab) {
      btn.classList.add('active');
      panel.style.display = 'block';
    } else {
      btn.classList.remove('active');
      panel.style.display = 'none';
    }
  });
  if (tab === 'files') populateUnitSelector();
}

// ============================================================
// CASES TAB
// ============================================================

async function refreshAdminTable() {
  var tbody = document.getElementById('admin-cases-tbody');
  tbody.innerHTML = '<tr><td colspan="5" class="loading">Завантаження...</td></tr>';

  try {
    var data = await window.localAPI.fetch('/cases/all');
    var countEl = document.getElementById('admin-total-count');
    if (countEl) countEl.textContent = 'Всього справ: ' + data.length;

    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="no-data">Справи відсутні</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(function(c) {
      return '<tr>' +
        '<td>' + escHTML(c.unit_name || c.unit_id) + '</td>' +
        '<td>' + escHTML(c.title) + '</td>' +
        '<td>' + (c.case_date ? formatDate(c.case_date) : '—') + '</td>' +
        '<td>' + new Date(c.created_at).toLocaleDateString('uk-UA') + '</td>' +
        '<td><button class="btn-sm btn-danger admin-del-case" data-id="' + escHTML(c.id) + '">🗑️</button></td>' +
        '</tr>';
    }).join('');

    tbody.querySelectorAll('.admin-del-case').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        if (!confirm('Видалити справу?')) return;
        try {
          await window.localAPI.fetch('/cases/' + btn.dataset.id, { method: 'DELETE' });
          await refreshAdminTable();
        } catch(e) { alert(e.message); }
      });
    });
  } catch(e) {
    tbody.innerHTML = '<tr><td colspan="5" class="error-msg">' + escHTML(e.message) + '</td></tr>';
  }
}

// ============================================================
// FILES TAB
// ============================================================

function populateUnitSelector() {
  var sel = document.getElementById('admin-upload-unit-sel');
  if (!sel || sel.dataset.populated) return;
  var rows = window.state?.data || [];
  sel.innerHTML = '<option value="">— оберіть підрозділ —</option>' +
    rows.map(function(r) {
      return '<option value="' + escHTML(r.id) + '">' + escHTML(r.name) + '</option>';
    }).join('');
  sel.dataset.populated = '1';
}

async function refreshAdminFilesList(unitId) {
  var container = document.getElementById('admin-files-list');
  if (!container) return;
  if (!unitId) { container.innerHTML = ''; return; }

  container.innerHTML = '<div class="loading">Завантаження...</div>';

  try {
    var files = await window.localAPI.fetch('/files/' + encodeURIComponent(unitId));

    // Group files by section_name
    var bySection = {};
    files.forEach(function(f) {
      var key = f.section_name || 'Без розділу';
      if (!bySection[key]) bySection[key] = [];
      bySection[key].push(f);
    });

    // Merge DEFAULT_SECTIONS + any extra from files
    var sectionNames = (window.DEFAULT_SECTIONS || []).slice();
    Object.keys(bySection).forEach(function(name) {
      if (sectionNames.indexOf(name) === -1) sectionNames.push(name);
    });

    var totalFiles = files.length;
    var html = '<div class="admin-files-total">Файлів: ' + totalFiles + ' | Розділів: ' + sectionNames.length + '</div>';

    sectionNames.forEach(function(secName) {
      var secFiles = bySection[secName] || [];
      html += '<div class="admin-sec-group" data-sec="' + escHTML(secName) + '">' +
        '<div class="admin-sec-title" style="display:flex;align-items:center;justify-content:space-between">' +
        '<span>' + escHTML(secName) + ' (' + secFiles.length + ' файл' + (secFiles.length === 1 ? '' : secFiles.length < 5 ? 'и' : 'ів') + ')</span>' +
        '<div style="display:flex;gap:6px">' +
        '<label class="btn-sm" style="cursor:pointer" title="Завантажити файли в розділ">' +
        '<input type="file" class="admin-sec-upload-input" data-sec="' + escHTML(secName) + '" multiple style="display:none">⬆ Файли</label>' +
        (secFiles.length > 0 ? '<button class="btn-sm btn-danger admin-del-sec-btn" data-sec="' + escHTML(secName) + '" title="Видалити всі файли розділу">🗑️ Розділ</button>' : '') +
        '</div>' +
        '</div>';

      if (secFiles.length) {
        html += '<table class="admin-table" style="margin-bottom:0">' +
          '<thead><tr><th>Файл</th><th>Розмір</th><th>Дата</th><th></th></tr></thead><tbody>' +
          secFiles.map(function(f) {
            return '<tr>' +
              '<td>' + escHTML(f.filename) + '</td>' +
              '<td>' + (f.file_size ? (f.file_size / 1024).toFixed(0) + ' KB' : '—') + '</td>' +
              '<td>' + new Date(f.created_at).toLocaleDateString('uk-UA') + '</td>' +
              '<td><button class="btn-sm btn-danger admin-del-file" data-id="' + escHTML(f.id) + '">🗑️</button></td>' +
              '</tr>';
          }).join('') +
          '</tbody></table>';
      } else {
        html += '<div class="no-data" style="padding:8px 0;font-size:12px">Файлів немає — завантажте кнопкою ⬆</div>';
      }

      html += '</div>';
    });

    container.innerHTML = html;

    // Delete section (all files in section)
    container.querySelectorAll('.admin-del-sec-btn').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        var sec = btn.dataset.sec;
        if (!confirm('Видалити всі файли розділу "' + sec + '"?')) return;
        var secFiles = bySection[sec] || [];
        try {
          for (var i = 0; i < secFiles.length; i++) {
            await window.localAPI.fetch('/files/' + secFiles[i].id, { method: 'DELETE' });
          }
          await refreshAdminFilesList(unitId);
        } catch(e) { alert(e.message); }
      });
    });

    // Delete single file
    container.querySelectorAll('.admin-del-file').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        if (!confirm('Видалити файл?')) return;
        try {
          await window.localAPI.fetch('/files/' + btn.dataset.id, { method: 'DELETE' });
          await refreshAdminFilesList(unitId);
        } catch(e) { alert(e.message); }
      });
    });

    // Per-section file upload
    container.querySelectorAll('.admin-sec-upload-input').forEach(function(input) {
      input.addEventListener('change', async function(e) {
        var fileList = e.target.files;
        var sec = input.dataset.sec;
        if (!fileList?.length || !sec) return;

        var sel = document.getElementById('admin-upload-unit-sel');
        var unitName = sel?.options[sel.selectedIndex]?.text || '';

        var prog = document.getElementById('admin-upload-progress');
        var fill = document.getElementById('admin-progress-fill');
        var progText = document.getElementById('admin-progress-text');

        if (prog) prog.style.display = 'block';
        if (fill) { fill.style.width = '0%'; fill.style.background = ''; }
        if (progText) progText.textContent = 'Завантаження в розділ "' + sec + '"...';

        var errors = await window.adminUploadFilesToSection(fileList, unitId, unitName, sec, function(done, total) {
          var pct = Math.round((done / total) * 100);
          if (fill) fill.style.width = pct + '%';
          if (progText) progText.textContent = done + ' / ' + total + ' файлів (' + pct + '%)';
        });

        if (fill) { fill.style.width = '100%'; fill.style.background = errors.length ? 'var(--bad)' : 'var(--ok)'; }
        if (progText) progText.textContent = errors.length
          ? 'Помилки (' + errors.length + '): ' + errors.slice(0, 3).join(', ')
          : 'Завантажено успішно!';

        e.target.value = '';
        await refreshAdminFilesList(unitId);
      });
    });

  } catch(e) {
    container.innerHTML = '<div class="error-msg">' + escHTML(e.message) + '</div>';
  }
}

window.refreshAdminFilesList = refreshAdminFilesList;

// ============================================================
// USERS TAB
// ============================================================

async function refreshAdminUsers() {
  var tbody = document.getElementById('admin-users-tbody');
  var countEl = document.getElementById('admin-users-count');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" class="loading">Завантаження...</td></tr>';

  try {
    var users = await window.localAPI.fetch('/users');
    if (countEl) countEl.textContent = 'Користувачів: ' + users.length;

    if (!users.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="no-data">Користувачів немає</td></tr>';
      return;
    }

    tbody.innerHTML = users.map(function(u) {
      var canDel = u.role !== 'admin' || users.filter(function(x){ return x.role==='admin'; }).length > 1;
      return '<tr>' +
        '<td>' + escHTML(u.email) + '</td>' +
        '<td>' + escHTML(u.full_name || '—') + '</td>' +
        '<td><span class="badge badge-' + (u.role === 'admin' ? 'bad' : 'info') + '">' + escHTML(u.role) + '</span></td>' +
        '<td>' + new Date(u.created_at).toLocaleDateString('uk-UA') + '</td>' +
        '<td style="white-space:nowrap">' +
          '<button class="btn-sm admin-pwd-user" data-id="' + escHTML(u.id) + '" data-email="' + escHTML(u.email) + '" title="Змінити пароль">🔑</button>' +
          (canDel ? ' <button class="btn-sm btn-danger admin-del-user" data-id="' + escHTML(u.id) + '">🗑️</button>' : '') +
        '</td>' +
        '</tr>';
    }).join('');

    tbody.querySelectorAll('.admin-del-user').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        if (!confirm('Видалити користувача?')) return;
        try {
          await window.localAPI.fetch('/users/' + btn.dataset.id, { method: 'DELETE' });
          await refreshAdminUsers();
        } catch(e) { alert(e.message); }
      });
    });

    tbody.querySelectorAll('.admin-pwd-user').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var newPwd = prompt('Новий пароль для ' + btn.dataset.email + ' (мін. 6 символів):');
        if (!newPwd) return;
        if (newPwd.length < 6) { alert('Пароль мінімум 6 символів'); return; }
        window.localAPI.fetch('/users/' + btn.dataset.id, {
          method: 'PATCH',
          body: JSON.stringify({ password: newPwd })
        }).then(function() {
          alert('Пароль змінено успішно');
        }).catch(function(e) { alert('Помилка: ' + e.message); });
      });
    });
  } catch(e) {
    tbody.innerHTML = '<tr><td colspan="5" class="error-msg">' + escHTML(e.message) + '</td></tr>';
  }
}

window.refreshAdminUsers = refreshAdminUsers;

// ============================================================
// UI Bindings
// ============================================================

function bindAdminUI() {
  document.getElementById('admin-close')?.addEventListener('click', function() {
    document.getElementById('admin-modal').close();
  });

  document.getElementById('admin-tab-cases')?.addEventListener('click', function() {
    switchAdminTab('cases');
    refreshAdminTable();
  });
  document.getElementById('admin-tab-files')?.addEventListener('click', function() {
    switchAdminTab('files');
  });
  document.getElementById('admin-tab-users')?.addEventListener('click', function() {
    switchAdminTab('users');
    refreshAdminUsers();
  });

  // Users tab: add user form
  document.getElementById('admin-add-user-btn')?.addEventListener('click', function() {
    var form = document.getElementById('admin-add-user-form');
    if (form) form.classList.toggle('hidden');
  });

  // Change my password
  document.getElementById('admin-change-my-pwd-btn')?.addEventListener('click', function() {
    var form = document.getElementById('admin-change-pwd-form');
    if (form) form.classList.toggle('hidden');
  });
  document.getElementById('cancel-my-pwd-btn')?.addEventListener('click', function() {
    var form = document.getElementById('admin-change-pwd-form');
    if (form) form.classList.add('hidden');
  });
  document.getElementById('save-my-pwd-btn')?.addEventListener('click', async function() {
    var newPwd = document.getElementById('my-new-password')?.value;
    var confirmPwd = document.getElementById('my-confirm-password')?.value;
    var errEl = document.getElementById('change-pwd-error');
    if (errEl) errEl.textContent = '';
    if (!newPwd || newPwd.length < 6) { if (errEl) errEl.textContent = 'Пароль мінімум 6 символів'; return; }
    if (newPwd !== confirmPwd) { if (errEl) errEl.textContent = 'Паролі не збігаються'; return; }
    var me = window.currentUser;
    if (!me || !me.id) { if (errEl) errEl.textContent = 'Не вдалося визначити поточного користувача'; return; }
    try {
      await window.localAPI.fetch('/users/' + me.id, {
        method: 'PATCH',
        body: JSON.stringify({ password: newPwd })
      });
      document.getElementById('my-new-password').value = '';
      document.getElementById('my-confirm-password').value = '';
      document.getElementById('admin-change-pwd-form').classList.add('hidden');
      alert('Пароль успішно змінено');
    } catch(e) { if (errEl) errEl.textContent = e.message; }
  });
  document.getElementById('cancel-user-btn')?.addEventListener('click', function() {
    var form = document.getElementById('admin-add-user-form');
    if (form) form.classList.add('hidden');
  });
  document.getElementById('save-user-btn')?.addEventListener('click', async function() {
    var email = document.getElementById('new-user-email')?.value.trim();
    var password = document.getElementById('new-user-password')?.value;
    var full_name = document.getElementById('new-user-name')?.value.trim();
    var role = document.getElementById('new-user-role')?.value;
    var errEl = document.getElementById('add-user-error');
    if (errEl) errEl.textContent = '';
    if (!email || !password) { if (errEl) errEl.textContent = 'Email та пароль обовʼязкові'; return; }
    if (password.length < 6) { if (errEl) errEl.textContent = 'Пароль мінімум 6 символів'; return; }
    try {
      await window.localAPI.fetch('/users', { method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ email, password, full_name, role }) });
      // Reset form
      ['new-user-email','new-user-password','new-user-name'].forEach(function(id) {
        var el = document.getElementById(id); if (el) el.value = '';
      });
      var form = document.getElementById('admin-add-user-form');
      if (form) form.classList.add('hidden');
      await refreshAdminUsers();
    } catch(e) { if (errEl) errEl.textContent = e.message; }
  });

  document.getElementById('admin-upload-unit-sel')?.addEventListener('change', async function(e) {
    await refreshAdminFilesList(e.target.value);
  });

  document.getElementById('admin-folder-input')?.addEventListener('change', async function(e) {
    var files = e.target.files;
    var sel = document.getElementById('admin-upload-unit-sel');
    var unitId = sel?.value;
    var unitName = sel?.options[sel.selectedIndex]?.text || '';

    if (!unitId) { alert('Спочатку оберіть підрозділ'); e.target.value = ''; return; }
    if (!files?.length) return;

    var prog = document.getElementById('admin-upload-progress');
    var fill = document.getElementById('admin-progress-fill');
    var progText = document.getElementById('admin-progress-text');

    if (prog) prog.style.display = 'block';
    if (fill) { fill.style.width = '0%'; fill.style.background = ''; }
    if (progText) progText.textContent = 'Завантаження...';

    var errors = await window.adminUploadFolder(files, unitId, unitName, function(done, total) {
      var pct = Math.round((done / total) * 100);
      if (fill) fill.style.width = pct + '%';
      if (progText) progText.textContent = done + ' / ' + total + ' файлів (' + pct + '%)';
    });

    if (fill) { fill.style.width = '100%'; fill.style.background = errors.length ? 'var(--bad)' : 'var(--ok)'; }
    if (progText) progText.textContent = errors.length
      ? 'Готово з помилками (' + errors.length + '): ' + errors.slice(0, 3).join(', ')
      : 'Завантажено успішно!';

    e.target.value = '';
    await refreshAdminFilesList(unitId);
  });
}

bindAdminUI();
