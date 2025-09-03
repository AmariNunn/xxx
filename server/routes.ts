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
import adminRoutes from "./adminRoutes";
import clientApiRoutes from "./routes/clientApi";
import apiKeyRoutes from "./routes/apiKeyRoutes";
import ragRoutes from "./routes/ragRoutes";
import { db } from "./db";
import { eq } from "drizzle-orm";

export async function registerRoutes(app: Express): Promise<Server> {
  // PRIORITY: Fast health check endpoints for deployment health checks
  app.get("/healthz", (req: Request, res: Response) => {
    res.status(200).json({ status: "healthy" });
  });

  app.get("/api/health", (req: Request, res: Response) => {
    res.status(200).json({ 
      status: "healthy", 
      service: "Sky IQ Platform",
      uptime: process.uptime()
    });
  });

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

  // Admin routes (backend only)
  app.use(adminRoutes);

  // Client API routes (for external voice agents)
  app.use('/api/client', clientApiRoutes);

  // API key management routes
  app.use('/api', apiKeyRoutes);

  // RAG (Retrieval Augmented Generation) routes
  app.use(ragRoutes);
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

  // Email verification endpoint
  app.get("/api/auth/verify-email/:token", async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const success = await storage.verifyEmail(token);
      
      if (success) {
        res.json({ message: "Email verified successfully! You can now log in." });
      } else {
        res.status(400).json({ message: "Invalid or expired verification token" });
      }
    } catch (error: any) {
      console.error("Email verification error:", error);
      res.status(500).json({ message: "Failed to verify email" });
    }
  });

  // Password reset endpoint
  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    try {
      const { token, password } = req.body;
      
      if (!token || !password) {
        return res.status(400).json({ message: "Token and password are required" });
      }

      const success = await storage.resetPassword(token, password);
      
      if (success) {
        res.json({ message: "Password reset successfully! You can now log in with your new password." });
      } else {
        res.status(400).json({ message: "Invalid or expired reset token" });
      }
    } catch (error: any) {
      console.error("Password reset error:", error);
      res.status(400).json({ message: error.message || "Failed to reset password" });
    }
  });

  // Resend verification email endpoint
  app.post("/api/auth/resend-verification", async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const success = await storage.resendVerificationEmail(email);
      
      if (success) {
        res.json({ message: "Verification email sent successfully" });
      } else {
        res.status(400).json({ message: "Email not found or already verified" });
      }
    } catch (error: any) {
      console.error("Resend verification error:", error);
      res.status(500).json({ message: "Failed to resend verification email" });
    }
  });

  // Comprehensive health check endpoint with database operations
  app.get("/api/health/detailed", async (req: Request, res: Response) => {
    try {
      // Check database connectivity
      const user = await storage.getUser(1);
      
      res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: "connected",
        version: "1.0.0",
        environment: process.env.NODE_ENV || "development",
        databaseTest: user ? "passed" : "no_user_found"
      });
    } catch (error) {
      res.status(503).json({
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: "Database connection failed"
      });
    }
  });

  app.post("/api/test-email", async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Test direct MailerSend API call
      const emailData = {
        from: {
          email: "info@skyiq.app",
          name: "Sky IQ"
        },
        to: [
          {
            email: email,
            name: "Test User"
          }
        ],
        subject: "Sky IQ Email Service Test",
        html: `
          <h2>Email Test Successful!</h2>
          <p>This is a test email from Sky IQ to verify that email sending is working correctly.</p>
          <p>If you received this email, the email service is properly configured with info@skyiq.app.</p>
        `,
        text: "Email Test Successful! This is a test email from Sky IQ to verify that email sending is working correctly."
      };

      console.log(`Testing MailerSend API with verified domain...`);

      const response = await fetch("https://api.mailersend.com/v1/email", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'Authorization': `Bearer ${process.env.MAILERSEND_API_TOKEN}`
        },
        body: JSON.stringify(emailData)
      });

      console.log(`MailerSend API response status: ${response.status}`);
      
      if (!response.ok) {
        const responseText = await response.text();
        console.error("MailerSend API error:", response.status, responseText);
        return res.status(500).json({ message: "Failed to send test email", error: responseText });
      }

      // MailerSend returns 202 with empty body on success
      console.log(`Test email sent successfully via MailerSend API`);
      res.json({ message: "Test email sent successfully via MailerSend", status: response.status });

    } catch (error: any) {
      console.error("Test email error:", error);
      res.status(500).json({ message: "Failed to send test email", error: error.message });
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
  
  // Get calls by user ID - SECURE: Only returns calls for the specified user
  app.get("/api/calls/user/:userId", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      // SECURITY: Only fetch calls that belong to this specific user
      const result = await db.select().from(calls)
        .where(eq(calls.userId, userId))
        .orderBy(calls.createdAt);
      
      console.log(`Retrieved ${result.length} calls for user ${userId}`);
      
      res.status(200).json({ 
        message: "Calls retrieved successfully", 
        data: result,
        count: result.length
      });
    } catch (error) {
      console.error("Error fetching calls:", error);
      res.status(500).json({ message: "Failed to fetch calls" });
    }
  });

  // Sarah's Railway AI Call Webhook - Specific to Audamaur@gmail.com user
  app.post("/api/railway/sarah-calls", async (req: Request, res: Response) => {
    try {
      const { 
        phoneNumber, 
        contactName, 
        duration, 
        status, 
        summary, 
        notes, 
        transcript,
        direction = "inbound",
        callStartTime,
        callEndTime 
      } = req.body;

      // Validate required fields
      if (!phoneNumber) {
        return res.status(400).json({ 
          message: "Missing required field: phoneNumber" 
        });
      }

      // Find the specific user by email (audamaur@gmail.com - lowercase)
      const targetUser = await storage.getUserByEmail("audamaur@gmail.com");
      
      if (!targetUser) {
        return res.status(404).json({ 
          message: "Target user Audamaur@gmail.com not found in system" 
        });
      }

      // Map status to valid enum values
      const mapStatus = (rawStatus: string): 'completed' | 'missed' | 'failed' => {
        const statusLower = (rawStatus || '').toLowerCase();
        if (statusLower.includes('completed') || statusLower.includes('success')) return 'completed';
        if (statusLower.includes('missed') || statusLower.includes('no-answer')) return 'missed';
        if (statusLower.includes('failed') || statusLower.includes('error')) return 'failed';
        return 'completed'; // Default for in-progress or unknown statuses
      };

      // Create call record specifically for this user
      const callData = {
        userId: targetUser.id,
        phoneNumber,
        contactName: contactName || "Unknown Caller",
        duration: duration || 0,
        status: mapStatus(status),
        summary: summary || "AI assistant call via Railway",
        notes: notes || "",
        transcript: transcript || "",
        direction,
        isFromTwilio: false, // Mark as Railway integration
        createdAt: callStartTime ? new Date(callStartTime) : new Date(),
      };

      const newCall = await storage.createCall(callData);
      
      console.log(`Railway call logged for ${targetUser.email}:`, newCall);
      
      res.status(200).json({ 
        message: "Call logged successfully for Audamaur@gmail.com", 
        callId: newCall.id,
        userId: targetUser.id
      });

    } catch (error) {
      console.error("Error processing Sarah's Railway call webhook:", error);
      res.status(500).json({ 
        message: "Error logging call for Audamaur@gmail.com",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // General Railway webhook (for other integrations)
  app.post("/api/railway/call-webhook", async (req: Request, res: Response) => {
    try {
      const { 
        userId, 
        phoneNumber, 
        contactName, 
        duration, 
        status, 
        summary, 
        notes, 
        transcript,
        direction = "inbound",
        callStartTime,
        recordingUrl,
        twilioCallSid
      } = req.body;

      // Validate required fields
      if (!userId || !phoneNumber) {
        return res.status(400).json({ 
          message: "Missing required fields: userId and phoneNumber are required" 
        });
      }

      // Map status to valid enum values
      const mapStatus = (rawStatus: string): 'completed' | 'missed' | 'failed' => {
        const statusLower = (rawStatus || '').toLowerCase();
        if (statusLower.includes('completed') || statusLower.includes('success')) return 'completed';
        if (statusLower.includes('missed') || statusLower.includes('no-answer')) return 'missed';
        if (statusLower.includes('failed') || statusLower.includes('error')) return 'failed';
        return 'completed'; // Default for in-progress or unknown statuses
      };

      // Create call record in Sky IQ database
      const callData = {
        userId: parseInt(userId),
        phoneNumber,
        contactName: contactName || "Unknown",
        duration: duration || 0,
        status: mapStatus(status),
        summary: summary || "AI call completed",
        notes: notes || "",
        transcript: transcript || "",
        direction,
        recordingUrl: recordingUrl || null,
        twilioCallSid: twilioCallSid || null,
        isFromTwilio: false, // Mark as Railway integration
        createdAt: callStartTime ? new Date(callStartTime) : new Date(),
      };

      const newCall = await storage.createCall(callData);
      
      console.log("Railway AI call logged:", newCall);
      
      res.status(200).json({ 
        message: "Call logged successfully in Sky IQ", 
        callId: newCall.id 
      });

    } catch (error) {
      console.error("Error processing Railway call webhook:", error);
      res.status(500).json({ 
        message: "Error logging call",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Twilio webhook endpoint to receive real call data
  // Twilio webhook endpoint - processes calls for all users based on their phone numbers
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

  // Set up Twilio integration for a specific user (secure endpoint)
  app.post("/api/twilio/setup/:userId", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      const { accountSid, authToken, phoneNumber } = req.body;

      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      if (!accountSid || !authToken || !phoneNumber) {
        return res.status(400).json({ 
          message: "Missing required fields: accountSid, authToken, phoneNumber" 
        });
      }

      const { twilioService } = await import("./twilioService");
      const result = await twilioService.setupUserTwilioIntegration(
        userId, 
        accountSid, 
        authToken, 
        phoneNumber
      );

      if (result.success) {
        res.json({ 
          message: result.message,
          success: true,
          phoneNumber: phoneNumber 
        });
      } else {
        res.status(400).json({ 
          message: result.message,
          success: false 
        });
      }

    } catch (error) {
      console.error("Error setting up Twilio integration:", error);
      res.status(500).json({ 
        message: "Failed to set up Twilio integration",
        success: false 
      });
    }
  });

  // Get user's available Twilio phone numbers (secure endpoint)
  app.post("/api/twilio/numbers/:userId", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      const { accountSid, authToken } = req.body;

      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      if (!accountSid || !authToken) {
        return res.status(400).json({ 
          message: "Missing required fields: accountSid, authToken" 
        });
      }

      const { twilioService } = await import("./twilioService");
      
      // First validate credentials
      const credentialsValid = await twilioService.validateUserTwilioCredentials(accountSid, authToken);
      if (!credentialsValid) {
        return res.status(400).json({ 
          message: "Invalid Twilio credentials",
          phoneNumbers: [] 
        });
      }

      // Get available phone numbers
      const phoneNumbers = await twilioService.getUserTwilioNumbers(accountSid, authToken);
      
      res.json({ 
        phoneNumbers,
        message: `Found ${phoneNumbers.length} phone number(s) in your Twilio account` 
      });

    } catch (error) {
      console.error("Error fetching Twilio numbers:", error);
      res.status(500).json({ 
        message: "Failed to fetch phone numbers",
        phoneNumbers: [] 
      });
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
      
      // Create a Google Doc with just the title - content will be provided separately
      const docUrl = `https://docs.google.com/document/create?title=${encodeURIComponent(docTitle)}`;
      
      // Generate the formatted content for the user to copy/paste
      const formattedContent = generateCallReviewContent(calls, businessInfo);
      
      res.json({ 
        docUrl,
        content: formattedContent,
        callCount: calls.length,
        businessName: businessName,
        generatedAt: new Date().toISOString(),
        instructions: "Copy the content below and paste it into your new Google Doc"
      });
      
    } catch (error) {
      console.error("Error generating review document:", error);
      res.status(500).json({ message: "Failed to generate review document" });
    }
  });

  // Register admin routes for backend Twilio management  
  // (adminRoutes is already imported and used above)


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
🔴 LIVE CALL OPERATIONS DASHBOARD
${businessName}
Last Updated: ${new Date().toLocaleString()}

═══════════════════════════════════════
🚨 IMMEDIATE ACTION REQUIRED
═══════════════════════════════════════

⚡ PRIORITY CALLBACKS:
${calls.filter((call: any) => call.status === 'missed' || call.notes?.includes('callback')).slice(0, 5).map((call: any, index: number) => `
${index + 1}. 📞 ${call.contactName || call.phoneNumber}
   🕐 MISSED: ${call.createdAt ? new Date(call.createdAt).toLocaleDateString() : 'Recently'}
   📝 Action: CALL BACK IMMEDIATELY
   ────────────────────────────────────
`).join('') || '✅ No urgent callbacks needed'}

🎯 FOLLOW-UP QUEUE:
${calls.filter((call: any) => call.summary?.includes('follow') || call.notes?.includes('follow')).slice(0, 3).map((call: any, index: number) => `
${index + 1}. 📞 ${call.contactName || call.phoneNumber}
   📋 Reason: ${call.summary || call.notes || 'Follow-up required'}
   ⏰ Due: Today
   ────────────────────────────────────
`).join('') || '✅ No follow-ups pending'}

═══════════════════════════════════════
📊 TODAY'S CALL PERFORMANCE
═══════════════════════════════════════

📈 LIVE STATS:
• Total Calls Today: ${totalCalls}
• Success Rate: ${totalCalls > 0 ? Math.round(completedCalls/totalCalls * 100) : 0}%
• Avg Call Time: ${Math.floor(avgDuration / 60)}m ${avgDuration % 60}s
• Missed Calls: ${missedCalls} (${missedCalls > 0 ? '⚠️ NEEDS ATTENTION' : '✅ Good'})

🎯 CALL TARGETS:
□ Daily Goal: 20 calls
□ Completion Rate: >85%
□ Follow-up Rate: 100%
□ Customer Satisfaction: Track after each call

═══════════════════════════════════════
🔥 ACTIVE CALL LOG
═══════════════════════════════════════

${calls.slice(-5).reverse().map((call: any, index: number) => `
📞 CALL #${calls.length - index}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 Contact: ${call.contactName || 'Unknown'}
📱 Number: ${call.phoneNumber}
🕐 Time: ${call.createdAt ? new Date(call.createdAt).toLocaleTimeString() : 'Recent'}
⏱️ Duration: ${call.duration ? `${Math.floor(call.duration / 60)}m ${call.duration % 60}s` : 'N/A'}
📊 Status: ${call.status?.toUpperCase() || 'PENDING'}

📝 CALL SUMMARY:
${call.summary || 'No summary recorded'}

📋 NOTES & ACTIONS:
${call.notes || 'No notes'}

${call.isFromTwilio ? '🔗 AUTO-LOGGED' : '✍️ MANUAL ENTRY'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`).join('')}

═══════════════════════════════════════
📝 CALL SCRIPT & GUIDELINES
═══════════════════════════════════════

🎯 OPENING SCRIPT:
"Hi [Name], this is [Your Name] from ${businessName}. I'm calling about [reason]. Do you have 2-3 minutes to chat?"

📋 KEY TALKING POINTS:
• ${businessInfo.description || 'Your value proposition'}
• Benefits and features
• Address common objections
• Next steps and follow-up

🎯 CLOSING SCRIPT:
"Thank you for your time today. I'll [specific next step] and follow up with you on [date]. Have a great day!"

═══════════════════════════════════════
⚡ REAL-TIME CALL TRACKING
═══════════════════════════════════════

📝 QUICK CALL LOG TEMPLATE:
Copy and paste for each new call:

CALL DATE: ${new Date().toLocaleDateString()}
TIME: ${new Date().toLocaleTimeString()}
CONTACT: ________________
NUMBER: ________________
DURATION: _______________
STATUS: [Completed/Missed/Failed]

SUMMARY:
_____________________________
_____________________________

NEXT ACTION:
□ Callback required
□ Follow-up email
□ Schedule meeting
□ Close deal
□ No action needed

NOTES:
_____________________________
_____________________________

═══════════════════════════════════════

💡 This document updates automatically with your live call data.
Keep this open during calling sessions for real-time tracking!
`;

  return content;
}
