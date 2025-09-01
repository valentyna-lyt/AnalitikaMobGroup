import { state } from './state.js';

const KEY = 'gunp_map_settings_v1';

export function saveSettings() {
  const payload = {
    edits: state.edits,
    theme: state.theme,
    dataSource: state.dataSource,
    refreshMinutes: state.refreshMinutes,
  };
  localStorage.setItem(KEY, JSON.stringify(payload));
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const obj = JSON.parse(raw);
    state.edits = obj.edits || {};
    state.theme = obj.theme || state.theme;
    state.dataSource = obj.dataSource || state.dataSource;
    state.refreshMinutes = typeof obj.refreshMinutes === 'number' ? obj.refreshMinutes : state.refreshMinutes;
  } catch(e){ console.warn('loadSettings error', e); }
}

export function clearEdits() {
  state.edits = {};
  saveSettings();
}
