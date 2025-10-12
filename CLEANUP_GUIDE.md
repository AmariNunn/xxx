# Database Cleanup Guide

This guide explains which tables and columns can be safely removed from your Supabase database to clean up unused data structures.

## 🗑️ Tables to Remove

### 1. `eleven_labs_conversations` (DEPRECATED)
**Status**: ✅ Safe to remove immediately

**Reason**: This table is no longer used. All conversation data is now stored in the `calls` table, which includes:
- Transcripts
- Summaries  
- Call metadata
- ElevenLabs conversation data

**How to remove**:
```sql
DROP TABLE IF EXISTS eleven_labs_conversations CASCADE;
DROP INDEX IF EXISTS idx_eleven_labs_conversations_user_id;
DROP POLICY IF EXISTS "Users can view own conversations" ON eleven_labs_conversations;
```

### 2. `leads` (OPTIONAL)
**Status**: ⚠️ Review before removing

**Reason**: Lead data may be stored in the `business_info` table using these columns:
- `lead_urls`
- `lead_names`
- `lead_types`
- `lead_sizes`

**Decision needed**: 
- If you're using the separate `leads` table → Keep it, remove lead_* columns from business_info
- If you're using lead_* columns in business_info → Keep them, remove leads table
- If you're not tracking leads at all → Remove both

**How to remove** (if not needed):
```sql
DROP TABLE IF EXISTS leads CASCADE;
DROP INDEX IF EXISTS idx_leads_user_id;
DROP POLICY IF EXISTS "Users can view own leads" ON leads;
```

## 📋 Columns to Review in `business_info`

### Lead-related columns (if using separate leads table)
```sql
ALTER TABLE business_info DROP COLUMN IF EXISTS lead_urls;
ALTER TABLE business_info DROP COLUMN IF EXISTS lead_names;
ALTER TABLE business_info DROP COLUMN IF EXISTS lead_types;
ALTER TABLE business_info DROP COLUMN IF EXISTS lead_sizes;
```

## 🚀 How to Apply Cleanup

### Method 1: Run the migration file
1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Open and run: `migrations/final_cleanup.sql`
4. Uncomment optional sections as needed

### Method 2: Manual cleanup
Copy the SQL commands above and run them in Supabase SQL Editor

## ✅ Code Changes Already Applied

The following code has been updated to remove references to deprecated tables:

1. **server/supabaseStorage.ts**: Removed unused imports for `Lead`, `ElevenLabsConversation`, `InsertLead`, and `InsertElevenLabsConversation`

2. **shared/types.ts**: Added deprecation notices to:
   - `Lead` interface
   - `ElevenLabsConversation` interface

3. **server/index.ts**: Updated batch processing to use user-specific credentials

## 📊 Current Active Tables

After cleanup, your database will have these core tables:

| Table | Purpose |
|-------|---------|
| `users` | User authentication and account info |
| `business_info` | Business configuration + integration credentials (ElevenLabs, Cal.com, Twilio) |
| `calls` | Call records with transcripts and summaries |
| `batches` | Batch call processing queue |
| `batch_calls` | Individual calls in a batch |
| `prompts` | AI agent prompts and messages |

## 🔐 Multi-Tenant Architecture

The cleaned-up schema supports the multi-tenant architecture where:
- Each user has their own ElevenLabs credentials (API key, Agent ID, Phone Number ID)
- Each user has their own Cal.com credentials (API key, Event Type ID)
- Each user has their own Twilio credentials (Account SID, Auth Token, Phone Number)
- All stored securely in the `business_info` table per user

## 📝 Next Steps

1. Review which tables/columns you actually need
2. Run the appropriate cleanup SQL in Supabase
3. Test your application to ensure everything works
4. Delete this guide and the migration files once cleanup is complete
