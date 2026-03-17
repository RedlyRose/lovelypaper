CREATE TABLE IF NOT EXISTS files (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  r2_key       TEXT NOT NULL UNIQUE,
  display_name TEXT,
  folder       TEXT NOT NULL DEFAULT '/',
  type         TEXT,
  size_bytes   INTEGER,
  mime_type    TEXT,
  tags         TEXT,
  uploaded_at  TEXT NOT NULL DEFAULT (datetime('now')),
  notes        TEXT
);

CREATE TABLE IF NOT EXISTS folders (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  path         TEXT NOT NULL UNIQUE,
  display_name TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
