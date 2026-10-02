-- Migration 017: composite index for brand-filtered listings and facets.
-- d1 insights (1d): brand GROUP BY + brand listing queries ≈ 1.6M rows_read/day,
-- all full-table scans because no index leads with (status, brand).
-- The 4-column index also serves: WHERE status=? AND brand=? ORDER BY available_qty DESC, created_at DESC
CREATE INDEX IF NOT EXISTS idx_products_status_brand_qty ON products(status, brand, available_qty, created_at);

-- Stats so the query planner picks the selective indexes (slug over status).
-- Without these SQLite chose idx_products_status_brand_qty for slug lookups.
ANALYZE products;
ANALYZE categories;
