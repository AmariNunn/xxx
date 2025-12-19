-- Add permission field for child account management
-- Run this SQL in your Supabase SQL Editor

-- Add can_create_child_accounts column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS can_create_child_accounts BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN users.can_create_child_accounts IS 'Permission flag for creating and managing child accounts. Controlled by admin.';

-- Verification query
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name = 'can_create_child_accounts';
