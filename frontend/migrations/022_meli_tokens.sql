-- Token OAuth de Mercado Libre: fila única (id = 1) para la cuenta de la tienda.
-- La escribe /api/auth/ml-callback al autorizar y la rotan MeliClient (refresh).
CREATE TABLE IF NOT EXISTS meli_tokens (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    user_id TEXT,
    nickname TEXT,
    scopes TEXT,
    last_sync_at TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO meli_tokens (id, access_token, refresh_token, expires_at)
VALUES (1, '', '', '');
