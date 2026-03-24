// ---- protect.js ----
// Document protection: watermark, no copy/print/save, no context menu

(function() {

  // ── 1. Block right-click ──────────────────────────────────────────────────
  document.addEventListener('contextmenu', function(e) {
    var t = e.target;
    if (t.tagName === 'IMG' || t.tagName === 'IFRAME' ||
        t.closest('.file-card') || t.closest('.app-modal') ||
        t.closest('#doc-viewer-overlay')) {
      e.preventDefault();
    }
  });

  // ── 2. Block Ctrl/Cmd shortcuts in viewer ─────────────────────────────────
  document.addEventListener('keydown', function(e) {
    var ctrl = e.ctrlKey || e.metaKey;
    if (!ctrl) return;
    var overlay = document.getElementById('doc-viewer-overlay');
    if (overlay && !overlay.classList.contains('hidden')) {
      var k = e.key.toLowerCase();
      if (k === 'c' || k === 's' || k === 'p') {
        e.preventDefault(); e.stopPropagation();
      }
    }
  }, true);

  // ── 3. Block drag on images ───────────────────────────────────────────────
  document.addEventListener('dragstart', function(e) {
    if (e.target.tagName === 'IMG' || e.target.closest('#doc-viewer-overlay')) {
      e.preventDefault();
    }
  });

  // ── 4. Watermark builder ──────────────────────────────────────────────────
  function buildWatermark(extraClass) {
    var email = (window.currentUser && window.currentUser.email) || 'unauthorized';
    var name  = (window.currentUser && window.currentUser.full_name) || '';
    var now   = new Date();
    var dateStr = now.toLocaleDateString('uk-UA') + ' ' +
                  now.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
    var line = (name ? name + ' · ' : '') + email + ' · ' + dateStr;

    var wm = document.createElement('div');
    wm.className = 'doc-watermark' + (extraClass ? ' ' + extraClass : '');
    wm.setAttribute('aria-hidden', 'true');
    wm.setAttribute('data-user', email);

    // Grid of 40 copies
    var html = '';
    for (var i = 0; i < 40; i++) {
      html += '<span>' + line + '</span>';
    }
    wm.innerHTML = html;
    return wm;
  }

  function attachWatermark(overlay) {
    // 1. Overlay-level watermark (light text — visible on dark background areas)
    var old = overlay.querySelector(':scope > .doc-watermark');
    if (old) old.remove();
    overlay.appendChild(buildWatermark());

    // 2. Content-level watermark (dark text — visible on white docx pages and PDF)
    var content = document.getElementById('dv-content');
    if (content) {
      var oldCw = content.querySelector('.doc-watermark-content');
      if (oldCw) oldCw.remove();
      content.appendChild(buildWatermark('doc-watermark-content'));
    }
  }

  // ── 5. Watch doc-viewer-overlay for visibility changes ───────────────────
  var overlay = document.getElementById('doc-viewer-overlay');
  if (overlay) {
    var obs = new MutationObserver(function() {
      if (!overlay.classList.contains('hidden')) {
        attachWatermark(overlay);
      }
    });
    obs.observe(overlay, { attributes: true, attributeFilter: ['class'] });
  }

  // Update when user signs in
  document.addEventListener('userSignedIn', function() {
    var ov = document.getElementById('doc-viewer-overlay');
    if (ov && !ov.classList.contains('hidden')) attachWatermark(ov);
  });

})();
