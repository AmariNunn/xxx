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

  const systemPrompt = `You analyze call center data and identify matching calls. Total calls: ${callData.length}. Here are up to 50 calls with their IDs:

${JSON.stringify(callSummary)}

IMPORTANT: You MUST respond with valid JSON in this exact format:
{
  "analysis": "Your detailed analysis here answering the user's question",
  "matchingCallIds": [1, 2, 3]
}

The "matchingCallIds" array should contain the numeric IDs of calls that are relevant to the user's question. If the question is about specific calls (e.g., "calls mentioning church", "missed calls", "long calls"), include only those call IDs. If it's a general question about all calls, include all IDs from the data.

Always respond with valid JSON only. No text before or after the JSON.`;

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
