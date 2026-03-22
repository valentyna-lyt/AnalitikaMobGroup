// ---- files.js ----
// Unit files: dynamic sections from unit_sections table + Supabase Storage viewer + admin uploader

// ---- File type helpers ----
function isImage(name) { return /\.(jpe?g|png|gif|webp|bmp|tiff?)$/i.test(name); }
function isPDF(name)   { return /\.pdf$/i.test(name); }
function isOffice(name){ return /\.(docx?|xlsx?|pptx?|odt|ods|odp)$/i.test(name); }

function fileIcon(name) {
  if (isImage(name))  return '🖼️';
  if (isPDF(name))    return '📄';
  if (/\.docx?$/i.test(name)) return '📝';
  if (/\.xlsx?$/i.test(name)) return '📊';
  if (/\.pptx?$/i.test(name)) return '📑';
  return '📎';
}

function fileCountLabel(n) {
  if (!n) return 'порожньо';
  if (n === 1) return '1 файл';
  if (n < 5)  return n + ' файли';
  return n + ' файлів';
}

// ---- Supabase with timeout ----
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise(function(_, reject) {
      setTimeout(function() { reject(new Error('Timeout: ' + (label || 'запит') + ' (' + ms + 'мс)')); }, ms);
    })
  ]);
}

async function loadUnitFiles(unitId) {
  var result = await withTimeout(
    window.supabase
      .from('unit_files')
      .select('*')
      .eq('unit_id', String(unitId))
      .order('section_name')
      .order('filename'),
    8000, 'unit_files'
  );
  if (result.error) throw result.error;
  return result.data || [];
}

async function loadUnitSections(unitId) {
  var result = await withTimeout(
    window.supabase
      .from('unit_sections')
      .select('*')
      .eq('unit_id', String(unitId))
      .order('section_order')
      .order('section_name'),
    8000, 'unit_sections'
  );
  if (result.error) throw result.error;
  return result.data || [];
}

async function getSignedUrl(storagePath) {
  try {
    var result = await withTimeout(
      window.supabase.storage.from('unit-files').createSignedUrl(storagePath, 3600),
      6000, 'signedUrl'
    );
    return result.data?.signedUrl || '';
  } catch(e) { return ''; }
}

// ============================================================
// MAIN RENDER — folder-card grid (dynamic sections)
// ============================================================

async function renderUnitFiles(container, unitId, unitName) {
  container.innerHTML = '<div class="loading">Завантаження файлів...</div>';

  var sections = [], files = [];

  // Load sections
  try {
    sections = await loadUnitSections(unitId);
  } catch(e) {
    var msg = e.message || '';
    var isMissing = msg.indexOf('unit_sections') !== -1 || msg.indexOf('does not exist') !== -1 || msg.indexOf('42P01') !== -1;
    if (isMissing) {
      container.innerHTML =
        '<div class="error-msg" style="padding:16px;text-align:center">' +
        '⚠️ Таблиця <b>unit_sections</b> не існує.<br><br>' +
        'Необхідно виконати SQL-міграцію в <b>Supabase → SQL Editor</b>.<br>' +
        'Файл: <code>supabase_migration_v2.sql</code>' +
        '</div>' +
        (isAdmin() ? '<div style="text-align:center;margin-top:8px"><button class="btn-primary btn-sm" id="show-sql-btn">Показати SQL</button></div>' : '');
      var sqlBtn = container.querySelector('#show-sql-btn');
      if (sqlBtn) sqlBtn.addEventListener('click', function() { showSQLInstructions(container); });
      return;
    }
    // Other error — show it but continue with empty sections
    sections = [];
  }

  // Load files
  try {
    files = await loadUnitFiles(unitId);
  } catch(e) {
    files = [];
  }

  // Group files by section_name
  var bySection = {};
  files.forEach(function(f) {
    var key = f.section_name || 'Без розділу';
    if (!bySection[key]) bySection[key] = [];
    bySection[key].push(f);
  });

  // Merge: sections from unit_sections + any orphan section_names from files
  var sectionNames = [];
  sections.forEach(function(s) { sectionNames.push(s.section_name); });
  Object.keys(bySection).forEach(function(name) {
    if (sectionNames.indexOf(name) === -1) sectionNames.push(name);
  });

  if (sectionNames.length === 0) {
    container.innerHTML = '<div class="no-data" style="padding:24px;text-align:center">' +
      '📂 Файли ще не завантажені для цього підрозділу' +
      '</div>' +
      (isAdmin()
        ? '<div style="text-align:center;margin-top:12px">' +
          '<button class="btn-primary" style="width:auto;padding:8px 20px" id="btn-go-upload">📁 Завантажити файли через адмін-панель</button>' +
          '</div>'
        : '');
    var goBtn = container.querySelector('#btn-go-upload');
    if (goBtn) goBtn.addEventListener('click', function() {
      document.getElementById('unit-cases-modal')?.close();
      if (typeof openAdminPanel === 'function') openAdminPanel('files', unitId);
    });
    return;
  }

  // Build folder grid HTML
  var html = '';

  if (isAdmin()) {
    html += '<div class="sec-mgmt-bar">' +
      '<button class="btn-sm btn-add-section">+ Додати розділ</button>' +
      '</div>' +
      '<div class="add-section-form hidden" id="add-section-form">' +
      '<input type="text" id="new-section-name" class="form-control" placeholder="Назва розділу..." style="flex:1;min-width:180px">' +
      '<button class="btn-primary btn-sm" id="save-section-btn">Зберегти</button>' +
      '<button class="btn-sm" id="cancel-section-btn">Скасувати</button>' +
      '</div>';
  }

  html += '<div class="folders-grid" id="folders-grid-' + escHTML(String(unitId)) + '">';
  sectionNames.forEach(function(secName) {
    var count = (bySection[secName] || []).length;
    html += '<div class="folder-card" data-sec="' + escHTML(secName) + '">' +
      '<div class="folder-icon">📁</div>' +
      '<div class="folder-name">' + escHTML(secName) + '</div>' +
      '<div class="folder-count">' + fileCountLabel(count) + '</div>' +
      (isAdmin() ? '<button class="btn-del-section" data-sec="' + escHTML(secName) + '" title="Видалити розділ">🗑️</button>' : '') +
      '</div>';
  });
  html += '</div>';

  // File panels
  sectionNames.forEach(function(secName) {
    var panelId = 'panel-' + secName.replace(/[^\w]/g, '_');
    html += '<div class="sec-files-panel hidden" data-panel="' + escHTML(secName) + '" id="' + escHTML(panelId) + '">' +
      '<div class="sec-panel-header">' +
      '<button class="sec-panel-back">← Назад</button>' +
      '<span>📁 ' + escHTML(secName) + '</span>' +
      (isAdmin() ? '<button class="btn-sm sec-upload-btn" data-sec="' + escHTML(secName) + '">⬆ Завантажити</button>' : '') +
      '</div>' +
      '<div class="files-grid" id="fgrid-' + escHTML(panelId) + '"><div class="loading" style="padding:16px">Завантаження...</div></div>' +
      '</div>';
  });

  container.innerHTML = html;

  // Folder click → open panel (lazy load files)
  container.querySelectorAll('.folder-card').forEach(function(card) {
    card.addEventListener('click', function(e) {
      if (e.target.classList.contains('btn-del-section')) return;
      var sec = card.dataset.sec;
      container.querySelector('#folders-grid-' + String(unitId))?.classList.add('hidden');
      container.querySelectorAll('.sec-mgmt-bar, #add-section-form').forEach(function(el){ el.classList.add('hidden'); });
      container.querySelectorAll('.sec-files-panel').forEach(function(p){ p.classList.add('hidden'); });
      var panelId = 'panel-' + sec.replace(/[^\w]/g, '_');
      var panel = container.querySelector('#' + panelId);
      if (panel) {
        panel.classList.remove('hidden');
        // Lazy-load files for this section
        var grid = container.querySelector('#fgrid-' + panelId);
        if (grid && grid.querySelector('.loading')) {
          renderSectionFiles(grid, bySection[sec] || [], unitId, unitName, container);
        }
      }
    });
  });

  // Back button
  container.querySelectorAll('.sec-panel-back').forEach(function(btn) {
    btn.addEventListener('click', function() {
      container.querySelectorAll('.sec-files-panel').forEach(function(p){ p.classList.add('hidden'); });
      container.querySelector('#folders-grid-' + String(unitId))?.classList.remove('hidden');
      container.querySelectorAll('.sec-mgmt-bar').forEach(function(el){ el.classList.remove('hidden'); });
    });
  });

  // Admin: add section
  if (isAdmin()) {
    var addBtn = container.querySelector('.btn-add-section');
    var addForm = container.querySelector('#add-section-form');
    if (addBtn && addForm) addBtn.addEventListener('click', function() { addForm.classList.toggle('hidden'); });

    var saveSecBtn = container.querySelector('#save-section-btn');
    var cancelSecBtn = container.querySelector('#cancel-section-btn');
    if (saveSecBtn) {
      saveSecBtn.addEventListener('click', async function() {
        var inp = container.querySelector('#new-section-name');
        var secName = (inp?.value || '').trim();
        if (!secName) { alert("Введіть назву розділу"); return; }
        var { error } = await window.supabase.from('unit_sections').upsert({
          unit_id: String(unitId), unit_name: unitName,
          section_name: secName, section_order: sectionNames.length,
          created_by: window.currentUser?.id || null,
        }, { onConflict: 'unit_id,section_name' });
        if (error) { alert(error.message); return; }
        await renderUnitFiles(container, unitId, unitName);
      });
    }
    if (cancelSecBtn) cancelSecBtn.addEventListener('click', function() {
      var f = container.querySelector('#add-section-form');
      if (f) f.classList.add('hidden');
    });

    // Delete section
    container.querySelectorAll('.btn-del-section').forEach(function(btn) {
      btn.addEventListener('click', async function(e) {
        e.stopPropagation();
        var sec = btn.dataset.sec;
        if (!confirm('Видалити розділ "' + sec + '" та всі файли?')) return;
        var { data: secFiles } = await window.supabase.from('unit_files').select('id,storage_path').eq('unit_id', String(unitId)).eq('section_name', sec);
        if (secFiles && secFiles.length) {
          var paths = secFiles.map(function(f){ return f.storage_path; }).filter(Boolean);
          if (paths.length) await window.supabase.storage.from('unit-files').remove(paths);
          await window.supabase.from('unit_files').delete().in('id', secFiles.map(function(f){ return f.id; }));
        }
        await window.supabase.from('unit_sections').delete().eq('unit_id', String(unitId)).eq('section_name', sec);
        await renderUnitFiles(container, unitId, unitName);
      });
    });

    // Per-section upload
    container.querySelectorAll('.sec-upload-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var sec = btn.dataset.sec;
        var fileInput = document.getElementById('admin-section-file-input');
        if (!fileInput) return;
        fileInput.dataset.sec = sec;
        fileInput.dataset.unitId = String(unitId);
        fileInput.dataset.unitName = unitName || '';
        fileInput.value = '';
        fileInput.click();
      });
    });
  }
}

// ============================================================
// RENDER FILES IN A SECTION PANEL (lazy)
// ============================================================

async function renderSectionFiles(grid, sectionFiles, unitId, unitName, container) {
  if (!sectionFiles.length) {
    grid.innerHTML = '<div class="no-data" style="padding:16px">Файлів немає</div>';
    return;
  }
  grid.innerHTML = sectionFiles.map(renderFileCard).join('');
  bindFileCards(grid, unitId, unitName, container);
}

// ============================================================
// FILE CARD
// ============================================================

function renderFileCard(f) {
  var safe = escHTML(f.filename);
  var sp   = escHTML(f.storage_path);
  var del  = isAdmin()
    ? '<button class="file-del" data-id="' + escHTML(f.id) + '" title="Видалити">🗑️</button>'
    : '';

  if (isImage(f.filename)) {
    return '<div class="file-card">' +
      '<div class="file-thumb-wrap">' +
      '<img data-sp="' + sp + '" alt="' + safe + '" class="file-thumb">' +
      '<div class="file-overlay">🔍</div></div>' +
      '<div class="file-card-name">' + safe + '</div>' + del + '</div>';
  }
  if (isPDF(f.filename)) {
    return '<div class="file-card">' +
      '<a class="file-icon-link" data-sp="' + sp + '" data-pdf="1" data-name="' + safe + '" href="#">' +
      '<span class="file-big-icon">📄</span></a>' +
      '<div class="file-card-name">' + safe + '</div>' + del + '</div>';
  }
  if (isOffice(f.filename)) {
    return '<div class="file-card">' +
      '<a class="file-icon-link" data-sp="' + sp + '" data-office="1" data-name="' + safe + '" href="#">' +
      '<span class="file-big-icon">' + fileIcon(f.filename) + '</span></a>' +
      '<div class="file-card-name">' + safe + '</div>' + del + '</div>';
  }
  return '<div class="file-card">' +
    '<a class="file-icon-link" data-sp="' + sp + '" href="#" download="' + safe + '">' +
    '<span class="file-big-icon">' + fileIcon(f.filename) + '</span></a>' +
    '<div class="file-card-name">' + safe + '</div>' + del + '</div>';
}

function bindFileCards(grid, unitId, unitName, container) {
  grid.querySelectorAll('[data-sp]').forEach(async function(el) {
    var url = await getSignedUrl(el.dataset.sp);
    if (!url) return;
    if (el.tagName === 'IMG') {
      el.src = url;
      el.style.cursor = 'zoom-in';
      el.addEventListener('click', function() { openImgViewer(url, el.alt); });
      var overlay = el.closest('.file-thumb-wrap')?.querySelector('.file-overlay');
      if (overlay) overlay.addEventListener('click', function() { openImgViewer(url, el.alt); });
    } else if (el.dataset.pdf) {
      el.href = url;
      el.addEventListener('click', function(e) { e.preventDefault(); openPDFViewer(url, el.dataset.name); });
    } else if (el.dataset.office) {
      var viewerUrl = 'https://docs.google.com/viewer?embedded=true&url=' + encodeURIComponent(url);
      el.href = url;
      el.addEventListener('click', function(e) { e.preventDefault(); openPDFViewer(viewerUrl, el.dataset.name); });
    } else {
      el.href = url;
    }
  });

  grid.querySelectorAll('.file-del').forEach(function(btn) {
    btn.addEventListener('click', function() {
      deleteUnitFile(btn.dataset.id, unitId, unitName, container);
    });
  });
}

// ============================================================
// IMAGE / PDF VIEWERS
// ============================================================

function openImgViewer(url, title) {
  var modal = document.getElementById('img-viewer-modal');
  if (!modal) { window.open(url, '_blank'); return; }
  var t = document.getElementById('img-viewer-title');
  var i = document.getElementById('img-viewer-img');
  if (t) t.textContent = title || '';
  if (i) i.src = url;
  modal.showModal();
}

function openPDFViewer(url, filename) {
  var modal = document.getElementById('pdf-viewer-modal');
  if (!modal) { window.open(url, '_blank'); return; }
  var t = document.getElementById('pdf-viewer-title');
  var f = document.getElementById('pdf-viewer-iframe');
  if (t) t.textContent = filename;
  if (f) f.src = url;
  modal.showModal();
}

// ============================================================
// DELETE FILE
// ============================================================

async function deleteUnitFile(fileId, unitId, unitName, container) {
  if (!confirm('Видалити файл?')) return;
  var { data } = await window.supabase.from('unit_files').select('storage_path').eq('id', fileId).single();
  if (data?.storage_path) await window.supabase.storage.from('unit-files').remove([data.storage_path]);
  var { error } = await window.supabase.from('unit_files').delete().eq('id', fileId);
  if (error) { alert(error.message); return; }
  await renderUnitFiles(container || document.getElementById('unit-files-tab-content'), unitId, unitName);
}

// ============================================================
// SQL MIGRATION HELPER
// ============================================================

function showSQLInstructions(container) {
  var sql = 'ALTER TABLE unit_files DROP CONSTRAINT IF EXISTS unit_files_section_num_check;\n' +
    'ALTER TABLE unit_files ADD CONSTRAINT unit_files_section_num_check CHECK (section_num between 0 and 99);\n\n' +
    'CREATE TABLE IF NOT EXISTS unit_sections (\n' +
    '  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,\n' +
    '  unit_id text NOT NULL,\n' +
    '  unit_name text,\n' +
    '  section_name text NOT NULL,\n' +
    '  section_order int DEFAULT 0,\n' +
    '  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,\n' +
    '  created_at timestamptz DEFAULT now() NOT NULL,\n' +
    '  CONSTRAINT unit_sections_unique UNIQUE(unit_id, section_name)\n' +
    ');\n\n' +
    'ALTER TABLE unit_sections ENABLE ROW LEVEL SECURITY;\n\n' +
    'CREATE POLICY "read" ON unit_sections FOR SELECT TO authenticated USING (true);\n' +
    'CREATE POLICY "admin" ON unit_sections FOR ALL TO authenticated\n' +
    '  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = \'admin\')\n' +
    '  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = \'admin\');';

  container.innerHTML = '<div style="padding:12px">' +
    '<p style="margin:0 0 8px;font-weight:600">📋 Виконайте цей SQL в Supabase → SQL Editor:</p>' +
    '<pre style="background:#f5f5f5;padding:12px;border-radius:6px;font-size:11px;overflow:auto;max-height:200px;white-space:pre-wrap">' + escHTML(sql) + '</pre>' +
    '<p style="margin:8px 0 0;font-size:12px;color:#666">Після виконання — оновіть сторінку (Ctrl+Shift+R)</p>' +
    '</div>';
}

// ============================================================
// ADMIN FOLDER UPLOAD (webkitdirectory)
// ============================================================

async function adminUploadFolder(fileList, unitId, unitName, onProgress) {
  var files = Array.from(fileList).filter(function(f) {
    return !f.name.startsWith('.') && !f.name.endsWith('.tmp') && f.size > 0;
  });

  var done = 0, errors = [], sectionOrderMap = {}, counter = 1;

  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    try {
      var parts = (file.webkitRelativePath || file.name).split('/');
      var secName, fileSubPath;
      if (parts.length >= 3) { secName = parts[1]; fileSubPath = parts.slice(2).join('/'); }
      else if (parts.length === 2) { secName = parts[1]; fileSubPath = file.name; }
      else { secName = 'Без розділу'; fileSubPath = file.name; }

      var storagePath = unitId + '/' + secName + '/' + fileSubPath;
      if (!sectionOrderMap.hasOwnProperty(secName)) sectionOrderMap[secName] = counter++;

      await window.supabase.from('unit_sections').upsert({
        unit_id: String(unitId), unit_name: unitName, section_name: secName,
        section_order: sectionOrderMap[secName], created_by: window.currentUser?.id || null,
      }, { onConflict: 'unit_id,section_name' });

      var up = await window.supabase.storage.from('unit-files').upload(storagePath, file, { upsert: true });
      if (up.error) { errors.push(file.name + ': ' + up.error.message); }
      else {
        await window.supabase.from('unit_files').upsert({
          unit_id: String(unitId), unit_name: unitName,
          section_num: sectionOrderMap[secName], section_name: secName,
          filename: file.name, storage_path: storagePath,
          mime_type: file.type || '', file_size: file.size,
          uploaded_by: window.currentUser?.id || null,
        }, { onConflict: 'storage_path' });
      }
    } catch(e) { errors.push(file.name + ': ' + e.message); }
    done++;
    if (typeof onProgress === 'function') onProgress(done, files.length);
  }
  return errors;
}

// ============================================================
// ADMIN PER-SECTION UPLOAD
// ============================================================

async function adminUploadFilesToSection(fileList, unitId, unitName, sectionName, onProgress) {
  var files = Array.from(fileList).filter(function(f) {
    return !f.name.startsWith('.') && !f.name.endsWith('.tmp') && f.size > 0;
  });
  var done = 0, errors = [];

  await window.supabase.from('unit_sections').upsert({
    unit_id: String(unitId), unit_name: unitName, section_name: sectionName,
    created_by: window.currentUser?.id || null,
  }, { onConflict: 'unit_id,section_name' });

  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    try {
      var storagePath = unitId + '/' + sectionName + '/' + file.name;
      var up = await window.supabase.storage.from('unit-files').upload(storagePath, file, { upsert: true });
      if (up.error) { errors.push(file.name + ': ' + up.error.message); }
      else {
        await window.supabase.from('unit_files').upsert({
          unit_id: String(unitId), unit_name: unitName,
          section_num: 0, section_name: sectionName,
          filename: file.name, storage_path: storagePath,
          mime_type: file.type || '', file_size: file.size,
          uploaded_by: window.currentUser?.id || null,
        }, { onConflict: 'storage_path' });
      }
    } catch(e) { errors.push(file.name + ': ' + e.message); }
    done++;
    if (typeof onProgress === 'function') onProgress(done, files.length);
  }
  return errors;
}

// ============================================================
// INTEGRATION — called from cases.js
// ============================================================

window.loadAndRenderFilesTab = async function(unitId, unitName) {
  var container = document.getElementById('unit-files-tab-content');
  if (!container) return;
  await renderUnitFiles(container, unitId, unitName);
};

// ============================================================
// UI BINDINGS
// ============================================================

function bindFilesUI() {
  document.getElementById('pdf-viewer-close')?.addEventListener('click', function() {
    var m = document.getElementById('pdf-viewer-modal');
    if (m) m.close();
    var f = document.getElementById('pdf-viewer-iframe');
    if (f) f.src = '';
  });

  document.getElementById('img-viewer-close')?.addEventListener('click', function() {
    var m = document.getElementById('img-viewer-modal');
    if (m) m.close();
    var i = document.getElementById('img-viewer-img');
    if (i) i.src = '';
  });

  document.getElementById('admin-section-file-input')?.addEventListener('change', async function(e) {
    var input = e.target;
    var sec = input.dataset.sec;
    var unitId = input.dataset.unitId;
    var unitName = input.dataset.unitName || '';
    if (!unitId || !sec || !input.files?.length) { input.value = ''; return; }

    var prog = document.getElementById('admin-upload-progress');
    var fill = document.getElementById('admin-progress-fill');
    var progText = document.getElementById('admin-progress-text');
    if (prog) prog.style.display = 'block';
    if (fill) { fill.style.width = '0%'; fill.style.background = ''; }
    if (progText) progText.textContent = 'Завантаження...';

    var errors = await adminUploadFilesToSection(input.files, unitId, unitName, sec, function(done, total) {
      var pct = Math.round((done / total) * 100);
      if (fill) fill.style.width = pct + '%';
      if (progText) progText.textContent = done + ' / ' + total + ' (' + pct + '%)';
    });

    if (fill) fill.style.width = '100%';
    if (fill) fill.style.background = errors.length ? 'var(--bad, #e74c3c)' : 'var(--ok, #27ae60)';
    if (progText) progText.textContent = errors.length
      ? 'Помилки (' + errors.length + '): ' + errors.slice(0, 3).join(', ')
      : 'Завантажено успішно!';

    input.value = '';
    var container = document.getElementById('unit-files-tab-content');
    if (container && unitId) await renderUnitFiles(container, unitId, unitName);
    if (typeof refreshAdminFilesList === 'function') await refreshAdminFilesList(unitId);
  });
}

bindFilesUI();
window.adminUploadFolder         = adminUploadFolder;
window.openPDFViewer             = openPDFViewer;
window.openImgViewer             = openImgViewer;
window.renderUnitFiles           = renderUnitFiles;
window.adminUploadFilesToSection = adminUploadFilesToSection;
