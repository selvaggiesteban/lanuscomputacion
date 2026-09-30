-- Migration 015: composite indexes to cut rows_read per query (D1 free tier: 5M rows/day)
-- Home:      WHERE status='published' ORDER BY available_qty DESC, created_at DESC LIMIT 10
CREATE INDEX IF NOT EXISTS idx_products_home ON products(status, available_qty, created_at);
-- Price range MIN/MAX, ofertas filters: WHERE status='published' [AND price ...]
CREATE INDEX IF NOT EXISTS idx_products_status_price ON products(status, price);
-- Category pages: WHERE status='published' AND category_id = ?
CREATE INDEX IF NOT EXISTS idx_products_status_category ON products(status, category_id);
