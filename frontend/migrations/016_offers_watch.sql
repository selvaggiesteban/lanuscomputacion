-- Migration 016: state for the /ofertas change-detection email alerts.
-- Written by the sync-elit worker (it also self-creates this table at runtime).
CREATE TABLE IF NOT EXISTS offers_watch_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    fingerprint TEXT NOT NULL,
    snapshot TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
