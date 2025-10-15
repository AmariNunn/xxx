-- ===================================================================
-- ADMIN IMPERSONATION SYSTEM - SUPABASE SETUP
-- ===================================================================
-- Run this SQL in your Supabase SQL Editor to set up the admin system
-- This creates the database schema needed for admin functionality
-- ===================================================================

-- Step 1: Add admin flag to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Step 2: Create admin audit log table
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id VARCHAR(255) NOT NULL,
  admin_email VARCHAR(255) NOT NULL,
  action VARCHAR(100) NOT NULL,
  target_user_id VARCHAR(255),
  target_user_email VARCHAR(255),
  details TEXT,
  ip_address VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Step 3: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_audit_admin_id ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created_at ON admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin) WHERE is_admin = TRUE;

-- ===================================================================
-- IMPORTANT: After running this SQL, you need to make yourself an admin
-- ===================================================================
-- Option 1: Using SQL (replace with your email)
-- UPDATE users SET is_admin = TRUE WHERE email = 'info@skyiq.cloud';

-- Option 2: Using Supabase Table Editor
-- 1. Go to Table Editor → users table
-- 2. Find your email row
-- 3. Set is_admin column to TRUE
-- 4. Save
-- ===================================================================

-- To verify you're an admin:
-- SELECT id, email, is_admin FROM users WHERE email = 'info@skyiq.cloud';

-- To add more admins later:
-- UPDATE users SET is_admin = TRUE WHERE email = 'another-admin@example.com';

-- To remove admin access:
-- UPDATE users SET is_admin = FALSE WHERE email = 'user@example.com';
