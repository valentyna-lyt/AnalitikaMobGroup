// ---- admin.js ----

// ============================================================
// ADMIN PANEL — open with optional tab
// ============================================================

async function openAdminPanel(tab, preselectUnitId) {
  if (!isAdmin()) { alert('Доступ заборонено'); return; }
  const modal = document.getElementById('admin-modal');
  modal.showModal();

  if (tab === 'files') {
    switchAdminTab('files');
    if (preselectUnitId) {
      const sel = document.getElementById('admin-upload-unit-sel');
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
  const tabCases  = document.getElementById('admin-tab-cases');
  const tabFiles  = document.getElementById('admin-tab-files');
  const panelCases = document.getElementById('admin-cases-panel');
  const panelFiles = document.getElementById('admin-files-panel');

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
  const tbody = document.getElementById('admin-cases-tbody');
  tbody.innerHTML = '<tr><td colspan="5" class="loading">Завантаження...</td></tr>';

  const { data, error } = await window.supabase
    .from('unit_cases')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    tbody.innerHTML = `<tr><td colspan="5" class="error-msg">${escHTML(error.message)}</td></tr>`;
    return;
  }

  const countEl = document.getElementById('admin-total-count');
  if (countEl) countEl.textContent = `Всього справ: ${data.length}`;

  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="no-data">Справи відсутні</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(c => `
    <tr>
      <td>${escHTML(c.unit_name || c.unit_id)}</td>
      <td>${escHTML(c.title)}</td>
      <td>${c.case_date ? formatDate(c.case_date) : '—'}</td>
      <td>${new Date(c.created_at).toLocaleDateString('uk-UA')}</td>
      <td>
        <button class="btn-sm btn-danger admin-del-case" data-id="${escHTML(c.id)}">🗑️</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.admin-del-case').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Видалити справу?')) return;
      const { error } = await window.supabase.from('unit_cases').delete().eq('id', btn.dataset.id);
      if (error) { alert(error.message); return; }
      await refreshAdminTable();
    });
  });
}

// ============================================================
// FILES TAB
// ============================================================

function populateUnitSelector() {
  const sel = document.getElementById('admin-upload-unit-sel');
  if (!sel || sel.dataset.populated) return;
  const rows = window.state?.data || [];
  sel.innerHTML = '<option value="">— оберіть підрозділ —</option>' +
    rows.map(r => `<option value="${escHTML(r.id)}">${escHTML(r.name)}</option>`).join('');
  sel.dataset.populated = '1';
}

async function refreshAdminFilesList(unitId) {
  const container = document.getElementById('admin-files-list');
  if (!container) return;
  if (!unitId) { container.innerHTML = ''; return; }

  container.innerHTML = '<div class="loading">Завантаження...</div>';

  const { data, error } = await window.supabase
    .from('unit_files')
    .select('id, section_num, section_name, filename, file_size, uploaded_at')
    .eq('unit_id', String(unitId))
    .order('section_num')
    .order('filename');

  if (error) {
    container.innerHTML = `<div class="error-msg">${escHTML(error.message)}</div>`;
    return;
  }

  if (!data.length) {
    container.innerHTML = '<div class="no-data">Файлів ще немає для цього підрозділу</div>';
    return;
  }

  // Group by section
  const bySec = {};
  data.forEach(f => {
    const k = f.section_num;
    if (!bySec[k]) bySec[k] = { name: f.section_name, files: [] };
    bySec[k].files.push(f);
  });

  let html = `<div class="admin-files-total">Файлів: ${data.length}</div>`;
  Object.entries(bySec).sort((a,b) => a[0]-b[0]).forEach(([num, sec]) => {
    html += `<div class="admin-sec-group">
      <div class="admin-sec-title">Розділ ${num}: ${escHTML(sec.name)} (${sec.files.length})</div>
      <table class="admin-table" style="margin-bottom:0">
        <thead><tr><th>Файл</th><th>Розмір</th><th>Дата</th><th></th></tr></thead>
        <tbody>` +
      sec.files.map(f => `<tr>
        <td>${escHTML(f.filename)}</td>
        <td>${f.file_size ? (f.file_size/1024).toFixed(0)+' KB' : '—'}</td>
        <td>${new Date(f.uploaded_at).toLocaleDateString('uk-UA')}</td>
        <td><button class="btn-sm btn-danger admin-del-file" data-id="${escHTML(f.id)}">🗑️</button></td>
      </tr>`).join('') +
      `</tbody></table></div>`;
  });

  container.innerHTML = html;

  container.querySelectorAll('.admin-del-file').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Видалити файл?')) return;
      const { data: row } = await window.supabase
        .from('unit_files').select('storage_path').eq('id', btn.dataset.id).single();
      if (row?.storage_path) {
        await window.supabase.storage.from('unit-files').remove([row.storage_path]);
      }
      await window.supabase.from('unit_files').delete().eq('id', btn.dataset.id);
      await refreshAdminFilesList(unitId);
    });
  });
}

// ============================================================
// UI Bindings
// ============================================================

function bindAdminUI() {
  document.getElementById('admin-close')?.addEventListener('click', () => {
    document.getElementById('admin-modal').close();
  });

  // Tab buttons
  document.getElementById('admin-tab-cases')?.addEventListener('click', () => {
    switchAdminTab('cases');
    refreshAdminTable();
  });
  document.getElementById('admin-tab-files')?.addEventListener('click', () => {
    switchAdminTab('files');
  });

  // Unit selector change
  document.getElementById('admin-upload-unit-sel')?.addEventListener('change', async e => {
    await refreshAdminFilesList(e.target.value);
  });

  // Folder input change — upload
  document.getElementById('admin-folder-input')?.addEventListener('change', async e => {
    const files  = e.target.files;
    const sel    = document.getElementById('admin-upload-unit-sel');
    const unitId = sel?.value;
    const unitName = sel?.options[sel.selectedIndex]?.text || '';

    if (!unitId) { alert('Спочатку оберіть підрозділ'); e.target.value = ''; return; }
    if (!files?.length) return;

    const prog     = document.getElementById('admin-upload-progress');
    const fill     = document.getElementById('admin-progress-fill');
    const progText = document.getElementById('admin-progress-text');

    prog.style.display = 'block';
    fill.style.width   = '0%';
    progText.textContent = 'Завантаження...';

    const errors = await adminUploadFolder(files, unitId, unitName, (done, total) => {
      const pct = Math.round((done / total) * 100);
      fill.style.width   = pct + '%';
      progText.textContent = `${done} / ${total} файлів (${pct}%)`;
    });

    fill.style.width     = '100%';
    fill.style.background = errors.length ? 'var(--bad)' : 'var(--ok)';
    progText.textContent  = errors.length
      ? `Готово з помилками (${errors.length}): ${errors.slice(0,3).join(', ')}`
      : 'Завантажено успішно!';

    e.target.value = '';
    await refreshAdminFilesList(unitId);
  });
}

bindAdminUI();
