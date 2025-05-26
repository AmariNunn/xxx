import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertUserSchema, 
  loginUserSchema, 
  forgotPasswordSchema,
  callStatusEnum,
  calls
} from "@shared/schema";
import businessRoutes from "./routes/business";
import { db } from "./db";
import { eq } from "drizzle-orm";

export async function registerRoutes(app: Express): Promise<Server> {
  // Get authenticated user
  app.get("/api/auth/user/:id", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Return user data without password
      const { password, ...userWithoutPassword } = user;
      res.status(200).json({ data: userWithoutPassword });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user data" });
    }
  });
  
  // Register business routes
  app.use(businessRoutes);
  // Auth routes
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      // Validate request body
      const validation = insertUserSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid input data", 
          errors: validation.error.format() 
        });
      }

      // Create new user
      const newUser = await storage.createUser(validation.data);
      
      // Return success without password
      const { password, ...userWithoutPassword } = newUser;
      res.status(201).json({
        message: "User registered successfully",
        user: userWithoutPassword
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      // Validate request body
      const validation = loginUserSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid input data", 
          errors: validation.error.format() 
        });
      }

      // Validate credentials
      const user = await storage.validateUserCredentials(validation.data);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Return success without password
      const { password, ...userWithoutPassword } = user;
      res.status(200).json({
        message: "Login successful",
        user: userWithoutPassword
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Login failed" });
    }
  });

  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    try {
      // Validate request body
      const validation = forgotPasswordSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid input data", 
          errors: validation.error.format() 
        });
      }

      // Request password reset
      await storage.requestPasswordReset(validation.data);
      
      // Always return success for security reasons (don't disclose if email exists)
      res.status(200).json({ message: "Password reset instructions sent if email exists" });
    } catch (error: any) {
      res.status(500).json({ message: "Password reset request failed" });
    }
  });
  
  // Create a new call
  app.post("/api/calls", async (req: Request, res: Response) => {
    try {
      const callData = req.body;
      
      // Validate user ID
      if (!callData.userId || isNaN(parseInt(callData.userId))) {
        return res.status(400).json({ message: "Valid user ID is required" });
      }
      
      // Process duration
      let duration = 0;
      if (callData.duration) {
        if (typeof callData.duration === 'number') {
          duration = callData.duration;
        } else if (typeof callData.duration === 'string' && callData.duration.includes('m')) {
          // Format: "2m 30s"
          const parts = callData.duration.split('m ');
          const minutes = parseInt(parts[0]) || 0;
          const seconds = parseInt(parts[1]?.split('s')[0]) || 0;
          duration = minutes * 60 + seconds;
        }
      }
      
      // Insert the call into the database
      const result = await db.insert(calls).values({
        userId: parseInt(callData.userId),
        phoneNumber: callData.number || callData.phoneNumber,
        contactName: callData.name || callData.contactName || null,
        duration: duration,
        status: callData.status || "completed",
        notes: callData.notes || null,
        summary: callData.summary || null,
        createdAt: callData.date ? new Date(`${callData.date} ${callData.time || '00:00:00'}`) : new Date()
      }).returning();
      
      res.status(201).json({ 
        message: "Call created successfully", 
        data: result[0] 
      });
    } catch (error) {
      console.error("Error creating call:", error);
      res.status(500).json({ message: "Failed to create call" });
    }
  });
  
  // Delete a call - verify user owns the call before deleting it
  app.delete("/api/calls/:id", async (req: Request, res: Response) => {
    try {
      const callId = parseInt(req.params.id);
      const userId = parseInt(req.query.userId as string);
      
      if (isNaN(callId)) {
        return res.status(400).json({ message: "Invalid call ID" });
      }
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "User ID is required" });
      }
      
      // First verify this call belongs to the user
      const callToDelete = await db.select()
        .from(calls)
        .where(eq(calls.id, callId))
        .limit(1);
      
      if (callToDelete.length === 0) {
        return res.status(404).json({ message: "Call not found" });
      }
      
      if (callToDelete[0].userId !== userId) {
        return res.status(403).json({ message: "Not authorized to delete this call" });
      }
      
      // Delete the call from the database
      const result = await db.delete(calls)
        .where(eq(calls.id, callId))
        .returning();
      
      res.status(200).json({ 
        message: "Call deleted successfully", 
        data: result[0] 
      });
    } catch (error) {
      console.error("Error deleting call:", error);
      res.status(500).json({ message: "Failed to delete call" });
    }
  });
  
  // Get calls by user ID
  app.get("/api/calls/user/:userId", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      // Fetch calls for this user
      const result = await db.select().from(calls).where(eq(calls.userId, userId));
      
      res.status(200).json({ 
        message: "Calls retrieved successfully", 
        data: result 
      });
    } catch (error) {
      console.error("Error fetching calls:", error);
      res.status(500).json({ message: "Failed to fetch calls" });
    }
  });

  // Twilio webhook endpoint to receive real call data
  app.post("/api/twilio/webhook", async (req: Request, res: Response) => {
    try {
      const { twilioService } = await import("./twilioService");
      await twilioService.processCallWebhook(req.body);
      res.status(200).send("OK");
    } catch (error) {
      console.error("Error processing Twilio webhook:", error);
      res.status(500).send("Error processing webhook");
    }
  });

  // Update user's Twilio settings
  app.post("/api/twilio/settings/:userId", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      const { accountSid, authToken, phoneNumber } = req.body;

      if (!accountSid || !authToken || !phoneNumber) {
        return res.status(400).json({ message: "Missing required Twilio settings" });
      }

      // Validate Twilio credentials before saving
      const { twilioService } = await import("./twilioService");
      const isValid = await twilioService.validateUserTwilioCredentials(accountSid, authToken);
      
      if (!isValid) {
        return res.status(400).json({ message: "Invalid Twilio credentials" });
      }

      // Save Twilio settings for the user
      const result = await storage.updateTwilioSettings(userId, {
        accountSid,
        authToken,
        phoneNumber
      });

      res.json({ message: "Twilio settings updated successfully", data: result });
    } catch (error) {
      console.error("Error updating Twilio settings:", error);
      res.status(500).json({ message: "Failed to update Twilio settings" });
    }
  });

  // Get user's Twilio settings
  app.get("/api/twilio/settings/:userId", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      const businessInfo = await storage.getBusinessInfo(userId);
      
      if (businessInfo && businessInfo.twilioAccountSid) {
        res.json({
          connected: true,
          phoneNumber: businessInfo.twilioPhoneNumber,
          accountSid: businessInfo.twilioAccountSid.substring(0, 8) + "..." // Only show partial for security
        });
      } else {
        res.json({ connected: false });
      }
    } catch (error) {
      console.error("Error fetching Twilio settings:", error);
      res.status(500).json({ message: "Failed to fetch Twilio settings" });
    }
  });

  // Get or create user-specific review document
  app.get("/api/users/:userId/review-doc", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      
      // Get user's call data for the review document
      const callsResponse = await fetch(`http://localhost:5000/api/calls/user/${userId}`);
      const callsData = await callsResponse.json();
      const calls = callsData.data || [];
      
      // Get user business info
      const businessResponse = await fetch(`http://localhost:5000/api/business/${userId}`);
      const businessData = await businessResponse.json();
      const businessInfo = businessData.data || {};
      
      // Create user-specific document title with business name
      const businessName = businessInfo.businessName || `User ${userId}`;
      const docTitle = `Call Review & Analytics - ${businessName}`;
      
      // Generate comprehensive Google Doc URL with pre-filled content
      const docContent = encodeURIComponent(generateCallReviewContent(calls, businessInfo));
      const docUrl = `https://docs.google.com/document/create?title=${encodeURIComponent(docTitle)}&body=${docContent}`;
      
      res.json({ 
        docUrl,
        callCount: calls.length,
        businessName: businessName,
        generatedAt: new Date().toISOString()
      });
      
    } catch (error) {
      console.error("Error generating review document:", error);
      res.status(500).json({ message: "Failed to generate review document" });
    }
  });

  // Register admin routes for backend Twilio management
  const { registerAdminRoutes } = await import("./adminRoutes");
  registerAdminRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}

// Helper function to generate detailed call review content
function generateCallReviewContent(calls: any[], businessInfo: any): string {
  const businessName = businessInfo.businessName || "Your Business";
  const totalCalls = calls.length;
  const completedCalls = calls.filter((call: any) => call.status === 'completed').length;
  const missedCalls = calls.filter((call: any) => call.status === 'missed').length;
  const failedCalls = calls.filter((call: any) => call.status === 'failed').length;
  
  // Calculate average call duration
  const callsWithDuration = calls.filter((call: any) => call.duration);
  const totalDuration = callsWithDuration.reduce((sum: number, call: any) => {
    return sum + (call.duration || 0);
  }, 0);
  const avgDuration = callsWithDuration.length > 0 ? Math.round(totalDuration / callsWithDuration.length) : 0;
  
  // Generate recent calls summary
  const recentCalls = calls.slice(-10); // Last 10 calls
  
  const content = `
CALL REVIEW & ANALYTICS REPORT
${businessName}
Generated: ${new Date().toLocaleDateString()}

═══════════════════════════════════════

📊 CALL OVERVIEW
Total Calls: ${totalCalls}
✅ Completed: ${completedCalls} (${totalCalls > 0 ? Math.round(completedCalls/totalCalls * 100) : 0}%)
❌ Missed: ${missedCalls} (${totalCalls > 0 ? Math.round(missedCalls/totalCalls * 100) : 0}%)
⚠️ Failed: ${failedCalls} (${totalCalls > 0 ? Math.round(failedCalls/totalCalls * 100) : 0}%)
⏱️ Average Duration: ${Math.floor(avgDuration / 60)}m ${avgDuration % 60}s

═══════════════════════════════════════

📞 RECENT CALL DETAILS

${recentCalls.map((call: any, index: number) => `
${index + 1}. ${call.contactName || call.phoneNumber}
   📅 Date: ${call.createdAt ? new Date(call.createdAt).toLocaleDateString() : 'N/A'}
   ⏰ Duration: ${call.duration ? `${Math.floor(call.duration / 60)}m ${call.duration % 60}s` : 'N/A'}
   📊 Status: ${call.status?.toUpperCase() || 'UNKNOWN'}
   📝 Summary: ${call.summary || 'No summary available'}
   📋 Notes: ${call.notes || 'No notes'}
   ${call.isFromTwilio ? '🔗 Source: Twilio Integration' : '📱 Source: Manual Entry'}
   ────────────────────────────────────
`).join('')}

═══════════════════════════════════════

📈 INSIGHTS & RECOMMENDATIONS

Call Performance:
• Your call completion rate is ${totalCalls > 0 ? Math.round(completedCalls/totalCalls * 100) : 0}%
• Average call duration suggests ${avgDuration > 180 ? 'detailed conversations' : avgDuration > 60 ? 'standard interactions' : 'brief exchanges'}
• ${missedCalls > 0 ? `Consider follow-up on ${missedCalls} missed calls` : 'Great job - no missed calls!'}

Business Optimization:
• Peak calling patterns: [Analyze your call times]
• Customer satisfaction indicators: [Review call summaries]
• Follow-up opportunities: [Check flagged calls]

Next Steps:
□ Review calls marked for follow-up
□ Analyze successful call patterns
□ Update call scripts based on outcomes
□ Schedule callback appointments

═══════════════════════════════════════

📋 BUSINESS CONTEXT
Name: ${businessInfo.businessName || 'Not specified'}
Email: ${businessInfo.businessEmail || 'Not specified'}
Phone: ${businessInfo.businessPhone || 'Not specified'}
Description: ${businessInfo.description || 'Not specified'}

This report was automatically generated from your AI Call Assistant platform.
Data includes both manual entries and integrated call tracking.
`;

  return content;
}
