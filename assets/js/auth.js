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
    const { data } = await window.supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single();
    window.userProfile = data || { role: 'viewer' };
  } catch {
    window.userProfile = { role: 'viewer' };
  }

  const emailEl = document.getElementById('user-email');
  if (emailEl) emailEl.textContent = user.email;

  const adminBtn = document.getElementById('btn-admin');
  if (adminBtn) adminBtn.style.display = isAdmin() ? '' : 'none';

  hideAuthOverlay();
}

function handleSignOut() {
  window.currentUser = null;
  window.userProfile = null;
  showAuthOverlay();
  showAuthMode('login');
}

async function initAuth() {
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
