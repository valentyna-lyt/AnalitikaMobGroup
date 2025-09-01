export const state = {
  loading: false,
  data: [],           // original + edits applied
  raw: [],            // original data received (before edits)
  edits: {},          // {id: {name, level, parent, lat, lon, color}}
  filters: { period: 'today', level: '', parent: '', query: '' },
  mapmode: 'points',
  theme: localStorage.getItem('theme') || 'dark',
  dataSource: { type: 'demo', url: '' },
  refreshMinutes: 0,
  refreshTimer: null,
};
