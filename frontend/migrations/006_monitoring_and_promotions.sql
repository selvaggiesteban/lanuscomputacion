-- Migration 006: Monitoring & Promotions
-- Price history, dollar rate history, promotions, alert rules

CREATE TABLE IF NOT EXISTS price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id TEXT NOT NULL,
    old_price REAL,
    new_price REAL,
    old_cost_price REAL,
    new_cost_price REAL,
    old_dollar_rate REAL,
    new_dollar_rate REAL,
    old_markup_pct REAL,
    new_markup_pct REAL,
    reason TEXT DEFAULT 'sync',
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX IF NOT EXISTS idx_price_history_product ON price_history(product_id);
CREATE INDEX IF NOT EXISTS idx_price_history_date ON price_history(changed_at);

CREATE TABLE IF NOT EXISTS dollar_rate_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rate REAL NOT NULL,
    source TEXT DEFAULT 'bcra',
    fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dollar_rate_date ON dollar_rate_history(fetched_at);

CREATE TABLE IF NOT EXISTS promotions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('percentage', 'fixed')),
    value REAL NOT NULL,
    applies_to TEXT NOT NULL CHECK(applies_to IN ('all', 'category', 'product')),
    target_id TEXT,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(is_active);
CREATE INDEX IF NOT EXISTS idx_promotions_dates ON promotions(start_date, end_date);
