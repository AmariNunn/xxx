import { storage } from './storage';

/**
 * AI Prompt Service
 * Generates dynamic AI prompts based on client's business information and call history
 */

interface AIPromptData {
  businessContext: string;
  callHistory: string;
  clientPersonalization: string;
  responseGuidelines: string;
  fullPrompt: string;
}

export class AIPromptService {
  
  /**
   * Generate personalized AI prompt for a specific user
   */
  async generateUserPrompt(userId: number): Promise<AIPromptData> {
    try {
      // Get user's business information
      const businessInfo = await storage.getBusinessInfo(userId);
      
      // Get user's recent call history
      const calls = await storage.getCallsByUserId(userId);
      const recentCalls = calls.slice(-10); // Last 10 calls for context
      
      // Build business context
      const businessContext = this.buildBusinessContext(businessInfo);
      
      // Build call history context
      const callHistory = this.buildCallHistoryContext(recentCalls);
      
      // Build client personalization
      const clientPersonalization = this.buildClientPersonalization(businessInfo, calls);
      
      // Build response guidelines
      const responseGuidelines = this.buildResponseGuidelines(businessInfo);
      
      // Combine into full prompt
      const fullPrompt = this.assembleFullPrompt({
        businessContext,
        callHistory,
        clientPersonalization,
        responseGuidelines
      });
      
      return {
        businessContext,
        callHistory,
        clientPersonalization,
        responseGuidelines,
        fullPrompt
      };
      
    } catch (error) {
      console.error('Error generating AI prompt for user:', userId, error);
      throw new Error('Failed to generate AI prompt');
    }
  }
  
  /**
   * Build business context from user's business information
   */
  private buildBusinessContext(businessInfo: any): string {
    if (!businessInfo) {
      return "Business information not configured. Use general professional responses.";
    }
    
    const context = [];
    
    if (businessInfo.businessName) {
      context.push(`Business Name: ${businessInfo.businessName}`);
    }
    
    if (businessInfo.description) {
      context.push(`Business Description: ${businessInfo.description}`);
    }
    
    if (businessInfo.businessEmail) {
      context.push(`Contact Email: ${businessInfo.businessEmail}`);
    }
    
    if (businessInfo.businessPhone) {
      context.push(`Business Phone: ${businessInfo.businessPhone}`);
    }
    
    if (businessInfo.businessAddress) {
      context.push(`Address: ${businessInfo.businessAddress}`);
    }
    
    if (businessInfo.links && businessInfo.links.length > 0) {
      context.push(`Additional Resources: ${businessInfo.links.join(', ')}`);
    }
    
    return context.length > 0 ? context.join('\n') : "Limited business information available.";
  }
  
  /**
   * Build call history context from recent calls
   */
  private buildCallHistoryContext(calls: any[]): string {
    if (!calls || calls.length === 0) {
      return "No previous call history available.";
    }
    
    const callSummaries = calls.map((call, index) => {
      const callNum = calls.length - index;
      const date = call.createdAt ? new Date(call.createdAt).toLocaleDateString() : 'Recent';
      const contact = call.contactName || call.phoneNumber || 'Unknown contact';
      const status = call.status || 'completed';
      const duration = call.duration ? `${Math.floor(call.duration / 60)}m ${call.duration % 60}s` : 'Unknown duration';
      
      let summary = `Call ${callNum} (${date}): ${contact} - ${status} - ${duration}`;
      
      if (call.summary) {
        summary += `\nSummary: ${call.summary}`;
      }
      
      if (call.notes) {
        summary += `\nNotes: ${call.notes}`;
      }
      
      return summary;
    });
    
    return `Recent Call History (${calls.length} calls):\n\n${callSummaries.join('\n\n')}`;
  }
  
  /**
   * Build client personalization based on business type and call patterns
   */
  private buildClientPersonalization(businessInfo: any, calls: any[]): string {
    const personalizations = [];
    
    // Analyze business type for tone
    if (businessInfo?.description) {
      const desc = businessInfo.description.toLowerCase();
      if (desc.includes('medical') || desc.includes('healthcare') || desc.includes('doctor')) {
        personalizations.push("Use professional medical terminology when appropriate");
      } else if (desc.includes('legal') || desc.includes('law') || desc.includes('attorney')) {
        personalizations.push("Maintain formal legal communication standards");
      } else if (desc.includes('restaurant') || desc.includes('food') || desc.includes('catering')) {
        personalizations.push("Be warm and inviting, focus on customer service excellence");
      } else if (desc.includes('tech') || desc.includes('software') || desc.includes('IT')) {
        personalizations.push("Use appropriate technical language while remaining accessible");
      } else if (desc.includes('real estate') || desc.includes('property')) {
        personalizations.push("Focus on trust-building and long-term relationships");
      }
    }
    
    // Analyze call patterns
    const completedCalls = calls.filter(call => call.status === 'completed').length;
    const missedCalls = calls.filter(call => call.status === 'missed').length;
    const totalCalls = calls.length;
    
    if (totalCalls > 0) {
      const completionRate = (completedCalls / totalCalls) * 100;
      if (completionRate < 60) {
        personalizations.push("Be extra engaging to improve call completion rates");
      }
      
      if (missedCalls > completedCalls) {
        personalizations.push("Focus on callback scheduling and follow-up strategies");
      }
    }
    
    // Average call duration insights
    const callsWithDuration = calls.filter(call => call.duration && call.duration > 0);
    if (callsWithDuration.length > 0) {
      const avgDuration = callsWithDuration.reduce((sum, call) => sum + call.duration, 0) / callsWithDuration.length;
      if (avgDuration < 60) {
        personalizations.push("Calls tend to be brief - be concise and direct");
      } else if (avgDuration > 300) {
        personalizations.push("Calls tend to be longer - provide detailed information and take time to build rapport");
      }
    }
    
    return personalizations.length > 0 
      ? personalizations.join('\n') 
      : "Use standard professional communication approach";
  }
  
  /**
   * Build response guidelines based on business context
   */
  private buildResponseGuidelines(businessInfo: any): string {
    const guidelines = [
      "Always be professional, helpful, and courteous",
      "Listen actively and respond to the caller's specific needs",
      "Take detailed notes during the conversation",
      "Ask clarifying questions when needed",
      "Provide clear next steps or follow-up actions",
      "Maintain confidentiality and privacy"
    ];
    
    if (businessInfo?.businessName) {
      guidelines.unshift(`Identify yourself as calling from ${businessInfo.businessName}`);
    }
    
    if (businessInfo?.businessPhone) {
      guidelines.push(`Provide callback number: ${businessInfo.businessPhone} if requested`);
    }
    
    return guidelines.join('\n');
  }
  
  /**
   * Assemble the complete AI prompt
   */
  private assembleFullPrompt(components: {
    businessContext: string;
    callHistory: string;
    clientPersonalization: string;
    responseGuidelines: string;
  }): string {
    return `# AI VOICE AGENT PROMPT

## BUSINESS CONTEXT
${components.businessContext}

## CALL HISTORY CONTEXT
${components.callHistory}

## PERSONALIZATION GUIDELINES
${components.clientPersonalization}

## RESPONSE GUIDELINES
${components.responseGuidelines}

## INSTRUCTIONS
You are an AI voice agent representing this business. Use the above context to provide personalized, relevant responses that align with the business's needs and communication style. Reference previous call history when appropriate to provide continuity in the customer relationship.

Always maintain professionalism while adapting your tone and approach based on the business type and customer interaction patterns shown in the call history.`;
  }
  
  /**
   * Get a simplified prompt for quick API responses
   */
  async getSimplePrompt(userId: number): Promise<string> {
    try {
      const businessInfo = await storage.getBusinessInfo(userId);
      const businessName = businessInfo?.businessName || 'the business';
      const description = businessInfo?.description || 'providing professional services';
      
      return `You are an AI voice agent representing ${businessName}, ${description}. Be professional, helpful, and represent the business positively.`;
    } catch (error) {
      return "You are a professional AI voice agent. Be helpful and courteous in all interactions.";
    }
  }
  
  /**
   * Update prompt based on real-time call outcome
   */
  async updatePromptWithCallOutcome(userId: number, callOutcome: {
    successful: boolean;
    customerSatisfaction?: number;
    notes?: string;
  }): Promise<void> {
    // This could be used to adjust future prompts based on call success
    // For now, we'll log the outcome for future analysis
    console.log(`Call outcome for user ${userId}:`, callOutcome);
  }
}

export const aiPromptService = new AIPromptService();