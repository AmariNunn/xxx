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

// Parse duration filters from user query (e.g., "over 5 minutes", "under 2 minutes")
function parseDurationFilter(query: string): { operator: 'over' | 'under' | null, seconds: number | null } {
  const queryLower = query.toLowerCase();
  
  // Match patterns like "over 5 minutes", "under 3 minutes", "longer than 2 minutes", "more than 5 min"
  const overPattern = /(?:over|more than|longer than|greater than|exceeding|above)\s*(\d+)\s*(?:minutes?|mins?|m\b)/i;
  const underPattern = /(?:under|less than|shorter than|below|within)\s*(\d+)\s*(?:minutes?|mins?|m\b)/i;
  
  const overMatch = queryLower.match(overPattern);
  if (overMatch) {
    const minutes = parseInt(overMatch[1], 10);
    console.log(`⏱️ Detected duration filter: over ${minutes} minutes (${minutes * 60} seconds)`);
    return { operator: 'over', seconds: minutes * 60 };
  }
  
  const underMatch = queryLower.match(underPattern);
  if (underMatch) {
    const minutes = parseInt(underMatch[1], 10);
    console.log(`⏱️ Detected duration filter: under ${minutes} minutes (${minutes * 60} seconds)`);
    return { operator: 'under', seconds: minutes * 60 };
  }
  
  return { operator: null, seconds: null };
}

// Apply duration filter to calls based on parsed query
function filterByDuration(calls: any[], query: string): { filteredCalls: any[], filterApplied: string | null } {
  const { operator, seconds } = parseDurationFilter(query);
  
  if (!operator || seconds === null) {
    return { filteredCalls: calls, filterApplied: null };
  }
  
  const filtered = calls.filter(call => {
    if (!call.duration) return false;
    if (operator === 'over') return call.duration > seconds;
    if (operator === 'under') return call.duration < seconds;
    return true;
  });
  
  const filterDesc = `${operator} ${seconds / 60} minutes`;
  console.log(`✅ Duration filter applied: ${filtered.length} of ${calls.length} calls are ${filterDesc}`);
  
  return { filteredCalls: filtered, filterApplied: filterDesc };
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
  
  // Step 0.5: Apply duration filter if user asked for calls over/under X minutes
  const { filteredCalls: durationFilteredCalls, filterApplied: durationFilter } = filterByDuration(qualityCalls, userQuestion);
  
  // Step 1: Pre-filter remaining calls by keywords to prioritize relevant ones
  const { priorityCalls, allCalls } = preFilterCallsByKeywords(durationFilteredCalls, userQuestion);
  
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

  // Build context about what filtering was already applied
  const filterContext = durationFilter 
    ? `\nNOTE: A duration filter was already applied - these ${callSummary.length} calls are ALREADY filtered to only include calls ${durationFilter}. Do not re-filter or second-guess this.`
    : '';

  // Get current date/time in UTC for the AI to understand "today", "yesterday", etc.
  const now = new Date();
  const currentDateTime = now.toLocaleString('en-US', { 
    weekday: 'long',
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC'
  }) + ' UTC';

  const systemPrompt = `You are a helpful call analytics assistant for SkyIQ. Help users understand their phone call data by finding calls, summarizing insights, and answering questions.

CURRENT DATE & TIME: ${currentDateTime}
Use this to understand relative time references like "today", "yesterday", "this week", "last 24 hours", etc.

ABSOLUTE RULES - YOU MUST FOLLOW THESE:
1. NEVER HALLUCINATE OR MAKE UP DATA - Only use information from the call data provided below
2. NEVER GUESS - If the data doesn't clearly answer the question, say so honestly
3. ASK FOR CLARIFICATION - If a question is ambiguous, ask the user to clarify instead of guessing
4. ONLY REPORT WHAT YOU SEE - If there are no matching calls, say "I didn't find any calls matching that criteria"
5. BE ACCURATE - Double-check numbers, counts, and durations before stating them
${filterContext}

CALL DATA (${callData.length} total calls, showing ${callSummary.length}):
${JSON.stringify(callSummary)}

UNDERSTANDING CALL STATUS vs OUTCOME:
- "completed" status ONLY means the call connected - NOT that it was successful
- Determine success from SUMMARY content: look for "agreed", "donated", "scheduled", "booked", "resolved", "confirmed", "signed up"
- Negative outcomes include: "declined", "refused", "not interested", "hung up", "voicemail"

DURATION RULES:
- Duration is in SECONDS: 5 minutes = 300 seconds, 3 minutes = 180 seconds
- Convert accurately: 143 seconds = 2 minutes 23 seconds

WRITING STYLE:
- Natural, conversational sentences - no bullets, pipes, brackets, or symbols
- Phone numbers included naturally when helpful
- Dates as "November 21st at 4:29 PM", durations as "2 minutes"
- IDs only go in matchingCallIds array, never in your text

IF NO CALLS MATCH THE CRITERIA:
- Simply say "I didn't find any calls matching that criteria" or "No calls matched your search"
- Do NOT say "I don't have enough information" - that phrase is confusing
- Only ask for clarification if the question itself is unclear, NOT when there are zero results

RESPOND WITH ONLY THIS JSON:
{"analysis": "Your honest, data-based response...", "matchingCallIds": [123, 456]}

Include ALL relevant call IDs in matchingCallIds. If none match: {"analysis": "Your response...", "matchingCallIds": []}`;

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
