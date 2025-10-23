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

  // Normalize to E.164 (US default here)
  const callerNumber = rawCaller ? toE164US(rawCaller) : null;
  const calledNumber = rawCalled ? toE164US(rawCalled) : null;

  // Guarantee `phone_number` (fallback to called if caller is missing)
  const canonicalPhone = callerNumber || calledNumber;

  return { callerNumber, calledNumber, canonicalPhone };
}

export async function resolveUserIdForCall(callType: string, callerNumber: string | null, calledNumber: string | null) {
  let userId: string | null = null;

  // Generate candidate numbers for both caller and called numbers
  const callerCandidates = callerNumber ? candidateNumbers(callerNumber) : [];
  const calledCandidates = calledNumber ? candidateNumbers(calledNumber) : [];
  
  // Combine all candidates to check against Twilio numbers
  const allCandidates = [...callerCandidates, ...calledCandidates];
  
  if (allCandidates.length > 0) {
    // Look up user by matching either caller or called number against business_info.twilio_phone_number
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
      userId = twilioMatch.user_id;
    }
    
    // If no Twilio match, try ElevenLabs phone number
    if (!userId) {
      const { data: elevenLabsMatch, error: elevenLabsError } = await supabase
        .from('business_info')
        .select('user_id, elevenlabs_phone_number_id')
        .in('elevenlabs_phone_number_id', allCandidates)
        .maybeSingle();
      
      if (elevenLabsError) {
        console.error('Error looking up ElevenLabs number in business_info:', elevenLabsError);
      }
      
      if (elevenLabsMatch?.user_id) {
        console.log(`✅ Matched ElevenLabs number ${elevenLabsMatch.elevenlabs_phone_number_id} to user ${elevenLabsMatch.user_id}`);
        userId = elevenLabsMatch.user_id;
      }
    }
  }

  // Fallback: use default user if no Twilio number match found
  if (!userId) {
    console.warn('⚠️ No Twilio or ElevenLabs number match found, using fallback user');
    const { data: firstUser } = await supabase
      .from('users')
      .select('id')
      .limit(1)
      .single();
    userId = firstUser?.id || null;
  }

  return userId;
}
