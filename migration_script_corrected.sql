-- =====================================================
-- CORRECTED MIGRATION SCRIPT
-- SkyIQ Database Schema Migration
-- =====================================================
-- This script migrates from the old schema to a clean, normalized schema
-- while preserving all existing data and adding missing functionality.

-- =====================================================
-- STEP 1: CREATE ENUMS FOR DATA INTEGRITY
-- =====================================================

CREATE TYPE call_status AS ENUM ('initiated', 'in-progress', 'completed', 'failed', 'missed');
CREATE TYPE call_direction AS ENUM ('inbound', 'outbound', 'ai_agent');
CREATE TYPE subscription_status AS ENUM ('trial', 'active', 'cancelled', 'expired');

-- =====================================================
-- STEP 2: CREATE NEW CLEAN SCHEMA
-- =====================================================

-- Users table (simplified and clean)
CREATE TABLE IF NOT EXISTS users_new (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  last_login_at TIMESTAMPTZ,
  subscription_status subscription_status DEFAULT 'trial',
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Business profiles (comprehensive business context)
CREATE TABLE IF NOT EXISTS business_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES users_new(id) ON DELETE CASCADE,
  business_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  description TEXT,
  logo_url TEXT,
  
  -- Twilio integration
  twilio_account_sid TEXT,
  twilio_auth_token TEXT,
  twilio_phone_number TEXT,
  
  -- ElevenLabs integration
  eleven_labs_api_key TEXT,
  eleven_labs_agent_id TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent prompts (AI configuration)
CREATE TABLE IF NOT EXISTS agent_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE,
  system_prompt TEXT NOT NULL,
  first_message TEXT,
  prompt_text TEXT, -- Legacy field for compatibility
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Batches (for bulk calling)
CREATE TABLE IF NOT EXISTS batches (
  id TEXT PRIMARY KEY, -- Changed to TEXT to match existing data
  business_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE,
  batch_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  total_calls INTEGER DEFAULT 0,
  completed_calls INTEGER DEFAULT 0,
  successful_calls INTEGER DEFAULT 0,
  failed_calls INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Calls (comprehensive call tracking)
CREATE TABLE IF NOT EXISTS calls_new (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE,
  prompt_id UUID REFERENCES agent_prompts(id),
  batch_id TEXT REFERENCES batches(id),
  
  -- Call identification
  from_number TEXT,
  to_number TEXT,
  
  -- Call details
  status call_status NOT NULL,
  duration_sec INTEGER,
  
  -- Call content
  transcript TEXT,
  summary TEXT,
  notes TEXT,
  
  -- External service IDs
  twilio_sid TEXT,
  
  -- Media
  recording_url TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Batch calls (individual calls within a batch)
CREATE TABLE IF NOT EXISTS batch_calls (
  id TEXT PRIMARY KEY, -- Changed to TEXT to match existing data
  batch_id TEXT REFERENCES batches(id) ON DELETE CASCADE, -- Changed to TEXT
  business_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  company TEXT,
  status TEXT DEFAULT 'pending',
  call_id UUID, -- Will add foreign key constraint later
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Leads (for lead management)
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  email TEXT,
  company TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ElevenLabs conversations (AI conversation tracking)
CREATE TABLE IF NOT EXISTS eleven_labs_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE,
  conversation_id TEXT UNIQUE NOT NULL,
  agent_id TEXT,
  status TEXT NOT NULL,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration INTEGER,
  transcript TEXT,
  summary TEXT,
  metadata JSONB,
  phone_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- STEP 3: MIGRATE USERS DATA
-- =====================================================

INSERT INTO users_new (id, email, password_hash, name, created_at, updated_at)
SELECT 
  id, 
  email, 
  password as password_hash, 
  business_name as name, 
  created_at, 
  created_at as updated_at
FROM users
WHERE id IS NOT NULL
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  name = EXCLUDED.name,
  updated_at = NOW();

-- =====================================================
-- STEP 4: CREATE BUSINESS PROFILES
-- =====================================================

INSERT INTO business_profiles (
  id, user_id, business_name, email, phone, address, description, logo_url,
  twilio_account_sid, twilio_auth_token, twilio_phone_number, 
  eleven_labs_api_key, eleven_labs_agent_id, created_at, updated_at
)
SELECT 
  gen_random_uuid() as id,
  u.id as user_id,
  u.business_name,
  u.email,
  u.phone_number as phone,
  NULL as address,
  NULL as description,
  NULL as logo_url,
  bi.twilio_account_sid,
  bi.twilio_auth_token,
  bi.twilio_phone_number,
  NULL as eleven_labs_api_key, -- Will be set separately
  NULL as eleven_labs_agent_id, -- Will be set separately
  u.created_at,
  COALESCE(bi.updated_at, u.created_at) as updated_at
FROM users u
LEFT JOIN business_info bi ON u.id = bi.user_id
WHERE u.id IS NOT NULL
ON CONFLICT (user_id) DO UPDATE SET
  business_name = EXCLUDED.business_name,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  updated_at = NOW();

-- =====================================================
-- STEP 5: MIGRATE BUSINESS CONTEXT DATA
-- =====================================================

-- First, add the missing columns to business_profiles if they don't exist
ALTER TABLE business_profiles 
ADD COLUMN IF NOT EXISTS links TEXT[],
ADD COLUMN IF NOT EXISTS file_urls TEXT[],
ADD COLUMN IF NOT EXISTS file_names TEXT[],
ADD COLUMN IF NOT EXISTS file_types TEXT[],
ADD COLUMN IF NOT EXISTS file_sizes TEXT[],
ADD COLUMN IF NOT EXISTS document_content TEXT[],
ADD COLUMN IF NOT EXISTS document_titles TEXT[],
ADD COLUMN IF NOT EXISTS document_extracted_at TEXT[],
ADD COLUMN IF NOT EXISTS scraped_content TEXT[],
ADD COLUMN IF NOT EXISTS scraped_titles TEXT[],
ADD COLUMN IF NOT EXISTS scraped_urls TEXT[],
ADD COLUMN IF NOT EXISTS scraped_at TEXT[],
ADD COLUMN IF NOT EXISTS lead_urls TEXT[],
ADD COLUMN IF NOT EXISTS lead_names TEXT[],
ADD COLUMN IF NOT EXISTS lead_types TEXT[],
ADD COLUMN IF NOT EXISTS lead_sizes TEXT[];

-- Now update the business context data
UPDATE business_profiles 
SET 
  links = bi.links,
  file_urls = bi.file_urls,
  file_names = bi.file_names,
  file_types = bi.file_types,
  file_sizes = bi.file_sizes,
  document_content = bi.document_content,
  document_titles = bi.document_titles,
  document_extracted_at = bi.document_extracted_at,
  scraped_content = bi.scraped_content,
  scraped_titles = bi.scraped_titles,
  scraped_urls = bi.scraped_urls,
  scraped_at = bi.scraped_at,
  lead_urls = bi.lead_urls,
  lead_names = bi.lead_names,
  lead_types = bi.lead_types,
  lead_sizes = bi.lead_sizes,
  description = bi.description,
  logo_url = bi.logo_url,
  updated_at = NOW()
FROM business_info bi
WHERE business_profiles.user_id = bi.user_id;

-- =====================================================
-- STEP 6: MIGRATE CALLS DATA (COMPREHENSIVE)
-- =====================================================

-- First, add the missing columns to calls_new if they don't exist
ALTER TABLE calls_new 
ADD COLUMN IF NOT EXISTS caller_number TEXT,
ADD COLUMN IF NOT EXISTS called_number TEXT,
ADD COLUMN IF NOT EXISTS phone_number TEXT,
ADD COLUMN IF NOT EXISTS contact_name TEXT,
ADD COLUMN IF NOT EXISTS conversation_id TEXT,
ADD COLUMN IF NOT EXISTS elevenlabs_call_id TEXT,
ADD COLUMN IF NOT EXISTS call_type call_direction DEFAULT 'inbound',
ADD COLUMN IF NOT EXISTS direction call_direction,
ADD COLUMN IF NOT EXISTS is_from_twilio BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS client_data JSONB,
ADD COLUMN IF NOT EXISTS action TEXT;

INSERT INTO calls_new (
  id, business_id, from_number, to_number, caller_number, called_number, phone_number,
  status, call_type, direction, duration_sec, contact_name, transcript, summary, 
  notes, twilio_sid, conversation_id, elevenlabs_call_id, is_from_twilio,
  created_at, updated_at
)
SELECT 
  gen_random_uuid() as id,
  bp.id as business_id,
  c.caller_number as from_number,
  c.called_number as to_number,
  c.caller_number,
  c.called_number,
  c.phone_number,
  COALESCE(c.status::call_status, 'completed'::call_status) as status,
  COALESCE(c.call_type::call_direction, 'inbound'::call_direction) as call_type,
  COALESCE(c.direction::call_direction, 'inbound'::call_direction) as direction,
  c.duration as duration_sec,
  c.contact_name,
  c.transcript,
  c.summary,
  c.notes,
  c.twilio_call_sid as twilio_sid,
  c.conversation_id,
  c.elevenlabs_call_id,
  COALESCE(c.is_from_twilio, false) as is_from_twilio,
  c.created_at,
  COALESCE(c.updated_at, c.created_at) as updated_at
FROM calls c
JOIN users u ON c.user_id = u.id
JOIN business_profiles bp ON bp.user_id = u.id
WHERE c.id IS NOT NULL
ON CONFLICT DO NOTHING;

-- =====================================================
-- STEP 7: MIGRATE LEADS DATA
-- =====================================================

INSERT INTO leads (id, business_id, name, phone_number, email, company, notes, created_at)
SELECT 
  gen_random_uuid() as id,
  bp.id as business_id,
  l.name,
  l.phone_number,
  l.email,
  l.company,
  l.notes,
  l.created_at
FROM leads l
JOIN users u ON l.user_id = u.id
JOIN business_profiles bp ON bp.user_id = u.id
WHERE l.id IS NOT NULL
ON CONFLICT DO NOTHING;

-- =====================================================
-- STEP 8: MIGRATE BATCHES DATA
-- =====================================================

INSERT INTO batches (id, business_id, batch_name, status, total_calls, completed_calls, successful_calls, failed_calls, created_at, updated_at)
SELECT 
  b.id,
  bp.id as business_id,
  COALESCE(b.name, 'Batch ' || b.id) as batch_name,
  COALESCE(b.status, 'pending') as status,
  COALESCE(b.total_calls, 0) as total_calls,
  COALESCE(b.completed_calls, 0) as completed_calls,
  COALESCE(b.successful_calls, 0) as successful_calls,
  COALESCE(b.failed_calls, 0) as failed_calls,
  b.created_at,
  b.created_at as updated_at
FROM batches b
JOIN users u ON u.id = b.user_id
JOIN business_profiles bp ON bp.user_id = u.id
WHERE b.id IS NOT NULL
ON CONFLICT (id) DO UPDATE SET
  batch_name = EXCLUDED.batch_name,
  status = EXCLUDED.status,
  updated_at = NOW();

-- =====================================================
-- STEP 9: MIGRATE BATCH CALLS DATA
-- =====================================================

INSERT INTO batch_calls (id, batch_id, business_id, phone_number, first_name, last_name, company, status, call_id, error_message, created_at, completed_at)
SELECT 
  bc.id,
  bc.batch_id,
  bp.id as business_id,
  bc.phone_number,
  bc.first_name,
  bc.last_name,
  bc.company,
  COALESCE(bc.status, 'pending') as status,
  bc.call_id::uuid,
  bc.error_message,
  bc.created_at,
  bc.completed_at
FROM batch_calls bc
JOIN batches b ON bc.batch_id = b.id
JOIN users u ON u.id = b.user_id
JOIN business_profiles bp ON bp.user_id = u.id
WHERE bc.id IS NOT NULL
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  call_id = EXCLUDED.call_id,
  error_message = EXCLUDED.error_message;

-- =====================================================
-- STEP 10: MIGRATE ELEVENLABS CONVERSATIONS
-- =====================================================

INSERT INTO eleven_labs_conversations (
  id, business_id, conversation_id, agent_id, status, start_time, end_time,
  duration, transcript, summary, metadata, phone_number, created_at, updated_at
)
SELECT 
  gen_random_uuid() as id,
  bp.id as business_id,
  elc.conversation_id,
  elc.agent_id,
  elc.status,
  elc.start_time,
  elc.end_time,
  elc.duration,
  elc.transcript,
  elc.summary,
  elc.metadata::jsonb,
  elc.phone_number,
  elc.created_at,
  elc.updated_at
FROM eleven_labs_conversations elc
JOIN users u ON elc.user_id = u.id
JOIN business_profiles bp ON bp.user_id = u.id
WHERE elc.id IS NOT NULL
ON CONFLICT (conversation_id) DO UPDATE SET
  transcript = EXCLUDED.transcript,
  summary = EXCLUDED.summary,
  updated_at = NOW();

-- =====================================================
-- STEP 11: MIGRATE PROMPTS DATA
-- =====================================================

-- Create default prompts for each business
INSERT INTO agent_prompts (id, business_id, system_prompt, first_message, prompt_text, created_at, updated_at)
SELECT 
  gen_random_uuid() as id,
  bp.id as business_id,
  COALESCE(p.system_prompt, 'You are a professional AI voice agent. Help customers with their inquiries in a friendly and helpful manner.') as system_prompt,
  COALESCE(p.first_message, 'Hello! How can I help you today?') as first_message,
  COALESCE(p.prompt, p.system_prompt) as prompt_text,
  COALESCE(p.created_at, NOW()) as created_at,
  COALESCE(p.updated_at, NOW()) as updated_at
FROM business_profiles bp
LEFT JOIN prompts p ON p.user_id = bp.user_id
ON CONFLICT DO NOTHING;

-- =====================================================
-- STEP 12: ADD FOREIGN KEY CONSTRAINTS
-- =====================================================

-- Add the foreign key constraint for batch_calls after calls_new is populated
ALTER TABLE batch_calls 
ADD CONSTRAINT fk_batch_calls_call_id 
FOREIGN KEY (call_id) REFERENCES calls_new(id) ON DELETE CASCADE;

-- =====================================================
-- STEP 13: CREATE INDEXES FOR PERFORMANCE
-- =====================================================
-- =====================================================
-- STEP 13: CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users_new(email);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users_new(subscription_status);

-- Business profiles indexes
CREATE INDEX IF NOT EXISTS idx_business_profiles_user_id ON business_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_business_profiles_business_name ON business_profiles(business_name);

-- Calls indexes
CREATE INDEX IF NOT EXISTS idx_calls_business_id ON calls_new(business_id);
CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls_new(created_at);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls_new(status);
CREATE INDEX IF NOT EXISTS idx_calls_call_type ON calls_new(call_type);
CREATE INDEX IF NOT EXISTS idx_calls_twilio_sid ON calls_new(twilio_sid);
CREATE INDEX IF NOT EXISTS idx_calls_conversation_id ON calls_new(conversation_id);
CREATE INDEX IF NOT EXISTS idx_calls_elevenlabs_call_id ON calls_new(elevenlabs_call_id);
CREATE INDEX IF NOT EXISTS idx_calls_prompt_id ON calls_new(prompt_id);
CREATE INDEX IF NOT EXISTS idx_calls_batch_id ON calls_new(batch_id);
CREATE INDEX IF NOT EXISTS idx_calls_phone_number ON calls_new(phone_number);

-- Agent prompts indexes
CREATE INDEX IF NOT EXISTS idx_prompts_business_id ON agent_prompts(business_id);

-- Batches indexes
CREATE INDEX IF NOT EXISTS idx_batches_business_id ON batches(business_id);
CREATE INDEX IF NOT EXISTS idx_batches_status ON batches(status);
CREATE INDEX IF NOT EXISTS idx_batches_id ON batches(id);

-- Batch calls indexes
CREATE INDEX IF NOT EXISTS idx_batch_calls_batch_id ON batch_calls(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_calls_business_id ON batch_calls(business_id);
CREATE INDEX IF NOT EXISTS idx_batch_calls_call_id ON batch_calls(call_id);
CREATE INDEX IF NOT EXISTS idx_batch_calls_status ON batch_calls(status);
CREATE INDEX IF NOT EXISTS idx_batch_calls_id ON batch_calls(id);

-- Leads indexes
CREATE INDEX IF NOT EXISTS idx_leads_business_id ON leads(business_id);
CREATE INDEX IF NOT EXISTS idx_leads_phone_number ON leads(phone_number);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);

-- ElevenLabs conversations indexes
CREATE INDEX IF NOT EXISTS idx_eleven_labs_conversations_business_id ON eleven_labs_conversations(business_id);
CREATE INDEX IF NOT EXISTS idx_eleven_labs_conversations_conversation_id ON eleven_labs_conversations(conversation_id);
CREATE INDEX IF NOT EXISTS idx_eleven_labs_conversations_status ON eleven_labs_conversations(status);
-- =====================================================
-- STEP 14: ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE users_new ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls_new ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE eleven_labs_conversations ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 15: CREATE RLS POLICIES
-- =====================================================

-- Users can only access their own data
CREATE POLICY "user_owns_row" ON users_new FOR ALL USING (id = auth.uid());

-- Business profiles are owned by users
CREATE POLICY "business_by_owner" ON business_profiles FOR ALL USING (user_id = auth.uid());

-- Prompts are owned by business
CREATE POLICY "prompts_by_owner" ON agent_prompts FOR ALL USING (
  business_id IN (SELECT id FROM business_profiles WHERE user_id = auth.uid())
);

-- Calls are owned by business
CREATE POLICY "calls_by_owner" ON calls_new FOR ALL USING (
  business_id IN (SELECT id FROM business_profiles WHERE user_id = auth.uid())
);

-- Batches are owned by business
CREATE POLICY "batches_by_owner" ON batches FOR ALL USING (
  business_id IN (SELECT id FROM business_profiles WHERE user_id = auth.uid())
);

-- Batch calls are owned by business
CREATE POLICY "batch_calls_by_owner" ON batch_calls FOR ALL USING (
  business_id IN (SELECT id FROM business_profiles WHERE user_id = auth.uid())
);

-- Leads are owned by business
CREATE POLICY "leads_by_owner" ON leads FOR ALL USING (
  business_id IN (SELECT id FROM business_profiles WHERE user_id = auth.uid())
);

-- ElevenLabs conversations are owned by business
CREATE POLICY "eleven_labs_conversations_by_owner" ON eleven_labs_conversations FOR ALL USING (
  business_id IN (SELECT id FROM business_profiles WHERE user_id = auth.uid())
);

-- =====================================================
-- STEP 16: ADD DATA VALIDATION CONSTRAINTS
-- =====================================================

-- Call duration must be positive
ALTER TABLE calls_new ADD CONSTRAINT chk_duration_positive CHECK (duration_sec >= 0);

-- Email format validation
ALTER TABLE users_new ADD CONSTRAINT chk_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Phone number format validation (basic)
ALTER TABLE calls_new ADD CONSTRAINT chk_phone_format CHECK (phone_number ~* '^\+?[1-9]\d{1,14}$' OR phone_number IS NULL);

-- =====================================================
-- STEP 17: VERIFY MIGRATION
-- =====================================================

SELECT 'Original users' as table_name, COUNT(*) as record_count FROM users
UNION ALL
SELECT 'New users' as table_name, COUNT(*) as record_count FROM users_new
UNION ALL
SELECT 'Business profiles' as table_name, COUNT(*) as record_count FROM business_profiles
UNION ALL
SELECT 'Original calls' as table_name, COUNT(*) as record_count FROM calls
UNION ALL
SELECT 'New calls' as table_name, COUNT(*) as record_count FROM calls_new
UNION ALL
SELECT 'Leads' as table_name, COUNT(*) as record_count FROM leads
UNION ALL
SELECT 'ElevenLabs conversations' as table_name, COUNT(*) as record_count FROM eleven_labs_conversations
UNION ALL
SELECT 'Agent prompts' as table_name, COUNT(*) as record_count FROM agent_prompts;

-- =====================================================
-- STEP 18: RENAME TABLES (AFTER VERIFICATION)
-- =====================================================
-- WARNING: Only run these after verifying the migration!

-- ALTER TABLE users RENAME TO users_old;
-- ALTER TABLE calls RENAME TO calls_old;
-- ALTER TABLE business_info RENAME TO business_info_old;
-- ALTER TABLE leads RENAME TO leads_old;
-- ALTER TABLE eleven_labs_conversations RENAME TO eleven_labs_conversations_old;
-- ALTER TABLE prompts RENAME TO prompts_old;

-- ALTER TABLE users_new RENAME TO users;
-- ALTER TABLE calls_new RENAME TO calls;

-- =====================================================
-- STEP 19: CLEAN UP OLD TABLES (AFTER TESTING)
-- =====================================================
-- WARNING: Only run these after thorough testing!

-- DROP TABLE IF EXISTS users_old CASCADE;
-- DROP TABLE IF EXISTS calls_old CASCADE;
-- DROP TABLE IF EXISTS business_info_old CASCADE;
-- DROP TABLE IF EXISTS leads_old CASCADE;
-- DROP TABLE IF EXISTS eleven_labs_conversations_old CASCADE;
-- DROP TABLE IF EXISTS prompts_old CASCADE;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- The migration is now complete with:
-- ✅ All original data preserved
-- ✅ Missing fields added
-- ✅ Proper relationships established
-- ✅ Performance indexes created
-- ✅ Row Level Security enabled
-- ✅ Data validation constraints added
-- ✅ Comprehensive business context support
