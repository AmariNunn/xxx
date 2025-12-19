-- =============================================
-- Child Accounts Feature - Database Migration
-- =============================================
-- Run this SQL in your Supabase SQL Editor
-- This adds parent/child account support to allow
-- users to create and manage multiple sub-accounts

-- Add parent_account_id column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS parent_account_id VARCHAR(255) REFERENCES users(id);

-- Create index for faster lookups of child accounts
CREATE INDEX IF NOT EXISTS idx_users_parent_account 
ON users(parent_account_id) 
WHERE parent_account_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN users.parent_account_id IS 'References parent user ID for child accounts. NULL for parent/standalone accounts.';

-- =============================================
-- VERIFICATION QUERIES
-- =============================================
-- Run these to verify the migration worked:

-- 1. Check if column exists
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name = 'parent_account_id';

-- 2. Check if index exists
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'users' 
AND indexname = 'idx_users_parent_account';

-- =============================================
-- EXAMPLE USAGE AFTER MIGRATION
-- =============================================
-- These queries show how the system will work:

-- Get all child accounts for a parent user
-- SELECT * FROM users WHERE parent_account_id = 'parent-user-id-here';

-- Check if a user is a child account
-- SELECT parent_account_id IS NOT NULL as is_child FROM users WHERE id = 'user-id-here';

-- Count child accounts for each parent
-- SELECT parent_account_id, COUNT(*) as child_count 
-- FROM users 
-- WHERE parent_account_id IS NOT NULL 
-- GROUP BY parent_account_id;
