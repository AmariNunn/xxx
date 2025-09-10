import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { buildPrompt } from "../promptBuilder";
import { buildEnhancedPrompt } from "../enhancedPromptBuilder";
import { db } from "../db";
import { documentChunks, documents } from "@shared/schema";
import { eq, and } from "drizzle-orm"; 

const router = Router();

// Middleware to validate API key
async function validateApiKey(req: Request, res: Response, next: any) {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    return res.status(401).json({ 
      error: "API key required", 
      message: "Include your API key in the X-API-Key header" 
    });
  }

  try {
    const user = await storage.validateApiKey(apiKey);
    if (!user) {
      return res.status(401).json({ 
        error: "Invalid API key", 
        message: "The provided API key is not valid or has been revoked" 
      });
    }

    // Add user to request for use in routes
    (req as any).user = user;
    next();
  } catch (error) {
    console.error("API key validation error:", error);
    res.status(500).json({ 
      error: "Internal server error", 
      message: "Failed to validate API key" 
    });
  }
}

// Apply API key validation to all routes
router.use(validateApiKey);

// Get client business information
router.get('/business', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const businessInfo = await storage.getBusinessInfo(user.id);

    if (!businessInfo) {
      return res.status(404).json({
        error: "Business info not found",
        message: "No business information available for this client"
      });
    }

    // Return sanitized business info for voice agent customization
    const voiceAgentData = {
      businessName: businessInfo.businessName,
      businessEmail: businessInfo.businessEmail,
      businessPhone: businessInfo.businessPhone,
      businessAddress: businessInfo.businessAddress,
      description: businessInfo.description,
      links: businessInfo.links || [],
      servicePlan: user.servicePlan,
      website: user.website,
      files: businessInfo.fileNames?.map((name: string, index: number) => ({
        name,
        type: businessInfo.fileTypes?.[index],
        url: businessInfo.fileUrls?.[index]
      })) || [],
      leadSources: businessInfo.leadNames?.map((name: string, index: number) => ({
        name,
        type: businessInfo.leadTypes?.[index],
        url: businessInfo.leadUrls?.[index]
      })) || []
    };

    res.json({
      success: true,
      data: voiceAgentData,
      clientId: user.id,
      lastUpdated: businessInfo.updatedAt
    });
  } catch (error) {
    console.error("Error fetching client business data:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to retrieve business information"
    });
  }
});

// Get client call data for voice agent training
router.get('/calls', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const calls = await storage.getCallsByUserId(user.id);
    const paginatedCalls = calls.slice(offset, offset + limit);

    const voiceAgentCalls = paginatedCalls.map(call => ({
      id: call.id,
      phoneNumber: call.phoneNumber,
      contactName: call.contactName,
      duration: call.duration,
      status: call.status,
      direction: call.direction,
      summary: call.summary,
      transcript: call.transcript,
      notes: call.notes,
      createdAt: call.createdAt,
      isFromTwilio: call.isFromTwilio
    }));

    res.json({
      success: true,
      data: voiceAgentCalls,
      pagination: {
        total: calls.length,
        limit,
        offset,
        hasMore: (offset + limit) < calls.length
      },
      clientId: user.id
    });
  } catch (error) {
    console.error("Error fetching client calls:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to retrieve call data"
    });
  }
});

// Get recent call patterns for voice agent optimization
router.get('/call-patterns', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const days = parseInt(req.query.days as string) || 30;

    const calls = await storage.getCallsByUserId(user.id);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const recentCalls = calls.filter(call => 
      call.createdAt && new Date(call.createdAt) > cutoffDate
    );

    const patterns = {
      totalCalls: recentCalls.length,
      averageDuration: recentCalls.length > 0 
        ? Math.round(recentCalls.reduce((sum, call) => sum + (call.duration || 0), 0) / recentCalls.length)
        : 0,
      statusBreakdown: {
        completed: recentCalls.filter(c => c.status === 'completed').length,
        missed: recentCalls.filter(c => c.status === 'missed').length,
        failed: recentCalls.filter(c => c.status === 'failed').length
      },
      directionBreakdown: {
        inbound: recentCalls.filter(c => c.direction === 'inbound').length,
        outbound: recentCalls.filter(c => c.direction === 'outbound').length
      },
      commonContacts: recentCalls
        .filter(call => call.contactName)
        .reduce((acc: any, call) => {
          acc[call.contactName!] = (acc[call.contactName!] || 0) + 1;
          return acc;
        }, {}),
      busyHours: recentCalls.reduce((acc: any, call) => {
        if (call.createdAt) {
          const hour = new Date(call.createdAt).getHours();
          acc[hour] = (acc[hour] || 0) + 1;
        }
        return acc;
      }, {}),
      successfulExamples: recentCalls
        .filter(call => call.status === 'completed' && call.summary)
        .slice(-5)
        .map(call => ({
          summary: call.summary,
          duration: call.duration,
          notes: call.notes
        }))
    };

    res.json({
      success: true,
      data: patterns,
      dateRange: {
        from: cutoffDate.toISOString(),
        to: new Date().toISOString(),
        days
      },
      clientId: user.id
    });
  } catch (error) {
    console.error("Error analyzing call patterns:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to analyze call patterns"
    });
  }
});

// Get client leads for voice agent context
router.get('/leads', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const leads = await storage.getCallsByUserId(user.id);

    const voiceAgentLeads = leads.map((lead: any) => ({
      id: lead.id,
      name: lead.name,
      phoneNumber: lead.phoneNumber,
      email: lead.email,
      company: lead.company,
      notes: lead.notes,
      createdAt: lead.createdAt
    }));

    res.json({
      success: true,
      data: voiceAgentLeads,
      total: leads.length,
      clientId: user.id
    });
  } catch (error) {
    console.error("Error fetching client leads:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to retrieve leads"
    });
  }
});

// Get client profile summary
router.get('/profile', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const businessInfo = await storage.getBusinessInfo(user.id);
    const calls = await storage.getCallsByUserId(user.id);
    const leads = await storage.getCallsByUserId(user.id);

    const profile = {
      client: {
        id: user.id,
        businessName: user.businessName,
        email: user.email,
        phone: user.phoneNumber,
        website: user.website,
        servicePlan: user.servicePlan,
        joinedDate: user.createdAt
      },
      business: businessInfo ? {
        description: businessInfo.description,
        address: businessInfo.businessAddress,
        email: businessInfo.businessEmail,
        phone: businessInfo.businessPhone
      } : null,
      activity: {
        totalCalls: calls.length,
        totalLeads: leads.length,
        recentCallsCount: calls.filter(call => {
          if (!call.createdAt) return false;
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return new Date(call.createdAt) > weekAgo;
        }).length,
        lastCallDate: calls.length > 0 
          ? calls
              .filter(call => call.createdAt)
              .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())[0]?.createdAt || null
          : null
      },
      preferences: {
        servicePlan: user.servicePlan,
        autoLogging: true
      }
    };

    res.json({
      success: true,
      data: profile,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error generating client profile:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to generate client profile"
    });
  }
});

// 🔥 Enhanced endpoint: Get AI-ready prompt with RAG data
router.get('/prompt', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const businessInfo = await storage.getBusinessInfo(user.id);

    if (!businessInfo) {
      return res.status(404).json({ 
        error: "Business info not found",
        message: "No business information available for this client"
      });
    }

    // Get processed document chunks for knowledge base (fallback to empty if tables don't exist)
    let rawDocumentChunks: any[] = [];
    let documentsCount = 0;
    
    try {
      rawDocumentChunks = await db
        .select({
          id: documentChunks.id,
          documentId: documentChunks.documentId,
          content: documentChunks.content,
          summary: documentChunks.summary,
          keywords: documentChunks.keywords,
          chunkIndex: documentChunks.chunkIndex,
          wordCount: documentChunks.wordCount,
          userId: documentChunks.userId,
          createdAt: documentChunks.createdAt,
          documentTitle: documents.title,
          sourceType: documents.sourceType
        })
        .from(documentChunks)
        .innerJoin(documents, eq(documentChunks.documentId, documents.id))
        .where(and(
          eq(documentChunks.userId, user.id),
          eq(documents.status, 'completed')
        ))
        .orderBy(documentChunks.documentId, documentChunks.chunkIndex)
        .limit(50);

      const uniqueDocumentIds = new Set(rawDocumentChunks.map(c => c.documentId));
      documentsCount = Array.from(uniqueDocumentIds).length;
    } catch (error) {
      console.log("RAG tables not ready yet, using basic prompt");
      rawDocumentChunks = [];
      documentsCount = 0;
    }

    // Build enhanced prompt with document knowledge
    const aiPrompt = buildEnhancedPrompt(businessInfo, rawDocumentChunks);

    res.json({
      success: true,
      prompt: aiPrompt,
      clientId: user.id,
      knowledgeBaseSize: rawDocumentChunks.length,
      documentsProcessed: documentsCount,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error building enhanced prompt:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to generate enhanced prompt"
    });
  }
});

// Health check endpoint
router.get('/health', (req: Request, res: Response) => {
  const user = (req as any).user;
  res.json({
    success: true,
    message: "Client API is operational",
    clientId: user.id,
    timestamp: new Date().toISOString()
  });
});

export default router;
