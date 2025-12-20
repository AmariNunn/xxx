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

// Pre-filter calls by searching for keywords in transcripts and summaries
export function preFilterCallsByKeywords(calls: any[], userQuery: string): { priorityCalls: any[], allCalls: any[] } {
  // Extract potential keywords from the user's query (words > 3 chars, not common words)
  const stopWords = new Set(['what', 'when', 'where', 'which', 'that', 'this', 'have', 'with', 'from', 'they', 'been', 'were', 'being', 'there', 'their', 'about', 'would', 'could', 'should', 'calls', 'call', 'find', 'show', 'list', 'give', 'tell', 'over', 'under', 'more', 'less', 'than', 'minutes', 'seconds', 'long', 'short', 'all', 'any', 'summarize', 'summary']);
  
  const keywords = userQuery
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word));
  
  if (keywords.length === 0) {
    return { priorityCalls: [], allCalls: calls };
  }
  
  console.log(`🔍 Pre-filtering with keywords: ${keywords.join(', ')}`);
  
  // Score each call based on keyword matches in transcript and summary
  const scoredCalls = calls.map(call => {
    let score = 0;
    const searchText = `${call.summary || ''} ${call.transcript || ''} ${call.notes || ''}`.toLowerCase();
    
    for (const keyword of keywords) {
      const matches = (searchText.match(new RegExp(keyword, 'gi')) || []).length;
      score += matches;
    }
    
    return { call, score };
  });
  
  // Get calls with matches as priority
  const priorityCalls = scoredCalls
    .filter(sc => sc.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(sc => sc.call);
  
  console.log(`✅ Pre-filter found ${priorityCalls.length} calls with keyword matches`);
  
  return { priorityCalls, allCalls: calls };
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
  // Step 1: Pre-filter calls by keywords to prioritize relevant ones
  const { priorityCalls, allCalls } = preFilterCallsByKeywords(callData, userQuestion);
  
  // Step 2: Build optimized call list - strict limits for 8k context window
  // ~80 calls with 200 char summaries ≈ 20-25k chars ≈ 5-6k tokens (safe margin)
  const maxCalls = 80;
  const summaryLength = 200;
  
  let callsToAnalyze: any[] = [];
  
  if (priorityCalls.length > 0) {
    // Cap priority calls to avoid overflow
    const cappedPriority = priorityCalls.slice(0, maxCalls);
    callsToAnalyze = [...cappedPriority];
    
    // Fill remaining slots with other calls (for context)
    const remainingSlots = maxCalls - cappedPriority.length;
    if (remainingSlots > 0) {
      const otherCalls = allCalls.filter(c => !cappedPriority.find(p => p.id === c.id));
      callsToAnalyze.push(...otherCalls.slice(0, remainingSlots));
    }
  } else {
    // No keyword matches - use all calls up to limit
    callsToAnalyze = allCalls.slice(0, maxCalls);
  }
  
  const callSummary = callsToAnalyze.map(call => ({
    id: call.id,
    phone: call.phone_number || call.caller_number,
    status: call.status,
    duration: call.duration,
    summary: call.summary?.substring(0, summaryLength) || 'No summary',
    timestamp: call.timestamp,
  }));

  // Create a set of valid IDs for validation
  const validIds = new Set(callSummary.map(c => c.id));

  const systemPrompt = `You are a helpful call analytics assistant for SkyIQ. Your job is to help users understand their phone call data by:
1. Finding specific calls based on criteria (topics, outcomes, duration, etc.)
2. Summarizing groups of calls with useful insights
3. Identifying patterns, callbacks needed, or action items
4. Answering ANY question about the call data helpfully and thoroughly

CALL DATA (${callData.length} total calls, analyzing ${callSummary.length}${priorityCalls.length > 0 ? ` - ${priorityCalls.length} keyword matches prioritized` : ''}):
${JSON.stringify(callSummary)}

CALCULATION RULES:
- Duration is in SECONDS: 5 minutes = 300 seconds, 3 minutes = 180 seconds
- A call of 143 seconds = 2m 23s (NOT over 5 minutes)
- A call of 301 seconds = 5m 1s (IS over 5 minutes)

RESPONSE GUIDELINES:
1. For FINDING/FILTERING calls: List each matching call with [ID:X] marker
2. For SUMMARIZING calls: Provide a thorough summary with key takeaways, trends, and actionable insights
3. For QUESTIONS: Answer helpfully and completely based on the call data
4. Always be specific - reference actual call details, phone numbers, and content

FORMATTING for the analysis field:
- Phone: "(615) 930-3419" not "+16159303419"  
- Date: "Nov 21, 4:29 PM" not ISO timestamps
- Duration: "75s" or "2m 23s"
- For each call mentioned, include [ID:X] marker where X is the call's id field

Example for filtering:
"Found 2 calls mentioning donations:

• [ID:847] (615) 930-3419 | Nov 21, 4:29 PM | 2m 23s
  Customer agreed to donate to the campaign.

• [ID:862] (336) 340-3670 | Nov 18, 6:44 PM | 75s
  Asked for donation, customer declined."

Example for summarizing:
"Summary of your 5 longest calls:

These calls averaged 8 minutes and covered customer support issues. Key themes:
- 3 calls about billing questions (all resolved)
- 2 calls about product returns
- Action needed: [ID:901] customer requested callback about refund status

Recommendation: Consider creating FAQ for billing to reduce call time."

YOU MUST RESPOND WITH ONLY THIS JSON FORMAT - NO OTHER TEXT:
{"analysis": "Your helpful response here...", "matchingCallIds": [847, 862]}

The matchingCallIds array must contain the EXACT id values (integers) from the call data for ALL calls that match or are relevant to the query. If no specific calls match: {"analysis": "Your response...", "matchingCallIds": []}`;

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
