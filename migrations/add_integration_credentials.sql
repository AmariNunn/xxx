-- Add ElevenLabs and Cal.com integration credentials to business_info table
ALTER TABLE business_info
ADD COLUMN IF NOT EXISTS elevenlabs_api_key TEXT,
ADD COLUMN IF NOT EXISTS elevenlabs_agent_id TEXT,
ADD COLUMN IF NOT EXISTS elevenlabs_phone_number_id TEXT,
ADD COLUMN IF NOT EXISTS cal_api_key TEXT,
ADD COLUMN IF NOT EXISTS cal_event_type_id TEXT,
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Chicago';

-- Add comment to document the purpose
COMMENT ON COLUMN business_info.elevenlabs_api_key IS 'User-specific ElevenLabs API key for voice AI calls';
COMMENT ON COLUMN business_info.elevenlabs_agent_id IS 'User-specific ElevenLabs agent ID';
COMMENT ON COLUMN business_info.elevenlabs_phone_number_id IS 'User-specific ElevenLabs phone number ID for outbound calls';
COMMENT ON COLUMN business_info.cal_api_key IS 'User-specific Cal.com API key for meeting bookings';
COMMENT ON COLUMN business_info.cal_event_type_id IS 'User-specific Cal.com event type ID for bookings';
COMMENT ON COLUMN business_info.timezone IS 'User timezone for scheduling (default: America/Chicago)';
