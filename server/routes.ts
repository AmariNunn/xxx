import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./supabaseStorage";
import { 
  insertUserSchema, 
  loginUserSchema, 
  forgotPasswordSchema,
  insertBatchCallSchema,
  CALL_STATUS_VALUES,
  CALL_ACTION_VALUES
} from "../shared/types";
import businessRoutes from "./routes/business";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Configure Cal.com tools in ElevenLabs agent
// Note: Cal.com credentials are NOT sent to ElevenLabs - they stay in Supabase
// User ID and webhook token are sent for authentication, webhooks fetch Cal.com credentials from Supabase
async function configureCalComTools(
  userId: string,
  agentId: string
): Promise<void> {
  try {
    // Get user's ElevenLabs API key and webhook token
    const businessInfo = await storage.getBusinessInfo(userId);
    if (!businessInfo?.elevenlabs_api_key) {
      throw new Error("ElevenLabs API key not found");
    }
    
    if (!businessInfo?.cal_com_webhook_token) {
      throw new Error("Cal.com webhook token not found");
    }

    const elevenLabsApiKey = businessInfo.elevenlabs_api_key;
    const webhookToken = businessInfo.cal_com_webhook_token;

    // Define Cal.com tools for ElevenLabs
    // Only user ID and webhook token are sent - Cal.com API key stays in Supabase
    const calComTools = [
      {
        type: "server_tool",
        name: "get_available_slots",
        description: "Get available time slots from Cal.com for booking appointments. Use this to check availability before booking.",
        parameters: {
          type: "object",
          properties: {
            date: {
              type: "string",
              description: "The date to check availability for (YYYY-MM-DD format)"
            }
          },
          required: ["date"]
        },
        handler: {
          type: "webhook",
          url: `${process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'}/api/calcom/get-slots`,
          method: "POST",
          headers: {
            "x-user-id": userId,
            "x-webhook-token": webhookToken
          }
        }
      },
      {
        type: "server_tool",
        name: "book_meeting",
        description: "Book an appointment in Cal.com. Use this after confirming availability and getting customer details (name, email, phone).",
        parameters: {
          type: "object",
          properties: {
            start_time: {
              type: "string",
              description: "Start time in ISO 8601 format (e.g., 2024-01-15T14:00:00Z)"
            },
            attendee_name: {
              type: "string",
              description: "Full name of the person booking the appointment"
            },
            attendee_email: {
              type: "string",
              description: "Email address of the person booking"
            },
            attendee_phone: {
              type: "string",
              description: "Phone number of the person booking (optional)"
            },
            notes: {
              type: "string",
              description: "Additional notes or reason for the appointment (optional)"
            }
          },
          required: ["start_time", "attendee_name", "attendee_email"]
        },
        handler: {
          type: "webhook",
          url: `${process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'}/api/calcom/book-meeting`,
          method: "POST",
          headers: {
            "x-user-id": userId,
            "x-webhook-token": webhookToken
          }
        }
      }
    ];

    // Update agent with Cal.com tools via ElevenLabs API
    const response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
      method: "PATCH",
      headers: {
        "xi-api-key": elevenLabsApiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        tools: calComTools,
        prompt: {
          prompt: `You are a helpful AI assistant that can book appointments using Cal.com.

When a customer wants to schedule an appointment:
1. First ask them what date they prefer
2. Use get_available_slots to check availability for that date
3. Share the available time slots with them
4. Once they choose a time, collect their:
   - Full name
   - Email address
   - Phone number (optional)
   - Reason for the appointment (optional)
5. Use book_meeting to confirm the booking
6. Provide them with the confirmation details

Always be polite, helpful, and confirm all details before booking. If no slots are available, offer to check alternative dates.`
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("ElevenLabs API error:", error);
      throw new Error(`Failed to configure Cal.com tools in ElevenLabs: ${error}`);
    }

    console.log(`✅ Successfully configured Cal.com tools for agent ${agentId}`);
  } catch (error) {
    console.error("Error configuring Cal.com tools:", error);
    throw error;
  }
}

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
        // Keep timestamps as-is - frontend will handle timezone conversion
        created_at: call.created_at || call.timestamp,
        timestamp: call.timestamp || call.created_at,
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

  // Update user's ElevenLabs settings
  app.post("/api/elevenlabs/settings/:userId", async (req: Request, res: Response) => {
    try {
      const userId = req.params.userId;
      const { apiKey, agentId, phoneNumberId } = req.body;

      if (!apiKey || !agentId || !phoneNumberId) {
        return res.status(400).json({ message: "Missing required ElevenLabs settings" });
      }

      // Save ElevenLabs settings for the user
      const result = await storage.updateElevenLabsSettings(userId, {
        apiKey,
        agentId,
        phoneNumberId
      });

      res.json({ message: "ElevenLabs settings updated successfully", data: result });
    } catch (error) {
      console.error("Error updating ElevenLabs settings:", error);
      res.status(500).json({ message: "Failed to update ElevenLabs settings" });
    }
  });

  // Get user's ElevenLabs settings
  app.get("/api/elevenlabs/settings/:userId", async (req: Request, res: Response) => {
    try {
      const userId = req.params.userId;
      const businessInfo = await storage.getBusinessInfo(userId);
      
      if (businessInfo && businessInfo.elevenlabs_api_key) {
        res.json({
          connected: true,
          agentId: businessInfo.elevenlabs_agent_id,
          apiKey: businessInfo.elevenlabs_api_key.substring(0, 8) + "...", // Only show partial for security
          phoneNumberId: businessInfo.elevenlabs_phone_number_id?.substring(0, 8) + "..."
        });
      } else {
        res.json({ connected: false });
      }
    } catch (error) {
      console.error("Error fetching ElevenLabs settings:", error);
      res.status(500).json({ message: "Failed to fetch ElevenLabs settings" });
    }
  });

  // Create batch call
  app.post("/api/elevenlabs/batch-call/:userId", async (req: Request, res: Response) => {
    try {
      const userId = req.params.userId;
      console.log('📞 Batch call request received for userId:', userId);
      console.log('📦 Request body:', JSON.stringify(req.body, null, 2));
      
      // Validate request body using Zod schema
      const validation = insertBatchCallSchema.safeParse({ userId, ...req.body });
      if (!validation.success) {
        console.error('❌ Validation failed:', validation.error.format());
        return res.status(400).json({ 
          message: "Invalid input data", 
          errors: validation.error.format() 
        });
      }

      const { batchName, recipients, scheduledTimeUnix } = validation.data;
      console.log('✅ Validation passed. Recipients:', recipients.length);

      // Get user's ElevenLabs credentials
      const businessInfo = await storage.getBusinessInfo(userId);
      if (!businessInfo?.elevenlabs_api_key || !businessInfo?.elevenlabs_agent_id || !businessInfo?.elevenlabs_phone_number_id) {
        return res.status(400).json({ message: "ElevenLabs credentials not configured" });
      }

      // Prepare batch call request for ElevenLabs API
      const batchCallPayload = {
        call_name: batchName,
        agent_id: businessInfo.elevenlabs_agent_id,
        agent_phone_number_id: businessInfo.elevenlabs_phone_number_id,
        recipients: recipients.map((r: any) => ({
          phone_number: r.phone_number,
          ...(r.name && { name: r.name })
        })),
        ...(scheduledTimeUnix && { scheduled_time_unix: scheduledTimeUnix })
      };

      console.log('📞 Calling ElevenLabs batch API with payload:', JSON.stringify(batchCallPayload, null, 2));

      // Call ElevenLabs batch calling API (correct endpoint is batch-calls plural)
      const response = await fetch('https://api.elevenlabs.io/v1/convai/batch-calls', {
        method: 'POST',
        headers: {
          'xi-api-key': businessInfo.elevenlabs_api_key,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(batchCallPayload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("ElevenLabs batch call error:", errorText);
        return res.status(response.status).json({ 
          message: "Failed to create batch call with ElevenLabs", 
          error: errorText 
        });
      }

      const batchData = await response.json();

      // Store batch call record in our database
      const { data, error } = await supabase
        .from('batch_calls')
        .insert({
          user_id: userId,
          batch_name: batchName,
          elevenlabs_batch_id: batchData.id,
          status: batchData.status || 'pending',
          total_calls_scheduled: batchData.total_calls_scheduled || recipients.length,
          total_calls_dispatched: batchData.total_calls_dispatched || 0,
          scheduled_time_unix: scheduledTimeUnix || null
        })
        .select()
        .single();

      if (error) {
        console.error("Error storing batch call:", error);
        return res.status(500).json({ message: "Batch call created but failed to store in database" });
      }

      res.json({ 
        message: "Batch call created successfully", 
        data: {
          ...data,
          elevenlabs_response: batchData
        }
      });
    } catch (error: any) {
      console.error("Error creating batch call:", error);
      res.status(500).json({ message: error.message || "Failed to create batch call" });
    }
  });

  // Get user's batch call history
  app.get("/api/elevenlabs/batches/:userId", async (req: Request, res: Response) => {
    try {
      const userId = req.params.userId;

      const { data, error } = await supabase
        .from('batch_calls')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      res.json({ data: data || [] });
    } catch (error: any) {
      console.error("Error fetching batch calls:", error);
      res.status(500).json({ message: "Failed to fetch batch calls" });
    }
  });

  // Update user's Cal.com settings
  app.post("/api/calcom/settings/:userId", async (req: Request, res: Response) => {
    try {
      const userId = req.params.userId;
      const { apiKey, eventTypeId, enabled } = req.body;

      if (!apiKey || !eventTypeId) {
        return res.status(400).json({ message: "Missing required Cal.com settings" });
      }

      // Save Cal.com settings for the user
      const result = await storage.updateCalComSettings(userId, {
        apiKey,
        eventTypeId,
        enabled: enabled || false
      });

      // If enabled, configure Cal.com tools in ElevenLabs agent
      if (enabled) {
        const businessInfo = await storage.getBusinessInfo(userId);
        if (businessInfo?.elevenlabs_agent_id) {
          try {
            await configureCalComTools(userId, businessInfo.elevenlabs_agent_id);
            console.log(`✅ Cal.com tools configured for agent ${businessInfo.elevenlabs_agent_id}`);
          } catch (error) {
            console.error("Error configuring Cal.com tools in ElevenLabs:", error);
          }
        }
      }

      res.json({ 
        message: "Cal.com settings updated successfully", 
        data: result,
        enabled: enabled || false
      });
    } catch (error) {
      console.error("Error updating Cal.com settings:", error);
      res.status(500).json({ message: "Failed to update Cal.com settings" });
    }
  });

  // Get user's Cal.com settings
  app.get("/api/calcom/settings/:userId", async (req: Request, res: Response) => {
    try {
      const userId = req.params.userId;
      const businessInfo = await storage.getBusinessInfo(userId);
      
      if (businessInfo && businessInfo.cal_com_api_key) {
        res.json({
          connected: true,
          eventTypeId: businessInfo.cal_com_event_type_id,
          apiKey: businessInfo.cal_com_api_key.substring(0, 12) + "...", // Only show partial for security
          enabled: businessInfo.cal_com_enabled || false
        });
      } else {
        res.json({ connected: false, enabled: false });
      }
    } catch (error) {
      console.error("Error fetching Cal.com settings:", error);
      res.status(500).json({ message: "Failed to fetch Cal.com settings" });
    }
  });

  // Cal.com webhook endpoint: Get available slots
  app.post("/api/calcom/get-slots", async (req: Request, res: Response) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      const webhookToken = req.headers['x-webhook-token'] as string;
      const { date } = req.body;

      if (!userId || !webhookToken || !date) {
        return res.status(400).json({ error: "Missing required parameters" });
      }

      // Fetch user's Cal.com credentials from Supabase (credentials never leave our backend)
      const businessInfo = await storage.getBusinessInfo(userId);
      
      if (!businessInfo?.cal_com_api_key || !businessInfo?.cal_com_event_type_id) {
        return res.status(400).json({ error: "Cal.com credentials not configured" });
      }

      if (!businessInfo.cal_com_enabled) {
        return res.status(400).json({ error: "Cal.com integration is disabled" });
      }

      // Verify webhook token to prevent unauthorized access (confused-deputy attack prevention)
      if (businessInfo.cal_com_webhook_token !== webhookToken) {
        console.warn(`⚠️ Invalid webhook token for user ${userId}`);
        return res.status(401).json({ error: "Unauthorized: Invalid webhook token" });
      }

      // Call Cal.com API to get availability using credentials from Supabase
      const response = await fetch(
        `https://api.cal.com/v2/slots/available?eventTypeId=${businessInfo.cal_com_event_type_id}&startTime=${date}T00:00:00Z&endTime=${date}T23:59:59Z`,
        {
          headers: {
            "Authorization": `Bearer ${businessInfo.cal_com_api_key}`,
            "Content-Type": "application/json"
          }
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error("Cal.com API error:", error);
        return res.status(response.status).json({ error: "Failed to fetch availability from Cal.com" });
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Error getting Cal.com slots:", error);
      res.status(500).json({ error: "Failed to fetch available slots" });
    }
  });

  // Cal.com webhook endpoint: Book a meeting
  app.post("/api/calcom/book-meeting", async (req: Request, res: Response) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      const webhookToken = req.headers['x-webhook-token'] as string;
      const { start_time, attendee_name, attendee_email, attendee_phone, notes } = req.body;

      if (!userId || !webhookToken) {
        return res.status(400).json({ error: "Missing required headers" });
      }

      if (!start_time || !attendee_name || !attendee_email) {
        return res.status(400).json({ error: "Missing required booking parameters" });
      }

      // Fetch user's Cal.com credentials from Supabase (credentials never leave our backend)
      const businessInfo = await storage.getBusinessInfo(userId);
      
      if (!businessInfo?.cal_com_api_key || !businessInfo?.cal_com_event_type_id) {
        return res.status(400).json({ error: "Cal.com credentials not configured" });
      }

      if (!businessInfo.cal_com_enabled) {
        return res.status(400).json({ error: "Cal.com integration is disabled" });
      }

      // Verify webhook token to prevent unauthorized access (confused-deputy attack prevention)
      if (businessInfo.cal_com_webhook_token !== webhookToken) {
        console.warn(`⚠️ Invalid webhook token for user ${userId} in book-meeting`);
        return res.status(401).json({ error: "Unauthorized: Invalid webhook token" });
      }

      // Call Cal.com API to book the meeting using credentials from Supabase
      const bookingPayload = {
        eventTypeId: parseInt(businessInfo.cal_com_event_type_id),
        start: start_time,
        responses: {
          name: attendee_name,
          email: attendee_email,
          ...(attendee_phone && { phone: attendee_phone }),
          ...(notes && { notes })
        },
        metadata: {}
      };

      const response = await fetch("https://api.cal.com/v2/bookings", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${businessInfo.cal_com_api_key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(bookingPayload)
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("Cal.com booking error:", error);
        return res.status(response.status).json({ error: "Failed to book meeting in Cal.com" });
      }

      const booking = await response.json();
      
      // Log the successful booking
      console.log(`✅ Meeting booked for user ${userId}:`, {
        bookingId: booking.id,
        attendee: attendee_name,
        time: start_time
      });

      res.json({
        success: true,
        booking,
        message: `Appointment successfully booked for ${attendee_name} on ${new Date(start_time).toLocaleString()}`
      });
    } catch (error) {
      console.error("Error booking Cal.com meeting:", error);
      res.status(500).json({ error: "Failed to book meeting" });
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
