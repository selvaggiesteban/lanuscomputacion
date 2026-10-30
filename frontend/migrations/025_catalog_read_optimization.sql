-- 025: reasegura los índices que el catálogo público necesita para no
-- escanear products entera por visita (límite free tier: 5M filas leídas/día).
-- Idempotente: si 010/015/017 ya los crearon, no hace nada.
--
--   idx_products_home          → getProducts ORDER BY available_qty, created_at LIMIT 20
--   idx_products_status_price  → MIN/MAX de precios del filtro (descenso por índice)
--   idx_products_status_category → conteos filtrados por categoría
--   idx_products_brand         → facet de marcas (evita acceso a tabla)
--   idx_products_slug          → página de producto por slug
CREATE INDEX IF NOT EXISTS idx_products_home ON products(status, available_qty, created_at);
CREATE INDEX IF NOT EXISTS idx_products_status_price ON products(status, price);
CREATE INDEX IF NOT EXISTS idx_products_status_category ON products(status, category_id);
CREATE INDEX IF NOT EXISTS idx_products_status_brand_qty ON products(status, brand, available_qty, created_at);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
