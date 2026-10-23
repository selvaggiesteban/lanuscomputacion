-- Órdenes: origen del pedido (default 'web') y ID externo para idempotencia.
-- El webhook de ML usa source='mercadolibre' + external_id=<ML order id>.
-- Verificado contra el CREATE TABLE real de orders (backend/db/schema.sql): no
-- tenía columnas equivalentes; sólo se le agregó shipping_cost (migración 019).
ALTER TABLE orders ADD COLUMN source TEXT DEFAULT 'web';
ALTER TABLE orders ADD COLUMN external_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_source_external ON orders(source, external_id) WHERE external_id IS NOT NULL;
