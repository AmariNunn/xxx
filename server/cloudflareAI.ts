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

// Sanitize AI analysis text to remove unwanted symbols and formatting
function sanitizeAnalysisText(text: string): string {
  return text
    .replace(/\[ID:\d+\]/g, '')           // Remove [ID:xxx] markers
    .replace(/•/g, '')                     // Remove bullet points
    .replace(/\|/g, ',')                   // Replace pipes with commas
    .replace(/\s+,/g, ',')                 // Clean up spacing around commas
    .replace(/,\s*,/g, ',')                // Remove double commas
    .replace(/\n{3,}/g, '\n\n')            // Collapse multiple newlines
    .replace(/^\s+|\s+$/g, '')             // Trim whitespace
    .replace(/\s{2,}/g, ' ')               // Collapse multiple spaces
    .trim();
}

// Filter out low-quality calls (short duration or missing transcripts) unless user specifically asks for them
function filterQualityCalls(calls: any[], userQuery: string): any[] {
  const queryLower = userQuery.toLowerCase();
  
  // Check if user is specifically asking for short calls, all calls, or failed calls
  const wantsAllCalls = 
    queryLower.includes('all calls') ||
    queryLower.includes('every call') ||
    queryLower.includes('short calls') ||
    queryLower.includes('brief calls') ||
    queryLower.includes('failed') ||
    queryLower.includes('missed') ||
    queryLower.includes('no transcript') ||
    queryLower.includes('under 3') ||
    queryLower.includes('less than 3');
  
  if (wantsAllCalls) {
    console.log('📋 User requested all calls - skipping quality filter');
    return calls;
  }
  
  // Filter out calls that are too short or have no meaningful transcript
  const qualityCalls = calls.filter(call => {
    // Must have duration > 3 seconds
    const hasSufficientDuration = call.duration && call.duration > 3;
    
    // Must have a transcript with actual content
    const hasTranscript = call.transcript && 
      call.transcript.trim().length > 10 && 
      !call.transcript.includes('No transcript');
    
    // Must have a meaningful summary (not auto-generated failure message)
    const hasMeaningfulSummary = call.summary && 
      !call.summary.includes("couldn't be generated") &&
      !call.summary.includes("Summary not available");
    
    return hasSufficientDuration && (hasTranscript || hasMeaningfulSummary);
  });
  
  console.log(`🔍 Quality filter: ${calls.length} total → ${qualityCalls.length} meaningful calls`);
  
  return qualityCalls;
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
  // Step 0: Filter out low-quality calls (short duration, no transcript) unless specifically requested
  const qualityCalls = filterQualityCalls(callData, userQuestion);
  
  // Step 1: Pre-filter remaining calls by keywords to prioritize relevant ones
  const { priorityCalls, allCalls } = preFilterCallsByKeywords(qualityCalls, userQuestion);
  
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

  const systemPrompt = `You are a helpful call analytics assistant for SkyIQ. Help users understand their phone call data by finding calls, summarizing insights, and answering questions.

CALL DATA (${callData.length} total calls, analyzing ${callSummary.length}${priorityCalls.length > 0 ? ` - ${priorityCalls.length} keyword matches prioritized` : ''}):
${JSON.stringify(callSummary)}

IMPORTANT - UNDERSTANDING CALL STATUS vs OUTCOME:
- "completed" status ONLY means the call connected and ended normally - NOT that it was successful
- "positive outcome" or "success" must be determined by the SUMMARY content, not status
- Look for these POSITIVE indicators in summaries: "agreed", "donated", "scheduled", "booked", "resolved", "confirmed", "signed up", "purchased", "converted", "interested", "will call back"
- Look for these NEGATIVE indicators: "declined", "refused", "not interested", "hung up", "voicemail", "no answer", "wrong number", "asked to be removed"
- A call is ONLY a positive outcome if the summary shows the customer agreed to something, made a purchase, scheduled an appointment, or expressed genuine interest

CALCULATION RULES:
- Duration is in SECONDS: 5 minutes = 300 seconds, 3 minutes = 180 seconds
- A call of 143 seconds = 2 minutes 23 seconds (NOT over 5 minutes)

CRITICAL WRITING STYLE - YOUR ANALYSIS MUST:
- Use natural, conversational sentences - write like you're talking to a colleague
- NEVER use bullets, pipes, brackets, or any special symbols
- NEVER include call IDs in your text - IDs only go in the matchingCallIds array
- Include phone numbers naturally in sentences when helpful
- Format dates as "November 21st at 4:29 PM" and durations as "2 minutes"
- Organize information in clear paragraphs, not lists

GOOD EXAMPLE for positive outcomes:
"I found 2 calls with positive outcomes. On November 21st, the customer at (615) 930-3419 agreed to donate to the campaign, which is a clear win. On November 18th, the caller at (336) 340-3670 scheduled a follow-up appointment for next week."

GOOD EXAMPLE for summarizing:
"Looking at your 5 longest calls, they averaged about 8 minutes and mostly dealt with customer support issues. Three of them were billing questions that got resolved, and two involved product returns. One customer specifically requested a callback about their refund status, so that might be worth following up on."

BAD EXAMPLE (DO NOT write like this):
"Found 2 calls:
• [ID:847] (615) 930-3419 | Nov 21, 4:29 PM | 2m 23s - Customer donated"

YOU MUST RESPOND WITH ONLY THIS JSON FORMAT - NO OTHER TEXT:
{"analysis": "Your natural language response here...", "matchingCallIds": [847, 862]}

The matchingCallIds array must contain the EXACT id values (integers) from the call data for ALL calls discussed. If no specific calls match: {"analysis": "Your response...", "matchingCallIds": []}`;

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
      analysisText = sanitizeAnalysisText(parsed.analysis || rawResponse);
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
