// ---- admin.js ----
// Admin panel

async function openAdminPanel() {
  if (!isAdmin()) { alert('Доступ заборонено'); return; }
  document.getElementById('admin-modal').showModal();
  await refreshAdminTable();
}
window.openAdminPanel = openAdminPanel;

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

function bindAdminUI() {
  document.getElementById('admin-close')?.addEventListener('click', () => {
    document.getElementById('admin-modal').close();
  });
}

bindAdminUI();
