// ---- files.js ----
// Unit files viewer + admin uploader
// Uses local API (/api/files, /api/view)

window.DEFAULT_SECTIONS = [
  'Загальна інформація про підрозділ',
  'Інформація щодо особового складу',
  'Інформація щодо діяльності підрозділу',
  'Характеристика району обслуговування',
  'Робота під час блекауту'
];

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

// ---- API helpers ----
async function loadUnitFiles(unitId) {
  return window.localAPI.fetch('/files/' + encodeURIComponent(unitId));
}

// Fetch file blob and return object URL (for authenticated access)
var _blobCache = {};
async function getBlobUrl(storagePath) {
  if (_blobCache[storagePath]) return _blobCache[storagePath];
  try {
    var blob = await window.localAPI.getBlob('/view/' + storagePath);
    var url = URL.createObjectURL(blob);
    _blobCache[storagePath] = url;
    return url;
  } catch(e) { return ''; }
}

function escHTML(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ============================================================
// MAIN RENDER
// ============================================================

async function renderUnitFiles(container, unitId, unitName) {
  var sectionNames = DEFAULT_SECTIONS.slice();
  var bySection = {};
  DEFAULT_SECTIONS.forEach(function(s) { bySection[s] = null; });

  renderFolderGrid(container, sectionNames, bySection, unitId, unitName);

  try {
    var files = await loadUnitFiles(unitId);
    var newBySection = {};
    sectionNames.forEach(function(s) { newBySection[s] = []; });
    files.forEach(function(f) {
      var key = f.section_name || DEFAULT_SECTIONS[0];
      if (!newBySection[key]) { newBySection[key] = []; sectionNames.push(key); }
      newBySection[key].push(f);
    });
    if (container.isConnected) {
      renderFolderGrid(container, sectionNames, newBySection, unitId, unitName);
    }
  } catch(e) {
    // Keep showing default sections
  }
}

function renderFolderGrid(container, sectionNames, bySection, unitId, unitName) {
  var html = '';

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

  sectionNames.forEach(function(secName) {
    var panelId = 'sp-' + secName.replace(/[^\w]/g, '_');
    var grid = container.querySelector('#fg-' + panelId);
    if (!grid) return;
    var sectionFiles = bySection[secName];
    if (sectionFiles === null) {
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

    container.querySelectorAll('.sec-upload-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var sec = btn.dataset.sec;
        var inp = document.createElement('input');
        inp.type = 'file';
        inp.multiple = true;
        inp.style.display = 'none';
        document.body.appendChild(inp);
        inp.addEventListener('change', async function() {
          if (!inp.files?.length) { document.body.removeChild(inp); return; }
          var errors = await adminUploadFilesToSection(inp.files, unitId, unitName, sec, null);
          document.body.removeChild(inp);
          _blobCache = {};
          await renderUnitFiles(container, unitId, unitName);
          if (typeof refreshAdminFilesList === 'function') refreshAdminFilesList(unitId);
          if (errors.length) alert('Помилки:\n' + errors.slice(0,3).join('\n'));
        });
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
    '<a class="file-icon-link" data-sp="' + sp + '" href="#" data-download="' + safe + '">' +
    '<span class="file-big-icon">' + fileIcon(f.filename) + '</span></a>' +
    '<div class="file-card-name">' + safe + '</div>' + del + '</div>';
}

function bindFileCards(grid, unitId, unitName, container, bySection) {
  grid.querySelectorAll('[data-sp]').forEach(async function(el) {
    var sp = el.dataset.sp;
    var url = await getBlobUrl(sp);
    if (!url) return;

    if (el.tagName === 'IMG') {
      el.src = url;
      el.style.cursor = 'zoom-in';
      el.addEventListener('click', function() { openImgViewer(url, el.alt); });
      var ov = el.closest('.file-thumb-wrap')?.querySelector('.file-overlay');
      if (ov) ov.addEventListener('click', function() { openImgViewer(url, el.alt); });
    } else if (el.dataset.pdf) {
      el.href = '#';
      el.addEventListener('click', function(e) { e.preventDefault(); openDocViewer(url, el.dataset.name, sp); });
    } else if (el.dataset.office) {
      el.href = '#';
      el.addEventListener('click', function(e) { e.preventDefault(); openDocViewer(url, el.dataset.name, sp); });
    } else if (el.dataset.download) {
      // Download link - fetch blob and trigger download
      el.addEventListener('click', async function(e) {
        e.preventDefault();
        try {
          var a = document.createElement('a');
          a.href = url;
          a.download = el.dataset.download;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } catch(err) {}
      });
    }
  });

  grid.querySelectorAll('.file-del').forEach(function(btn) {
    btn.addEventListener('click', function() {
      deleteUnitFile(btn.dataset.id, unitId, unitName, container);
    });
  });
}

// ============================================================
// IMAGE VIEWER
// ============================================================

function openImgViewer(url, title) {
  var overlay = document.getElementById('doc-viewer-overlay');
  var titleEl = document.getElementById('dv-title');
  var content = document.getElementById('dv-content');
  if (!overlay || !content) return;
  if (titleEl) titleEl.textContent = title || '';
  content.innerHTML = '<img src="' + url + '" alt="' + escHTML(title||'') + '" class="dv-img">';
  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

// ============================================================
// DOCUMENT VIEWER (PDF.js + mammoth.js)
// ============================================================

function closeDocViewer() {
  var overlay = document.getElementById('doc-viewer-overlay');
  if (overlay) overlay.classList.add('hidden');
  document.body.style.overflow = '';
  var content = document.getElementById('dv-content');
  if (content) content.innerHTML = '';
}

async function openDocViewer(blobUrl, filename, storagePath) {
  var overlay = document.getElementById('doc-viewer-overlay');
  var titleEl = document.getElementById('dv-title');
  var content = document.getElementById('dv-content');
  if (!overlay || !content) return;
  if (titleEl) titleEl.textContent = filename || 'Документ';
  content.innerHTML = '<div class="loading" style="padding:40px;text-align:center">⏳ Завантаження...</div>';
  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  try {
    var ext = (filename || '').split('.').pop().toLowerCase();

    if (ext === 'docx' || ext === 'doc') {
      if (typeof mammoth === 'undefined') {
        content.innerHTML = '<div class="error-msg" style="padding:20px">Бібліотека mammoth не завантажилась. Оновіть сторінку.</div>';
        return;
      }
      // For DOCX we need fresh blob (mammoth uses arrayBuffer)
      var freshBlob = await window.localAPI.getBlob('/view/' + storagePath);
      var buf = await freshBlob.arrayBuffer();
      var result = await mammoth.convertToHtml({ arrayBuffer: buf });
      content.innerHTML = '<div class="docx-content">' + result.value + '</div>';
      return;
    }

    if (ext === 'pdf') {
      if (typeof pdfjsLib === 'undefined') {
        content.innerHTML = '<div class="error-msg" style="padding:20px">PDF.js не завантажився. Оновіть сторінку.</div>';
        return;
      }
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      content.innerHTML = '<div class="loading" style="padding:40px;text-align:center">⏳ Рендеринг сторінок...</div>';
      var pdf = await pdfjsLib.getDocument({ url: blobUrl }).promise;
      content.innerHTML = '';
      for (var p = 1; p <= pdf.numPages; p++) {
        var page = await pdf.getPage(p);
        var viewport = page.getViewport({ scale: 1.5 });
        var canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.className = 'pdf-page-canvas';
        content.appendChild(canvas);
        await page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise;
      }
      return;
    }

    if (ext === 'xlsx' || ext === 'xls') {
      content.innerHTML = '<div class="doc-info-msg">📊 Таблиця Excel<br><small>Перегляд таблиць у браузері не підтримується.<br>Зверніться до адміністратора.</small></div>';
      return;
    }

    if (ext === 'pptx' || ext === 'ppt') {
      content.innerHTML = '<div class="doc-info-msg">📑 Презентація PowerPoint<br><small>Перегляд презентацій у браузері не підтримується.<br>Зверніться до адміністратора.</small></div>';
      return;
    }

    content.innerHTML = '<div class="doc-info-msg">📎 ' + escHTML(filename || 'Файл') + '<br><small>Перегляд цього формату недоступний.</small></div>';

  } catch(e) {
    content.innerHTML = '<div class="error-msg" style="padding:20px">⚠️ ' + escHTML(e.message) + '</div>';
  }
}

// Keep backward compat alias
window.openPDFViewer = function(url, name) { openDocViewer(url, name, ''); };

// ============================================================
// DELETE FILE
// ============================================================

async function deleteUnitFile(fileId, unitId, unitName, container) {
  if (!confirm('Видалити файл?')) return;
  try {
    await window.localAPI.fetch('/files/' + fileId, { method: 'DELETE' });
    // Clear blob cache for this file
    // (we don't know the storagePath here easily, so just clear all)
    _blobCache = {};
    await renderUnitFiles(container || document.getElementById('sidebar-files-panel'), unitId, unitName);
  } catch(e) {
    alert('Помилка: ' + e.message);
  }
}

// ============================================================
// UPLOAD FILES TO SECTION
// ============================================================

async function adminUploadFilesToSection(fileList, unitId, unitName, sectionName, onProgress) {
  var files = Array.from(fileList).filter(function(f) {
    return !f.name.startsWith('.') && !f.name.endsWith('.tmp') && f.size > 0;
  });
  var done = 0, errors = [];
  var secIdx = DEFAULT_SECTIONS.indexOf(sectionName) + 1 || 0;

  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    try {
      var fd = new FormData();
      fd.append('file', file);
      fd.append('unit_id', String(unitId));
      fd.append('unit_name', unitName || '');
      fd.append('section_name', sectionName);
      fd.append('section_num', String(secIdx));

      await window.localAPI.fetch('/files/upload', { method: 'POST', body: fd });
    } catch(e) {
      errors.push(file.name + ': ' + e.message);
    }
    done++;
    if (typeof onProgress === 'function') onProgress(done, files.length);
  }
  // Clear blob cache so fresh files load
  _blobCache = {};
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
      var secName;
      if (parts.length >= 2) { secName = parts[1]; }
      else { secName = DEFAULT_SECTIONS[0]; }

      var secIdx2 = DEFAULT_SECTIONS.indexOf(secName) + 1 || 0;

      var fd = new FormData();
      fd.append('file', file);
      fd.append('unit_id', String(unitId));
      fd.append('unit_name', unitName || '');
      fd.append('section_name', secName);
      fd.append('section_num', String(secIdx2));

      await window.localAPI.fetch('/files/upload', { method: 'POST', body: fd });
    } catch(e) {
      errors.push(file.name + ': ' + e.message);
    }
    done++;
    if (typeof onProgress === 'function') onProgress(done, files.length);
  }
  _blobCache = {};
  return errors;
}

// ============================================================
// INTEGRATION — called from cases.js
// ============================================================

window.loadAndRenderFilesTab = async function(unitId, unitName) {
  var container = document.getElementById('sidebar-files-panel');
  if (!container) return;
  await renderUnitFiles(container, unitId, unitName);
};

// ============================================================
// UI BINDINGS
// ============================================================

function handleSectionFileInput(input) {
  input.addEventListener('change', async function() {
    var sec = input.dataset.sec;
    var unitId = input.dataset.unitId;
    var unitName = input.dataset.unitName || '';
    if (!unitId || !sec || !input.files?.length) { input.value = ''; return; }

    var container = input._container || document.getElementById('unit-files-tab-content');

    if (container) container.innerHTML = '<div class="loading" style="padding:32px;text-align:center">Завантаження файлів... 0%</div>';

    var errors = await adminUploadFilesToSection(input.files, unitId, unitName, sec, function(done, total) {
      var loadEl = container?.querySelector('.loading');
      if (loadEl) loadEl.textContent = 'Завантаження файлів... ' + Math.round((done/total)*100) + '% (' + done + '/' + total + ')';
    });

    input.value = '';
    input._container = null;
    input._bySection = null;
    input._sectionNames = null;

    if (errors.length) {
      alert('Завантажено з помилками:\n' + errors.slice(0, 5).join('\n'));
    }

    if (container) await renderUnitFiles(container, unitId, unitName);
    if (typeof refreshAdminFilesList === 'function') refreshAdminFilesList(unitId);
  });
}

function bindFilesUI() {
  var closeBtn = document.getElementById('dv-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeDocViewer);
  }
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeDocViewer();
  });

  var adminInput = document.getElementById('admin-section-file-input');
  if (adminInput) handleSectionFileInput(adminInput);
}

bindFilesUI();
window.adminUploadFolder         = adminUploadFolder;
window.openDocViewer             = openDocViewer;
window.openImgViewer             = openImgViewer;
window.renderUnitFiles           = renderUnitFiles;
window.adminUploadFilesToSection = adminUploadFilesToSection;
