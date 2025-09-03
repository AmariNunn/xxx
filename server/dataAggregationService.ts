import { db } from "./db";
import { businessInfo, leads, documents, documentChunks } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { enhancedWebScraper, type ComprehensiveWebData } from "./enhancedWebScraper";
import { ragService } from "./ragService";
import type { BusinessInfo, Lead, DocumentChunk } from "@shared/schema";

export interface AggregatedBusinessData {
  businessProfile: BusinessInfo;
  webPresence: ComprehensiveWebData[];
  documentKnowledge: {
    totalDocuments: number;
    processedDocuments: number;
    chunks: DocumentChunk[];
    keyTopics: string[];
    summaries: string[];
  };
  leadInsights: {
    totalLeads: number;
    recentLeads: Lead[];
    leadSources: string[];
    conversionPatterns: string[];
  };
  competitiveIntel: {
    industryKeywords: string[];
    marketPosition: string;
    uniqueValueProps: string[];
  };
  contentAnalysis: {
    brandVoice: string[];
    messagingThemes: string[];
    expertiseAreas: string[];
    customerPainPoints: string[];
  };
  operationalData: {
    businessHours: string[];
    contactMethods: string[];
    serviceDelivery: string[];
    teamStructure: string[];
  };
  lastUpdated: Date;
}

export class DataAggregationService {
  private readonly CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes
  private cache = new Map<number, { data: AggregatedBusinessData; expires: number }>();

  async aggregateBusinessData(userId: number, forceRefresh = false): Promise<AggregatedBusinessData> {
    // Check cache first
    if (!forceRefresh) {
      const cached = this.cache.get(userId);
      if (cached && cached.expires > Date.now()) {
        console.log(`Returning cached business data for user ${userId}`);
        return cached.data;
      }
    }

    console.log(`Aggregating comprehensive business data for user ${userId}${forceRefresh ? ' (forced refresh)' : ''}`);

    try {
      // Fetch all data sources in parallel for efficiency
      const [
        businessProfile,
        recentLeads,
        documentStatus,
        documentChunks
      ] = await Promise.all([
        this.getBusinessProfile(userId),
        this.getLeadInsights(userId),
        ragService.getDocumentStatus(userId),
        this.getDocumentChunks(userId)
      ]);

      // Process web presence data
      const webPresence = await this.processWebPresence(businessProfile);

      // Aggregate all data
      const aggregatedData: AggregatedBusinessData = {
        businessProfile,
        webPresence,
        documentKnowledge: this.processDocumentKnowledge(documentStatus, documentChunks),
        leadInsights: this.processLeadInsights(recentLeads),
        competitiveIntel: this.analyzeCompetitiveIntelligence(businessProfile, webPresence, documentChunks),
        contentAnalysis: this.analyzeContentThemes(businessProfile, webPresence, documentChunks),
        operationalData: this.extractOperationalData(businessProfile, webPresence),
        lastUpdated: new Date()
      };

      // Cache the result
      this.cache.set(userId, {
        data: aggregatedData,
        expires: Date.now() + this.CACHE_DURATION_MS
      });

      console.log(`Successfully aggregated business data for user ${userId}: ${webPresence.length} websites, ${documentChunks.length} document chunks, ${recentLeads.length} leads`);

      return aggregatedData;

    } catch (error) {
      console.error(`Error aggregating business data for user ${userId}:`, error);
      throw error;
    }
  }

  private async getBusinessProfile(userId: number): Promise<BusinessInfo> {
    const [profile] = await db
      .select()
      .from(businessInfo)
      .where(eq(businessInfo.userId, userId))
      .limit(1);

    if (!profile) {
      throw new Error(`No business profile found for user ${userId}`);
    }

    return profile;
  }


  private async getLeadInsights(userId: number): Promise<Lead[]> {
    return await db
      .select()
      .from(leads)
      .where(eq(leads.userId, userId))
      .orderBy(desc(leads.createdAt))
      .limit(25);
  }

  private async getDocumentChunks(userId: number): Promise<any[]> {
    const chunks = await db
      .select({
        id: documentChunks.id,
        documentId: documentChunks.documentId,
        content: documentChunks.content,
        summary: documentChunks.summary,
        keywords: documentChunks.keywords,
        chunkIndex: documentChunks.chunkIndex,
        documentTitle: documents.title,
        sourceType: documents.sourceType,
        sourceUrl: documents.sourceUrl
      })
      .from(documentChunks)
      .innerJoin(documents, eq(documentChunks.documentId, documents.id))
      .where(and(
        eq(documentChunks.userId, userId),
        eq(documents.status, 'completed')
      ))
      .orderBy(desc(documentChunks.id))
      .limit(100);

    return chunks;
  }

  private async processWebPresence(businessProfile: BusinessInfo): Promise<ComprehensiveWebData[]> {
    const webData: ComprehensiveWebData[] = [];
    const linksToScrape = new Set<string>();

    console.log(`Processing web presence for ${businessProfile.name || 'business'}, raw links:`, businessProfile.links);

    // Add business website links
    if (businessProfile.links) {
      businessProfile.links.forEach(link => {
        console.log(`Processing link: ${link}`);
        const normalizedUrl = this.normalizeUrl(link);
        if (normalizedUrl) {
          console.log(`Successfully normalized and added: ${normalizedUrl}`);
          linksToScrape.add(normalizedUrl);
        }
      });
    }

    console.log(`Total links to scrape: ${linksToScrape.size}`, Array.from(linksToScrape));

    // Scrape all unique links
    const scrapePromises = Array.from(linksToScrape).map(async (url) => {
      try {
        const scrapedData = await enhancedWebScraper.scrapeWebsite(url);
        return scrapedData;
      } catch (error) {
        console.error(`Failed to scrape ${url}:`, error);
        return null;
      }
    });

    const results = await Promise.all(scrapePromises);
    results.forEach(result => {
      if (result) {
        webData.push(result);
      }
    });

    return webData;
  }

  private processDocumentKnowledge(documentStatus: any, chunks: any[]): AggregatedBusinessData['documentKnowledge'] {
    const allKeywords = new Set<string>();
    const summaries: string[] = [];

    chunks.forEach(chunk => {
      if (chunk.keywords) {
        chunk.keywords.forEach((kw: string) => allKeywords.add(kw));
      }
      if (chunk.summary) {
        summaries.push(chunk.summary);
      }
    });

    return {
      totalDocuments: documentStatus.totalDocuments,
      processedDocuments: documentStatus.processedDocuments,
      chunks,
      keyTopics: Array.from(allKeywords).slice(0, 30),
      summaries: summaries.slice(0, 20)
    };
  }


  private processLeadInsights(leads: Lead[]): AggregatedBusinessData['leadInsights'] {
    const leadSources = new Set<string>();
    const conversionPatterns: string[] = [];

    leads.forEach(lead => {
      if (lead.company) {
        leadSources.add(lead.company);
      }
      if (lead.notes) {
        conversionPatterns.push(lead.notes);
      }
    });

    return {
      totalLeads: leads.length,
      recentLeads: leads.slice(0, 10),
      leadSources: Array.from(leadSources).slice(0, 15),
      conversionPatterns: conversionPatterns.slice(0, 10)
    };
  }

  private analyzeCompetitiveIntelligence(
    businessProfile: BusinessInfo, 
    webData: ComprehensiveWebData[], 
    documentChunks: any[]
  ): AggregatedBusinessData['competitiveIntel'] {
    const industryKeywords = new Set<string>();
    const uniqueValueProps: string[] = [];

    // Extract industry keywords from web content
    webData.forEach(site => {
      site.keywords.forEach(kw => industryKeywords.add(kw));
      
      // Look for value proposition indicators
      const valueIndicators = ['unique', 'exclusive', 'only', 'first', 'leading', 'expert', 'specialized'];
      site.businessInfo.aboutSections.forEach(section => {
        valueIndicators.forEach(indicator => {
          if (section.toLowerCase().includes(indicator)) {
            const sentence = this.extractSentenceContaining(section, indicator);
            if (sentence) uniqueValueProps.push(sentence);
          }
        });
      });
    });

    // Extract from document knowledge
    documentChunks.forEach(chunk => {
      if (chunk.keywords) {
        chunk.keywords.forEach((kw: string) => industryKeywords.add(kw));
      }
    });

    // Determine market position
    const businessDesc = businessProfile.description?.toLowerCase() || '';
    let marketPosition = 'established business';
    if (businessDesc.includes('startup') || businessDesc.includes('new')) {
      marketPosition = 'emerging startup';
    } else if (businessDesc.includes('leading') || businessDesc.includes('established')) {
      marketPosition = 'market leader';
    } else if (businessDesc.includes('boutique') || businessDesc.includes('specialized')) {
      marketPosition = 'niche specialist';
    }

    return {
      industryKeywords: Array.from(industryKeywords).slice(0, 25),
      marketPosition,
      uniqueValueProps: uniqueValueProps.slice(0, 10)
    };
  }

  private analyzeContentThemes(
    businessProfile: BusinessInfo, 
    webData: ComprehensiveWebData[], 
    documentChunks: any[]
  ): AggregatedBusinessData['contentAnalysis'] {
    const brandVoice: string[] = [];
    const messagingThemes = new Set<string>();
    const expertiseAreas = new Set<string>();
    const customerPainPoints: string[] = [];

    // Analyze web content for brand voice
    webData.forEach(site => {
      // Extract brand voice from about sections
      site.businessInfo.aboutSections.forEach(section => {
        if (section.length > 100) {
          brandVoice.push(this.analyzeToneFromText(section));
        }
      });

      // Extract messaging themes from services/products
      site.businessInfo.services.forEach(service => messagingThemes.add(service));
      site.businessInfo.products.forEach(product => messagingThemes.add(product));

      // Expertise areas from structured data and meta
      if (site.structuredData) {
        site.structuredData.forEach(data => {
          if (data.expertise) expertiseAreas.add(data.expertise);
          if (data.specialty) expertiseAreas.add(data.specialty);
        });
      }
    });

    // Extract from document knowledge
    documentChunks.forEach(chunk => {
      if (chunk.content) {
        // Look for pain points (problems, challenges, issues)
        const painPointPatterns = [
          /problem[s]?\s+with/gi, /challenge[s]?\s+of/gi, /issue[s]?\s+in/gi,
          /difficulty\s+in/gi, /struggle[s]?\s+with/gi, /concern[s]?\s+about/gi
        ];
        
        painPointPatterns.forEach(pattern => {
          const matches = chunk.content.match(pattern);
          if (matches) {
            const context = this.extractContextAroundMatch(chunk.content, matches[0]);
            if (context) customerPainPoints.push(context);
          }
        });
      }
    });

    return {
      brandVoice: brandVoice.slice(0, 5),
      messagingThemes: Array.from(messagingThemes).slice(0, 20),
      expertiseAreas: Array.from(expertiseAreas).slice(0, 15),
      customerPainPoints: customerPainPoints.slice(0, 10)
    };
  }

  private extractOperationalData(
    businessProfile: BusinessInfo, 
    webData: ComprehensiveWebData[]
  ): AggregatedBusinessData['operationalData'] {
    const businessHours = new Set<string>();
    const contactMethods = new Set<string>();
    const serviceDelivery: string[] = [];
    const teamStructure: string[] = [];

    // Extract from web data
    webData.forEach(site => {
      site.businessInfo.hours.forEach(hour => businessHours.add(hour));
      site.businessInfo.teamMembers.forEach(member => teamStructure.push(member));
      
      // Contact methods from contact info
      if (site.contactInfo.emails.length > 0) contactMethods.add('Email');
      if (site.contactInfo.phones.length > 0) contactMethods.add('Phone');
      if (site.contactInfo.socialMedia.length > 0) contactMethods.add('Social Media');
    });

    // From business profile
    if (businessProfile.businessPhone) contactMethods.add('Phone');
    if (businessProfile.businessEmail) contactMethods.add('Email');

    return {
      businessHours: Array.from(businessHours).slice(0, 7),
      contactMethods: Array.from(contactMethods),
      serviceDelivery: serviceDelivery.slice(0, 10),
      teamStructure: teamStructure.slice(0, 15)
    };
  }

  private isValidUrl(string: string): boolean {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  private normalizeUrl(input: string): string | null {
    if (!input || typeof input !== 'string') return null;
    
    // Clean up the input
    let url = input.trim();
    
    // Skip email addresses
    if (url.includes('@') && !url.includes('://')) {
      console.log(`Skipping email address: ${url}`);
      return null;
    }
    
    // Skip if it's clearly not a domain/URL
    if (url.length < 4) {
      console.log(`Skipping too short: ${url}`);
      return null;
    }
    
    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    // Validate the constructed URL
    try {
      const urlObj = new URL(url);
      // Basic domain validation
      if (urlObj.hostname && urlObj.hostname.includes('.')) {
        console.log(`Normalized URL: ${input} -> ${url}`);
        return url;
      }
    } catch (error) {
      console.log(`Failed to normalize URL: ${input} - ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    return null;
  }

  private extractSentenceContaining(text: string, keyword: string): string {
    const sentences = text.split(/[.!?]+/);
    const targetSentence = sentences.find(sentence => 
      sentence.toLowerCase().includes(keyword.toLowerCase())
    );
    return targetSentence?.trim() || '';
  }

  private analyzeToneFromText(text: string): string {
    const professionalIndicators = ['expertise', 'professional', 'certified', 'licensed', 'qualified'];
    const friendlyIndicators = ['welcome', 'happy', 'love', 'enjoy', 'passion'];
    const authoritativeIndicators = ['leading', 'industry', 'expert', 'proven', 'established'];

    const textLower = text.toLowerCase();
    
    if (professionalIndicators.some(ind => textLower.includes(ind))) {
      return 'Professional and Expert';
    } else if (friendlyIndicators.some(ind => textLower.includes(ind))) {
      return 'Warm and Approachable';
    } else if (authoritativeIndicators.some(ind => textLower.includes(ind))) {
      return 'Authoritative and Confident';
    }
    
    return 'Informative and Clear';
  }

  private extractContextAroundMatch(text: string, match: string): string {
    const index = text.toLowerCase().indexOf(match.toLowerCase());
    if (index === -1) return '';
    
    const start = Math.max(0, index - 50);
    const end = Math.min(text.length, index + match.length + 50);
    
    return text.slice(start, end).trim();
  }

  // Clear cache for a specific user or all users
  clearCache(userId?: number): void {
    if (userId) {
      this.cache.delete(userId);
      console.log(`Cleared cache for user ${userId}`);
    } else {
      this.cache.clear();
      console.log('Cleared all cached business data');
    }
  }

  // Get cache statistics
  getCacheStats(): { totalCached: number; cacheHitRate: number } {
    return {
      totalCached: this.cache.size,
      cacheHitRate: 0 // Would need to track hits/misses for accurate rate
    };
  }
}

export const dataAggregationService = new DataAggregationService();