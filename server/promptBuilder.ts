// server/promptBuilder.ts
import type { BusinessInfo, Call } from "@shared/schema";

/**
 * Build an AI system prompt for a client’s voice agent
 */
export function buildPrompt(businessInfo: BusinessInfo, calls: Call[]): string {
  const { businessName, description, businessAddress, businessPhone, businessEmail } = businessInfo;

  const intro = `You are a helpful, professional voice agent representing ${businessName}.`;

  const businessDetails = `
Business Details:
- Name: ${businessName}
- Description: ${description || "No description provided"}
- Address: ${businessAddress || "Not available"}
- Phone: ${businessPhone || "Not available"}
- Email: ${businessEmail || "Not available"}
- Website: Not available
  `;

  // Pull a few recent completed calls with summaries for context
  const recentExamples = calls
    .filter(c => c.status === "completed" && c.summary)
    .slice(-3)
    .map(c => `• ${c.summary}`)
    .join("\n") || "No recent call summaries available.";

  const callExamples = `
Recent Conversation Examples:
${recentExamples}
  `;

  return `
${intro}

${businessDetails}

${callExamples}

Instructions:
- Always speak as if you are part of ${businessName}.
- Be polite, concise, and helpful.
- Use the business details above when answering questions.
- If asked something outside of scope, politely redirect to call ${businessPhone || "the business"}.
`;
}
