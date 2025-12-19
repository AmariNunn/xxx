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

CRITICAL RULES:
1. Duration is in SECONDS. 5 minutes = 300 seconds. Calculate accurately.
2. Format phone numbers cleanly (e.g., "(615) 930-3419" not "+16159303419")
3. Format dates as readable (e.g., "Nov 21, 2025 at 4:29 PM" not raw ISO strings)
4. Be CONCISE - use bullet points and clean formatting
5. If zero calls match criteria, say "No calls found matching this criteria"

RESPONSE FORMAT - Use clear sections:
- Start with a one-line summary count
- Use bullet points for each matching call
- Each bullet: Phone | Date | Duration | Brief summary (1 line max)

EXAMPLE of good format:
"Found 2 calls over 5 minutes:

• (615) 930-3419 | Nov 21, 4:29 PM | 7m 23s
  Donation request call - customer agreed to donate

• (336) 340-3670 | Nov 19, 2:21 AM | 6m 45s
  Service inquiry - scheduled follow-up appointment"

REQUIRED JSON OUTPUT:
{
  "analysis": "Your concise, formatted analysis",
  "matchingCallIds": [numeric IDs of matching calls only]
}

Include ONLY call IDs that match the user's specific criteria. Respond with valid JSON only.`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userQuestion },
  ];

  const rawResponse = await chatWithCloudflareAI(messages);
  
  // Parse the JSON response
  try {
    // Try to extract JSON from the response (in case there's extra text)
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        response: parsed.analysis || rawResponse,
        matchingCallIds: Array.isArray(parsed.matchingCallIds) ? parsed.matchingCallIds : []
      };
    }
  } catch (e) {
    console.log('Failed to parse AI response as JSON, returning as plain text');
  }
  
  // Fallback: return all call IDs if parsing fails
  return {
    response: rawResponse,
    matchingCallIds: callData.slice(0, 50).map(c => c.id)
  };
}
