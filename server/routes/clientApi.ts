import { Router, Request, Response } from "express";
import { storage } from "../storage";

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
      // Include file information for context
      files: businessInfo.fileNames?.map((name: string, index: number) => ({
        name,
        type: businessInfo.fileTypes?.[index],
        url: businessInfo.fileUrls?.[index]
      })) || [],
      // Include lead sources
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
    
    // Apply pagination
    const paginatedCalls = calls.slice(offset, offset + limit);
    
    // Format calls for voice agent use
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
      // Include for pattern analysis
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
    
    // Filter calls by date range
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const recentCalls = calls.filter(call => 
      call.createdAt && new Date(call.createdAt) > cutoffDate
    );

    // Analyze patterns
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
      // Recent successful conversation examples
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
    const leads = await storage.getLeadsByUserId(user.id);
    
    // Format leads for voice agent use
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

// Get client profile summary for voice agent personalization
router.get('/profile', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const businessInfo = await storage.getBusinessInfo(user.id);
    const calls = await storage.getCallsByUserId(user.id);
    const leads = await storage.getLeadsByUserId(user.id);

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
        // Can be expanded based on user settings
        servicePlan: user.servicePlan,
        autoLogging: true // Based on Twilio integration
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