ALTER TABLE customers ADD COLUMN password_reset_token TEXT;
ALTER TABLE customers ADD COLUMN password_reset_expires TIMESTAMP;
