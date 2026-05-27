CREATE TABLE IF NOT EXISTS section_tags (
  section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  tag_id     TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (section_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_section_tags_tag ON section_tags(tag_id);
