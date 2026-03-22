// ---- auth.js ----
// Authentication via Supabase Auth

window.currentUser = null;
window.userProfile = null;

function isAdmin() {
  return window.userProfile?.role === 'admin';
}

function showAuthOverlay() {
  document.getElementById('auth-overlay').style.display = 'flex';
}

function hideAuthOverlay() {
  document.getElementById('auth-overlay').style.display = 'none';
}

function showAuthMode(mode) {
  ['login', 'forgot', 'reset-password'].forEach(m => {
    const el = document.getElementById('auth-' + m);
    if (el) el.style.display = m === mode ? 'flex' : 'none';
  });
}

async function handleSignIn(user) {
  window.currentUser = user;
  try {
    const profilePromise = window.supabase
      .from('profiles').select('role, full_name').eq('id', user.id).single();
    const timeout = new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 6000));
    const { data } = await Promise.race([profilePromise, timeout]);
    window.userProfile = data || { role: 'viewer' };
  } catch {
    window.userProfile = { role: 'viewer' };
  }

  const emailEl = document.getElementById('user-email');
  if (emailEl) emailEl.textContent = user.email;

  const adminBtn = document.getElementById('btn-admin');
  if (adminBtn) adminBtn.style.display = isAdmin() ? '' : 'none';

  document.getElementById('btn-login')?.style && (document.getElementById('btn-login').style.display = 'none');
  document.getElementById('btn-logout') && (document.getElementById('btn-logout').style.display = '');
  hideAuthOverlay();

  // Notify protect.js that user is signed in (for watermark update)
  document.dispatchEvent(new CustomEvent('userSignedIn'));

  // Re-render open unit modal with correct admin state
  const modal = document.getElementById('unit-cases-modal');
  if (modal && modal.open && typeof window.loadAndRenderFilesTab === 'function') {
    window.loadAndRenderFilesTab(modal.dataset.unitId, modal.dataset.unitName);
  }
}

function handleSignOut() {
  window.currentUser = null;
  window.userProfile = null;
  const emailEl = document.getElementById('user-email');
  if (emailEl) emailEl.textContent = '';
  document.getElementById('btn-admin')?.style && (document.getElementById('btn-admin').style.display = 'none');
  document.getElementById('btn-login')?.style && (document.getElementById('btn-login').style.display = '');
  document.getElementById('btn-logout')?.style && (document.getElementById('btn-logout').style.display = 'none');
  showAuthOverlay();
  showAuthMode('login');
}

async function initAuth() {
  // Initially hide logout, show login until session is confirmed
  document.getElementById('btn-logout')?.style && (document.getElementById('btn-logout').style.display = 'none');
  document.getElementById('btn-login')?.style && (document.getElementById('btn-login').style.display = '');

  window.supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      await handleSignIn(session.user);
    } else if (event === 'SIGNED_OUT') {
      handleSignOut();
    } else if (event === 'PASSWORD_RECOVERY') {
      showAuthMode('reset-password');
      showAuthOverlay();
    }
  });

  const { data: { session } } = await window.supabase.auth.getSession();
  if (session) {
    await handleSignIn(session.user);
  } else {
    showAuthOverlay();
    showAuthMode('login');
  }
}

function bindAuthUI() {
  // --- Login ---
  document.getElementById('auth-login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pwd = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');
    const btn = e.target.querySelector('[type=submit]');
    btn.disabled = true; btn.textContent = 'Вхід...'; errEl.textContent = '';

    const { error } = await window.supabase.auth.signInWithPassword({ email, password: pwd });
    if (error) {
      errEl.textContent = error.message === 'Invalid login credentials'
        ? 'Невірний email або пароль' : error.message;
      btn.disabled = false; btn.textContent = 'Увійти';
    }
  });

  document.getElementById('link-forgot')?.addEventListener('click', e => {
    e.preventDefault(); showAuthMode('forgot');
  });
  document.getElementById('link-back-login')?.addEventListener('click', e => {
    e.preventDefault(); showAuthMode('login');
  });

  // --- Forgot password ---
  document.getElementById('auth-forgot-form').addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value;
    const errEl = document.getElementById('forgot-error');
    const msgEl = document.getElementById('forgot-msg');
    const btn = e.target.querySelector('[type=submit]');
    btn.disabled = true; errEl.textContent = ''; msgEl.textContent = '';

    const { error } = await window.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname
    });
    if (error) {
      errEl.textContent = error.message;
    } else {
      msgEl.textContent = 'Лист для відновлення пароля надіслано. Перевірте вхідні.';
    }
    btn.disabled = false;
  });

  // --- Reset password ---
  document.getElementById('auth-reset-password-form').addEventListener('submit', async e => {
    e.preventDefault();
    const newPwd = document.getElementById('new-password').value;
    const confirmPwd = document.getElementById('confirm-password').value;
    const errEl = document.getElementById('reset-error');
    const btn = e.target.querySelector('[type=submit]');

    if (newPwd !== confirmPwd) { errEl.textContent = 'Паролі не збігаються'; return; }
    if (newPwd.length < 6) { errEl.textContent = 'Мінімум 6 символів'; return; }

    btn.disabled = true; btn.textContent = 'Збереження...'; errEl.textContent = '';

    const { error } = await window.supabase.auth.updateUser({ password: newPwd });
    if (error) {
      errEl.textContent = error.message;
      btn.disabled = false; btn.textContent = 'Зберегти пароль';
    } else {
      window.history.replaceState(null, '', window.location.pathname);
      hideAuthOverlay();
    }
  });

  // --- Login button (header) ---
  document.getElementById('btn-login')?.addEventListener('click', () => {
    showAuthOverlay();
    showAuthMode('login');
  });

  // --- Logout ---
  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await window.supabase.auth.signOut();
  });

  // --- Admin panel ---
  document.getElementById('btn-admin')?.addEventListener('click', () => {
    if (typeof openAdminPanel === 'function') openAdminPanel();
  });
}

bindAuthUI();
initAuth();
