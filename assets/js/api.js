// ---- api.js ----
// Local API client (replaces Supabase)

(function() {
  var API_BASE = '/api';

  function getToken() {
    return localStorage.getItem('analitika_token');
  }
  function setToken(token) {
    if (token) localStorage.setItem('analitika_token', token);
    else localStorage.removeItem('analitika_token');
  }

  function authHeaders(extra) {
    var h = Object.assign({ 'Content-Type': 'application/json' }, extra || {});
    var tok = getToken();
    if (tok) h['Authorization'] = 'Bearer ' + tok;
    return h;
  }

  async function apiFetch(path, options) {
    var opts = Object.assign({}, options || {});
    opts.headers = authHeaders(opts.headers || {});
    // Don't set Content-Type for FormData (browser sets it with boundary)
    if (opts.body instanceof FormData) delete opts.headers['Content-Type'];
    var res = await fetch(API_BASE + path, opts);
    if (!res.ok) {
      var err = await res.json().catch(function() { return { error: res.statusText }; });
      throw new Error(err.error || res.statusText);
    }
    return res.json();
  }

  async function apiGetBlob(path) {
    var headers = {};
    var tok = getToken();
    if (tok) headers['Authorization'] = 'Bearer ' + tok;
    var res = await fetch(API_BASE + path, { headers: headers });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.blob();
  }

  window.localAPI = {
    getToken: getToken,
    setToken: setToken,
    fetch: apiFetch,
    getBlob: apiGetBlob
  };
})();

// ---- Toast notifications ----
window.showToast = function(msg, type, duration) {
  var host = document.getElementById('toastHost');
  if (!host) return;
  var el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(function() {
    el.style.transition = 'opacity 0.3s';
    el.style.opacity = '0';
    setTimeout(function() { el.remove(); }, 350);
  }, duration || 3000);
};

// ---- Shared helpers ----
window.escHTML = window.escHTML || function(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};
window.formatDate = window.formatDate || function(d) {
  if (!d) return '—';
  var dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString('uk-UA');
};
window.isAdmin = window.isAdmin || function() {
  return window.currentUser && window.currentUser.role === 'admin';
};
