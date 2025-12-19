const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CloudflareAIResponse {
  result: {
    response: string;
  };
  success: boolean;
  errors: any[];
  messages: any[];
}

export interface AnalysisResult {
  response: string;
  matchingCallIds: number[];
}

export async function chatWithCloudflareAI(
  messages: ChatMessage[],
  model: string = '@cf/meta/llama-3.1-8b-instruct'
): Promise<string> {
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
    throw new Error('Cloudflare credentials not configured');
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${model}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloudflare AI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as CloudflareAIResponse;
  
  if (!data.success) {
    throw new Error(`Cloudflare AI error: ${JSON.stringify(data.errors)}`);
  }

  return data.result.response;
}

export async function analyzeCallData(
  userQuestion: string,
  callData: any[]
): Promise<AnalysisResult> {
  // Limit to 50 calls with shorter content to fit within 8k context window
  const callSummary = callData.slice(0, 50).map(call => ({
    id: call.id,
    phone: call.phone_number || call.caller_number,
    status: call.status,
    duration: call.duration,
    summary: call.summary?.substring(0, 150),
    timestamp: call.timestamp,
  }));

  const systemPrompt = `You are a professional call analytics assistant. Be CONCISE, ACCURATE, and WELL-FORMATTED.

CALL DATA (${callData.length} total calls, showing up to 50):
${JSON.stringify(callSummary)}

CRITICAL CALCULATION RULES:
- Duration is in SECONDS: 5 minutes = 300 seconds, 3 minutes = 180 seconds
- A call of 143 seconds = 2m 23s (NOT over 5 minutes)
- A call of 301 seconds = 5m 1s (IS over 5 minutes)
- ONLY include calls that ACTUALLY match the criteria

FORMATTING RULES:
- Phone: "(615) 930-3419" not "+16159303419"
- Date: "Nov 21, 4:29 PM" not ISO timestamps
- Be CONCISE - bullet points only

RESPONSE FORMAT:
"Found X calls [matching criteria]:

• (phone) | Date | Duration
  One-line summary"

If ZERO calls match: "No calls found matching this criteria."

CRITICAL - matchingCallIds MUST ONLY contain IDs of calls that match:
- For "calls over 5 minutes": ONLY IDs where duration > 300
- For "missed calls": ONLY IDs where status = 'missed'
- For "calls mentioning X": ONLY IDs where summary contains X
- DO NOT include all IDs. FILTER strictly.

JSON OUTPUT (valid JSON only, no extra text):
{
  "analysis": "Your formatted response",
  "matchingCallIds": [only IDs that match the criteria]
}`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userQuestion },
  ];

  const rawResponse = await chatWithCloudflareAI(messages);
  
  console.log('🤖 Raw AI response (first 500 chars):', rawResponse.substring(0, 500));
  
  // Parse the JSON response
  try {
    // Try to extract JSON from the response (in case there's extra text)
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const matchingIds = Array.isArray(parsed.matchingCallIds) ? parsed.matchingCallIds : [];
      console.log(`✅ Parsed ${matchingIds.length} matching call IDs from AI response`);
      return {
        response: parsed.analysis || rawResponse,
        matchingCallIds: matchingIds
      };
    }
  } catch (e) {
    console.log('❌ Failed to parse AI response as JSON:', e);
  }
  
  // Fallback: return empty array if parsing fails (don't include all calls)
  console.log('⚠️ JSON parsing failed, returning empty matchingCallIds');
  return {
    response: rawResponse,
    matchingCallIds: []
  };
}
