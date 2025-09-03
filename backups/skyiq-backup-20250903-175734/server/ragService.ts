import { db } from "./db";
import { documents, documentChunks, businessInfo } from "@shared/schema";
import { eq, and, like, or } from "drizzle-orm";

export class RAGService {
  
  // Process all files and links for a user
  async processUserDocuments(userId: number): Promise<void> {
    console.log(`Starting document processing for user ${userId}`);
    
    // Get user's business info with files and links
    const userBusiness = await db
      .select()
      .from(businessInfo)
      .where(eq(businessInfo.userId, userId))
      .limit(1);

    if (userBusiness.length === 0) {
      console.log(`No business info found for user ${userId}`);
      return;
    }

    const business = userBusiness[0];
    
    // Process files
    if (business.fileUrls && business.fileNames && business.fileTypes) {
      for (let i = 0; i < business.fileUrls.length; i++) {
        const fileUrl = business.fileUrls[i];
        const fileName = business.fileNames[i];
        const fileType = business.fileTypes[i];
        
        await this.processDocument(userId, {
          sourceType: "file",
          sourceUrl: fileUrl,
          title: fileName,
          contentType: fileType
        });
      }
    }

    // Process links
    if (business.links) {
      for (const link of business.links) {
        await this.processDocument(userId, {
          sourceType: "link", 
          sourceUrl: link,
          title: this.extractDomainFromUrl(link),
          contentType: "webpage"
        });
      }
    }
  }

  // Process individual document or link
  private async processDocument(userId: number, docInfo: {
    sourceType: string;
    sourceUrl: string;
    title: string;
    contentType: string;
  }): Promise<void> {
    try {
      // Check if document already exists
      const existingDoc = await db
        .select()
        .from(documents)
        .where(and(
          eq(documents.userId, userId),
          eq(documents.sourceUrl, docInfo.sourceUrl)
        ))
        .limit(1);

      if (existingDoc.length > 0) {
        console.log(`Document ${docInfo.title} already processed`);
        return;
      }

      // Create document record
      const [newDoc] = await db
        .insert(documents)
        .values({
          userId,
          sourceType: docInfo.sourceType,
          sourceUrl: docInfo.sourceUrl,
          title: docInfo.title,
          contentType: docInfo.contentType,
          status: "processing"
        })
        .returning();

      console.log(`Processing document: ${docInfo.title}`);

      let extractedText = "";
      
      // Extract text based on source type
      if (docInfo.sourceType === "link") {
        extractedText = await this.extractTextFromWebpage(docInfo.sourceUrl);
      } else if (docInfo.sourceType === "file") {
        extractedText = await this.extractTextFromFile(docInfo.sourceUrl, docInfo.contentType);
      }

      if (!extractedText || extractedText.trim().length === 0) {
        await this.updateDocumentStatus(newDoc.id, "failed", "No text content extracted");
        return;
      }

      // Update document with extracted text
      await db
        .update(documents)
        .set({
          extractedText,
          status: "completed",
          processedAt: new Date()
        })
        .where(eq(documents.id, newDoc.id));

      // Create chunks
      await this.createDocumentChunks(newDoc.id, userId, extractedText);
      
      console.log(`Successfully processed: ${docInfo.title}`);

    } catch (error) {
      console.error(`Error processing document ${docInfo.title}:`, error);
      // Update status to failed if document was created
    }
  }

  // Extract text from webpage
  private async extractTextFromWebpage(url: string): Promise<string> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Sky IQ Document Processor)'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const html = await response.text();
      
      // Basic HTML text extraction (remove tags, scripts, styles)
      let text = html
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/<style[^>]*>.*?<\/style>/gi, '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Clean up common web artifacts
      text = text
        .replace(/\b(cookie|privacy policy|terms of service|subscribe|newsletter)\b/gi, '')
        .replace(/^\s*[\r\n]/gm, '')
        .trim();
      
      return text.slice(0, 50000); // Limit to 50KB of text
      
    } catch (error) {
      console.error(`Error extracting text from webpage ${url}:`, error);
      return "";
    }
  }

  // Extract text from file (basic implementation)
  private async extractTextFromFile(fileUrl: string, contentType: string): Promise<string> {
    try {
      // For now, we'll handle text files and basic extraction
      // This can be expanded to handle PDFs, Word docs, etc.
      
      if (contentType?.includes('text/')) {
        const response = await fetch(fileUrl);
        if (response.ok) {
          return await response.text();
        }
      }
      
      // For other file types, return filename and type info for now
      const filename = fileUrl.split('/').pop() || 'unknown';
      return `Document: ${filename}\nType: ${contentType}\nContent: This document is available for reference.`;
      
    } catch (error) {
      console.error(`Error extracting text from file ${fileUrl}:`, error);
      return "";
    }
  }

  // Create searchable chunks from extracted text
  private async createDocumentChunks(documentId: number, userId: number, text: string): Promise<void> {
    const chunkSize = 1000; // Characters per chunk
    const chunks = this.splitTextIntoChunks(text, chunkSize);
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const wordCount = chunk.split(/\s+/).length;
      const keywords = this.extractKeywords(chunk);
      const summary = this.generateSimpleSummary(chunk);
      
      await db
        .insert(documentChunks)
        .values({
          documentId,
          userId,
          chunkIndex: i,
          content: chunk,
          wordCount,
          summary,
          keywords
        });
    }
  }

  // Split text into manageable chunks
  private splitTextIntoChunks(text: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    let currentChunk = "";
    
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if ((currentChunk + trimmedSentence).length <= chunkSize) {
        currentChunk += (currentChunk ? ". " : "") + trimmedSentence;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk + ".");
        }
        currentChunk = trimmedSentence;
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk + ".");
    }
    
    return chunks;
  }

  // Extract keywords using simple text analysis
  private extractKeywords(text: string): string[] {
    const commonWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
      'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them'
    ]);
    
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !commonWords.has(word));
    
    // Count word frequency
    const wordCounts: { [key: string]: number } = {};
    words.forEach(word => {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    });
    
    // Return top 10 most frequent words
    return Object.entries(wordCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  // Generate simple summary (first sentence + key points)
  private generateSimpleSummary(text: string): string {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    if (sentences.length === 0) return "";
    if (sentences.length === 1) return sentences[0].trim() + ".";
    
    // Take first sentence as intro
    let summary = sentences[0].trim();
    
    // Add key sentences (those with important keywords)
    const keywordPatterns = /\b(important|key|main|primary|essential|critical|significant|major)\b/i;
    const keySentences = sentences.slice(1, 4).filter(s => keywordPatterns.test(s));
    
    if (keySentences.length > 0) {
      summary += ". " + keySentences[0].trim();
    }
    
    return summary + ".";
  }

  // Search through document chunks
  async searchDocuments(userId: number, query: string, limit: number = 10): Promise<any[]> {
    const startTime = Date.now();
    
    // Split query into keywords
    const queryKeywords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    
    // Search in content and keywords
    const searchConditions = queryKeywords.map(keyword => 
      or(
        like(documentChunks.content, `%${keyword}%`),
        like(documentChunks.summary, `%${keyword}%`)
      )
    );
    
    const results = await db
      .select({
        chunkId: documentChunks.id,
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
        or(...searchConditions)
      ))
      .limit(limit);
    
    const responseTime = Date.now() - startTime;
    
    // Log search query  
    const { searchQueries } = await import("@shared/schema");
    await db
      .insert(searchQueries)
      .values({
        userId,
        query,
        resultsCount: results.length,
        responseTime
      });
    
    return results;
  }

  // Get document status for a user
  async getDocumentStatus(userId: number): Promise<any> {
    const docs = await db
      .select()
      .from(documents)
      .where(eq(documents.userId, userId));
    
    const totalChunks = await db
      .select({ count: documentChunks.id })
      .from(documentChunks)
      .where(eq(documentChunks.userId, userId));
    
    return {
      totalDocuments: docs.length,
      processedDocuments: docs.filter(d => d.status === 'completed').length,
      failedDocuments: docs.filter(d => d.status === 'failed').length,
      totalChunks: totalChunks.length,
      documents: docs.map(d => ({
        id: d.id,
        title: d.title,
        sourceType: d.sourceType,
        status: d.status,
        processedAt: d.processedAt
      }))
    };
  }

  // Update document status
  private async updateDocumentStatus(documentId: number, status: string, errorMessage?: string): Promise<void> {
    await db
      .update(documents)
      .set({
        status,
        errorMessage,
        processedAt: status === 'completed' || status === 'failed' ? new Date() : undefined
      })
      .where(eq(documents.id, documentId));
  }

  // Extract domain from URL for title
  private extractDomainFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return url;
    }
  }
}

export const ragService = new RAGService();