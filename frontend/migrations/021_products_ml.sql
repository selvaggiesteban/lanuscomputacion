-- Mercado Libre: vínculo del producto con el ítem publicado y con su categoría MLA.
-- Ojo: D1 no soporta "ADD COLUMN IF NOT EXISTS"; las migraciones se aplican una
-- sola vez (están versionadas). Si algún entorno ya tuvo columnas equivalentes,
-- verificar antes con PRAGMA table_info(products).
ALTER TABLE products ADD COLUMN ml_item_id TEXT;
ALTER TABLE products ADD COLUMN ml_category_id TEXT;

-- Un solo producto por ítem de ML: evita duplicados si una sincronización se
-- repite con un producto que todavía no tenía ml_item_id persistido.
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_ml_item ON products(ml_item_id) WHERE ml_item_id IS NOT NULL;
