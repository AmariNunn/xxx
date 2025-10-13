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

  if (callType === 'inbound' && calledNumber) {
    const toCandidates = candidateNumbers(calledNumber);
    if (toCandidates.length > 0) {
      const { data: userMatch } = await supabase
        .from('users')
        .select('id')
        .in('phone_number', toCandidates)
        .maybeSingle();
      userId = userMatch?.id || null;
    }
  }

  if (callType === 'outbound' && callerNumber) {
    const fromCandidates = candidateNumbers(callerNumber);
    if (fromCandidates.length > 0) {
      const { data: userMatch } = await supabase
        .from('users')
        .select('id')
        .in('phone_number', fromCandidates)
        .maybeSingle();
      userId = userMatch?.id || null;
    }
  }

  // If no user found, return null (don't fallback to arbitrary user)
  if (!userId) {
    console.warn(`⚠️ No user found for call: ${callType} - caller: ${callerNumber}, called: ${calledNumber}`);
  }

  return userId;
}
