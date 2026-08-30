-- Coupons table for discount codes
CREATE TABLE IF NOT EXISTS coupons (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK(type IN ('percentage', 'fixed')),
    value REAL NOT NULL,
    min_purchase REAL DEFAULT 0,
    max_uses INTEGER,
    used_count INTEGER DEFAULT 0,
    applies_to TEXT DEFAULT 'all' CHECK(applies_to IN ('all', 'category', 'product')),
    target_id TEXT,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(is_active);

-- Add discount columns to order_items
ALTER TABLE order_items ADD COLUMN discount_amount REAL DEFAULT 0;
ALTER TABLE order_items ADD COLUMN promo_id TEXT;
