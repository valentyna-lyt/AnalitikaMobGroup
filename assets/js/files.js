// ---- files.js ----
// Unit files: Supabase Storage viewer + admin uploader

const UNIT_SECTIONS = [
  { num: 1, short: 'Про підрозділ',   icon: '🏛️', name: 'Загальна інформація про підрозділ' },
  { num: 2, short: 'Район та карта',  icon: '🗺️', name: 'Характеристика району та карта' },
  { num: 3, short: 'Особовий склад',  icon: '👥', name: 'Особовий склад' },
  { num: 4, short: 'Діяльність',      icon: '📋', name: 'Діяльність підрозділу' },
  { num: 5, short: 'ПОГ підрозділи',  icon: '🗂️', name: 'Діяльність ПОГ підрозділів' },
  { num: 6, short: 'Блокпости',       icon: '🚧', name: 'Блокпости' },
  { num: 7, short: 'Відряджені',      icon: '👮', name: 'Відряджені поліцейські' },
  { num: 8, short: 'Готовність',      icon: '⚡', name: 'Готовність до відключення електропостачання' },
];
window.UNIT_SECTIONS = UNIT_SECTIONS;

function isImage(name) {
  return /\.(jpe?g|png|gif|webp)$/i.test(name);
}
function isPDF(name) {
  return /\.pdf$/i.test(name);
}
function fileIcon(name) {
  if (isImage(name)) return '🖼️';
  if (isPDF(name))   return '📄';
  if (/\.docx?$/i.test(name)) return '📝';
  if (/\.xlsx?$/i.test(name)) return '📊';
  return '📎';
}

// ============================================================
// VIEWER
// ============================================================

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

function renderFilesTab(files, container, unitId, unitName) {
  if (!files.length) {
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

  // Group by section
  const bySec = {};
  UNIT_SECTIONS.forEach(s => { bySec[s.num] = []; });
  files.forEach(f => { if (bySec[f.section_num]) bySec[f.section_num].push(f); });
  const active = UNIT_SECTIONS.filter(s => bySec[s.num].length > 0);

  let html = `<div class="sec-tabs">`;
  active.forEach((s, i) => {
    html += `<button class="sec-tab${i===0?' active':''}" data-sec="${s.num}">
      ${s.icon} <span class="sec-tab-label">${s.short}</span>
      <span class="sec-tab-count">${bySec[s.num].length}</span>
    </button>`;
  });
  html += `</div>`;

  active.forEach((s, i) => {
    html += `<div class="sec-panel${i===0?'':' hidden'}" data-sec="${s.num}">
      <div class="files-grid" id="fgrid-${s.num}"></div>
    </div>`;
  });

  container.innerHTML = html;

  // Tab switching
  container.querySelectorAll('.sec-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.sec-tab').forEach(b => b.classList.remove('active'));
      container.querySelectorAll('.sec-panel').forEach(p => p.classList.add('hidden'));
      btn.classList.add('active');
      container.querySelector(`.sec-panel[data-sec="${btn.dataset.sec}"]`)?.classList.remove('hidden');
    });
  });

  // Render file cards (then async-load signed URLs)
  active.forEach(s => {
    const grid = container.querySelector(`#fgrid-${s.num}`);
    if (!grid) return;
    grid.innerHTML = bySec[s.num].map(f => renderFileCard(f)).join('');
  });

  // Signed URLs — batch
  container.querySelectorAll('[data-sp]').forEach(async el => {
    const url = await getSignedUrl(el.dataset.sp);
    if (!url) return;
    if (el.tagName === 'IMG') {
      el.src = url;
    } else if (el.dataset.pdf) {
      el.addEventListener('click', e => { e.preventDefault(); openPDFViewer(url, el.dataset.name); });
      el.href = url;
    } else {
      el.href = url;
    }
  });

  // Delete buttons
  container.querySelectorAll('.file-del').forEach(btn => {
    btn.addEventListener('click', () => deleteUnitFile(btn.dataset.id, unitId, unitName));
  });
}

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

  return `<div class="file-card">
    <a class="file-icon-link" data-sp="${sp}" href="#" download="${safe}">
      <span class="file-big-icon">${fileIcon(f.filename)}</span>
    </a>
    <div class="file-card-name">${safe}</div>
    ${del}
  </div>`;
}

function openPDFViewer(url, filename) {
  const modal = document.getElementById('pdf-viewer-modal');
  if (!modal) { window.open(url, '_blank'); return; }
  document.getElementById('pdf-viewer-title').textContent = filename;
  document.getElementById('pdf-viewer-iframe').src = url;
  modal.showModal();
}

async function deleteUnitFile(fileId, unitId, unitName) {
  if (!confirm('Видалити файл?')) return;
  const { data } = await window.supabase
    .from('unit_files').select('storage_path').eq('id', fileId).single();
  if (data?.storage_path) {
    await window.supabase.storage.from('unit-files').remove([data.storage_path]);
  }
  const { error } = await window.supabase.from('unit_files').delete().eq('id', fileId);
  if (error) { alert(error.message); return; }
  // Reload files tab
  const files = await loadUnitFiles(unitId);
  const container = document.getElementById('unit-files-tab-content');
  if (container) renderFilesTab(files, container, unitId, unitName);
}

// ============================================================
// ADMIN UPLOAD
// ============================================================

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

      // Find section folder (starts with digit 1-8 followed by space)
      let sectionNum  = 0;
      let fileSubPath = file.name;

      for (let i = 0; i < parts.length - 1; i++) {
        const m = parts[i].match(/^([1-8])[\s_]/);
        if (m) {
          sectionNum  = parseInt(m[1]);
          fileSubPath = parts.slice(i + 1).join('/');
          break;
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
    document.getElementById('pdf-viewer-iframe').src = '';
  });
}

bindFilesUI();
window.adminUploadFolder  = adminUploadFolder;
window.openPDFViewer      = openPDFViewer;
