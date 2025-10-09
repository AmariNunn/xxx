import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./supabaseStorage";
import { 
  insertUserSchema, 
  loginUserSchema, 
  forgotPasswordSchema,
  CALL_STATUS_VALUES,
  CALL_ACTION_VALUES
} from "../shared/types";
import businessRoutes from "./routes/business";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function registerRoutes(app: Express): Promise<Server> {
  // Get authenticated user
  app.get("/api/auth/user/:id", async (req: Request, res: Response) => {
    try {
      const userId = req.params.id;
      if (!userId) {
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
      if (!callData.userId) {
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
      const result = await supabase
        .from('calls')
        .insert({
          user_id: callData.userId,
          phone_number: callData.number || callData.phoneNumber,
          contact_name: callData.name || callData.contactName || null,
          duration: duration,
          status: callData.status || "completed",
          notes: callData.notes || null,
          summary: callData.summary || null,
          created_at: callData.date ? new Date(`${callData.date} ${callData.time || '00:00:00'}`).toISOString() : new Date().toISOString()
        })
        .select()
        .single();
      
      if (result.error) {
        throw new Error(result.error.message);
      }
      
      res.status(201).json({ 
        message: "Call created successfully", 
        data: result.data 
      });
    } catch (error) {
      console.error("Error creating call:", error);
      res.status(500).json({ message: "Failed to create call" });
    }
  });
  
  // Update call action
  app.patch("/api/calls/:id/action", async (req: Request, res: Response) => {
    try {
      const callId = req.params.id;
      const { action, userId } = req.body;
      
      console.log('🔄 Updating call action:', { callId, action, userId });
      
      if (!callId) {
        return res.status(400).json({ message: "Invalid call ID" });
      }
      
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }
      
      if (!action || !CALL_ACTION_VALUES.includes(action as any)) {
        console.log('❌ Invalid action value:', action);
        return res.status(400).json({ message: "Invalid action value" });
      }
      
      // Verify user owns this call
      const { data: callToUpdate, error: fetchError } = await supabase
        .from('calls')
        .select('*')
        .eq('id', callId)
        .single();
      
      if (fetchError) {
        console.error('❌ Error fetching call:', fetchError);
        return res.status(404).json({ message: "Call not found", error: fetchError.message });
      }
      
      if (!callToUpdate) {
        console.log('❌ Call not found with ID:', callId);
        return res.status(404).json({ message: "Call not found" });
      }
      
      console.log('📞 Call found:', callToUpdate);
      
      if (callToUpdate.user_id !== userId) {
        console.log('❌ Unauthorized: call user_id:', callToUpdate.user_id, 'request userId:', userId);
        return res.status(403).json({ message: "Not authorized to update this call" });
      }
      
      // Update the call action
      console.log('📝 Updating action to:', action);
      const { data: result, error: updateError } = await supabase
        .from('calls')
        .update({ action })
        .eq('id', callId)
        .select()
        .single();
      
      if (updateError) {
        console.error('❌ Update error:', updateError);
        throw new Error(updateError.message);
      }
      
      console.log('✅ Action updated successfully:', result);
      
      res.status(200).json({ 
        message: "Call action updated successfully", 
        data: result 
      });
    } catch (error) {
      console.error("❌ Error updating call action:", error);
      res.status(500).json({ message: "Failed to update call action" });
    }
  });
  
  // Delete a call - verify user owns the call before deleting it
  app.delete("/api/calls/:id", async (req: Request, res: Response) => {
    try {
      const callId = req.params.id;
      const userId = req.query.userId as string;
      
      if (!callId) {
        return res.status(400).json({ message: "Invalid call ID" });
      }
      
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }
      
      // First verify this call belongs to the user
      const { data: callToDelete, error: fetchError } = await supabase
        .from('calls')
        .select('*')
        .eq('id', callId)
        .single();
      
      if (fetchError || !callToDelete) {
        return res.status(404).json({ message: "Call not found" });
      }
      
      if (callToDelete.user_id !== userId) {
        return res.status(403).json({ message: "Not authorized to delete this call" });
      }
      
      // Delete the call from the database
      const { data: result, error: deleteError } = await supabase
        .from('calls')
        .delete()
        .eq('id', callId)
        .select()
        .single();
      
      if (deleteError) {
        throw new Error(deleteError.message);
      }
      
      res.status(200).json({ 
        message: "Call deleted successfully", 
        data: result 
      });
    } catch (error) {
      console.error("Error deleting call:", error);
      res.status(500).json({ message: "Failed to delete call" });
    }
  });
  
  // Get calls by user ID
  app.get("/api/calls/user/:userId", async (req: Request, res: Response) => {
    try {
      const userId = req.params.userId;
      if (!userId) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      // Fetch calls for this user
      const { data: result, error } = await supabase
        .from('calls')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(50);
      
      if (error) {
        throw new Error(error.message);
      }

      // Transform the data to ensure consistent field names for the frontend
      const transformedData = (result || []).map((call: any) => ({
        ...call,
        // Ensure created_at exists for frontend compatibility
        created_at: call.created_at || call.timestamp,
        // Ensure phone_number is consistent
        phone_number: call.phone_number || call.caller_number,
        // Ensure duration is a number
        duration: call.duration || 0,
        // Ensure transcript and summary are strings
        transcript: call.transcript || '',
        summary: call.summary || ''
      }));
      
      res.status(200).json({ 
        message: "Calls retrieved successfully", 
        data: transformedData 
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

      // Create call record specifically for this user
      const callData = {
        userId: targetUser.id,
        phoneNumber,
        contactName: contactName || "Unknown Caller",
        duration: duration || 0,
        status: status || "completed",
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

      // Create call record in VoxIntel database
      const callData = {
        userId: parseInt(userId),
        phoneNumber,
        contactName: contactName || "Unknown",
        duration: duration || 0,
        status: status || "completed",
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
        message: "Call logged successfully in VoxIntel", 
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
  app.post("/api/twilio/webhook", async (req: Request, res: Response) => {
    try {
      console.log("🔔 Twilio webhook received:", JSON.stringify(req.body, null, 2));
      const { twilioService } = await import("./twilioService");
      const result = await twilioService.processCallWebhook(req.body);
      
      // Emit callCompleted event if a call was created/updated
      if (result && result.callId) {
        console.log("📡 Emitting callCompleted event for call:", result.callId);
        io.emit("callCompleted", {
          callId: result.callId,
          userId: result.userId,
          status: result.status,
          duration: result.duration,
          phoneNumber: result.phoneNumber,
          twilioCallSid: result.twilioCallSid
        });
      }
      
      console.log("✅ Twilio webhook processed successfully");
      res.status(200).send("OK");
    } catch (error) {
      console.error("❌ Error processing Twilio webhook:", error);
      res.status(500).send("Error processing webhook");
    }
  });

  // Update user's Twilio settings
  app.post("/api/twilio/settings/:userId", async (req: Request, res: Response) => {
    try {
      const userId = req.params.userId;
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
      const userId = req.params.userId;
      const businessInfo = await storage.getBusinessInfo(userId);
      
      if (businessInfo && businessInfo.twilio_account_sid) {
        res.json({
          connected: true,
          phoneNumber: businessInfo.twilio_phone_number,
          accountSid: businessInfo.twilio_account_sid.substring(0, 8) + "..." // Only show partial for security
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
      const userId = req.params.userId;
      
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
