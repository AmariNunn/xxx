import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Phone normalization helpers (US-centric; extend as needed)
function onlyDigits(input?: string): string {
    return (input || '').replace(/\D+/g, '');
}

function toE164US(input?: string): string | null {
    const digits = onlyDigits(input);
    if (!digits) return null;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length > 1 && input?.startsWith('+')) return input as string;
    return null;
}

function candidateNumbers(input?: string): string[] {
    const raw = input || '';
    const digits = onlyDigits(raw);
    const e164 = toE164US(raw);
    const last10 = digits.length >= 10 ? digits.slice(-10) : digits;
    const candidates = new Set<string>();
    if (raw) candidates.add(raw);
    if (e164) candidates.add(e164);
    if (last10) candidates.add(`+1${last10}`);
    if (digits) candidates.add(digits);
    return Array.from(candidates).filter(Boolean);
}

export function normalizeAndResolveNumbers(webhookData: any) {
  // Extract raw numbers from all possible locations
  const rawCaller =
    webhookData.data.conversation_initiation_client_data?.dynamic_variables?.system__caller_id ||
    webhookData.data.phone_call?.external_number ||
    webhookData.data.from_number ||
    webhookData.data.caller_id ||
    null;

  const rawCalled =
    webhookData.data.conversation_initiation_client_data?.dynamic_variables?.system__called_number ||
    webhookData.data.phone_call?.agent_number ||
    webhookData.data.to_number ||
    webhookData.data.called_number ||
    null;

  // Extract ElevenLabs phone_number_id (e.g., phnum_xxx)
  const phoneNumberId = webhookData.data.phone_call?.phone_number_id || 
                        webhookData.data.metadata?.phone_call?.phone_number_id ||
                        null;

  // Normalize to E.164 (US default here)
  const callerNumber = rawCaller ? toE164US(rawCaller) : null;
  const calledNumber = rawCalled ? toE164US(rawCalled) : null;

  // Guarantee `phone_number` (fallback to called if caller is missing)
  const canonicalPhone = callerNumber || calledNumber;

  return { callerNumber, calledNumber, canonicalPhone, phoneNumberId };
}

export async function resolveUserIdForCall(callType: string, callerNumber: string | null, calledNumber: string | null, phoneNumberId: string | null = null, agentId: string | null = null) {
  let userId: string | null = null;

  // PRIORITY 1: Try ElevenLabs agent_id first (most reliable)
  if (agentId) {
    console.log(`🔍 Looking up user with agent_id: ${agentId}`);
    const { data: agentMatch, error: agentError } = await supabase
      .from('business_info')
      .select('user_id, elevenlabs_agent_id')
      .eq('elevenlabs_agent_id', agentId)
      .maybeSingle();
    
    if (agentError) {
      console.error('Error looking up ElevenLabs agent_id in business_info:', agentError);
    }
    
    if (agentMatch?.user_id) {
      console.log(`✅ Matched ElevenLabs agent_id ${agentId} to user ${agentMatch.user_id}`);
      return agentMatch.user_id;
    } else {
      console.warn(`⚠️ No user found for ElevenLabs agent_id: ${agentId}`);
    }
  }

  // PRIORITY 2: Try ElevenLabs phone_number_id (fallback)
  if (phoneNumberId) {
    const { data: phoneIdMatch, error: phoneIdError } = await supabase
      .from('business_info')
      .select('user_id, elevenlabs_phone_number_id')
      .eq('elevenlabs_phone_number_id', phoneNumberId)
      .maybeSingle();
    
    if (phoneIdError) {
      console.error('Error looking up ElevenLabs phone_number_id in business_info:', phoneIdError);
    }
    
    if (phoneIdMatch?.user_id) {
      console.log(`✅ Matched ElevenLabs phone_number_id ${phoneNumberId} to user ${phoneIdMatch.user_id}`);
      return phoneIdMatch.user_id;
    } else {
      console.warn(`⚠️ No user found for ElevenLabs phone_number_id: ${phoneNumberId}`);
    }
  }

  // PRIORITY 3: Try E.164 phone number matching
  // Generate candidate numbers for both caller and called numbers
  const callerCandidates = callerNumber ? candidateNumbers(callerNumber) : [];
  const calledCandidates = calledNumber ? candidateNumbers(calledNumber) : [];
  
  // Combine all candidates to check against phone numbers
  const allCandidates = [...callerCandidates, ...calledCandidates];
  
  if (allCandidates.length > 0) {
    // Try Twilio number match
    const { data: twilioMatch, error: twilioError } = await supabase
      .from('business_info')
      .select('user_id, twilio_phone_number')
      .in('twilio_phone_number', allCandidates)
      .maybeSingle();
    
    if (twilioError) {
      console.error('Error looking up Twilio number in business_info:', twilioError);
    }
    
    if (twilioMatch?.user_id) {
      console.log(`✅ Matched Twilio number ${twilioMatch.twilio_phone_number} to user ${twilioMatch.user_id}`);
      return twilioMatch.user_id;
    }
  }

  // Final fallback: use default user if no match found
  console.warn('⚠️ No ElevenLabs phone_number_id or Twilio number match found, using fallback user');
  const { data: firstUser } = await supabase
    .from('users')
    .select('id')
    .limit(1)
    .single();
  userId = firstUser?.id || null;

  return userId;
}
