ALTER TABLE customers ADD COLUMN b2b_status TEXT DEFAULT 'pending' CHECK(b2b_status IN ('pending', 'approved', 'rejected'));
