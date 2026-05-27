CREATE TABLE IF NOT EXISTS documents (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT DEFAULT '',
  section_label TEXT DEFAULT 'Section',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sections (
  id          TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  abbreviation TEXT NOT NULL,
  sort_order  INTEGER NOT NULL,
  content     TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sections_document ON sections(document_id, sort_order);

CREATE TABLE IF NOT EXISTS categories (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tags (
  id          TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#48dbfb',
  description TEXT DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tags_category ON tags(category_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_name_category ON tags(name, category_id);

CREATE TABLE IF NOT EXISTS annotations (
  id          TEXT PRIMARY KEY,
  section_id  TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  tag_id      TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  from_pos    INTEGER NOT NULL,
  to_pos      INTEGER NOT NULL,
  note        TEXT DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_annotations_section ON annotations(section_id);
CREATE INDEX IF NOT EXISTS idx_annotations_tag ON annotations(tag_id);

CREATE TABLE IF NOT EXISTS document_tags (
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tag_id      TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id),
  PRIMARY KEY (document_id, tag_id)
);

CREATE TABLE IF NOT EXISTS browse_categories (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  parent_id   TEXT REFERENCES browse_categories(id),
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS preferences (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Seed a default category so tags can be created immediately
INSERT OR IGNORE INTO categories (id, name, sort_order) VALUES
  ('cat-general', 'General', 1);
