-- Remove pre-filled browse categories and extra seed categories
-- Users should create their own categories as needed

DELETE FROM browse_categories;

-- Remove old seed categories (but keep cat-general and any user-created ones)
DELETE FROM categories WHERE id IN (
  'cat-member', 'cat-lore-type', 'cat-game', 'cat-location', 'cat-form'
);
