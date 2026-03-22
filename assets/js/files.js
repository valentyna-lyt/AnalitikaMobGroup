// ---- files.js ----
// Unit files viewer + admin uploader
// Uses ONLY unit_files table (no unit_sections required)

// Default sections shown for any unit (match ХРУП 1 folder names)
var DEFAULT_SECTIONS = [
  'Загальна інформація про підрозділ',
  'Інформація щодо особового складу',
  'Інформація щодо діяльності підрозділу',
  'Характеристика району обслуговування',
  'Робота під час блекауту'
];

// ---- Safe storage path (UUID-based, Supabase doesn't allow Cyrillic) ----
// Original filename/section are stored in DB for display; storage uses safe ASCII paths
function makeSafeStoragePath(unitId, sectionIndex, filename) {
  var ext = '';
  var dot = filename.lastIndexOf('.');
  if (dot > 0) ext = filename.slice(dot).toLowerCase().replace(/[^a-z0-9.]/g, '');
  var uid = Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  return String(unitId) + '/s' + sectionIndex + '/' + uid + ext;
}

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

// ---- Supabase helpers ----
function sbQuery(queryPromise) {
  return Promise.race([
    queryPromise,
    new Promise(function(_, reject) {
      setTimeout(function() { reject(new Error('Timeout: немає відповіді від сервера')); }, 8000);
    })
  ]);
}

async function loadUnitFiles(unitId) {
  var res = await sbQuery(
    window.supabase.from('unit_files').select('*')
      .eq('unit_id', String(unitId))
      .order('section_name').order('filename')
  );
  if (res.error) throw res.error;
  return res.data || [];
}

async function getSignedUrl(storagePath) {
  try {
    var res = await sbQuery(
      window.supabase.storage.from('unit-files').createSignedUrl(storagePath, 3600)
    );
    return res.data?.signedUrl || '';
  } catch(e) { return ''; }
}

// ============================================================
// MAIN RENDER
// ============================================================

async function renderUnitFiles(container, unitId, unitName) {
  // Show default sections IMMEDIATELY — no waiting for Supabase
  var sectionNames = DEFAULT_SECTIONS.slice();
  var bySection = {};
  DEFAULT_SECTIONS.forEach(function(s) { bySection[s] = null; }); // null = not yet loaded

  renderFolderGrid(container, sectionNames, bySection, unitId, unitName);

  // Then try to load actual files in background to get counts
  try {
    var files = await loadUnitFiles(unitId);
    var newBySection = {};
    sectionNames.forEach(function(s) { newBySection[s] = []; });
    files.forEach(function(f) {
      var key = f.section_name || DEFAULT_SECTIONS[0];
      if (!newBySection[key]) { newBySection[key] = []; sectionNames.push(key); }
      newBySection[key].push(f);
    });
    // Re-render with actual counts (only if modal still open)
    if (container.isConnected) {
      renderFolderGrid(container, sectionNames, newBySection, unitId, unitName);
    }
  } catch(e) {
    // Keep showing default sections, just without file counts
  }
}

function renderFolderGrid(container, sectionNames, bySection, unitId, unitName) {
  var html = '';

  // Admin: add section button
  if (isAdmin()) {
    html += '<div class="sec-mgmt-bar">' +
      '<button class="btn-sm btn-add-section">+ Додати розділ</button>' +
      '</div>' +
      '<div class="add-section-form hidden" id="add-section-form">' +
      '<input type="text" id="new-section-name" class="form-control" placeholder="Назва розділу...">' +
      '<button class="btn-primary btn-sm" id="save-section-btn">Зберегти</button>' +
      '<button class="btn-sm" id="cancel-section-btn">Скасувати</button>' +
      '</div>';
  }

  // Folder grid
  html += '<div class="folders-grid" id="folders-grid">';
  sectionNames.forEach(function(secName) {
    var sf = bySection[secName];
    var countLabel = sf === null ? '...' : fileCountLabel(sf.length);
    html += '<div class="folder-card" data-sec="' + escHTML(secName) + '">' +
      '<div class="folder-icon">📁</div>' +
      '<div class="folder-name">' + escHTML(secName) + '</div>' +
      '<div class="folder-count">' + countLabel + '</div>' +
      '</div>';
  });
  html += '</div>';

  // File panels (one per section, hidden)
  sectionNames.forEach(function(secName) {
    var panelId = 'sp-' + secName.replace(/[^\w]/g, '_');
    html += '<div class="sec-files-panel hidden" id="' + escHTML(panelId) + '" data-sec="' + escHTML(secName) + '">' +
      '<div class="sec-panel-header">' +
      '<button class="sec-panel-back">← Назад</button>' +
      '<span>📁 ' + escHTML(secName) + '</span>' +
      (isAdmin() ? '<button class="btn-sm sec-upload-btn" data-sec="' + escHTML(secName) + '">⬆ Завантажити</button>' : '') +
      '</div>' +
      '<div class="files-grid" id="fg-' + escHTML(panelId) + '"></div>' +
      '</div>';
  });

  container.innerHTML = html;

  // Render file cards per section (skip null = not yet loaded)
  sectionNames.forEach(function(secName) {
    var panelId = 'sp-' + secName.replace(/[^\w]/g, '_');
    var grid = container.querySelector('#fg-' + panelId);
    if (!grid) return;
    var sectionFiles = bySection[secName];
    if (sectionFiles === null) {
      // Will be loaded on click
      grid.innerHTML = '';
    } else if (!sectionFiles.length) {
      grid.innerHTML = '<div class="no-data" style="padding:20px;text-align:center">Файлів немає' +
        (isAdmin() ? '<br><small>Натисніть "⬆ Завантажити" щоб додати</small>' : '') + '</div>';
    } else {
      grid.innerHTML = sectionFiles.map(renderFileCard).join('');
      bindFileCards(grid, unitId, unitName, container, bySection);
    }
  });

  // Folder card → open section panel
  container.querySelectorAll('.folder-card').forEach(function(card) {
    card.addEventListener('click', function() {
      var sec = card.dataset.sec;
      var panelId = 'sp-' + sec.replace(/[^\w]/g, '_');
      container.querySelector('#folders-grid')?.classList.add('hidden');
      container.querySelectorAll('.sec-mgmt-bar,.add-section-form').forEach(function(el){ el.classList.add('hidden'); });
      container.querySelectorAll('.sec-files-panel').forEach(function(p){ p.classList.add('hidden'); });
      var panel = container.querySelector('#' + panelId);
      if (!panel) return;
      panel.classList.remove('hidden');

      // Load files for this section if not yet loaded (bySection[sec] === null)
      if (bySection[sec] === null) {
        var grid = container.querySelector('#fg-' + panelId);
        if (grid) {
          grid.innerHTML = '<div class="loading" style="padding:20px;text-align:center">Завантаження...</div>';
          loadUnitFiles(unitId).then(function(files) {
            var secFiles = files.filter(function(f){ return (f.section_name || DEFAULT_SECTIONS[0]) === sec; });
            bySection[sec] = secFiles;
            if (!secFiles.length) {
              grid.innerHTML = '<div class="no-data" style="padding:20px;text-align:center">Файлів немає' +
                (isAdmin() ? '<br><small>Натисніть "⬆ Завантажити" щоб додати</small>' : '') + '</div>';
            } else {
              grid.innerHTML = secFiles.map(renderFileCard).join('');
              bindFileCards(grid, unitId, unitName, container, bySection);
            }
          }).catch(function(e) {
            if (grid) grid.innerHTML = '<div class="error-msg" style="padding:16px">⚠️ ' + escHTML(e.message) + '</div>';
          });
        }
      }
    });
  });

  // Back button
  container.querySelectorAll('.sec-panel-back').forEach(function(btn) {
    btn.addEventListener('click', function() {
      container.querySelectorAll('.sec-files-panel').forEach(function(p){ p.classList.add('hidden'); });
      container.querySelector('#folders-grid')?.classList.remove('hidden');
      container.querySelectorAll('.sec-mgmt-bar').forEach(function(el){ el.classList.remove('hidden'); });
    });
  });

  // Admin: add section
  if (isAdmin()) {
    var addBtn = container.querySelector('.btn-add-section');
    var addForm = container.querySelector('#add-section-form');
    if (addBtn && addForm) addBtn.addEventListener('click', function() { addForm.classList.toggle('hidden'); });

    var saveBtn = container.querySelector('#save-section-btn');
    var cancelBtn = container.querySelector('#cancel-section-btn');
    if (saveBtn) saveBtn.addEventListener('click', function() {
      var inp = container.querySelector('#new-section-name');
      var name = (inp?.value || '').trim();
      if (!name) { alert('Введіть назву розділу'); return; }
      if (sectionNames.indexOf(name) === -1) sectionNames.push(name);
      if (!bySection[name]) bySection[name] = [];
      renderFolderGrid(container, sectionNames, bySection, unitId, unitName);
    });
    if (cancelBtn) cancelBtn.addEventListener('click', function() {
      var f = container.querySelector('#add-section-form');
      if (f) f.classList.add('hidden');
    });

    // Per-section upload button
    container.querySelectorAll('.sec-upload-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var sec = btn.dataset.sec;
        // Try modal input first, fallback to admin input
        var inp = document.getElementById('unit-section-file-input') ||
                  document.getElementById('admin-section-file-input');
        if (!inp) return;
        inp.dataset.sec = sec;
        inp.dataset.unitId = String(unitId);
        inp.dataset.unitName = unitName || '';
        inp._container = container;
        inp._bySection = bySection;
        inp._sectionNames = sectionNames;
        inp.value = '';
        inp.click();
      });
    });
  }
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
      '<div class="file-thumb-wrap"><img data-sp="' + sp + '" alt="' + safe + '" class="file-thumb">' +
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

function bindFileCards(grid, unitId, unitName, container, bySection) {
  grid.querySelectorAll('[data-sp]').forEach(async function(el) {
    var url = await getSignedUrl(el.dataset.sp);
    if (!url) return;
    if (el.tagName === 'IMG') {
      el.src = url;
      el.style.cursor = 'zoom-in';
      el.addEventListener('click', function() { openImgViewer(url, el.alt); });
      var ov = el.closest('.file-thumb-wrap')?.querySelector('.file-overlay');
      if (ov) ov.addEventListener('click', function() { openImgViewer(url, el.alt); });
    } else if (el.dataset.pdf) {
      el.href = url;
      el.addEventListener('click', function(e) { e.preventDefault(); openPDFViewer(url, el.dataset.name); });
    } else if (el.dataset.office) {
      var vUrl = 'https://docs.google.com/viewer?embedded=true&url=' + encodeURIComponent(url);
      el.href = url;
      el.addEventListener('click', function(e) { e.preventDefault(); openPDFViewer(vUrl, el.dataset.name); });
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
// UPLOAD FILES TO SECTION
// ============================================================

async function adminUploadFilesToSection(fileList, unitId, unitName, sectionName, onProgress) {
  var files = Array.from(fileList).filter(function(f) {
    return !f.name.startsWith('.') && !f.name.endsWith('.tmp') && f.size > 0;
  });
  var done = 0, errors = [];

  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    try {
      var secIdx = DEFAULT_SECTIONS.indexOf(sectionName) + 1 || 0;
      var storagePath = makeSafeStoragePath(unitId, secIdx, file.name);
      var up = await window.supabase.storage.from('unit-files').upload(storagePath, file, { upsert: false });
      if (up.error) {
        errors.push(file.name + ': ' + up.error.message);
      } else {
        await window.supabase.from('unit_files').insert({
          unit_id: String(unitId), unit_name: unitName,
          section_num: secIdx,
          section_name: sectionName,
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

async function adminUploadFolder(fileList, unitId, unitName, onProgress) {
  var files = Array.from(fileList).filter(function(f) {
    return !f.name.startsWith('.') && !f.name.endsWith('.tmp') && f.size > 0;
  });
  var done = 0, errors = [];

  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    try {
      var parts = (file.webkitRelativePath || file.name).split('/');
      var secName, fileSubPath;
      if (parts.length >= 3) { secName = parts[1]; fileSubPath = parts.slice(2).join('/'); }
      else if (parts.length === 2) { secName = parts[1]; fileSubPath = file.name; }
      else { secName = DEFAULT_SECTIONS[0]; fileSubPath = file.name; }

      var secIdx2 = DEFAULT_SECTIONS.indexOf(secName) + 1 || 0;
      var storagePath = makeSafeStoragePath(unitId, secIdx2, file.name);
      var up = await window.supabase.storage.from('unit-files').upload(storagePath, file, { upsert: false });
      if (up.error) {
        errors.push(file.name + ': ' + up.error.message);
      } else {
        await window.supabase.from('unit_files').insert({
          unit_id: String(unitId), unit_name: unitName,
          section_num: secIdx2,
          section_name: secName,
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

function handleSectionFileInput(input) {
  input.addEventListener('change', async function(e) {
    var sec = input.dataset.sec;
    var unitId = input.dataset.unitId;
    var unitName = input.dataset.unitName || '';
    if (!unitId || !sec || !input.files?.length) { input.value = ''; return; }

    var container = input._container || document.getElementById('unit-files-tab-content');
    var bySection = input._bySection;
    var sectionNames = input._sectionNames;

    // Show progress indicator
    var prevHTML = container?.innerHTML;
    if (container) container.innerHTML = '<div class="loading" style="padding:32px;text-align:center">Завантаження файлів... 0%</div>';

    var errors = await adminUploadFilesToSection(input.files, unitId, unitName, sec, function(done, total) {
      if (container) container.querySelector('.loading').textContent =
        'Завантаження файлів... ' + Math.round((done/total)*100) + '% (' + done + '/' + total + ')';
    });

    input.value = '';
    input._container = null;
    input._bySection = null;
    input._sectionNames = null;

    if (errors.length) {
      alert('Завантажено з помилками:\n' + errors.slice(0, 5).join('\n'));
    }

    // Re-render
    if (container) await renderUnitFiles(container, unitId, unitName);
    if (typeof refreshAdminFilesList === 'function') refreshAdminFilesList(unitId);
  });
}

function bindFilesUI() {
  // PDF viewer close
  document.getElementById('pdf-viewer-close')?.addEventListener('click', function() {
    var m = document.getElementById('pdf-viewer-modal');
    if (m) m.close();
    var f = document.getElementById('pdf-viewer-iframe');
    if (f) f.src = '';
  });

  // Image viewer close
  document.getElementById('img-viewer-close')?.addEventListener('click', function() {
    var m = document.getElementById('img-viewer-modal');
    if (m) m.close();
    var i = document.getElementById('img-viewer-img');
    if (i) i.src = '';
  });

  // Unit modal file input (for upload from within modal)
  var unitInput = document.getElementById('unit-section-file-input');
  if (unitInput) handleSectionFileInput(unitInput);

  // Admin panel file input
  var adminInput = document.getElementById('admin-section-file-input');
  if (adminInput) handleSectionFileInput(adminInput);
}

bindFilesUI();
window.adminUploadFolder         = adminUploadFolder;
window.openPDFViewer             = openPDFViewer;
window.openImgViewer             = openImgViewer;
window.renderUnitFiles           = renderUnitFiles;
window.adminUploadFilesToSection = adminUploadFilesToSection;
