-- Store configuration for installments, discounts, etc.
CREATE TABLE IF NOT EXISTS store_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO store_config (key, value) VALUES
('installment_count', '12'),
('installment_has_interest', 'false'),
('bank_transfer_discount_pct', '10'),
('store_name', 'Lanús Computación'),
('store_whatsapp', '5491153323937');
