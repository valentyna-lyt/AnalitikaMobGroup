// ---- auth.js ----
// Authentication via local API (JWT)

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
  ['login', 'change-password'].forEach(function(m) {
    var el = document.getElementById('auth-' + m);
    if (el) el.style.display = m === mode ? 'flex' : 'none';
  });
}

function handleSignIn(user) {
  window.currentUser = user;
  window.userProfile = { role: user.role, full_name: user.full_name };

  var emailEl = document.getElementById('user-email');
  if (emailEl) emailEl.textContent = user.email;

  var adminBtn = document.getElementById('btn-admin');
  if (adminBtn) adminBtn.style.display = isAdmin() ? '' : 'none';

  var loginBtn = document.getElementById('btn-login');
  if (loginBtn) loginBtn.style.display = 'none';
  var logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) logoutBtn.style.display = '';

  hideAuthOverlay();

  document.dispatchEvent(new CustomEvent('userSignedIn'));

  // Re-render open unit modal with correct admin state
  var modal = document.getElementById('unit-cases-modal');
  if (modal && modal.open && typeof window.loadAndRenderFilesTab === 'function') {
    window.loadAndRenderFilesTab(modal.dataset.unitId, modal.dataset.unitName);
  }
}

function handleSignOut() {
  window.currentUser = null;
  window.userProfile = null;
  window.localAPI.setToken(null);

  var emailEl = document.getElementById('user-email');
  if (emailEl) emailEl.textContent = '';

  var adminBtn = document.getElementById('btn-admin');
  if (adminBtn) adminBtn.style.display = 'none';
  var loginBtn = document.getElementById('btn-login');
  if (loginBtn) loginBtn.style.display = '';
  var logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) logoutBtn.style.display = 'none';

  showAuthOverlay();
  showAuthMode('login');
}

async function initAuth() {
  // Initially hide logout, show login until session is confirmed
  var logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) logoutBtn.style.display = 'none';
  var loginBtn = document.getElementById('btn-login');
  if (loginBtn) loginBtn.style.display = '';

  var token = window.localAPI.getToken();
  if (token) {
    try {
      var data = await window.localAPI.fetch('/auth/me');
      handleSignIn(data.user);
    } catch (e) {
      // Token invalid or expired
      window.localAPI.setToken(null);
      showAuthOverlay();
      showAuthMode('login');
    }
  } else {
    showAuthOverlay();
    showAuthMode('login');
  }
}

function bindAuthUI() {
  // --- Login ---
  var loginForm = document.getElementById('auth-login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      var email = document.getElementById('login-email').value;
      var pwd = document.getElementById('login-password').value;
      var errEl = document.getElementById('login-error');
      var btn = e.target.querySelector('[type=submit]');
      btn.disabled = true; btn.textContent = 'Вхід...'; errEl.textContent = '';

      try {
        var data = await window.localAPI.fetch('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: email, password: pwd })
        });
        window.localAPI.setToken(data.token);
        handleSignIn(data.user);
      } catch (err) {
        errEl.textContent = err.message || 'Помилка входу';
        btn.disabled = false; btn.textContent = 'Увійти';
      }
    });
  }

  // --- Change password (replaces forgot/reset) ---
  var changePwdForm = document.getElementById('auth-change-password-form');
  if (changePwdForm) {
    changePwdForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      var newPwd = document.getElementById('new-password').value;
      var confirmPwd = document.getElementById('confirm-password').value;
      var errEl = document.getElementById('reset-error');
      var btn = e.target.querySelector('[type=submit]');
      if (newPwd !== confirmPwd) { errEl.textContent = 'Паролі не збігаються'; return; }
      if (newPwd.length < 6) { errEl.textContent = 'Мінімум 6 символів'; return; }
      btn.disabled = true; btn.textContent = 'Збереження...'; errEl.textContent = '';
      try {
        await window.localAPI.fetch('/auth/change-password', {
          method: 'POST',
          body: JSON.stringify({ new_password: newPwd })
        });
        hideAuthOverlay();
      } catch (err) {
        errEl.textContent = err.message;
        btn.disabled = false; btn.textContent = 'Зберегти пароль';
      }
    });
  }

  // --- Login button (header) ---
  var loginHeaderBtn = document.getElementById('btn-login');
  if (loginHeaderBtn) {
    loginHeaderBtn.addEventListener('click', function() {
      showAuthOverlay();
      showAuthMode('login');
    });
  }

  // --- Logout ---
  var logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
      handleSignOut();
    });
  }

  // --- Admin panel ---
  var adminBtn = document.getElementById('btn-admin');
  if (adminBtn) {
    adminBtn.addEventListener('click', function() {
      if (typeof openAdminPanel === 'function') openAdminPanel();
    });
  }
}

bindAuthUI();
initAuth();
