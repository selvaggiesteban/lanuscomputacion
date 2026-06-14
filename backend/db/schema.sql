-- Lanús Computación Catalog Database Schema

CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    parent_id TEXT,
    level INTEGER DEFAULT 0,
    total_items INTEGER DEFAULT 0,
    picture TEXT,
    permalink TEXT,
    priority INTEGER DEFAULT 3,
    b2b_discount REAL DEFAULT 0.0,
    b2b_min_qty INTEGER DEFAULT 1,
    is_active INTEGER DEFAULT 1,
    last_api_update TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    external_id TEXT,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    category_id TEXT DEFAULT 'uncategorized',
    category_name TEXT,
    subcategory_name TEXT,
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft','pending_review','published','rejected','archived')),
    price REAL,
    cost_price REAL,
    original_price REAL,
    currency TEXT DEFAULT 'ARS',
    dollar_rate REAL,
    iva_pct REAL DEFAULT 10.5,
    internal_tax_pct REAL DEFAULT 0.0,
    markup_pct REAL DEFAULT 23.0,
    brand TEXT,
    sku TEXT,
    codigo_alfa TEXT,
    ean TEXT,
    weight REAL,
    warranty TEXT,
    provider TEXT DEFAULT 'manual',
    provider_store TEXT DEFAULT 'minorista',
    condition TEXT DEFAULT 'new',
    available_qty INTEGER DEFAULT 0,
    stock_level TEXT,
    sold_qty INTEGER DEFAULT 0,
    rating REAL DEFAULT 0.0,
    reviews_count INTEGER DEFAULT 0,
    seller_id TEXT,
    seller_nickname TEXT,
    seller_reputation REAL,
    free_shipping INTEGER DEFAULT 0,
    listing_type TEXT,
    permalink TEXT,
    thumbnail TEXT,
    supplier_link TEXT,
    is_gamer INTEGER DEFAULT 0,
    last_api_update TIMESTAMP,
    last_price_change TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP,
    published_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_external ON products(external_id, provider);
CREATE INDEX IF NOT EXISTS idx_products_provider ON products(provider);
CREATE INDEX IF NOT EXISTS idx_products_store ON products(provider_store);

CREATE TABLE IF NOT EXISTS product_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id TEXT NOT NULL,
    url_original TEXT NOT NULL,
    file_path TEXT,
    filename TEXT,
    alt_text TEXT,
    width INTEGER,
    height INTEGER,
    file_size_bytes INTEGER,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);

CREATE TABLE IF NOT EXISTS product_attributes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id TEXT NOT NULL,
    name TEXT NOT NULL,
    value TEXT NOT NULL,
    value_id TEXT,
    attribute_group TEXT,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_product_attributes_product ON product_attributes(product_id);

CREATE TABLE IF NOT EXISTS b2b_prices (
    product_id TEXT PRIMARY KEY,
    base_price REAL NOT NULL,
    discount_pct REAL NOT NULL DEFAULT 0.0,
    discount_rule TEXT,
    final_price REAL NOT NULL,
    min_quantity INTEGER DEFAULT 1,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payment_methods (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    config TEXT
);

INSERT OR IGNORE INTO payment_methods (id, name, is_active, config) VALUES
('mercadopago', 'Mercado Pago', 1, '{}'),
('bank_transfer', 'Transferencia Bancaria', 1, '{}');

CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    name TEXT,
    phone TEXT,
    google_id TEXT,
    facebook_id TEXT,
    is_b2b INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    customer_id INTEGER,
    product_id TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    unit_price REAL NOT NULL,
    total_price REAL NOT NULL,
    payment_method TEXT,
    payment_status TEXT DEFAULT 'pending' CHECK(payment_status IN ('pending','completed','failed','refunded')),
    mp_payment_id TEXT,
    mp_preference_id TEXT,
    transfer_proof_path TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','confirmed','shipped','delivered','cancelled')),
    customer_name TEXT,
    customer_email TEXT,
    customer_phone TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

CREATE TABLE IF NOT EXISTS favorites (
    customer_id INTEGER NOT NULL,
    product_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (customer_id, product_id),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    is_read INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sync_checkpoint (
    category_id TEXT NOT NULL,
    page INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','in_progress','completed','failed')),
    items_total INTEGER DEFAULT 0,
    items_scraped INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    PRIMARY KEY (category_id, page)
);

CREATE TABLE IF NOT EXISTS change_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    field TEXT,
    old_value TEXT,
    new_value TEXT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
