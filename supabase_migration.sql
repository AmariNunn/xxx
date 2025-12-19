-- Supabase Migration Script
-- This script creates all the necessary tables for the VoxIntel application

-- Create service plan enum
CREATE TYPE service_plan_enum AS ENUM ('inbound', 'outbound', 'both');

-- Create call status enum
CREATE TYPE call_status_enum AS ENUM ('completed', 'missed', 'failed');

-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    business_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    website TEXT,
    service_plan service_plan_enum NOT NULL,
    verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create calls table
CREATE TABLE calls (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    contact_name TEXT,
    duration INTEGER, -- Duration in seconds
    status call_status_enum NOT NULL,
    notes TEXT,
    summary TEXT,
    transcript TEXT, -- Full conversation transcript
    twilio_call_sid TEXT, -- Twilio unique call identifier
    direction TEXT, -- inbound or outbound
    recording_url TEXT, -- URL to call recording if available
    is_from_twilio BOOLEAN DEFAULT false, -- Track if call came from Twilio webhook
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create leads table
CREATE TABLE leads (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    email TEXT,
    company TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create business_info table
CREATE TABLE business_info (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    business_name TEXT,
    business_email TEXT,
    business_phone TEXT,
    business_address TEXT,
    description TEXT,
    links TEXT[],
    scraped_content TEXT[],
    scraped_titles TEXT[],
    scraped_urls TEXT[],
    scraped_at TEXT[],
    file_urls TEXT[],
    file_names TEXT[],
    file_types TEXT[],
    file_sizes TEXT[],
    document_content TEXT[],
    document_titles TEXT[],
    document_extracted_at TEXT[],
    lead_urls TEXT[],
    lead_names TEXT[],
    lead_types TEXT[],
    lead_sizes TEXT[],
    logo_url TEXT,
    twilio_account_sid TEXT,
    twilio_auth_token TEXT,
    twilio_phone_number TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create eleven_labs_conversations table
CREATE TABLE eleven_labs_conversations (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    status TEXT NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    duration INTEGER,
    transcript TEXT,
    summary TEXT,
    metadata TEXT,
    phone_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_calls_user_id ON calls(user_id);
CREATE INDEX idx_calls_created_at ON calls(created_at);
CREATE INDEX idx_leads_user_id ON leads(user_id);
CREATE INDEX idx_business_info_user_id ON business_info(user_id);
CREATE INDEX idx_eleven_labs_conversations_user_id ON eleven_labs_conversations(user_id);

-- Enable Row Level Security (RLS) for better security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE eleven_labs_conversations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (adjust based on your authentication needs)
-- These are basic policies - you may need to customize them based on your auth setup

-- Users can only see their own data
CREATE POLICY "Users can view own data" ON users
    FOR ALL USING (auth.uid()::text = id::text);

-- Users can only see their own calls
CREATE POLICY "Users can view own calls" ON calls
    FOR ALL USING (auth.uid()::text = user_id::text);

-- Users can only see their own leads
CREATE POLICY "Users can view own leads" ON leads
    FOR ALL USING (auth.uid()::text = user_id::text);

-- Users can only see their own business info
CREATE POLICY "Users can view own business info" ON business_info
    FOR ALL USING (auth.uid()::text = user_id::text);

-- Users can only see their own conversations
CREATE POLICY "Users can view own conversations" ON eleven_labs_conversations
    FOR ALL USING (auth.uid()::text = user_id::text);

-- Note: You may need to adjust these policies based on your specific authentication setup
-- For now, these policies assume you're using Supabase Auth with UUID user IDs
