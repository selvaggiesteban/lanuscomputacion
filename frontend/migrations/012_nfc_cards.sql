-- NFC Cards table for 20 NTAG213 tags
CREATE TABLE IF NOT EXISTS nfc_cards (
    id TEXT PRIMARY KEY,           -- 'nfc_01' to 'nfc_20'
    card_number INTEGER NOT NULL UNIQUE,  -- 1 to 20
    slug TEXT NOT NULL UNIQUE,     -- 'p/01' to 'p/20'
    title TEXT NOT NULL,           -- Display title for the card
    description TEXT,              -- Optional description
    target_url TEXT NOT NULL,      -- Full URL or path to redirect
    target_type TEXT NOT NULL DEFAULT 'page',  -- 'page', 'product', 'category', 'contact', 'custom'
    target_id TEXT,                -- Product ID, category ID, etc. if applicable
    background_color TEXT DEFAULT '#1a1a2e',  -- Card background color
    text_color TEXT DEFAULT '#ffffff',        -- Card text color
    icon TEXT,                     -- Icon name or emoji
    is_active INTEGER DEFAULT 1,   -- 1 = active, 0 = inactive
    scan_count INTEGER DEFAULT 0,  -- Number of times scanned
    last_scanned_at TIMESTAMP,     -- Last scan timestamp
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_nfc_cards_number ON nfc_cards(card_number);
CREATE INDEX IF NOT EXISTS idx_nfc_cards_slug ON nfc_cards(slug);
CREATE INDEX IF NOT EXISTS idx_nfc_cards_active ON nfc_cards(is_active);

-- NFC Card scans log for analytics
CREATE TABLE IF NOT EXISTS nfc_scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id TEXT NOT NULL,
    scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_hash TEXT,                  -- Hashed IP for privacy
    user_agent TEXT,               -- Device info
    referrer TEXT,                 -- Where the scan came from
    FOREIGN KEY (card_id) REFERENCES nfc_cards(id)
);

CREATE INDEX IF NOT EXISTS idx_nfc_scans_card ON nfc_scans(card_id);
CREATE INDEX IF NOT EXISTS idx_nfc_scans_date ON nfc_scans(scanned_at);

-- Seed 20 NFC cards with default configuration
INSERT OR IGNORE INTO nfc_cards (id, card_number, slug, title, description, target_url, target_type, icon, background_color) VALUES
('nfc_01', 1, 'p/01', 'Catálogo Principal', 'Acceso directo al catálogo completo de productos', '/categoria/todas', 'category', '📦', '#1a1a2e'),
('nfc_02', 2, 'p/02', 'Ofertas Especiales', 'Los mejores descuentos en tecnología', '/ofertas', 'page', '🔥', '#c0392b'),
('nfc_03', 3, 'p/03', 'Celulares y Smartphones', 'Últimos modelos de celulares', '/categoria/celulares-y-smartphones', 'category', '📱', '#2c3e50'),
('nfc_04', 4, 'p/04', 'Notebooks y Laptops', 'Equipos portátiles para trabajo y estudio', '/categoria/notebooks', 'category', '💻', '#27ae60'),
('nfc_05', 5, 'p/05', 'Componentes PC', 'Componentes para armar tu PC', '/categoria/componentes-de-pc', 'category', '⚙️', '#8e44ad'),
('nfc_06', 6, 'p/06', 'Monitores', 'Monitores para gaming y oficina', '/categoria/monitores', 'category', '🖥️', '#2980b9'),
('nfc_07', 7, 'p/07', 'Audio y Auriculares', 'Equipos de audio profesionales', '/categoria/audio', 'category', '🎧', '#d35400'),
('nfc_08', 8, 'p/08', 'Periféricos', 'Teclados, mouse y accesorios', '/categoria/perifericos-de-pc', 'category', '⌨️', '#16a085'),
('nfc_09', 9, 'p/09', 'Almacenamiento', 'Discos SSD, HDD y memorias USB', '/categoria/almacenamiento', 'category', '💾', '#2c3e50'),
('nfc_10', 10, 'p/10', 'Impresión', 'Impresoras y consumibles', '/categoria/impresion', 'category', '🖨️', '#7f8c8d'),
('nfc_11', 11, 'p/11', 'Consolas y Videojuegos', 'Gaming y entretenimiento', '/categoria/consolas', 'category', '🎮', '#c0392b'),
('nfc_12', 12, 'p/12', 'Accesorios Celulares', 'Fundas, cargadores y protectores', '/categoria/accesorios-para-celulares', 'category', '🔌', '#27ae60'),
('nfc_13', 13, 'p/13', 'Servicios Técnicos', 'Reparación y mantenimiento de PC', '/servicios/servicio-tecnico-de-pc', 'page', '🔧', '#8e44ad'),
('nfc_14', 14, 'p/14', 'Desarrollo Web', 'Sitios web y aplicaciones a medida', '/servicios/desarrollo-web', 'page', '🌐', '#2980b9'),
('nfc_15', 15, 'p/15', 'Marketing Digital', 'Google Ads, Meta Ads, SEO', '/servicios/gestion-de-google-ads', 'page', '📈', '#d35400'),
('nfc_16', 16, 'p/16', 'Contacto WhatsApp', 'Chatea directo con nosotros', 'https://wa.me/5491153323937', 'contact', '💬', '#25D366'),
('nfc_17', 17, 'p/17', 'Ubicación y Horarios', 'Dónde encontrarnos', '/contacto', 'page', '📍', '#16a085'),
('nfc_18', 18, 'p/18', 'Registro B2B', 'Cuenta mayorista para empresas', '/b2b', 'page', '🏢', '#2c3e50'),
('nfc_19', 19, 'p/19', 'Cómo Comprar', 'Guía paso a paso', '/como-comprar', 'page', '🛒', '#7f8c8d'),
('nfc_20', 20, 'p/20', 'Soporte Técnico', 'Ayuda y preguntas frecuentes', '/preguntas-frecuentes', 'page', '❓', '#8e44ad');