-- B2B rules table (replaces hardcoded Python dict)
CREATE TABLE IF NOT EXISTS b2b_rules (
    id TEXT PRIMARY KEY,
    category_name TEXT NOT NULL,
    discount_pct REAL NOT NULL DEFAULT 0.10,
    min_quantity INTEGER NOT NULL DEFAULT 6,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_b2b_rules_category ON b2b_rules(category_name);

-- Seed default rules
INSERT OR IGNORE INTO b2b_rules (id, category_name, discount_pct, min_quantity) VALUES
('b2b_default', 'Default', 0.10, 6),
('b2b_celulares', 'Celulares y Smartphones', 0.08, 3),
('b2b_componentes', 'Componentes de PC', 0.15, 10),
('b2b_almacenamiento', 'Almacenamiento', 0.12, 5),
('b2b_notebooks', 'Notebooks', 0.08, 3),
('b2b_monitores', 'Monitores', 0.10, 5),
('b2b_impresion', 'Impresión', 0.10, 5),
('b2b_audio', 'Audio', 0.12, 6),
('b2b_consolas', 'Consolas', 0.05, 3),
('b2b_videojuegos', 'Videojuegos', 0.10, 3),
('b2b_perifericos', 'Periféricos de PC', 0.12, 10),
('b2b_accesorios_cel', 'Accesorios para Celulares', 0.15, 12);
