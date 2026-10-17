-- Digest: registro de envío de recuperación de carritos abandonados.
ALTER TABLE abandoned_carts ADD COLUMN recovery_sent_at TEXT;
