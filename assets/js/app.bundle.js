/* -------------------------------------------------------
 *  Clean app.bundle.js for AnalitikaMobGroup
 *  - Leaflet map init
 *  - Load from API -> fallback CSV
 *  - Edits accumulation -> Apply => UPSERT /api/units/bulk
 * ----------------------------------------------------- */

(function () {
  "use strict";

  // ====== CONFIG ======
  const MAP_CONTAINER_ID = "map";                            // id елемента карти
  const DEMO_CSV_URL     = "data/units.kharkiv.csv";         // шлях до демо CSV
  const ICON_COLOR       = "#2dd4bf";                        // базовий колір маркерів
  const API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || "";
  const ADMIN_TOKEN = (window.APP_CONFIG && window.APP_CONFIG.ADMIN_TOKEN) || "";

  // ====== GLOBAL STATE ======
  const state = {
    map: null,
    tiles: null,
    layerGroup: null,
    raw: [],            // масив підрозділів
    edits: {},          // { id: {patch} }
    dataSource: { type: "api", url: "" },
  };

  // ====== UTILS ======
  function qs(sel, root = document) { return root.querySelector(sel); }
  function qsa(sel, root = document) { return [...root.querySelectorAll(sel)]; }

  function toNumber(v) {
    const n = Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }

  function csvToRows(text) {
    // Дуже простий парсер CSV (без лапок у середині)
    const lines = text.split(/\r?\n/).filter(Boolean);
    const head = lines.shift().split(",").map(s=>s.trim());
    return lines.map(line => {
      const cols = line.split(",").map(s=>s.trim());
      const row = {};
      head.forEach((h, i) => row[h] = cols[i] ?? "");
      return row;
    });
  }

  function normalizeRow(r, idx) {
    // Намагаємось привести до формату:
    // id, name, level, parent, lat, lon, today, m30, ytd, inspectors, last_check, color
    const id  = Number(r.id ?? idx + 1);
    const obj = {
      id,
      name: r.name ?? r["Назва"] ?? "",
      level: r.level ?? r["Рівень"] ?? "",
      parent: r.parent ?? r["Батьківський підрозділ"] ?? "",
      lat: toNumber(r.lat ?? r["lat"] ?? r["широта"]),
      lon: toNumber(r.lon ?? r["lon"] ?? r["довгота"]),
      today: Number(r.today ?? 0),
      m30: Number(r.m30 ?? 0),
      ytd: Number(r.ytd ?? 0),
      inspectors: r.inspectors ?? "",
      last_check: r.last_check ?? r["last_check"] ?? null,
      color: r.color || null,
    };
    return obj;
  }

  // ====== DATA LOADERS ======

  async function loadFromAPI() {
    const res = await fetch(API_BASE + "/api/units", { cache: "no-cache" });
    if (!res.ok) throw new Error("API /api/units failed: " + res.status);
    const rows = await res.json();
    state.dataSource = { type: "api", url: "" };
    state.raw = Array.isArray(rows) ? rows.map((r, i) => normalizeRow(r, i)) : [];
  }

  async function loadFromCSV() {
    const res = await fetch(DEMO_CSV_URL, { cache: "no-cache" });
    if (!res.ok) throw new Error("CSV load failed: " + res.status);
    const text = await res.text();
    const rows = csvToRows(text);
    state.dataSource = { type: "demo", url: DEMO_CSV_URL };
    state.raw = rows.map((r, i) => normalizeRow(r, i));
  }

  // ====== SYNC TO API ======
  async function syncEditsToAPI() {
    try {
      const edits = state.edits || {};
      const payload = Object.entries(edits).map(([id, patch]) => ({
        id: Number(id),
        ...patch,
      }));
      if (!payload.length) return; // нема чого відправляти

      const headers = { "Content-Type": "application/json" };
      if (ADMIN_TOKEN) headers["Authorization"] = "Bearer " + ADMIN_TOKEN;

      const res = await fetch(API_BASE + "/api/units/bulk", {
        method: "POST",
        headers,
        body: JSON.stringify({ edits: payload }),
      });
      if (!res.ok) throw new Error("bulk upsert failed: " + res.status);
      state.edits = {};
    } catch (e) {
      console.warn("syncEditsToAPI error:", e);
    }
  }

  // ====== MAP RENDER ======
  function initMap() {
    // Якщо у розмітці немає #map — створимо його.
    let el = qs("#" + MAP_CONTAINER_ID);
    if (!el) {
      const host = qs(".layout-map") || document.body;
      el = document.createElement("div");
      el.id = MAP_CONTAINER_ID;
      el.style.width = "100%";
      el.style.height = "100%";
      host.appendChild(el);
    }

    state.map = L.map(MAP_CONTAINER_ID, {
      center: [49.9935, 36.2304], // Харків
      zoom: 9,
      zoomControl: true,
    });
    state.tiles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    }).addTo(state.map);

    state.layerGroup = L.layerGroup().addTo(state.map);
  }

  function clearMarkers() {
    if (state.layerGroup) state.layerGroup.clearLayers();
  }

  function renderMarkers() {
    if (!state.map || !state.layerGroup) return;
    clearMarkers();

    for (const r of state.raw) {
      if (r.lat == null || r.lon == null) continue;
      const color = r.color || ICON_COLOR;
      const marker = L.circleMarker([r.lat, r.lon], {
        radius: 7,
        color,
        weight: 2,
        fillOpacity: 0.7,
      });
      marker.bindPopup(
        `<b>${escapeHTML(r.name || "—")}</b><br>` +
        `Рівень: ${escapeHTML(r.level || "—")}<br>` +
        (r.parent ? `Підпорядк.: ${escapeHTML(r.parent)}<br>` : "") +
        `YTD: ${r.ytd ?? 0}`
      );
      marker.addTo(state.layerGroup);
    }

    // Автофіт
    try {
      const latlngs = state.raw
        .filter(r => r.lat != null && r.lon != null)
        .map(r => [r.lat, r.lon]);
      if (latlngs.length) {
        const bounds = L.latLngBounds(latlngs);
        state.map.fitBounds(bounds.pad(0.2));
      }
    } catch (_) {}
  }

  function escapeHTML(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // ====== UI / SETTINGS (спрощено) ======
  function bindUI() {
    const btnApply = qs("#btn-apply") || qs('[data-action="apply"]');
    if (btnApply) {
      btnApply.addEventListener("click", async () => {
        // тут ти можеш заповнювати state.edits десь зі свого UI.
        // Щоб показати ідею — тестове внесення:
        // (Якщо є реальний UI — залиш його, а це прибери)
        if (!Object.keys(state.edits).length && state.raw.length) {
          const sampleId = state.raw[0].id;
          state.edits[sampleId] = { today: (state.raw[0].today || 0) + 1 };
        }

        await syncEditsToAPI();  // збереження у D1
        await reloadFromSource(); // перечитати джерело (API або демо)
        renderMarkers();          // перемалювати карту
      });
    }

    // Приклад: кнопка “Перезавантажити з Бази”
    const btnReload = qs("#btn-reload-api");
    if (btnReload) {
      btnReload.addEventListener("click", async () => {
        try {
          await loadFromAPI();
          renderMarkers();
        } catch (e) {
          alert("Не вдалося завантажити з БД. Див. консоль.");
          console.warn(e);
        }
      });
    }
  }

  async function reloadFromSource() {
    if (state.dataSource.type === "api") {
      try {
        await loadFromAPI();
      } catch (e) {
        console.warn("API reload failed, fallback to CSV", e);
        await loadFromCSV();
      }
    } else {
      await loadFromCSV();
    }
  }

  // ====== BOOT ======
  async function boot() {
    try {
      initMap();

      // 1) пробуємо API…
      let loaded = false;
      try {
        await loadFromAPI();
        loaded = true;
      } catch (e) {
        console.warn("API not available, fallback to CSV", e);
      }

      // 2) якщо API не працює — демо CSV
      if (!loaded) {
        await loadFromCSV();
      }

      renderMarkers();
      bindUI();
    } catch (e) {
      console.error("BOOT failed:", e);
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
