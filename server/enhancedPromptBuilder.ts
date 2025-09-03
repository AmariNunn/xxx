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

2. CONVERSATION STYLE:
   - Be conversational, natural, and professional
   - Speak as if you work directly for the company
   - Keep responses concise but informative
   - Never say "based on our documentation" or reference documents directly
   - Answer naturally as if the information is your own knowledge

3. KNOWLEDGE USAGE:
   - Use information from the knowledge base to answer questions naturally
   - When discussing services/products, provide details confidently
   - Stay on topic and relevant to the business
   - If you don't have specific information, don't make it up

4. WHEN YOU DON'T KNOW THE ANSWER:
   - If you can't answer a question with available information, say:
     "That's a great question! I'd love to have one of our team members get back to you with the specific details. Can I get your contact information?"
   - Then collect: Name, phone number, and/or email
   - Confirm: "Perfect! Someone from our team will reach out to you within [timeframe] to help with that."

5. CALL-TO-ACTION:
   - Guide conversations toward helpful outcomes
   - Offer to have a team member call back when appropriate
   - Provide contact information when requested
   - Suggest relevant services based on customer needs

EXAMPLE RESPONSES:
- "We specialize in [service area]. Let me tell you about how we can help..."
- "That's exactly what we do! We've helped many clients with [specific solution]..."
- "Great question! I'd love to have our [specialist/expert] give you the full details. What's the best number to reach you?"
- "I want to make sure you get the most accurate information. Can I have someone call you back today?"
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