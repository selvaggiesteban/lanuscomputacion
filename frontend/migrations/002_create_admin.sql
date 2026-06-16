-- Add is_admin column to customers table
ALTER TABLE customers ADD COLUMN is_admin INTEGER DEFAULT 0;

-- Create admin user
INSERT OR REPLACE INTO customers (id, email, name, password_hash, is_admin, is_b2b, created_at)
VALUES (
  'admin-001',
  'selvaggiesteban@gmail.com',
  'Esteban Selvaggi',
  'afe503fc5387a5b5d22d4a591385145cb03da177798c035dc71852fb7d05f711',
  1,
  0,
  datetime('now')
);
