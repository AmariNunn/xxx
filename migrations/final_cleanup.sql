-- Final Cleanup Migration
-- This migration removes unused tables and columns from the database
-- Run this in your Supabase SQL Editor after confirming you don't need these tables

-- ============================================================================
-- STEP 1: Drop unused tables
-- ============================================================================

-- Drop eleven_labs_conversations table (DEPRECATED)
-- Conversation data is now stored in the calls table
DROP TABLE IF EXISTS eleven_labs_conversations CASCADE;

-- Drop leads table (OPTIONAL - uncomment if you're not using it)
-- Lead information can be stored in lead_* columns in business_info if needed
-- DROP TABLE IF EXISTS leads CASCADE;

-- ============================================================================
-- STEP 2: Remove unused columns from business_info
-- ============================================================================

-- Remove lead-related columns (OPTIONAL - uncomment if not using)
-- These columns were intended for storing lead data but are rarely used
-- ALTER TABLE business_info DROP COLUMN IF EXISTS lead_urls;
-- ALTER TABLE business_info DROP COLUMN IF EXISTS lead_names;
-- ALTER TABLE business_info DROP COLUMN IF EXISTS lead_types;
-- ALTER TABLE business_info DROP COLUMN IF EXISTS lead_sizes;

-- ============================================================================
-- STEP 3: Clean up indexes and RLS policies
-- ============================================================================

-- Drop index for eleven_labs_conversations (if exists)
DROP INDEX IF EXISTS idx_eleven_labs_conversations_user_id;

-- Drop RLS policy for eleven_labs_conversations (if exists)
DROP POLICY IF EXISTS "Users can view own conversations" ON eleven_labs_conversations;

-- Drop index for leads table (if you dropped the leads table)
-- DROP INDEX IF EXISTS idx_leads_user_id;

-- Drop RLS policy for leads (if you dropped the leads table)
-- DROP POLICY IF EXISTS "Users can view own leads" ON leads;

-- ============================================================================
-- STEP 4: Add comments for documentation
-- ============================================================================

COMMENT ON TABLE business_info IS 'Stores business configuration and integration credentials (ElevenLabs, Cal.com, Twilio) per user for multi-tenant architecture';
COMMENT ON TABLE calls IS 'Stores all call records including conversation data, transcripts, and summaries';
COMMENT ON TABLE users IS 'User authentication and business information';
COMMENT ON TABLE batches IS 'Batch call processing queue';
COMMENT ON TABLE batch_calls IS 'Individual calls within a batch';
COMMENT ON TABLE prompts IS 'AI agent prompts and system messages';

-- ============================================================================
-- Summary of changes:
-- ✅ Removed: eleven_labs_conversations table (deprecated)
-- ⚠️  Optional: leads table (uncomment to remove)
-- ⚠️  Optional: lead_* columns in business_info (uncomment to remove)
-- ✅ Cleaned up indexes and RLS policies
-- ✅ Added table documentation
-- ============================================================================
