// ---- files.js ----
// Unit files: Supabase Storage viewer + admin uploader

const UNIT_SECTIONS = [
  { num: 1, short: 'Загальна інформація',  icon: '🏛️', name: 'Загальна інформація про підрозділ' },
  { num: 2, short: 'Район та карта',       icon: '🗺️', name: 'Характеристика району та карта' },
  { num: 3, short: 'Особовий склад',       icon: '👥', name: 'Особовий склад' },
  { num: 4, short: 'Діяльність',           icon: '📋', name: 'Діяльність підрозділу' },
  { num: 5, short: 'ПОГ підрозділи',       icon: '🗂️', name: 'Діяльність ПОГ підрозділів' },
  { num: 6, short: 'Блокпости',            icon: '🚧', name: 'Блокпости' },
  { num: 7, short: 'Відряджені',           icon: '👮', name: 'Відряджені поліцейські' },
  { num: 8, short: 'Готовність',           icon: '⚡', name: 'Готовність до відключення електропостачання' },
];
window.UNIT_SECTIONS = UNIT_SECTIONS;

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

// ---- Supabase helpers ----
async function loadUnitFiles(unitId) {
  const { data, error } = await window.supabase
    .from('unit_files')
    .select('*')
    .eq('unit_id', String(unitId))
    .order('section_num')
    .order('filename');
  if (error) throw error;
  return data || [];
}

async function getSignedUrl(storagePath) {
  try {
    const { data } = await window.supabase.storage
      .from('unit-files')
      .createSignedUrl(storagePath, 3600);
    return data?.signedUrl || '';
  } catch { return ''; }
}

// ============================================================
// FOLDER-CARD VIEW
// ============================================================

function renderFilesTab(files, container, unitId, unitName) {
  // Group by section
  const bySec = {};
  UNIT_SECTIONS.forEach(s => { bySec[s.num] = []; });
  files.forEach(f => { if (bySec[f.section_num]) bySec[f.section_num].push(f); });

  const hasFiles = files.length > 0;

  if (!hasFiles) {
    container.innerHTML = `<div class="no-data">Файли ще не завантажені для цього підрозділу</div>` +
      (isAdmin() ? `<div style="text-align:center;margin-top:12px">
        <button class="btn-primary" style="width:auto;padding:8px 20px" id="btn-go-upload">📁 Завантажити файли</button>
      </div>` : '');
    container.querySelector('#btn-go-upload')?.addEventListener('click', () => {
      document.getElementById('unit-cases-modal')?.close();
      if (typeof openAdminPanel === 'function') openAdminPanel('files', unitId);
    });
    return;
  }

  // Folder grid
  let html = `<div class="folders-grid">`;
  UNIT_SECTIONS.forEach(s => {
    const count = bySec[s.num].length;
    html += `<div class="folder-card${count ? '' : ' folder-empty'}" data-sec="${s.num}">
      <div class="folder-icon">${s.icon}</div>
      <div class="folder-name">${s.short}</div>
      <div class="folder-count">${count ? count + ' файл' + (count === 1 ? '' : count < 5 ? 'и' : 'ів') : 'порожньо'}</div>
    </div>`;
  });
  html += `</div>`;

  // File panels (hidden initially)
  UNIT_SECTIONS.forEach(s => {
    html += `<div class="sec-files-panel hidden" data-panel="${s.num}">
      <div class="sec-panel-header">
        <button class="sec-panel-back">← Назад</button>
        <span>${s.icon} ${s.name}</span>
        ${isAdmin() ? `<button class="btn-sm sec-upload-btn" data-sec="${s.num}">⬆ Завантажити</button>` : ''}
      </div>
      <div class="files-grid" id="fgrid-${s.num}"></div>
    </div>`;
  });

  container.innerHTML = html;

  // Render file cards
  UNIT_SECTIONS.forEach(s => {
    const grid = container.querySelector(`#fgrid-${s.num}`);
    if (!grid || !bySec[s.num].length) {
      if (grid) grid.innerHTML = '<div class="no-data" style="padding:16px">Файлів немає</div>';
      return;
    }
    grid.innerHTML = bySec[s.num].map(f => renderFileCard(f)).join('');
    // Batch load signed URLs
    grid.querySelectorAll('[data-sp]').forEach(async el => {
      const url = await getSignedUrl(el.dataset.sp);
      if (!url) return;
      if (el.tagName === 'IMG') {
        el.src = url;
      } else if (el.dataset.pdf) {
        el.href = url;
        el.addEventListener('click', e => { e.preventDefault(); openPDFViewer(url, el.dataset.name); });
      } else if (el.dataset.office) {
        const viewerUrl = 'https://docs.google.com/viewer?embedded=true&url=' + encodeURIComponent(url);
        el.href = url;
        el.addEventListener('click', e => { e.preventDefault(); openPDFViewer(viewerUrl, el.dataset.name); });
      } else {
        el.href = url;
      }
    });
    // Delete buttons
    grid.querySelectorAll('.file-del').forEach(btn => {
      btn.addEventListener('click', () => deleteUnitFile(btn.dataset.id, unitId, unitName, container));
    });
  });

  // Folder card click → open panel
  container.querySelectorAll('.folder-card').forEach(card => {
    card.addEventListener('click', () => {
      const sec = card.dataset.sec;
      container.querySelector('.folders-grid').classList.add('hidden');
      container.querySelectorAll('.sec-files-panel').forEach(p => p.classList.add('hidden'));
      container.querySelector(`.sec-files-panel[data-panel="${sec}"]`)?.classList.remove('hidden');
    });
  });

  // Back button
  container.querySelectorAll('.sec-panel-back').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.sec-files-panel').forEach(p => p.classList.add('hidden'));
      container.querySelector('.folders-grid').classList.remove('hidden');
    });
  });

  // Admin upload per section
  container.querySelectorAll('.sec-upload-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('unit-cases-modal')?.close();
      if (typeof openAdminPanel === 'function') openAdminPanel('files', unitId);
    });
  });
}

// ============================================================
// FILE CARD
// ============================================================

function renderFileCard(f) {
  const safe = escHTML(f.filename);
  const sp   = escHTML(f.storage_path);
  const del  = isAdmin()
    ? `<button class="file-del" data-id="${escHTML(f.id)}" title="Видалити">🗑️</button>`
    : '';

  if (isImage(f.filename)) {
    return `<div class="file-card">
      <div class="file-thumb-wrap">
        <img data-sp="${sp}" alt="${safe}" class="file-thumb">
        <div class="file-overlay">🔍</div>
      </div>
      <div class="file-card-name">${safe}</div>
      ${del}
    </div>`;
  }

  if (isPDF(f.filename)) {
    return `<div class="file-card">
      <a class="file-icon-link" data-sp="${sp}" data-pdf="1" data-name="${safe}" href="#">
        <span class="file-big-icon">📄</span>
      </a>
      <div class="file-card-name">${safe}</div>
      ${del}
    </div>`;
  }

  if (isOffice(f.filename)) {
    return `<div class="file-card">
      <a class="file-icon-link" data-sp="${sp}" data-office="1" data-name="${safe}" href="#">
        <span class="file-big-icon">${fileIcon(f.filename)}</span>
      </a>
      <div class="file-card-name">${safe}</div>
      ${del}
    </div>`;
  }

  // Generic download
  return `<div class="file-card">
    <a class="file-icon-link" data-sp="${sp}" href="#" download="${safe}">
      <span class="file-big-icon">${fileIcon(f.filename)}</span>
    </a>
    <div class="file-card-name">${safe}</div>
    ${del}
  </div>`;
}

// ============================================================
// PDF / OFFICE VIEWER
// ============================================================

function openPDFViewer(url, filename) {
  const modal = document.getElementById('pdf-viewer-modal');
  if (!modal) { window.open(url, '_blank'); return; }
  document.getElementById('pdf-viewer-title').textContent = filename;
  document.getElementById('pdf-viewer-iframe').src = url;
  modal.showModal();
}

// ============================================================
// DELETE
// ============================================================

async function deleteUnitFile(fileId, unitId, unitName, container) {
  if (!confirm('Видалити файл?')) return;
  const { data } = await window.supabase
    .from('unit_files').select('storage_path').eq('id', fileId).single();
  if (data?.storage_path) {
    await window.supabase.storage.from('unit-files').remove([data.storage_path]);
  }
  const { error } = await window.supabase.from('unit_files').delete().eq('id', fileId);
  if (error) { alert(error.message); return; }
  const files = await loadUnitFiles(unitId);
  renderFilesTab(files, container || document.getElementById('unit-files-tab-content'), unitId, unitName);
}

// ============================================================
// ADMIN UPLOAD
// ============================================================

// Maps Ukrainian folder names (without number prefix) to section numbers
const SECTION_FOLDER_MAP = [
  { num: 1, keys: ['загальна інформація', 'загальна інфо'] },
  { num: 2, keys: ['характеристика району', 'район', 'карта'] },
  { num: 3, keys: ['особовий склад', 'особовий', 'склад'] },
  { num: 4, keys: ['діяльність підрозділу', 'діяльність', 'накази', 'доручення', 'надзвичайні', 'назвичайні', 'службовий транспорт', 'службовий тарнспорт'] },
  { num: 5, keys: ['пог підрозділ', 'пог'] },
  { num: 6, keys: ['блокпости', 'блокпост'] },
  { num: 7, keys: ['відряджені', 'відряджен'] },
  { num: 8, keys: ['блекаут', 'відключення', 'готовність', 'робота під час'] },
];

function detectSectionByName(folderName) {
  const lower = folderName.toLowerCase().trim();
  for (const sec of SECTION_FOLDER_MAP) {
    if (sec.keys.some(k => lower.includes(k))) return sec.num;
  }
  return 0;
}

async function adminUploadFolder(fileList, unitId, unitName, onProgress) {
  const files = Array.from(fileList).filter(f =>
    !f.name.startsWith('.') && !f.name.endsWith('.tmp') && f.size > 0
  );
  let done = 0;
  const errors = [];

  for (const file of files) {
    try {
      const relPath = file.webkitRelativePath || file.name;
      const parts   = relPath.split('/');

      let sectionNum  = 0;
      let fileSubPath = file.name;

      // 1. Try numeric prefix: "1 Назва", "2_Назва", "3-Назва"
      for (let i = 0; i < parts.length - 1; i++) {
        const m = parts[i].match(/^([1-8])[\s_\-\.]/);
        if (m) {
          sectionNum  = parseInt(m[1]);
          fileSubPath = parts.slice(i + 1).join('/');
          break;
        }
      }

      // 2. If not found — try matching folder name by keywords
      if (!sectionNum) {
        for (let i = 0; i < parts.length - 1; i++) {
          const sec = detectSectionByName(parts[i]);
          if (sec) {
            sectionNum  = sec;
            fileSubPath = parts.slice(i + 1).join('/');
            break;
          }
        }
      }

      if (!sectionNum) {
        done++; onProgress?.(done, files.length); continue;
      }

      const storagePath = `${unitId}/${sectionNum}/${fileSubPath}`;
      const section     = UNIT_SECTIONS.find(s => s.num === sectionNum);

      const { error: upErr } = await window.supabase.storage
        .from('unit-files')
        .upload(storagePath, file, { upsert: true });

      if (upErr) {
        errors.push(`${file.name}: ${upErr.message}`);
      } else {
        await window.supabase.from('unit_files').upsert({
          unit_id:      String(unitId),
          unit_name:    unitName,
          section_num:  sectionNum,
          section_name: section?.name || '',
          filename:     file.name,
          storage_path: storagePath,
          mime_type:    file.type || '',
          file_size:    file.size,
          uploaded_by:  window.currentUser?.id,
        }, { onConflict: 'storage_path' });
      }
    } catch(e) {
      errors.push(`${file.name}: ${e.message}`);
    }
    done++;
    onProgress?.(done, files.length);
  }
  return errors;
}

// ============================================================
// INTEGRATION — called from cases.js tab switch
// ============================================================

window.loadAndRenderFilesTab = async function(unitId, unitName) {
  const container = document.getElementById('unit-files-tab-content');
  if (!container) return;
  container.innerHTML = '<div class="loading">Завантаження файлів...</div>';
  try {
    const files = await loadUnitFiles(unitId);
    renderFilesTab(files, container, unitId, unitName);
  } catch(e) {
    container.innerHTML = `<div class="error-msg">${escHTML(e.message)}</div>`;
  }
};

// ============================================================
// UI bindings
// ============================================================

function bindFilesUI() {
  document.getElementById('pdf-viewer-close')?.addEventListener('click', () => {
    const m = document.getElementById('pdf-viewer-modal');
    m?.close();
    const iframe = document.getElementById('pdf-viewer-iframe');
    if (iframe) iframe.src = '';
  });
}

bindFilesUI();
window.adminUploadFolder = adminUploadFolder;
window.openPDFViewer     = openPDFViewer;
