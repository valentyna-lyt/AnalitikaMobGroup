// mobile.js — PWA bottom sheet & bottom nav for phone layout
(function () {
  'use strict';

  var MOBILE_BP = 640;
  function isMobile() { return window.innerWidth <= MOBILE_BP; }

  var sidebar, sheetHandleBar, sheetTitleEl, filterBar, sidebarUnit, sidebarDefault;

  // ── Open / Collapse sheet ───────────────────────────────────────────────────
  function openSheet() {
    if (sidebar) sidebar.classList.add('sheet-open');
    setActiveNav('units');
  }
  function collapseSheet() {
    if (sidebar) sidebar.classList.remove('sheet-open');
    setActiveNav('map');
  }
  function isSheetOpen() { return sidebar && sidebar.classList.contains('sheet-open'); }

  // ── Bottom nav active state ─────────────────────────────────────────────────
  function setActiveNav(name) {
    ['map', 'units', 'filter'].forEach(function (n) {
      var btn = document.getElementById('mbn-' + n);
      if (btn) btn.classList.toggle('active', n === name);
    });
  }

  // ── Filter panel ────────────────────────────────────────────────────────────
  function openFilterPanel() {
    if (filterBar) filterBar.classList.add('mobile-filter-open');
    setActiveNav('filter');
  }
  function closeFilterPanel() {
    if (filterBar) filterBar.classList.remove('mobile-filter-open');
  }
  function isFilterOpen() { return filterBar && filterBar.classList.contains('mobile-filter-open'); }

  // ── Sheet title ─────────────────────────────────────────────────────────────
  function updateSheetTitle() {
    if (!sheetTitleEl) return;
    var unitName = document.getElementById('sidebar-unit-name');
    if (sidebarUnit && !sidebarUnit.classList.contains('hidden') && unitName && unitName.textContent) {
      sheetTitleEl.textContent = unitName.textContent;
    } else {
      sheetTitleEl.textContent = 'Підрозділи';
    }
  }

  // ── Touch drag on handle ────────────────────────────────────────────────────
  function setupTouchDrag() {
    if (!sheetHandleBar || !sidebar) return;
    var startY = 0, lastY = 0, wasOpen = false;

    sheetHandleBar.addEventListener('touchstart', function (e) {
      startY = e.touches[0].clientY;
      lastY = startY;
      wasOpen = isSheetOpen();
      sidebar.style.transition = 'none';
    }, { passive: true });

    sheetHandleBar.addEventListener('touchmove', function (e) {
      lastY = e.touches[0].clientY;
      var dy = lastY - startY;
      var sheetH = sidebar.offsetHeight - 54;
      var translate = wasOpen ? Math.max(0, Math.min(dy, sheetH)) : Math.max(0, sheetH + dy);
      sidebar.style.transform = 'translateY(' + translate + 'px)';
    }, { passive: true });

    sheetHandleBar.addEventListener('touchend', function () {
      sidebar.style.transition = '';
      sidebar.style.transform = '';
      var dy = lastY - startY;
      if (wasOpen && dy > 60) {
        collapseSheet();
      } else if (!wasOpen && dy < -60) {
        openSheet();
      } else {
        // snap back
        if (wasOpen) { sidebar.classList.add('sheet-open'); }
        else { sidebar.classList.remove('sheet-open'); }
      }
    });
  }

  // ── Map tap → collapse sheet ────────────────────────────────────────────────
  function setupMapCollapse() {
    var mapEl = document.getElementById('map');
    if (!mapEl) return;
    mapEl.addEventListener('click', function () {
      if (isSheetOpen()) { collapseSheet(); closeFilterPanel(); }
    });
  }

  // ── Auto-expand when unit sidebar becomes visible ───────────────────────────
  function setupAutoExpand() {
    if (!sidebarUnit) return;
    new MutationObserver(function () {
      if (!isMobile()) return;
      updateSheetTitle();
      if (!sidebarUnit.classList.contains('hidden')) {
        openSheet();
        closeFilterPanel();
      }
    }).observe(sidebarUnit, { attributes: true, attributeFilter: ['class'] });
  }

  // ── Bottom nav buttons ──────────────────────────────────────────────────────
  function setupBottomNav() {
    var btnMap = document.getElementById('mbn-map');
    var btnUnits = document.getElementById('mbn-units');
    var btnFilter = document.getElementById('mbn-filter');

    if (btnMap) btnMap.addEventListener('click', function () {
      collapseSheet();
      closeFilterPanel();
    });
    if (btnUnits) btnUnits.addEventListener('click', function () {
      openSheet();
      closeFilterPanel();
    });
    if (btnFilter) btnFilter.addEventListener('click', function () {
      if (isFilterOpen()) { closeFilterPanel(); setActiveNav(isSheetOpen() ? 'units' : 'map'); }
      else { openFilterPanel(); }
    });
  }

  // ── Sheet handle tap ────────────────────────────────────────────────────────
  function setupHandleTap() {
    if (!sheetHandleBar) return;
    var touchMoved = false;
    sheetHandleBar.addEventListener('touchstart', function () { touchMoved = false; }, { passive: true });
    sheetHandleBar.addEventListener('touchmove', function () { touchMoved = true; }, { passive: true });
    sheetHandleBar.addEventListener('touchend', function () {
      if (!touchMoved) {
        isSheetOpen() ? collapseSheet() : openSheet();
        closeFilterPanel();
      }
    });
    // Also handle click (mouse on emulator)
    sheetHandleBar.addEventListener('click', function () {
      isSheetOpen() ? collapseSheet() : openSheet();
      closeFilterPanel();
    });
  }

  // ── Init ────────────────────────────────────────────────────────────────────
  function init() {
    sidebar = document.getElementById('sidebar');
    sheetHandleBar = document.getElementById('sheetHandleBar');
    sheetTitleEl = document.getElementById('sheetTitle');
    filterBar = document.querySelector('.filter-bar');
    sidebarUnit = document.getElementById('sidebar-unit');
    sidebarDefault = document.getElementById('sidebar-default');

    if (!isMobile()) return;

    setupBottomNav();
    setupHandleTap();
    setupTouchDrag();
    setupAutoExpand();
    setupMapCollapse();
    updateSheetTitle();
  }

  // Reinit on orientation/resize
  window.addEventListener('resize', function () {
    if (!isMobile() && sidebar) {
      sidebar.classList.remove('sheet-open');
      sidebar.style.transform = '';
      sidebar.style.transition = '';
      if (filterBar) filterBar.classList.remove('mobile-filter-open');
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
