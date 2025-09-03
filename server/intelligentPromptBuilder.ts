import type { AggregatedBusinessData } from "./dataAggregationService";

export interface PromptContext {
  callType?: 'inbound' | 'outbound' | 'general';
  customerIntent?: string;
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'late';
  urgency?: 'low' | 'medium' | 'high';
  previousInteractions?: string[];
  specificTopic?: string;
}

export interface GeneratedPrompt {
  systemPrompt: string;
  contextualKnowledge: string[];
  suggestedResponses: string[];
  handoffTriggers: string[];
  metadata: {
    dataSourcesUsed: string[];
    confidenceScore: number;
    lastUpdated: Date;
  };
}

export class IntelligentPromptBuilder {
  
  /**
   * Build a dynamic, context-aware prompt for voice agents using comprehensive business data
   */
  buildDynamicPrompt(
    businessData: AggregatedBusinessData, 
    context: PromptContext = {}
  ): GeneratedPrompt {
    const {
      businessProfile,
      webPresence,
      documentKnowledge,
      callHistory,
      leadInsights,
      competitiveIntel,
      contentAnalysis,
      operationalData
    } = businessData;

    // Build the core system prompt with intelligent prioritization
    const systemPrompt = this.constructSystemPrompt(businessData, context);
    
    // Extract contextual knowledge based on the situation
    const contextualKnowledge = this.extractContextualKnowledge(businessData, context);
    
    // Generate suggested responses based on patterns and context
    const suggestedResponses = this.generateSuggestedResponses(businessData, context);
    
    // Define handoff triggers based on business capabilities
    const handoffTriggers = this.defineHandoffTriggers(businessData, context);

    // Calculate confidence score based on data completeness
    const confidenceScore = this.calculateConfidenceScore(businessData);

    return {
      systemPrompt,
      contextualKnowledge,
      suggestedResponses,
      handoffTriggers,
      metadata: {
        dataSourcesUsed: this.getDataSourcesUsed(businessData),
        confidenceScore,
        lastUpdated: businessData.lastUpdated
      }
    };
  }

  private constructSystemPrompt(businessData: AggregatedBusinessData, context: PromptContext): string {
    const { businessProfile, contentAnalysis, competitiveIntel, operationalData } = businessData;
    
    // Dynamic introduction based on business characteristics
    const businessPersonality = this.determineBrandPersonality(contentAnalysis);
    const expertiseLevel = this.determineExpertiseLevel(businessData);
    
    let intro = `You are an intelligent AI assistant representing ${businessProfile.businessName}`;
    
    if (expertiseLevel === 'expert') {
      intro += `, a ${competitiveIntel.marketPosition.toLowerCase()} in the industry.`;
    } else if (expertiseLevel === 'specialized') {
      intro += `, specializing in ${contentAnalysis.expertiseAreas.slice(0, 3).join(', ')}.`;
    } else {
      intro += `, committed to providing excellent service to our customers.`;
    }

    // Business identity and values
    const identity = this.buildIdentitySection(businessData);
    
    // Operational context
    const operations = this.buildOperationalContext(businessData, context);
    
    // Knowledge and expertise
    const expertise = this.buildExpertiseSection(businessData);
    
    // Communication style
    const communicationStyle = this.buildCommunicationStyle(businessData, context);
    
    // Call handling instructions
    const callHandling = this.buildCallHandlingInstructions(businessData, context);

    return `${intro}

${identity}

${operations}

${expertise}

${communicationStyle}

${callHandling}

CRITICAL GUIDELINES:
- Always represent yourself as part of ${businessProfile.businessName}
- Use "we", "our", and "us" when referring to the business
- Never say "according to documentation" or "based on our files"
- Speak with authority and knowledge as if the information is your own expertise
- If you don't know something specific, offer to connect them with a team member
- Stay professional, helpful, and aligned with our brand voice
- Focus on solving the customer's needs and providing value`;
  }

  private buildIdentitySection(businessData: AggregatedBusinessData): string {
    const { businessProfile, competitiveIntel, contentAnalysis } = businessData;
    
    let section = `BUSINESS IDENTITY:
- Company: ${businessProfile.businessName}`;

    if (businessProfile.description) {
      section += `\n- Mission: ${businessProfile.description}`;
    }

    if (competitiveIntel.uniqueValueProps.length > 0) {
      section += `\n- Unique Value: ${competitiveIntel.uniqueValueProps.slice(0, 2).join(', ')}`;
    }

    if (contentAnalysis.brandVoice.length > 0) {
      section += `\n- Brand Voice: ${contentAnalysis.brandVoice[0]}`;
    }

    return section;
  }

  private buildOperationalContext(businessData: AggregatedBusinessData, context: PromptContext): string {
    const { businessProfile, operationalData } = businessData;
    
    let section = `OPERATIONAL CONTEXT:`;

    // Contact information
    if (businessProfile.businessPhone || businessProfile.businessEmail) {
      section += `\n- Contact: `;
      const contacts = [];
      if (businessProfile.businessPhone) contacts.push(`Phone: ${businessProfile.businessPhone}`);
      if (businessProfile.businessEmail) contacts.push(`Email: ${businessProfile.businessEmail}`);
      section += contacts.join(', ');
    }

    if (businessProfile.businessAddress) {
      section += `\n- Location: ${businessProfile.businessAddress}`;
    }

    // Business hours
    if (operationalData.businessHours.length > 0) {
      section += `\n- Hours: ${operationalData.businessHours.slice(0, 3).join(', ')}`;
    }

    // Available contact methods
    if (operationalData.contactMethods.length > 0) {
      section += `\n- Available Contact Methods: ${operationalData.contactMethods.join(', ')}`;
    }

    // Context-specific information
    if (context.timeOfDay) {
      section += `\n- Current Context: ${context.timeOfDay} call`;
    }

    return section;
  }

  private buildExpertiseSection(businessData: AggregatedBusinessData): string {
    const { webPresence, documentKnowledge, contentAnalysis, competitiveIntel } = businessData;
    
    let section = `EXPERTISE & KNOWLEDGE:`;

    // Primary expertise areas
    if (contentAnalysis.expertiseAreas.length > 0) {
      section += `\n- Core Expertise: ${contentAnalysis.expertiseAreas.slice(0, 5).join(', ')}`;
    }

    // Services and offerings
    const allServices = new Set<string>();
    webPresence.forEach(site => {
      site.businessInfo.services.forEach(service => allServices.add(service));
      site.businessInfo.products.forEach(product => allServices.add(product));
    });

    if (allServices.size > 0) {
      section += `\n- Services/Products: ${Array.from(allServices).slice(0, 8).join(', ')}`;
    }

    // Knowledge base summary
    if (documentKnowledge.totalDocuments > 0) {
      section += `\n- Knowledge Base: ${documentKnowledge.processedDocuments} processed documents covering key topics`;
      
      if (documentKnowledge.keyTopics.length > 0) {
        section += `\n- Key Topics: ${documentKnowledge.keyTopics.slice(0, 10).join(', ')}`;
      }
    }

    // Industry positioning
    if (competitiveIntel.marketPosition) {
      section += `\n- Market Position: ${competitiveIntel.marketPosition}`;
    }

    return section;
  }

  private buildCommunicationStyle(businessData: AggregatedBusinessData, context: PromptContext): string {
    const { contentAnalysis, callHistory } = businessData;
    
    let section = `COMMUNICATION STYLE:`;

    // Brand voice adaptation
    if (contentAnalysis.brandVoice.length > 0) {
      section += `\n- Tone: ${contentAnalysis.brandVoice[0]}`;
    }

    // Context-specific adaptations
    switch (context.callType) {
      case 'inbound':
        section += `\n- Approach: Welcoming and solution-focused for incoming inquiries`;
        break;
      case 'outbound':
        section += `\n- Approach: Confident and value-driven for outbound contact`;
        break;
      default:
        section += `\n- Approach: Adaptive to customer needs and inquiry type`;
    }

    // Urgency handling
    if (context.urgency === 'high') {
      section += `\n- Priority: Address urgent concerns immediately and efficiently`;
    } else if (context.urgency === 'low') {
      section += `\n- Priority: Take time to educate and build relationship`;
    }

    // Successful patterns from call history
    if (callHistory.callPatterns.successfulOutcomes.length > 0) {
      section += `\n- Proven Approach: Build on successful interaction patterns`;
    }

    section += `\n- Response Style: Concise, helpful, and professional
- Length: Keep responses focused and actionable
- Personality: Knowledgeable team member who genuinely cares about helping`;

    return section;
  }

  private buildCallHandlingInstructions(businessData: AggregatedBusinessData, context: PromptContext): string {
    const { callHistory, leadInsights, contentAnalysis } = businessData;
    
    let section = `CALL HANDLING INSTRUCTIONS:`;

    // Common question preparation
    if (callHistory.callPatterns.commonQuestions.length > 0) {
      section += `\n- Common Questions: Be prepared to address frequently asked questions about our services`;
    }

    // Peak hours consideration
    if (callHistory.callPatterns.peakHours.length > 0 && context.timeOfDay) {
      const peakTimes = callHistory.callPatterns.peakHours.join(', ');
      section += `\n- Timing Awareness: Our busiest times are ${peakTimes}`;
    }

    // Customer pain points
    if (contentAnalysis.customerPainPoints.length > 0) {
      section += `\n- Pain Points: Understand common customer challenges and position solutions`;
    }

    // Lead qualification for outbound
    if (context.callType === 'outbound' && leadInsights.totalLeads > 0) {
      section += `\n- Lead Qualification: Identify needs and qualification criteria based on successful patterns`;
    }

    // Specific topic preparation
    if (context.specificTopic) {
      section += `\n- Topic Focus: This call is specifically about ${context.specificTopic}`;
    }

    section += `
- Information Gathering: Ask relevant questions to understand needs
- Solution Positioning: Connect customer needs to our capabilities
- Next Steps: Always provide clear next steps or call-to-action
- Escalation: Know when to involve human team members for complex issues`;

    return section;
  }

  private extractContextualKnowledge(businessData: AggregatedBusinessData, context: PromptContext): string[] {
    const knowledge: string[] = [];
    const { webPresence, documentKnowledge, callHistory } = businessData;

    // Relevant document summaries
    if (context.specificTopic) {
      const relevantSummaries = documentKnowledge.summaries.filter(summary => 
        summary.toLowerCase().includes(context.specificTopic.toLowerCase())
      );
      knowledge.push(...relevantSummaries.slice(0, 5));
    } else {
      knowledge.push(...documentKnowledge.summaries.slice(0, 8));
    }

    // Website content insights
    webPresence.forEach(site => {
      if (site.businessInfo.aboutSections.length > 0) {
        knowledge.push(`About: ${site.businessInfo.aboutSections[0].slice(0, 300)}...`);
      }
      
      if (site.businessInfo.testimonials.length > 0) {
        knowledge.push(`Customer Feedback: ${site.businessInfo.testimonials[0]}`);
      }
    });

    // Call history insights
    if (callHistory.callPatterns.successfulOutcomes.length > 0) {
      knowledge.push(`Recent Success: ${callHistory.callPatterns.successfulOutcomes[0]}`);
    }

    return knowledge.slice(0, 12);
  }

  private generateSuggestedResponses(businessData: AggregatedBusinessData, context: PromptContext): string[] {
    const responses: string[] = [];
    const { businessProfile, webPresence, callHistory } = businessData;

    // Greeting variations
    responses.push(`Thank you for calling ${businessProfile.businessName}. How can I help you today?`);
    responses.push(`Hi, this is ${businessProfile.businessName}. What can I assist you with?`);

    // Service-specific responses
    webPresence.forEach(site => {
      site.businessInfo.services.slice(0, 3).forEach(service => {
        responses.push(`I'd be happy to discuss our ${service} services with you.`);
      });
    });

    // Context-specific responses
    if (context.callType === 'outbound') {
      responses.push(`I'm calling to follow up on your interest in our services.`);
      responses.push(`I wanted to reach out to discuss how we might be able to help your business.`);
    }

    // Time-sensitive responses
    if (context.timeOfDay === 'evening') {
      responses.push(`Thanks for calling this evening. I have a few minutes to help you.`);
    }

    // Handoff responses
    responses.push(`Let me connect you with someone who specializes in that area.`);
    responses.push(`I'll have one of our experts get back to you with detailed information.`);

    return responses.slice(0, 10);
  }

  private defineHandoffTriggers(businessData: AggregatedBusinessData, context: PromptContext): string[] {
    const triggers: string[] = [];
    const { contentAnalysis, operationalData } = businessData;

    // Standard handoff scenarios
    triggers.push("When customer requests pricing for custom solutions");
    triggers.push("When technical specifications are needed");
    triggers.push("When customer wants to schedule an appointment");
    triggers.push("When complaint resolution requires management");
    
    // Business-specific triggers based on expertise
    if (contentAnalysis.expertiseAreas.length > 0) {
      contentAnalysis.expertiseAreas.slice(0, 3).forEach(area => {
        triggers.push(`When deep expertise in ${area} is required`);
      });
    }

    // Time-based triggers
    if (operationalData.businessHours.length > 0) {
      triggers.push("When calling outside business hours");
    }

    // Context-specific triggers
    if (context.urgency === 'high') {
      triggers.push("When urgent issues require immediate expert attention");
    }

    return triggers.slice(0, 8);
  }

  private calculateConfidenceScore(businessData: AggregatedBusinessData): number {
    let score = 0;
    const maxScore = 100;

    // Business profile completeness (20 points)
    const profile = businessData.businessProfile;
    if (profile.businessName) score += 5;
    if (profile.description) score += 5;
    if (profile.businessPhone || profile.businessEmail) score += 5;
    if (profile.businessAddress) score += 5;

    // Web presence (25 points)
    if (businessData.webPresence.length > 0) score += 15;
    if (businessData.webPresence.some(site => site.businessInfo.services.length > 0)) score += 10;

    // Document knowledge (25 points)
    if (businessData.documentKnowledge.processedDocuments > 0) score += 15;
    if (businessData.documentKnowledge.chunks.length > 10) score += 10;

    // Call history (15 points)
    if (businessData.callHistory.totalCalls > 5) score += 10;
    if (businessData.callHistory.callPatterns.successfulOutcomes.length > 0) score += 5;

    // Content analysis (15 points)
    if (businessData.contentAnalysis.expertiseAreas.length > 0) score += 8;
    if (businessData.contentAnalysis.brandVoice.length > 0) score += 7;

    return Math.min(score, maxScore);
  }

  private getDataSourcesUsed(businessData: AggregatedBusinessData): string[] {
    const sources: string[] = [];

    if (businessData.businessProfile.businessName) sources.push("Business Profile");
    if (businessData.webPresence.length > 0) sources.push("Website Content");
    if (businessData.documentKnowledge.processedDocuments > 0) sources.push("Document Knowledge");
    if (businessData.callHistory.totalCalls > 0) sources.push("Call History");
    if (businessData.leadInsights.totalLeads > 0) sources.push("Lead Data");
    if (businessData.competitiveIntel.industryKeywords.length > 0) sources.push("Market Intelligence");

    return sources;
  }

  private determineBrandPersonality(contentAnalysis: AggregatedBusinessData['contentAnalysis']): string {
    if (contentAnalysis.brandVoice.includes('Professional and Expert')) {
      return 'expert';
    } else if (contentAnalysis.brandVoice.includes('Warm and Approachable')) {
      return 'friendly';
    } else if (contentAnalysis.brandVoice.includes('Authoritative and Confident')) {
      return 'authoritative';
    }
    return 'balanced';
  }

  private determineExpertiseLevel(businessData: AggregatedBusinessData): string {
    const { documentKnowledge, contentAnalysis, competitiveIntel } = businessData;
    
    let expertiseIndicators = 0;
    
    if (documentKnowledge.processedDocuments > 10) expertiseIndicators++;
    if (contentAnalysis.expertiseAreas.length > 5) expertiseIndicators++;
    if (competitiveIntel.marketPosition.includes('leader')) expertiseIndicators++;
    if (contentAnalysis.brandVoice.includes('Expert')) expertiseIndicators++;

    if (expertiseIndicators >= 3) return 'expert';
    if (expertiseIndicators >= 2) return 'specialized';
    return 'general';
  }
}

export const intelligentPromptBuilder = new IntelligentPromptBuilder();