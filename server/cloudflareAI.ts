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

// Extract call IDs from [ID:xxx] markers in the response text
function extractCallIdsFromMarkers(responseText: string, validIds: Set<number>): number[] {
  const matchedIds: number[] = [];
  
  // Match [ID:xxx] patterns where xxx is a number
  const idPattern = /\[ID:(\d+)\]/g;
  let match;
  
  while ((match = idPattern.exec(responseText)) !== null) {
    const id = parseInt(match[1], 10);
    // Only include IDs that exist in the original call data
    if (validIds.has(id)) {
      matchedIds.push(id);
    }
  }
  
  // Remove duplicates while preserving order
  return Array.from(new Set(matchedIds));
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

  // Create a set of valid IDs for validation
  const validIds = new Set(callSummary.map(c => c.id));

  const systemPrompt = `You are a call analytics assistant. Analyze call data and respond in STRICT JSON format.

CALL DATA (${callData.length} total calls, showing up to 50):
${JSON.stringify(callSummary)}

CALCULATION RULES:
- Duration is in SECONDS: 5 minutes = 300 seconds, 3 minutes = 180 seconds
- A call of 143 seconds = 2m 23s (NOT over 5 minutes)
- A call of 301 seconds = 5m 1s (IS over 5 minutes)

CRITICAL FORMATTING for the analysis field:
- For each matching call, include [ID:X] marker where X is the call's id field
- Phone: "(615) 930-3419" not "+16159303419"  
- Date: "Nov 21, 4:29 PM" not ISO timestamps
- Duration: "75s" or "2m 23s"

Example analysis format:
"Found 2 calls mentioning donations:

• [ID:847] (615) 930-3419 | Nov 21, 4:29 PM | 2m 23s
  Customer agreed to donate to the campaign.

• [ID:862] (336) 340-3670 | Nov 18, 6:44 PM | 75s
  Stephany asked for donation, customer declined."

YOU MUST RESPOND WITH ONLY THIS JSON FORMAT - NO OTHER TEXT:
{"analysis": "Found X calls...", "matchingCallIds": [847, 862]}

The matchingCallIds array must contain the EXACT id values (integers) from the call data for ALL calls that match the query. If no calls match: {"analysis": "No calls found matching this criteria.", "matchingCallIds": []}`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Respond ONLY with valid JSON. Question: ${userQuestion}` },
  ];

  const rawResponse = await chatWithCloudflareAI(messages);
  
  console.log('🤖 Raw AI response (first 500 chars):', rawResponse.substring(0, 500));
  
  // Parse the JSON response
  let matchingIds: number[] = [];
  let analysisText = rawResponse;
  
  try {
    // Try to extract JSON from the response (in case there's extra text)
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      // Validate that all IDs exist in original data
      const parsedIds = Array.isArray(parsed.matchingCallIds) ? parsed.matchingCallIds : [];
      matchingIds = parsedIds.filter((id: number) => validIds.has(id));
      analysisText = parsed.analysis || rawResponse;
      console.log(`✅ Parsed ${matchingIds.length} valid matching call IDs from JSON (${parsedIds.length} total in response)`);
    }
  } catch (e) {
    console.log('❌ Failed to parse AI response as JSON:', e);
  }
  
  // Fallback: If JSON parsing failed or returned empty, try to extract IDs from [ID:xxx] markers
  if (matchingIds.length === 0) {
    console.log('🔄 Attempting fallback: extracting call IDs from [ID:xxx] markers...');
    matchingIds = extractCallIdsFromMarkers(rawResponse, validIds);
    console.log(`📍 Fallback extracted ${matchingIds.length} valid matching call IDs from markers`);
  }
  
  return {
    response: analysisText,
    matchingCallIds: matchingIds
  };
}
