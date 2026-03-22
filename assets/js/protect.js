// ---- protect.js ----
// Document viewing protection: watermark, no copy, no print, no context menu

(function() {

  // ── 1. Block right-click context menu ──────────────────────────────────
  document.addEventListener('contextmenu', function(e) {
    var t = e.target;
    // Block on images, iframes, file cards, viewers
    if (t.tagName === 'IMG' || t.tagName === 'IFRAME' ||
        t.closest('.file-card') || t.closest('.app-modal') ||
        t.closest('#img-viewer-modal') || t.closest('#pdf-viewer-modal')) {
      e.preventDefault();
    }
  });

  // ── 2. Block keyboard shortcuts ─────────────────────────────────────────
  document.addEventListener('keydown', function(e) {
    var ctrl = e.ctrlKey || e.metaKey;
    if (!ctrl) return;
    var key = e.key.toLowerCase();
    // Block: Copy (C), Save (S), Print (P), SaveAs (Shift+S)
    if (key === 'c' || key === 's' || key === 'p') {
      // Only block if a viewer modal is open
      var imgModal = document.getElementById('img-viewer-modal');
      var pdfModal = document.getElementById('pdf-viewer-modal');
      if ((imgModal && imgModal.open) || (pdfModal && pdfModal.open)) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
  }, true);

  // ── 3. Disable drag-and-drop on images ──────────────────────────────────
  document.addEventListener('dragstart', function(e) {
    if (e.target.tagName === 'IMG' || e.target.closest('.file-card') || e.target.closest('.app-modal')) {
      e.preventDefault();
    }
  });

  // ── 4. Watermark generator ───────────────────────────────────────────────
  function buildWatermark() {
    var email = window.currentUser?.email || 'перегляд';
    var now = new Date();
    var dateStr = now.toLocaleDateString('uk-UA') + ' ' + now.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
    var text = email + ' · ' + dateStr;

    var wm = document.createElement('div');
    wm.className = 'doc-watermark';
    wm.setAttribute('aria-hidden', 'true');

    // Repeat watermark text in a grid pattern
    var repeat = '';
    for (var i = 0; i < 20; i++) {
      repeat += '<span>' + text + '</span>';
    }
    wm.innerHTML = repeat;
    return wm;
  }

  function attachWatermark(modal) {
    var existing = modal.querySelector('.doc-watermark');
    if (existing) existing.remove();
    var wm = buildWatermark();
    modal.appendChild(wm);
  }

  // ── 5. Attach watermark when viewers open ────────────────────────────────
  var imgModal = document.getElementById('img-viewer-modal');
  var pdfModal = document.getElementById('pdf-viewer-modal');

  if (imgModal) {
    var imgObserver = new MutationObserver(function() {
      if (imgModal.open) attachWatermark(imgModal);
    });
    imgObserver.observe(imgModal, { attributes: true, attributeFilter: ['open'] });
  }

  if (pdfModal) {
    var pdfObserver = new MutationObserver(function() {
      if (pdfModal.open) attachWatermark(pdfModal);
    });
    pdfObserver.observe(pdfModal, { attributes: true, attributeFilter: ['open'] });
  }

  // Also update watermark when user signs in (email becomes available)
  document.addEventListener('userSignedIn', function() {
    [imgModal, pdfModal].forEach(function(m) {
      if (m && m.open) attachWatermark(m);
    });
  });

})();
