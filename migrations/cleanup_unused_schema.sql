-- Cleanup unused tables and columns
-- This migration removes tables and columns that are no longer used in the application

-- Drop the elevenlabs_conversations table (not used - conversation data is stored in calls table)
DROP TABLE IF EXISTS elevenlabs_conversations;

-- Drop the leads table if not actively used (business_info already contains lead_* columns)
-- Uncomment the line below if you confirm leads table is not needed:
-- DROP TABLE IF EXISTS leads;

-- Remove unused lead_* columns from business_info (if using a separate leads table)
-- Uncomment if you're keeping the leads table:
-- ALTER TABLE business_info 
-- DROP COLUMN IF EXISTS lead_urls,
-- DROP COLUMN IF EXISTS lead_names,
-- DROP COLUMN IF EXISTS lead_types,
-- DROP COLUMN IF EXISTS lead_sizes;

COMMENT ON TABLE business_info IS 'Stores all business configuration including ElevenLabs, Cal.com, and Twilio integration credentials per user';
