-- Messaging System: Communication channels configuration
CREATE TABLE IF NOT EXISTS messaging_channels (
    id TEXT PRIMARY KEY,              -- 'whatsapp', 'telegram', 'messenger', 'email', 'sms'
    name TEXT NOT NULL,               -- Display name
    icon TEXT,                        -- Icon/emoji
    is_active INTEGER DEFAULT 1,
    config TEXT,                      -- JSON configuration for the channel
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Messages/Communications log
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id TEXT NOT NULL,         -- 'whatsapp', 'telegram', 'messenger', 'email', 'sms'
    direction TEXT NOT NULL,          -- 'inbound', 'outbound'
    contact_id INTEGER,               -- Reference to contacts table
    subject TEXT,                     -- Email subject, etc.
    content TEXT NOT NULL,            -- Message content
    status TEXT DEFAULT 'pending',    -- 'pending', 'sent', 'delivered', 'read', 'failed'
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contact_id) REFERENCES customers(id)
);

CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_contact ON messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);

-- Contacts for messaging
CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    whatsapp TEXT,
    telegram TEXT,
    messenger_id TEXT,
    tags TEXT,                        -- JSON array of tags
    notes TEXT,
    is_subscribed INTEGER DEFAULT 1,  -- For SMS/email consent
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);

-- Message templates
CREATE TABLE IF NOT EXISTS message_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    subject TEXT,
    content TEXT NOT NULL,
    variables TEXT,                   -- JSON array of variable names
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed default messaging channels
INSERT OR IGNORE INTO messaging_channels (id, name, icon, is_active, config, display_order) VALUES
('whatsapp', 'WhatsApp', '💬', 1, '{"phone": "5491153323937", "default_message": "Hola, me interesa información sobre sus productos"}', 1),
('telegram', 'Telegram', '✈️', 1, '{"username": "lanuscomputacion", "url": "https://t.me/lanuscomputacion"}', 2),
('messenger', 'Messenger', '💙', 1, '{"page_id": "lanuscomputacion", "url": "https://m.me/lanuscomputacion"}', 3),
('email', 'Email', '📧', 1, '{"address": "info@lanuscomputacion.com", "smtp_host": "", "smtp_port": 587, "smtp_user": "", "smtp_pass": ""}', 4),
('sms', 'SMS', '📱', 0, '{"provider": "twilio", "account_sid": "", "auth_token": "", "from_number": ""}', 5);

-- Seed some message templates
INSERT OR IGNORE INTO message_templates (id, name, channel_id, subject, content, variables) VALUES
('welcome_whatsapp', 'Bienvenida WhatsApp', 'whatsapp', NULL, '¡Hola {{name}}! Bienvenido a Lanús Computación. {{message}}', '["name", "message"]'),
('order_confirmation_email', 'Confirmación de Pedido Email', 'email', 'Confirmación de tu pedido #{{order_id}}', 'Hola {{name}}, tu pedido #{{order_id}} por ${{total}} ha sido confirmado. {{details}}', '["name", "order_id", "total", "details"]'),
('promo_sms', 'Promoción SMS', 'sms', NULL, '¡Oferta especial en Lanús Computación! {{product}} con {{discount}}% OFF. Ver en: {{url}}', '["product", "discount", "url"]');