-- Agrega costo de envío fijo al pedido (configurable vía app_config.shipping_cost, default 17000).
ALTER TABLE orders ADD COLUMN shipping_cost REAL NOT NULL DEFAULT 0;
