// ---- admin.js ----

// ============================================================
// ADMIN PANEL — open with optional tab
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
  var tabCases   = document.getElementById('admin-tab-cases');
  var tabFiles   = document.getElementById('admin-tab-files');
  var panelCases = document.getElementById('admin-cases-panel');
  var panelFiles = document.getElementById('admin-files-panel');

  if (tab === 'files') {
    tabCases.classList.remove('active');
    tabFiles.classList.add('active');
    panelCases.style.display = 'none';
    panelFiles.style.display = 'block';
    populateUnitSelector();
  } else {
    tabCases.classList.add('active');
    tabFiles.classList.remove('active');
    panelCases.style.display = 'block';
    panelFiles.style.display = 'none';
  }
}

// ============================================================
// CASES TAB
// ============================================================

async function refreshAdminTable() {
  var tbody = document.getElementById('admin-cases-tbody');
  tbody.innerHTML = '<tr><td colspan="5" class="loading">Завантаження...</td></tr>';

  var result = await window.supabase
    .from('unit_cases')
    .select('*')
    .order('created_at', { ascending: false });

  if (result.error) {
    tbody.innerHTML = '<tr><td colspan="5" class="error-msg">' + escHTML(result.error.message) + '</td></tr>';
    return;
  }

  var data = result.data || [];
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
      var res = await window.supabase.from('unit_cases').delete().eq('id', btn.dataset.id);
      if (res.error) { alert(res.error.message); return; }
      await refreshAdminTable();
    });
  });
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

  // Load sections
  var secResult = await window.supabase
    .from('unit_sections')
    .select('*')
    .eq('unit_id', String(unitId))
    .order('section_order')
    .order('section_name');

  if (secResult.error) {
    container.innerHTML = '<div class="error-msg">' + escHTML(secResult.error.message) + '</div>';
    return;
  }

  // Load files to count per section
  var filesResult = await window.supabase
    .from('unit_files')
    .select('id, section_name, filename, file_size, uploaded_at')
    .eq('unit_id', String(unitId))
    .order('section_name')
    .order('filename');

  var sections = secResult.data || [];
  var files    = filesResult.data || [];

  // Group files by section_name
  var bySection = {};
  files.forEach(function(f) {
    var key = f.section_name || 'Без розділу';
    if (!bySection[key]) bySection[key] = [];
    bySection[key].push(f);
  });

  // Merge: sections + any orphan names from files
  var sectionNames = sections.map(function(s) { return s.section_name; });
  Object.keys(bySection).forEach(function(name) {
    if (sectionNames.indexOf(name) === -1) sectionNames.push(name);
  });

  if (!sectionNames.length && !files.length) {
    container.innerHTML = '<div class="no-data">Файлів та розділів ще немає для цього підрозділу</div>';
    return;
  }

  var totalFiles = files.length;
  var html = '<div class="admin-files-total">Файлів: ' + totalFiles + ' | Розділів: ' + sectionNames.length + '</div>';

  // Add section button
  html += '<div class="sec-mgmt-bar">' +
    '<button class="btn-sm" id="admin-add-section-btn">+ Додати розділ</button>' +
    '</div>' +
    '<div class="add-section-form hidden" id="admin-add-section-form">' +
    '<input type="text" id="admin-new-section-name" class="form-control" placeholder="Назва розділу..." style="flex:1;min-width:180px">' +
    '<button class="btn-primary btn-sm" id="admin-save-section-btn">Зберегти</button>' +
    '<button class="btn-sm" id="admin-cancel-section-btn">Скасувати</button>' +
    '</div>';

  sectionNames.forEach(function(secName) {
    var secFiles = bySection[secName] || [];
    html += '<div class="admin-sec-group" data-sec="' + escHTML(secName) + '">' +
      '<div class="admin-sec-title" style="display:flex;align-items:center;justify-content:space-between">' +
      '<span>' + escHTML(secName) + ' (' + secFiles.length + ' файл' + (secFiles.length === 1 ? '' : secFiles.length < 5 ? 'и' : 'ів') + ')</span>' +
      '<div style="display:flex;gap:6px">' +
      '<label class="btn-sm" style="cursor:pointer" title="Завантажити файли в розділ">' +
      '<input type="file" class="admin-sec-upload-input" data-sec="' + escHTML(secName) + '" multiple style="display:none">⬆ Файли</label>' +
      '<button class="btn-sm btn-danger admin-del-sec-btn" data-sec="' + escHTML(secName) + '" title="Видалити розділ">🗑️ Розділ</button>' +
      '</div>' +
      '</div>';

    if (secFiles.length) {
      html += '<table class="admin-table" style="margin-bottom:0">' +
        '<thead><tr><th>Файл</th><th>Розмір</th><th>Дата</th><th></th></tr></thead><tbody>' +
        secFiles.map(function(f) {
          return '<tr>' +
            '<td>' + escHTML(f.filename) + '</td>' +
            '<td>' + (f.file_size ? (f.file_size / 1024).toFixed(0) + ' KB' : '—') + '</td>' +
            '<td>' + new Date(f.uploaded_at || f.created_at || Date.now()).toLocaleDateString('uk-UA') + '</td>' +
            '<td><button class="btn-sm btn-danger admin-del-file" data-id="' + escHTML(f.id) + '">🗑️</button></td>' +
            '</tr>';
        }).join('') +
        '</tbody></table>';
    } else {
      html += '<div class="no-data" style="padding:8px 0;font-size:12px">Файлів немає — завантажте за допомогою кнопки ⬆</div>';
    }

    html += '</div>'; // end admin-sec-group
  });

  container.innerHTML = html;

  // Add section form bindings
  var addSecBtn = container.querySelector('#admin-add-section-btn');
  var addSecForm = container.querySelector('#admin-add-section-form');
  if (addSecBtn && addSecForm) {
    addSecBtn.addEventListener('click', function() { addSecForm.classList.toggle('hidden'); });
  }

  var saveSecBtn = container.querySelector('#admin-save-section-btn');
  if (saveSecBtn) {
    saveSecBtn.addEventListener('click', async function() {
      var nameInput = container.querySelector('#admin-new-section-name');
      var secName = (nameInput?.value || '').trim();
      if (!secName) { alert('Введіть назву розділу'); return; }
      var sel = document.getElementById('admin-upload-unit-sel');
      var unitName = sel?.options[sel.selectedIndex]?.text || '';
      var res = await window.supabase.from('unit_sections').upsert({
        unit_id: String(unitId),
        unit_name: unitName,
        section_name: secName,
        section_order: sectionNames.length,
        created_by: window.currentUser?.id || null,
      }, { onConflict: 'unit_id,section_name' });
      if (res.error) { alert(res.error.message); return; }
      await refreshAdminFilesList(unitId);
    });
  }

  var cancelSecBtn = container.querySelector('#admin-cancel-section-btn');
  if (cancelSecBtn) {
    cancelSecBtn.addEventListener('click', function() {
      var f = container.querySelector('#admin-add-section-form');
      if (f) f.classList.add('hidden');
    });
  }

  // Delete section buttons
  container.querySelectorAll('.admin-del-sec-btn').forEach(function(btn) {
    btn.addEventListener('click', async function() {
      var sec = btn.dataset.sec;
      if (!confirm('Видалити розділ "' + sec + '" та всі файли?')) return;
      var { data: secFiles } = await window.supabase
        .from('unit_files')
        .select('id, storage_path')
        .eq('unit_id', String(unitId))
        .eq('section_name', sec);
      if (secFiles && secFiles.length) {
        var paths = secFiles.map(function(f){ return f.storage_path; }).filter(Boolean);
        if (paths.length) await window.supabase.storage.from('unit-files').remove(paths);
        var ids = secFiles.map(function(f){ return f.id; });
        await window.supabase.from('unit_files').delete().in('id', ids);
      }
      await window.supabase.from('unit_sections').delete().eq('unit_id', String(unitId)).eq('section_name', sec);
      await refreshAdminFilesList(unitId);
    });
  });

  // Delete file buttons
  container.querySelectorAll('.admin-del-file').forEach(function(btn) {
    btn.addEventListener('click', async function() {
      if (!confirm('Видалити файл?')) return;
      var { data: row } = await window.supabase
        .from('unit_files').select('storage_path').eq('id', btn.dataset.id).single();
      if (row?.storage_path) {
        await window.supabase.storage.from('unit-files').remove([row.storage_path]);
      }
      await window.supabase.from('unit_files').delete().eq('id', btn.dataset.id);
      await refreshAdminFilesList(unitId);
    });
  });

  // Per-section file upload inputs (inside admin list)
  container.querySelectorAll('.admin-sec-upload-input').forEach(function(input) {
    input.addEventListener('change', async function(e) {
      var fileList = e.target.files;
      var sec      = input.dataset.sec;
      if (!fileList?.length || !sec) return;

      var sel      = document.getElementById('admin-upload-unit-sel');
      var unitName = sel?.options[sel.selectedIndex]?.text || '';

      var prog     = document.getElementById('admin-upload-progress');
      var fill     = document.getElementById('admin-progress-fill');
      var progText = document.getElementById('admin-progress-text');

      if (prog) prog.style.display = 'block';
      if (fill) { fill.style.width = '0%'; fill.style.background = ''; }
      if (progText) progText.textContent = 'Завантаження в розділ "' + sec + '"...';

      var errors = await adminUploadFilesToSection(fileList, unitId, unitName, sec, function(done, total) {
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
  });
}

// ============================================================
// UI Bindings
// ============================================================

function bindAdminUI() {
  document.getElementById('admin-close')?.addEventListener('click', function() {
    document.getElementById('admin-modal').close();
  });

  // Tab buttons
  document.getElementById('admin-tab-cases')?.addEventListener('click', function() {
    switchAdminTab('cases');
    refreshAdminTable();
  });
  document.getElementById('admin-tab-files')?.addEventListener('click', function() {
    switchAdminTab('files');
  });

  // Unit selector change
  document.getElementById('admin-upload-unit-sel')?.addEventListener('change', async function(e) {
    await refreshAdminFilesList(e.target.value);
  });

  // Folder input change — bulk upload
  document.getElementById('admin-folder-input')?.addEventListener('change', async function(e) {
    var files    = e.target.files;
    var sel      = document.getElementById('admin-upload-unit-sel');
    var unitId   = sel?.value;
    var unitName = sel?.options[sel.selectedIndex]?.text || '';

    if (!unitId) { alert('Спочатку оберіть підрозділ'); e.target.value = ''; return; }
    if (!files?.length) return;

    var prog     = document.getElementById('admin-upload-progress');
    var fill     = document.getElementById('admin-progress-fill');
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
