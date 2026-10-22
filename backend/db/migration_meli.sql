-- Add Mercado Libre Item ID to products table
ALTER TABLE products ADD COLUMN ml_item_id TEXT;

-- Create table to store OAuth tokens for Mercado Libre
CREATE TABLE meli_tokens (
    id INTEGER PRIMARY KEY CHECK (id = 1), -- Ensure only one set of tokens
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
