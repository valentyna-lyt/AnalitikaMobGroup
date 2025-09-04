-- D1 schema
CREATE TABLE IF NOT EXISTS units (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  level TEXT,
  parent TEXT,
  lat REAL,
  lon REAL,
  color TEXT,
  today INTEGER DEFAULT 0,
  m30 INTEGER DEFAULT 0,
  ytd INTEGER DEFAULT 0,
  inspectors TEXT,
  last_check TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
