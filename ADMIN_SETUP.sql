-- ================================================
-- ADMIN IMPERSONATION SETUP FOR SUPABASE
-- ================================================
-- Run this SQL in your Supabase SQL Editor

-- Step 1: Add admin flag to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Step 2: Make your account an admin (replace with your email)
UPDATE users 
SET is_admin = TRUE 
WHERE email = 'your-admin-email@example.com';

-- Step 3: Create admin audit log table
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id SERIAL PRIMARY KEY,
  admin_id VARCHAR(255) NOT NULL,
  admin_email VARCHAR(255) NOT NULL,
  action VARCHAR(100) NOT NULL,
  target_user_id VARCHAR(255),
  target_user_email VARCHAR(255),
  details TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Step 4: Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_admin_audit_admin_id ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created_at ON admin_audit_log(created_at);

-- Step 5: Verify admin users
SELECT id, email, business_name, is_admin, created_at 
FROM users 
WHERE is_admin = TRUE;

-- Step 6: View recent admin actions (optional - for monitoring)
-- SELECT * FROM admin_audit_log ORDER BY created_at DESC LIMIT 20;
