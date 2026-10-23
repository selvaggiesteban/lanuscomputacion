-- Eventos de la integración Mercado Libre: ventas (webhook), sincronizaciones,
-- errores y silencios. Los escribe logMeliEvent (frontend/src/lib/d1.ts).
CREATE TABLE IF NOT EXISTS meli_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    entity TEXT,
    entity_id TEXT,
    status TEXT DEFAULT 'ok',
    message TEXT,
    payload TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_meli_events_created_at ON meli_events(created_at);
