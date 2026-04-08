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
  if (emailEl) {
    emailEl.textContent = user.full_name || user.email;
    emailEl.style.cursor = 'pointer';
    emailEl.title = '';
    emailEl.onclick = function(e) { e.stopPropagation(); window.showUserInfoPopup(user, emailEl); };
  }

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

window.showUserInfoPopup = function(user, anchor) {
  var existing = document.getElementById('user-info-popup');
  if (existing) { existing.remove(); return; }

  var roleLabels = { admin: 'Адміністратор', curator: 'Куратор', viewer: 'Переглядач' };
  var roleBadge = roleLabels[user.role] || user.role;

  var permsHtml = '';
  if (user.role === 'admin') {
    permsHtml =
      '<div class="uip-stat"><span class="uip-icon">🛡️</span><div><div class="uip-label">Доступ</div><div class="uip-value">Повний</div></div></div>' +
      '<div class="uip-stat"><span class="uip-icon">✅</span><div><div class="uip-label">Може редагувати</div><div class="uip-value">Усі підрозділи · графік МГ · перевірки · користувачі</div></div></div>';
  } else if (user.role === 'curator') {
    permsHtml =
      '<div class="uip-stat"><span class="uip-icon">📂</span><div><div class="uip-label">Куст</div><div class="uip-value">' + escHTML(user.assigned_hrup || '— не призначено —') + '</div></div></div>' +
      '<div class="uip-stat"><span class="uip-icon">✏️</span><div><div class="uip-label">Може редагувати</div><div class="uip-value">Кураторську справу підрозділів свого куста</div></div></div>' +
      '<div class="uip-stat"><span class="uip-icon">👁</span><div><div class="uip-label">Решта підрозділів</div><div class="uip-value">Лише перегляд</div></div></div>';
  } else {
    permsHtml =
      '<div class="uip-stat"><span class="uip-icon">👁</span><div><div class="uip-label">Доступ</div><div class="uip-value">Лише перегляд даних</div></div></div>';
  }

  var pop = document.createElement('div');
  pop.id = 'user-info-popup';
  pop.className = 'unit-popup user-info-popup';
  pop.innerHTML =
    '<div class="popup-header">' +
      '<div class="popup-name">' + escHTML(user.full_name || user.email) + '</div>' +
      '<div class="popup-badges"><span class="popup-badge">' + escHTML(roleBadge) + '</span></div>' +
    '</div>' +
    '<div class="popup-body">' +
      '<div class="uip-email">📧 ' + escHTML(user.email) + '</div>' +
      '<div class="uip-stats">' + permsHtml + '</div>' +
    '</div>';

  document.body.appendChild(pop);
  var r = anchor.getBoundingClientRect();
  pop.style.position = 'fixed';
  pop.style.zIndex = '9999';
  var top = r.bottom + 8;
  var left = Math.max(8, Math.min(window.innerWidth - 308, r.left));
  pop.style.top = top + 'px';
  pop.style.left = left + 'px';

  setTimeout(function(){
    function close(ev){
      if (pop.contains(ev.target)) return;
      pop.remove();
      document.removeEventListener('click', close);
    }
    document.addEventListener('click', close);
  }, 0);
};

function escHTML(s) {
  return (s == null ? '' : String(s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

bindAuthUI();
initAuth();
