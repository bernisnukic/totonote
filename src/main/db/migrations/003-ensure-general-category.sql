-- Ensure the default General category exists
-- (002 removed old seeds but cat-general may not have been created by the original 001)
INSERT OR IGNORE INTO categories (id, name, sort_order) VALUES
  ('cat-general', 'General', 1);
