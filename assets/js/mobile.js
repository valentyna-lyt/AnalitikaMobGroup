// mobile.js — Hamburger drawer + read-only viewer mode for phones
(function () {
  'use strict';

  var MOBILE_BP = 1366;
  function isMobile() {
    // Treat any touch device or narrow window as mobile/tablet
    var touch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    return touch || window.innerWidth <= MOBILE_BP;
  }

  // Force everyone into viewer mode on mobile
  window.IS_MOBILE_VIEWER = false;

  var sidebar, sidebarDefault, sidebarUnit;
  var drawer, overlay, hamburger;
  var currentView = 'map';

  function escHTML(s) {
    return (s == null ? '' : String(s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function openDrawer() {
    drawer.classList.add('open');
    overlay.classList.add('open');
    hamburger.classList.add('open');
  }
  function closeDrawer() {
    drawer.classList.remove('open');
    overlay.classList.remove('open');
    hamburger.classList.remove('open');
  }

  function setActiveMenu(view) {
    document.querySelectorAll('.m-menu-item').forEach(function(b){
      b.classList.toggle('active', b.dataset.view === view);
    });
  }

  function setView(view) {
    currentView = view;
    document.body.classList.remove('m-view-map','m-view-stats','m-view-schedule','m-view-unit');
    document.body.classList.add('m-view-' + view);
    setActiveMenu(view);
    closeDrawer();

    if (view === 'map') {
      if (sidebar) sidebar.classList.remove('sheet-open');
      try { window.leaflet_map && window.leaflet_map.invalidateSize(); } catch(e){}
      return;
    }

    // open sheet, show only the right section
    if (sidebar) sidebar.classList.add('sheet-open');
    if (sidebarUnit) sidebarUnit.classList.add('hidden');
    if (sidebarDefault) sidebarDefault.classList.remove('hidden');

    var schedView = document.getElementById('view-schedule');
    var kpiBox = document.getElementById('kpi-box');
    var sectionTitle = document.querySelector('.section-title');
    var sectionTitleMt = document.querySelector('.section-title-mt');

    function show(el, on) { if (el) el.style.display = on ? '' : 'none'; }

    if (view === 'stats') {
      show(sectionTitle, true);
      show(kpiBox, true);
      show(sectionTitleMt, false);
      show(schedView, false);
    } else if (view === 'schedule') {
      show(sectionTitle, false);
      show(kpiBox, false);
      show(sectionTitleMt, true);
      show(schedView, true);
    }
  }

  function renderUserBlock() {
    var u = window.currentUser || {};
    var el = document.getElementById('m-drawer-user');
    if (!el) return;
    if (!u || !u.email) { el.innerHTML = ''; return; }
    var initials = (u.full_name || u.email).trim().split(/\s+/).slice(0,2).map(function(s){return s[0]||'';}).join('').toUpperCase();
    el.innerHTML =
      '<div class="m-userbox">' +
        '<div class="m-avatar">' + escHTML(initials) + '</div>' +
        '<div class="m-userinfo">' +
          '<div class="m-uname">' + escHTML(u.full_name || u.email) + '</div>' +
          '<div class="m-urole">Перегляд</div>' +
        '</div>' +
      '</div>';
  }

  // Auto-open unit detail in fullscreen sheet on map tap
  function setupUnitAutoOpen() {
    if (!sidebarUnit) return;
    new MutationObserver(function(){
      if (!isMobile()) return;
      if (!sidebarUnit.classList.contains('hidden')) {
        document.body.classList.remove('m-view-map','m-view-stats','m-view-schedule');
        document.body.classList.add('m-view-unit');
        if (sidebar) sidebar.classList.add('sheet-open');
      }
    }).observe(sidebarUnit, { attributes: true, attributeFilter: ['class'] });
  }

  function init() {
    sidebar = document.getElementById('sidebar');
    sidebarDefault = document.getElementById('sidebar-default');
    sidebarUnit = document.getElementById('sidebar-unit');
    drawer = document.getElementById('m-drawer');
    overlay = document.getElementById('m-drawer-overlay');
    hamburger = document.getElementById('m-hamburger');

    if (!isMobile()) return;

    // Force viewer mode globally
    window.IS_MOBILE_VIEWER = true;

    if (hamburger) hamburger.addEventListener('click', function(){
      drawer.classList.contains('open') ? closeDrawer() : openDrawer();
    });
    if (overlay) overlay.addEventListener('click', closeDrawer);

    document.querySelectorAll('.m-menu-item[data-view]').forEach(function(b){
      b.addEventListener('click', function(){ setView(b.dataset.view); });
    });

    var logout = document.getElementById('m-drawer-logout');
    if (logout) logout.addEventListener('click', function(){
      if (typeof handleSignOut === 'function') handleSignOut();
      else { window.localAPI.setToken(null); location.reload(); }
    });

    setupUnitAutoOpen();
    setView('map');
    renderUserBlock();

    document.addEventListener('userSignedIn', renderUserBlock);

    // Add a "Назад до карти" close button to unit-detail when on mobile
    var backBtn = document.getElementById('sidebar-back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', function(){
        setTimeout(function(){ setView('map'); }, 50);
      });
    }
  }

  window.addEventListener('resize', function(){
    if (!isMobile() && sidebar) {
      sidebar.classList.remove('sheet-open');
      sidebar.style.transform = '';
      window.IS_MOBILE_VIEWER = false;
    }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
