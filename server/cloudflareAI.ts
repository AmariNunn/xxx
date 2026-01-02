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

  // Log the approximate size of the request for debugging
  const requestBody = JSON.stringify({ messages });
  const requestSizeKB = (requestBody.length / 1024).toFixed(1);
  console.log(`📤 Cloudflare AI request size: ${requestSizeKB} KB (~${Math.ceil(requestBody.length / 4)} tokens estimated)`);

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${model}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: requestBody,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Cloudflare AI HTTP error: ${response.status} - ${errorText}`);
    throw new Error(`Cloudflare AI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as CloudflareAIResponse;
  
  // Verbose logging to debug empty responses
  console.log(`📥 Cloudflare AI response - success: ${data.success}, has result: ${!!data.result}, errors: ${JSON.stringify(data.errors || [])}`);
  
  if (!data.success) {
    console.error(`❌ Cloudflare AI returned success=false:`, JSON.stringify(data));
    throw new Error(`Cloudflare AI error: ${JSON.stringify(data.errors)}`);
  }

  // Check for empty or missing response
  if (!data.result || !data.result.response) {
    console.error(`⚠️ Cloudflare AI returned empty response. Full data:`, JSON.stringify(data).substring(0, 500));
    return ''; // Return empty string to be handled by caller
  }

  const responseLength = data.result.response.length;
  console.log(`✅ Cloudflare AI response received: ${responseLength} chars`);

  return data.result.response;
}

// Sanitize AI analysis text to remove unwanted symbols and formatting
function sanitizeAnalysisText(text: string): string {
  // First, check if the text looks like raw JSON and extract analysis if so
  if (text.trim().startsWith('{') && text.includes('"analysis"')) {
    try {
      const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '');
      if (parsed.analysis) {
        text = parsed.analysis;
        console.log('🧹 sanitizeAnalysisText: Extracted analysis from JSON wrapper');
      }
    } catch (e) {
      // Not valid JSON, continue with regular sanitization
    }
  }
  
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

// Parse duration filters from user query (e.g., "over 5 minutes", "2 minutes or more")
function parseDurationFilter(query: string): { operator: 'over' | 'overInclusive' | 'under' | 'underInclusive' | null, seconds: number | null } {
  const queryLower = query.toLowerCase();
  
  // Pattern 1: Number comes AFTER comparator - "over 5 minutes", "more than 2 minutes"
  const overPattern = /(?:over|more than|longer than|greater than|exceeding|above)\s*(\d+)\s*(?:minutes?|mins?|m\b)/i;
  const underPattern = /(?:under|less than|shorter than|below|within)\s*(\d+)\s*(?:minutes?|mins?|m\b)/i;
  
  // Pattern 2: Number comes BEFORE comparator - "2 minutes or more", "5 minutes or longer"
  const overInclusivePattern = /(\d+)\s*(?:minutes?|mins?|m)\s*(?:or more|or longer|or greater|and up|\+)/i;
  const underInclusivePattern = /(\d+)\s*(?:minutes?|mins?|m)\s*(?:or less|or shorter|or fewer|and under)/i;
  
  // Pattern 3: "at least X minutes", "minimum X minutes" (inclusive)
  const atLeastPattern = /(?:at least|minimum|min of|no less than)\s*(\d+)\s*(?:minutes?|mins?|m\b)/i;
  
  // Pattern 4: "lasted X minutes" - treat as inclusive minimum
  const lastedPattern = /(?:lasted|lasting|duration of|were)\s*(\d+)\s*(?:minutes?|mins?|m\b)/i;
  
  // Check inclusive patterns first (they're more specific)
  const overInclusiveMatch = queryLower.match(overInclusivePattern);
  if (overInclusiveMatch) {
    const minutes = parseInt(overInclusiveMatch[1], 10);
    console.log(`⏱️ Detected duration filter: ${minutes} minutes or more (>= ${minutes * 60} seconds)`);
    return { operator: 'overInclusive', seconds: minutes * 60 };
  }
  
  const atLeastMatch = queryLower.match(atLeastPattern);
  if (atLeastMatch) {
    const minutes = parseInt(atLeastMatch[1], 10);
    console.log(`⏱️ Detected duration filter: at least ${minutes} minutes (>= ${minutes * 60} seconds)`);
    return { operator: 'overInclusive', seconds: minutes * 60 };
  }
  
  const lastedMatch = queryLower.match(lastedPattern);
  if (lastedMatch) {
    const minutes = parseInt(lastedMatch[1], 10);
    console.log(`⏱️ Detected duration filter: lasted ${minutes} minutes (>= ${minutes * 60} seconds)`);
    return { operator: 'overInclusive', seconds: minutes * 60 };
  }
  
  const underInclusiveMatch = queryLower.match(underInclusivePattern);
  if (underInclusiveMatch) {
    const minutes = parseInt(underInclusiveMatch[1], 10);
    console.log(`⏱️ Detected duration filter: ${minutes} minutes or less (<= ${minutes * 60} seconds)`);
    return { operator: 'underInclusive', seconds: minutes * 60 };
  }
  
  // Check exclusive patterns
  const overMatch = queryLower.match(overPattern);
  if (overMatch) {
    const minutes = parseInt(overMatch[1], 10);
    console.log(`⏱️ Detected duration filter: over ${minutes} minutes (> ${minutes * 60} seconds)`);
    return { operator: 'over', seconds: minutes * 60 };
  }
  
  const underMatch = queryLower.match(underPattern);
  if (underMatch) {
    const minutes = parseInt(underMatch[1], 10);
    console.log(`⏱️ Detected duration filter: under ${minutes} minutes (< ${minutes * 60} seconds)`);
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
    if (!call.duration && call.duration !== 0) return false;
    switch (operator) {
      case 'over': return call.duration > seconds;
      case 'overInclusive': return call.duration >= seconds;
      case 'under': return call.duration < seconds;
      case 'underInclusive': return call.duration <= seconds;
      default: return true;
    }
  });
  
  const operatorDesc = operator === 'overInclusive' ? '>=' : 
                       operator === 'underInclusive' ? '<=' :
                       operator === 'over' ? '>' : '<';
  const filterDesc = `${operatorDesc} ${seconds / 60} minutes (${seconds} seconds)`;
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

// Sanitize text to prevent prompt injection attacks
function sanitizeForPrompt(text: string): string {
  if (!text) return '';
  
  // Remove potential control phrases that could manipulate the AI
  const dangerousPhrases = [
    /ignore\s*(all)?\s*(previous|prior|above)\s*instructions?/gi,
    /disregard\s*(all)?\s*(previous|prior|above)/gi,
    /forget\s*(everything|all|what)/gi,
    /you\s*are\s*now/gi,
    /new\s*instructions?:/gi,
    /system\s*prompt/gi,
    /act\s*as\s*(if|a|an)/gi,
  ];
  
  let sanitized = text;
  for (const pattern of dangerousPhrases) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }
  
  // Limit length and remove excessive special characters
  return sanitized.substring(0, 1000).replace(/[{}[\]]/g, '');
}

// Classify the type of question to determine if data lookup is needed
function classifyQuestion(query: string): 'count' | 'search' | 'summary' | 'general' {
  const queryLower = query.toLowerCase();
  
  // Count questions - require exact data
  if (/how many|count|total|number of/i.test(queryLower)) {
    return 'count';
  }
  
  // Search questions - need to find specific calls
  if (/find|search|show|list|which|what calls/i.test(queryLower)) {
    return 'search';
  }
  
  // Summary questions - aggregate insights
  if (/summar|overview|insight|trend|pattern/i.test(queryLower)) {
    return 'summary';
  }
  
  return 'general';
}

// Phone pattern result with direction
interface PhonePatternResult {
  areaCode: string;
  direction: 'to' | 'from' | 'both';
}

// Detect area code or phone number pattern in query with direction
function detectPhonePattern(query: string): PhonePatternResult | null {
  const queryLower = query.toLowerCase();
  
  // Skip if this looks like a duration query (contains seconds, minutes, etc.)
  if (/\d+\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)/i.test(query)) {
    return null;
  }
  
  // Detect direction first
  let direction: 'to' | 'from' | 'both' = 'both';
  if (/\b(to|outbound|dialed|called)\b/i.test(queryLower) && !/\b(from|inbound|received)\b/i.test(queryLower)) {
    direction = 'to';
  } else if (/\b(from|inbound|received)\b/i.test(queryLower) && !/\b(to|outbound|dialed|called)\b/i.test(queryLower)) {
    direction = 'from';
  }
  
  // Match area codes mentioned in explicit phone context only
  // Must have phone-related context words to avoid matching random numbers
  const areaCodePatterns = [
    /(\d{3})\s*(?:numbers?|area\s*code)/i,         // "615 numbers", "202 area code"
    /(?:area\s*code|phone|calls?\s+from|calls?\s+to)\s*(\d{3})/i,  // "area code 615", "calls from 615"
    /\b(?:to|from)\s+(\d{3})\b/i,                  // "to 615", "from 202"
    /\b1(\d{3})\s*numbers?/i,                      // "1202 numbers" -> extract "202"
  ];
  
  for (const pattern of areaCodePatterns) {
    const match = query.match(pattern);
    if (match) {
      let areaCode = match[1];
      // Verify it looks like a valid US area code (starts with 2-9)
      if (areaCode && areaCode[0] >= '2' && areaCode[0] <= '9') {
        console.log(`📞 Detected area code ${areaCode} with direction: ${direction}`);
        return { areaCode, direction };
      }
    }
  }
  
  // NO fallback for standalone numbers - too risky, could match durations, counts, etc.
  return null;
}

// Pre-filter calls by searching for keywords in transcripts and summaries
export function preFilterCallsByKeywords(calls: any[], userQuery: string): { priorityCalls: any[], allCalls: any[], keywords: string[], phonePattern: PhonePatternResult | null } {
  // First, check for phone number/area code pattern
  const phonePattern = detectPhonePattern(userQuery);
  
  if (phonePattern) {
    const { areaCode, direction } = phonePattern;
    console.log(`📞 Detected phone pattern: area code ${areaCode}, direction: ${direction}`);
    
    // Helper function to check if a phone number matches the area code
    const matchesAreaCode = (phoneNumber: string | null | undefined): boolean => {
      if (!phoneNumber) return false;
      const cleanNumber = phoneNumber.replace(/\D/g, '');
      return cleanNumber.startsWith(areaCode) || cleanNumber.startsWith('1' + areaCode);
    };
    
    // Filter calls based on direction
    const phoneMatches = calls.filter(call => {
      if (direction === 'to') {
        // Outbound calls - check the number we called (to_number or phone_number for outbound)
        // In ElevenLabs data: phone_number is typically the destination for outbound
        return matchesAreaCode(call.to_number) || matchesAreaCode(call.phone_number);
      } else if (direction === 'from') {
        // Inbound calls - check the caller's number (from_number or caller_number)
        return matchesAreaCode(call.from_number) || matchesAreaCode(call.caller_number);
      } else {
        // Both directions - check all phone fields
        return matchesAreaCode(call.phone_number) || 
               matchesAreaCode(call.caller_number) ||
               matchesAreaCode(call.to_number) ||
               matchesAreaCode(call.from_number);
      }
    });
    
    const directionLabel = direction === 'to' ? 'to' : direction === 'from' ? 'from' : 'involving';
    console.log(`✅ Phone pattern filter found ${phoneMatches.length} calls ${directionLabel} area code ${areaCode}`);
    
    return { 
      priorityCalls: phoneMatches, 
      allCalls: calls, 
      keywords: [`${directionLabel} area code ${areaCode}`],
      phonePattern 
    };
  }
  
  // Extract potential keywords from the user's query (words > 3 chars, not common words)
  const stopWords = new Set(['what', 'when', 'where', 'which', 'that', 'this', 'have', 'with', 'from', 'they', 'been', 'were', 'being', 'there', 'their', 'about', 'would', 'could', 'should', 'calls', 'call', 'find', 'show', 'list', 'give', 'tell', 'over', 'under', 'more', 'less', 'than', 'minutes', 'seconds', 'long', 'short', 'all', 'any', 'summarize', 'summary', 'many', 'lasted', 'lasting', 'make', 'report', 'numbers']);
  
  const keywords = userQuery
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word));
  
  if (keywords.length === 0) {
    return { priorityCalls: [], allCalls: calls, keywords: [], phonePattern: null };
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
  
  return { priorityCalls, allCalls: calls, keywords, phonePattern: null };
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
  callData: any[],
  userTimezone: string = 'UTC'
): Promise<AnalysisResult> {
  // Classify the question type
  const questionType = classifyQuestion(userQuestion);
  console.log(`📝 Question type: ${questionType}`);
  
  // Step 0: Filter out low-quality calls (short duration, no transcript) unless specifically requested
  const qualityCalls = filterQualityCalls(callData, userQuestion);
  
  // Step 0.5: Apply duration filter if user asked for calls over/under X minutes
  const { filteredCalls: durationFilteredCalls, filterApplied: durationFilter } = filterByDuration(qualityCalls, userQuestion);
  
  // Step 1: Pre-filter remaining calls by keywords to prioritize relevant ones
  const { priorityCalls, allCalls, keywords, phonePattern } = preFilterCallsByKeywords(durationFilteredCalls, userQuestion);
  
  // ===== PRE-AI GUARD: Handle phone number/area code searches deterministically =====
  if (phonePattern) {
    const { areaCode, direction } = phonePattern;
    const count = priorityCalls.length;
    
    // Build direction-aware description
    const directionDesc = direction === 'to' ? 'to' : direction === 'from' ? 'from' : 'involving';
    console.log(`🎯 PRE-AI GUARD: Phone pattern search - ${count} calls ${directionDesc} area code ${areaCode}`);
    
    if (count === 0) {
      return {
        response: `I didn't find any calls ${directionDesc} the ${areaCode} area code. I searched through ${allCalls.length} calls in your dataset.`,
        matchingCallIds: []
      };
    } else {
      const downloadPrompt = ' Download the AI-Enhanced Report to see the full transcripts and details.';
      return {
        response: `I found ${count} calls ${directionDesc} the ${areaCode} area code.${downloadPrompt}`,
        matchingCallIds: priorityCalls.map(c => c.id)
      };
    }
  }

  // ===== PRE-AI GUARD: Handle count questions deterministically =====
  if (questionType === 'count') {
    // Check if the count question has keywords that need to be matched
    const hasKeywordFilter = keywords.length > 0;
    
    if (hasKeywordFilter) {
      // User asked something like "How many calls mention refunds?"
      // Use the keyword-filtered results
      const count = priorityCalls.length;
      const keywordDesc = keywords.join(', ');
      
      console.log(`🎯 PRE-AI GUARD: Answering keyword count question - ${count} calls match keywords: ${keywordDesc}`);
      
      let response: string;
      if (count === 0) {
        response = `I didn't find any calls that mention "${keywordDesc}". I searched through ${allCalls.length} meaningful calls in your dataset.`;
      } else {
        response = `Based on your call data, there are exactly ${count} calls that mention "${keywordDesc}". This is out of ${allCalls.length} total meaningful calls.`;
      }
      
      return {
        response,
        matchingCallIds: priorityCalls.map(c => c.id)
      };
    } else if (durationFilter) {
      // User asked something like "How many calls are over 5 minutes?"
      const count = durationFilteredCalls.length;
      
      console.log(`🎯 PRE-AI GUARD: Answering duration count question - ${count} calls match filter: ${durationFilter}`);
      
      let response: string;
      if (count === 0) {
        response = `I didn't find any calls that are ${durationFilter}. Your current dataset has ${qualityCalls.length} meaningful calls total.`;
      } else {
        response = `Based on your call data, there are exactly ${count} calls that are ${durationFilter}. This is out of ${qualityCalls.length} total meaningful calls.`;
      }
      
      return {
        response,
        matchingCallIds: durationFilteredCalls.map(c => c.id)
      };
    }
    // If no specific filter, let AI handle general count questions
  }
  
  // ===== PRE-AI GUARD: Handle search with no results =====
  if (questionType === 'search' && keywords.length > 0 && priorityCalls.length === 0) {
    console.log(`🎯 PRE-AI GUARD: Search found no matching calls for keywords: ${keywords.join(', ')}`);
    return {
      response: `I searched through ${allCalls.length} calls but didn't find any that mention "${keywords.join('", "')}". Try different keywords or ask a broader question.`,
      matchingCallIds: []
    };
  }
  
  // Step 2: Build optimized call list - strict limits for 8k context window
  // Llama 3.1 8B has ~8k context - need to stay well under that
  // ~20 calls with 300 char summaries + 200 char transcripts ≈ 10k chars ≈ 2.5k tokens (safe margin)
  const maxCalls = 20;
  const summaryLength = 300;
  
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
  
  // Sanitize call data before sending to AI - include transcript excerpts for evidence
  const transcriptExcerptLength = 200; // Reduced from 300 to stay within token limits
  const callSummary = callsToAnalyze.map(call => {
    // Extract a relevant transcript excerpt if available
    let transcriptExcerpt = '';
    if (call.transcript && call.transcript.length > 10) {
      // Try to extract meaningful content, not just the start
      const sanitizedTranscript = sanitizeForPrompt(call.transcript);
      transcriptExcerpt = sanitizedTranscript.substring(0, transcriptExcerptLength);
      if (sanitizedTranscript.length > transcriptExcerptLength) {
        transcriptExcerpt += '...';
      }
    }
    
    return {
      id: call.id,
      phone: call.phone_number || call.caller_number,
      status: call.status,
      duration: call.duration,
      summary: sanitizeForPrompt(call.summary?.substring(0, summaryLength) || 'No summary'),
      transcript_excerpt: transcriptExcerpt || null,
      timestamp: call.timestamp,
    };
  });

  // Create a set of valid IDs for validation
  const validIds = new Set(callSummary.map(c => c.id));
  // Also include all calls from the filtered set for validation
  const allValidIds = new Set(allCalls.map(c => c.id));

  // Build context about what filtering was already applied
  const filterContext = durationFilter 
    ? `\nIMPORTANT: A duration filter was already applied - these ${callSummary.length} calls are ALREADY filtered to only include calls ${durationFilter}. The count is EXACT. Do not recalculate or second-guess this number.`
    : '';

  // Get current date/time in user's timezone for accurate "today", "yesterday" references
  const now = new Date();
  let currentDateTime: string;
  try {
    currentDateTime = now.toLocaleString('en-US', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: userTimezone
    }) + ` (${userTimezone})`;
  } catch (e) {
    // Fallback to UTC if timezone is invalid
    currentDateTime = now.toLocaleString('en-US', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'UTC'
    }) + ' (UTC)';
  }
  console.log(`🕐 AI using timezone: ${userTimezone}, current time: ${currentDateTime}`);

  const systemPrompt = `You are a helpful call analytics assistant for SkyIQ. Help users understand their phone call data by finding calls, summarizing insights, and answering questions.

CURRENT DATE & TIME: ${currentDateTime}
Use this to understand relative time references like "today", "yesterday", "this week", "last 24 hours", etc.

ABSOLUTE RULES - YOU MUST FOLLOW THESE:
1. STAY ON TOPIC - Only answer questions about call data, call analytics, and phone conversations. For anything else, politely say: "I'm here to help you analyze your call data. Is there something about your calls I can help you with?"
2. NEVER HALLUCINATE OR MAKE UP DATA - Only use information from the call data provided below
3. NEVER GUESS - If the data doesn't clearly answer the question, say so honestly
4. ONLY REPORT WHAT YOU SEE - If there are no matching calls, say "I didn't find any calls matching that criteria"
5. BE ACCURATE - Double-check numbers, counts, and durations before stating them
6. DECLINE INAPPROPRIATE REQUESTS - If asked to do something unethical, harmful, or unrelated to call analytics, politely decline
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

REPORT CONTEXT:
You are helping build an AI-Enhanced Report document. The matchingCallIds you provide will be used to compile a detailed PDF report with full transcripts and analysis.
- You CAN reference specific calls you found (e.g., "I found 3 calls where customers mentioned pricing concerns" or "One conversation from yesterday showed a successful booking")
- When you find relevant calls, tell the user to "download the AI-Enhanced Report for the full details and transcripts"
- The report gives users complete visibility into the calls you identified

WRITING STYLE:
- Be conversational and friendly - write like you're talking to a colleague
- Use natural sentences and paragraphs, not lists or bullet points
- NEVER include phone numbers, call IDs, or technical identifiers in your response text
- Keep dates simple like "yesterday afternoon" or "earlier today" when appropriate
- When relevant calls are found, end with: "Download the AI-Enhanced Report to see the full transcripts and details."

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
  
  // ===== FALLBACK: Handle empty AI response =====
  if (!rawResponse || rawResponse.trim().length === 0) {
    console.log('⚠️ AI returned empty response - using fallback');
    // Provide a helpful fallback based on available data
    const callCount = callsToAnalyze.length;
    const totalCount = allCalls.length;
    const fallbackResponse = callCount > 0
      ? `I analyzed ${callCount} of your ${totalCount} calls but couldn't generate a detailed response. Try asking a more specific question like "Show me calls from today" or "Which calls lasted over 5 minutes?"`
      : `I don't have enough call data to answer that question. Your account has ${totalCount} calls available for analysis.`;
    
    return {
      response: fallbackResponse,
      matchingCallIds: callsToAnalyze.slice(0, 10).map(c => c.id)
    };
  }
  
  // Parse the JSON response
  let matchingIds: number[] = [];
  let analysisText = rawResponse;
  let jsonParsedSuccessfully = false;
  
  try {
    // Try to extract JSON from the response (in case there's extra text)
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      // Extract analysis text - this is the most important part
      if (parsed.analysis && typeof parsed.analysis === 'string') {
        analysisText = sanitizeAnalysisText(parsed.analysis);
        jsonParsedSuccessfully = true;
        console.log('✅ Successfully extracted analysis text from JSON');
      }
      // Validate that all IDs exist in original data (optional - don't fail if IDs don't match)
      const parsedIds = Array.isArray(parsed.matchingCallIds) ? parsed.matchingCallIds : [];
      matchingIds = parsedIds.filter((id: number) => validIds.has(id));
      console.log(`📊 Call IDs: ${matchingIds.length} valid out of ${parsedIds.length} in response`);
    }
  } catch (e) {
    console.log('❌ Failed to parse AI response as JSON:', e);
  }
  
  // If JSON parsing failed, try to clean up raw response and extract IDs from markers
  if (!jsonParsedSuccessfully) {
    console.log('🔄 JSON parsing failed, using raw response...');
    // Try to extract just the analysis part if it exists as plain text
    analysisText = sanitizeAnalysisText(rawResponse);
    matchingIds = extractCallIdsFromMarkers(rawResponse, validIds);
    console.log(`📍 Fallback extracted ${matchingIds.length} valid matching call IDs from markers`);
  }
  
  // ===== POST-AI VALIDATION =====
  // Verify all returned IDs actually exist in the original dataset
  const validatedIds = matchingIds.filter(id => allValidIds.has(id));
  if (validatedIds.length !== matchingIds.length) {
    console.log(`⚠️ POST-AI VALIDATION: Removed ${matchingIds.length - validatedIds.length} invalid call IDs that don't exist in data`);
  }
  
  // Verify any count claims in the response match actual data
  if (jsonParsedSuccessfully) {
    const countMatch = analysisText.match(/(\d+)\s*calls?/i);
    if (countMatch) {
      const aiClaimedCount = parseInt(countMatch[1], 10);
      const actualCount = durationFilter ? durationFilteredCalls.length : allCalls.length;
      
      // Only correct if the discrepancy is significant (>10% difference or >5 calls off)
      if (Math.abs(aiClaimedCount - actualCount) > Math.max(5, actualCount * 0.1)) {
        console.log(`⚠️ POST-AI VALIDATION: AI claimed ${aiClaimedCount} calls but actual count is ${actualCount}. Large discrepancy detected.`);
        // Add a correction note rather than replacing the entire response
        analysisText = analysisText + ` (Note: The verified count from your data is ${actualCount} calls.)`;
      }
    }
  }
  
  console.log(`✅ Final response: ${validatedIds.length} matching call IDs`);
  
  return {
    response: analysisText,
    matchingCallIds: validatedIds
  };
}
