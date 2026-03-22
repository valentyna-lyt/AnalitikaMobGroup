// ---- cases.js ----
// Unit curator cases (Supabase)

function escHTML(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function loadCasesForUnit(unitId) {
  const promise = window.supabase
    .from('unit_cases')
    .select('*')
    .eq('unit_id', unitId)
    .order('case_date', { ascending: false });
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Timeout: не вдалося завантажити (8с)')), 8000)
  );
  const { data, error } = await Promise.race([promise, timeout]);
  if (error) throw error;
  return data || [];
}

function renderCasesList(cases, unitId, unitName) {
  const listEl = document.getElementById('unit-cases-list');
  const addBtn = document.getElementById('unit-cases-add-btn');
  if (addBtn) addBtn.style.display = isAdmin() ? '' : 'none';

  if (!cases.length) {
    listEl.innerHTML = '<div class="no-data">Кураторські справи відсутні</div>';
    return;
  }

  listEl.innerHTML = cases.map(c => `
    <div class="case-item">
      <div class="case-header">
        <span class="case-title">${escHTML(c.title)}</span>
        <span class="case-date">${c.case_date ? formatDate(c.case_date) : '—'}</span>
      </div>
      ${c.description ? `<div class="case-desc">${escHTML(c.description)}</div>` : ''}
      ${isAdmin() ? `<div class="case-actions">
        <button class="btn-sm btn-edit-case" data-id="${escHTML(c.id)}">✏️ Ред.</button>
        <button class="btn-sm btn-danger btn-delete-case" data-id="${escHTML(c.id)}">🗑️</button>
      </div>` : ''}
    </div>
  `).join('');

  if (isAdmin()) {
    listEl.querySelectorAll('.btn-edit-case').forEach(btn => {
      btn.addEventListener('click', () => {
        const c = cases.find(x => x.id === btn.dataset.id);
        showCaseEditForm(c, unitId, unitName);
      });
    });
    listEl.querySelectorAll('.btn-delete-case').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Видалити справу?')) return;
        const { error } = await window.supabase.from('unit_cases').delete().eq('id', btn.dataset.id);
        if (error) { alert('Помилка: ' + error.message); return; }
        const updated = await loadCasesForUnit(unitId);
        renderCasesList(updated, unitId, unitName);
      });
    });
  }
}

async function showUnitCasesModal(unitId, unitName) {
  if (!window.currentUser) { alert('Необхідно авторизуватись'); return; }
  const modal = document.getElementById('unit-cases-modal');
  document.getElementById('unit-cases-title').textContent = unitName;
  modal.dataset.unitId = unitId;
  modal.dataset.unitName = unitName;
  modal.showModal();

  // Load sections/files directly (no tabs)
  if (typeof window.loadAndRenderFilesTab === 'function') {
    window.loadAndRenderFilesTab(unitId, unitName);
  }
}
window.showUnitCasesModal = showUnitCasesModal;

function showCaseEditForm(existing, unitId, unitName) {
  const modal = document.getElementById('case-edit-modal');
  document.getElementById('case-edit-modal-title').textContent = existing ? 'Редагувати справу' : 'Нова справа';
  document.getElementById('case-edit-id').value = existing?.id || '';
  document.getElementById('case-edit-unit-id').value = unitId;
  document.getElementById('case-edit-unit-name').value = unitName;
  document.getElementById('case-edit-title-input').value = existing?.title || '';
  document.getElementById('case-edit-description').value = existing?.description || '';
  document.getElementById('case-edit-date').value = existing?.case_date || '';
  document.getElementById('case-edit-error').textContent = '';
  modal.showModal();
}

function bindCasesUI() {
  // Delegate click for popup info buttons
  document.addEventListener('click', e => {
    const btn = e.target.closest('.btn-unit-info');
    if (!btn) return;
    showUnitCasesModal(btn.dataset.unitId, btn.dataset.unitName);
  });

  document.getElementById('unit-cases-close')?.addEventListener('click', () => {
    document.getElementById('unit-cases-modal').close();
  });

  document.getElementById('case-edit-cancel')?.addEventListener('click', () => {
    document.getElementById('case-edit-modal').close();
  });
  document.getElementById('case-edit-close-x')?.addEventListener('click', () => {
    document.getElementById('case-edit-modal').close();
  });

  document.getElementById('case-edit-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const id = document.getElementById('case-edit-id').value;
    const unitId = document.getElementById('case-edit-unit-id').value;
    const unitName = document.getElementById('case-edit-unit-name').value;
    const errEl = document.getElementById('case-edit-error');
    const btn = e.target.querySelector('[type=submit]');

    const payload = {
      unit_id: unitId,
      unit_name: unitName,
      title: document.getElementById('case-edit-title-input').value.trim(),
      description: document.getElementById('case-edit-description').value.trim() || null,
      case_date: document.getElementById('case-edit-date').value || null,
      created_by: window.currentUser?.id
    };

    if (!payload.title) { errEl.textContent = "Назва є обов'язковою"; return; }
    btn.disabled = true; errEl.textContent = '';

    const { error } = id
      ? await window.supabase.from('unit_cases').update(payload).eq('id', id)
      : await window.supabase.from('unit_cases').insert(payload);

    if (error) {
      errEl.textContent = error.message;
      btn.disabled = false;
    } else {
      document.getElementById('case-edit-modal').close();
      const cases = await loadCasesForUnit(unitId);
      renderCasesList(cases, unitId, unitName);
    }
  });
}

bindCasesUI();
