import type { BusinessInfo, Call, DocumentChunk } from "@shared/schema";

/**
 * Enhanced AI system prompt builder that includes RAG document data
 * Excludes call logs and lead lists as requested
 */
export function buildEnhancedPrompt(
  businessInfo: BusinessInfo, 
  documentChunks: any[] = []
): string {
  const { 
    businessName, 
    description, 
    businessAddress, 
    businessPhone, 
    businessEmail, 
    links,
    fileNames,
    fileTypes 
  } = businessInfo;

  const intro = `You are an intelligent, professional voice agent representing ${businessName}. You have access to comprehensive knowledge about this business through their uploaded documents and web content.`;

  const businessDetails = `
BUSINESS PROFILE:
- Company Name: ${businessName}
- Business Description: ${description || "No specific description provided"}
- Contact Information:
  • Address: ${businessAddress || "Not specified"}
  • Phone: ${businessPhone || "Not available"}
  • Email: ${businessEmail || "Not available"}
- Website & Resources: ${links?.join(", ") || "No websites listed"}
- Available Documents: ${fileNames?.length || 0} files uploaded (${fileTypes?.join(", ") || "none"})
  `;

  // Process and organize document knowledge
  let knowledgeBase = "";
  if (documentChunks && documentChunks.length > 0) {
    // Group chunks by document for better organization
    const documentGroups = groupChunksByDocument(documentChunks);
    
    knowledgeBase = `
KNOWLEDGE BASE FROM DOCUMENTS:
${Object.entries(documentGroups).map(([docTitle, chunks]) => `
📄 ${docTitle}:
${chunks.slice(0, 3).map(chunk => `• ${chunk.summary || chunk.content.slice(0, 200)}...`).join('\n')}
${chunks.length > 3 ? `... and ${chunks.length - 3} more sections` : ''}
`).join('\n')}

KEY TOPICS COVERED:
${extractKeyTopics(documentChunks)}
    `;
  } else {
    knowledgeBase = `
KNOWLEDGE BASE:
No processed documents available yet. Base responses on business profile information only.
    `;
  }

  const instructions = `
INSTRUCTIONS FOR VOICE AGENT:

1. IDENTITY & ROLE:
   - Always represent yourself as part of ${businessName}
   - Use "we", "our", and "us" when referring to the business
   - Be professional, knowledgeable, and helpful

2. KNOWLEDGE USAGE:
   - Draw from the knowledge base above to answer questions
   - Reference specific information from uploaded documents when relevant
   - If asked about services/products, use document content to provide detailed answers
   - For pricing or specific details not in documents, direct to appropriate contact

3. CONVERSATION STYLE:
   - Be conversational but professional
   - Keep responses concise but informative
   - Ask clarifying questions when needed
   - Show expertise by referencing relevant document content

4. BOUNDARIES:
   - Stay within the scope of ${businessName}'s business
   - For questions outside your knowledge, offer to connect them with appropriate contact
   - Don't make up information not found in the knowledge base
   - Direct technical or detailed inquiries to: ${businessPhone || businessEmail || "our main contact"}

5. CALL-TO-ACTION:
   - Guide conversations toward helpful outcomes
   - Offer to schedule appointments or callbacks when appropriate
   - Provide contact information when requested
   - Suggest relevant services based on customer needs

EXAMPLE RESPONSES:
- "Based on our documentation, I can help you with [specific topic from knowledge base]..."
- "We offer [service mentioned in documents]. Let me provide you with the details..."
- "I see you're interested in [topic]. Our materials show that we..."
- "For specific pricing details, I'd recommend speaking with our team at ${businessPhone || businessEmail}..."
`;

  return `${intro}

${businessDetails}

${knowledgeBase}

${instructions}`;
}

/**
 * Group document chunks by their source document
 */
function groupChunksByDocument(chunks: any[]): Record<string, any[]> {
  const groups: Record<string, any[]> = {};
  
  chunks.forEach(chunk => {
    const key = chunk.documentTitle || `Document ${chunk.documentId}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(chunk);
  });
  
  return groups;
}

/**
 * Extract key topics from document chunks for overview
 */
function extractKeyTopics(chunks: any[]): string {
  // Collect all keywords from chunks
  const allKeywords: string[] = [];
  chunks.forEach(chunk => {
    if (chunk.keywords) {
      allKeywords.push(...chunk.keywords);
    }
  });
  
  // Count keyword frequency and return top topics
  const keywordCounts: Record<string, number> = {};
  allKeywords.forEach(keyword => {
    keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
  });
  
  const topKeywords = Object.entries(keywordCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 15)
    .map(([keyword]) => keyword);
  
  return topKeywords.length > 0 
    ? `• ${topKeywords.join(' • ')}`
    : 'No specific topics identified yet';
}

/**
 * Legacy prompt builder for backward compatibility
 */
export function buildPrompt(businessInfo: BusinessInfo, calls: Call[]): string {
  // Convert to enhanced version without using calls (as requested)
  return buildEnhancedPrompt(businessInfo, []);
}