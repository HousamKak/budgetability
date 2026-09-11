-- Data cleanup: expenses and plans recorded before the category registry
-- carry free-text categories in mixed case ("groceries" vs "Groceries") and
-- no category_id, which splits every per-category view. Attach each such row
-- to the user's matching registry category (case-insensitive) and canonicalize
-- the stored text. Rows whose text matches no registry category are left
-- untouched. Idempotent: already-attached rows are skipped by the IS NULL guard.

UPDATE expenses e
SET category_id = c.id,
    category = c.name
FROM categories c
WHERE e.user_id = c.user_id
  AND e.category_id IS NULL
  AND e.category IS NOT NULL
  AND lower(e.category) = lower(c.name);

UPDATE plans p
SET category_id = c.id,
    category = c.name
FROM categories c
WHERE p.user_id = c.user_id
  AND p.category_id IS NULL
  AND p.category IS NOT NULL
  AND lower(p.category) = lower(c.name);
