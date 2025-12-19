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
): Promise<string> {
  // Limit to 15 calls with shorter content to fit within 8k context window
  const callSummary = callData.slice(0, 15).map(call => ({
    phone: call.phone_number || call.caller_number,
    status: call.status,
    duration: call.duration,
    summary: call.summary?.substring(0, 100),
    timestamp: call.timestamp,
  }));

  const systemPrompt = `You analyze call center data. Total calls: ${callData.length}. Sample of 15 calls:

${JSON.stringify(callSummary)}

Answer based on this data. Be specific with counts and examples.`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userQuestion },
  ];

  return chatWithCloudflareAI(messages);
}
