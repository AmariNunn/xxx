import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./supabaseStorage.js";
import { 
  insertUserSchema, 
  loginUserSchema, 
  forgotPasswordSchema,
  insertBatchCallSchema,
  CALL_STATUS_VALUES,
  CALL_ACTION_VALUES
} from "../shared/types.js";
import businessRoutes from "./routes/business.js";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper function to sanitize business name for tool naming
function sanitizeBusinessName(businessName: string | null | undefined): string {
  if (!businessName) return 'business';
  
  return businessName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_') // Replace non-alphanumeric with underscores
    .replace(/^_+|_+$/g, '')     // Remove leading/trailing underscores
    .replace(/_+/g, '_')          // Replace multiple underscores with single
    .substring(0, 40) || 'business'; // Limit length and fallback
}

// Configure Cal.com tools in ElevenLabs agent using direct Cal.com API integration
// Cal.com API key is sent to ElevenLabs and stored there for direct API calls
export async function configureCalComTools(
  userId: string,
  agentId: string
): Promise<void> {
  try {
    // Get user's ElevenLabs API key and Cal.com credentials
    const businessInfo = await storage.getBusinessInfo(userId);
    if (!businessInfo?.elevenlabs_api_key) {
      throw new Error("ElevenLabs API key not found");
    }
    
    if (!businessInfo?.cal_com_api_key) {
      throw new Error("Cal.com API key not found");
    }

    if (!businessInfo?.cal_com_event_type_id) {
      throw new Error("Cal.com Event Type ID not found");
    }

    const elevenLabsApiKey = businessInfo.elevenlabs_api_key;
    const calComApiKey = businessInfo.cal_com_api_key;
    const eventTypeId = parseInt(businessInfo.cal_com_event_type_id, 10);
    
    // Get business name for dynamic tool naming
    const businessName = businessInfo.business_name || 'Business';
    const businessSlug = sanitizeBusinessName(businessInfo.business_name);

    // Define Cal.com tools config for POST /v1/convai/tools
    // Note: Cal.com API key is sent to ElevenLabs as a constant value
    // This is a trade-off between simplicity and security - consider user consent
    
    // Tool 1: Check available time slots
    const checkAvailabilityConfig = {
      type: "webhook",
      name: `check_${businessSlug}_availability`,
      description: `Check available appointment times for ${businessName}'s calendar.

WHEN TO USE THIS TOOL:
• Customer asks about availability: "when are you free?", "what times do you have?", "do you have anything this week?", "when can I come in?"
• Customer wants to schedule: "I need to book an appointment", "can I set up a time?", "I'd like to schedule"
• Customer asks to see the calendar: "show me your schedule", "what's open?", "what days are available?"
• Customer inquires about specific dates: "are you free on Tuesday?", "do you have any openings next week?"

BEFORE CALLING THIS TOOL:
1. Ask for their preferred day or date range if not mentioned
2. Note their timezone if they mention it (otherwise use default)
3. Understand their scheduling flexibility (specific date vs ASAP vs within a range)

INFORMATION TO GATHER:
• Preferred date or date range (required for the tool)
• Their general availability or time preferences
• Any urgency (ASAP vs flexible timing)

AFTER GETTING RESULTS:
• Present 2-3 best options conversationally
• Example: "I have Tuesday at 2pm, Wednesday at 10am, or Thursday at 3pm. Which works best for you?"
• If no availability in requested timeframe, offer the next available slots
• If completely booked, offer to be added to a waitlist or suggest alternative dates

CONVERSATION FLOW:
Customer: "When are you available next week?"
You: *Use this tool with startTime=next Monday, endTime=next Friday*
Tool returns available slots
You: "I have several openings next week. I can do Monday at 3pm, Tuesday at 10am, or Wednesday at 2pm. What works for you?"

CONTEXT: You are checking availability for ${businessName}. Be helpful, accommodating, and guide the customer toward booking an appointment.`,
      disable_interruptions: false,
      force_pre_tool_speech: false,
      assignments: [],
      tool_call_sound: null,
      tool_call_sound_behavior: "auto",
      dynamic_variables: {
        dynamic_variable_placeholders: {}
      },
      execution_mode: "immediate",
      response_timeout_secs: 20,
      api_schema: {
        url: "https://api.cal.com/v1/slots",
        method: "GET",
        path_params_schema: {},
        query_params_schema: {
          properties: {
            apiKey: {
              type: "string",
              constant_value: calComApiKey
            },
            eventTypeId: {
              type: "number",
              constant_value: eventTypeId
            },
            startTime: {
              type: "string",
              description: "Start date to check availability (ISO format like 2025-11-04)"
            },
            endTime: {
              type: "string",
              description: "End date to check availability (ISO format like 2025-11-08)"
            },
            timeZone: {
              type: "string",
              description: "Timezone for slot lookup",
              constant_value: "America/New_York"
            }
          },
          required: ["apiKey", "eventTypeId", "startTime", "endTime"]
        },
        request_headers: {},
        auth_connection: null
      }
    };

    // Tool 2: Book appointment
    const bookAppointmentConfig = {
      type: "webhook",
      name: `book_${businessSlug}_appointment`,
      description: `Book a confirmed appointment for ${businessName}.

WHEN TO USE THIS TOOL:
• Customer confirms a specific time: "I'll take the 2pm slot", "book me for Tuesday at 3pm", "that time works for me"
• Customer says: "schedule me", "sign me up", "reserve that time", "I want that appointment", "put me down for Monday"
• After showing availability and customer chooses a time
• Customer provides all required information (name, email, and preferred time)

REQUIRED INFORMATION (Must collect BEFORE using tool):
✓ Customer's full name
✓ Customer's email address
✓ Confirmed appointment time (in ISO format like 2025-11-04T14:30:00Z)
✓ Timezone (if customer mentioned it, otherwise use default)

CONVERSATION FLOW FOR BOOKING:
1. First check availability (use check_availability tool)
2. Present options to customer
3. Customer selects a time
4. Collect name if you don't have it: "Great! What's your name?"
5. Collect email if you don't have it: "And what's your email address?"
6. Confirm details: "Perfect! I'm booking you for Tuesday, November 5th at 2pm. I'll send confirmation to your email."
7. Use this tool to complete the booking
8. Confirm success: "You're all set! You'll receive a confirmation email shortly."

HANDLING DIFFERENT CUSTOMER REQUESTS:
• "Book me for next Tuesday at 2pm" → First verify that time is available (check_availability), then collect name/email, then book
• "I'll take that 3pm slot" (after showing availability) → Collect name/email if needed, then book immediately
• "Schedule me ASAP" → Check availability first, present options, let them choose, then collect info and book

IF CUSTOMER MISSING INFORMATION:
• No name? → "I'll need your full name to complete the booking"
• No email? → "And what email should I send the confirmation to?"
• Unclear time? → "Which time works best for you?" (show them available options first)
• Time not available? → Check availability first, don't book unavailable times

AFTER SUCCESSFUL BOOKING:
• Confirm the appointment details verbally
• Let them know they'll receive email confirmation
• Ask if they need anything else or have questions
• Example: "Perfect! You're booked for Tuesday at 2pm. You'll get a confirmation email at john@example.com. Is there anything else I can help you with?"

ERROR HANDLING:
• If booking fails → Apologize and offer alternative times
• If time slot just filled → Check availability again and offer next available
• If customer info invalid → Politely ask them to verify their email/name

CONTEXT: You are booking appointments for ${businessName}. Be professional, confirm all details, and ensure the customer has a smooth booking experience.`,
      disable_interruptions: false,
      force_pre_tool_speech: false,
      assignments: [],
      tool_call_sound: null,
      tool_call_sound_behavior: "auto",
      dynamic_variables: {
        dynamic_variable_placeholders: {}
      },
      execution_mode: "immediate",
      response_timeout_secs: 20,
      api_schema: {
        url: "https://api.cal.com/v1/bookings",
        method: "POST",
        path_params_schema: {},
        query_params_schema: {
          properties: {
            apiKey: {
              type: "string",
              constant_value: calComApiKey
            }
          },
          required: ["apiKey"]
        },
        request_body_schema: {
          type: "object",
          description: "Booking details",
          required: ["language", "start", "timeZone", "responses", "eventTypeId", "metadata"],
          properties: {
            language: {
              type: "string",
              constant_value: "en"
            },
            start: {
              type: "string",
              description: "Start datetime MUST include timezone offset. Format: YYYY-MM-DDTHH:MM:SS-05:00 (for America/New_York). Example: 2025-11-07T14:00:00-05:00. CRITICAL: Always append timezone offset to match America/New_York timezone."
            },
            timeZone: {
              type: "string",
              constant_value: "America/New_York"
            },
            responses: {
              type: "object",
              description: "Customer details - name and email",
              required: ["email", "name"],
              properties: {
                email: {
                  type: "string",
                  description: "Customer's email address"
                },
                name: {
                  type: "string",
                  description: "Customer's full name"
                }
              }
            },
            eventTypeId: {
              type: "number",
              constant_value: eventTypeId
            },
            metadata: {
              type: "object",
              constant_value: {}
            }
          }
        },
        request_headers: {
          "Content-Type": "application/json"
        },
        auth_connection: null
      }
    };

    console.log(`🔧 Creating Cal.com tools for ${businessName} in ElevenLabs workspace`);

    // Create both tools
    const toolConfigs = [
      { name: `check_${businessSlug}_availability`, config: checkAvailabilityConfig },
      { name: `book_${businessSlug}_appointment`, config: bookAppointmentConfig }
    ];

    const createdToolIds: string[] = [];

    for (const { name, config } of toolConfigs) {
      console.log(`🔧 Creating ${name} tool...`);
      
      const createToolResponse = await fetch(`https://api.elevenlabs.io/v1/convai/tools`, {
        method: "POST",
        headers: {
          "xi-api-key": elevenLabsApiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          tool_config: config
        })
      });

      if (!createToolResponse.ok) {
        const error = await createToolResponse.text();
        console.error(`❌ ElevenLabs API error for ${name}:`, error);
        throw new Error(`Failed to create ${name} tool in ElevenLabs: ${error}`);
      }

      const toolResult = await createToolResponse.json();
      const toolId = toolResult.id;
      createdToolIds.push(toolId);
      console.log(`✅ Successfully created ${name} tool with ID: ${toolId}`);
    }

    // Now attach the tools to the agent
    console.log(`🔧 Attaching ${createdToolIds.length} tools to agent ${agentId}`);

    // Get agent's current configuration to preserve existing tool IDs
    const getAgentResponse = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
      headers: {
        "xi-api-key": elevenLabsApiKey
      }
    });

    if (!getAgentResponse.ok) {
      throw new Error(`Failed to fetch agent configuration: ${getAgentResponse.status}`);
    }

    const agentData = await getAgentResponse.json();
    const currentToolIds = agentData.conversation_config?.agent?.prompt?.tool_ids || [];
    
    // Add new tool IDs that aren't already there
    const newToolIds = createdToolIds.filter(id => !currentToolIds.includes(id));
    
    if (newToolIds.length > 0) {
      const updatedToolIds = [...currentToolIds, ...newToolIds];
      
      // PATCH agent to add the tool IDs
      const patchAgentResponse = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
        method: "PATCH",
        headers: {
          "xi-api-key": elevenLabsApiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          conversation_config: {
            agent: {
              prompt: {
                tool_ids: updatedToolIds
              }
            }
          }
        })
      });

      if (!patchAgentResponse.ok) {
        const error = await patchAgentResponse.text();
        console.error("❌ Failed to attach tools to agent:", error);
        throw new Error(`Failed to attach tools to agent: ${error}`);
      }

      console.log(`✅ Successfully attached ${newToolIds.length} tools to agent ${agentId}`);
      console.log(`   Tool IDs: ${newToolIds.join(', ')}`);
    } else {
      console.log(`ℹ️ All tools already attached to agent ${agentId}`);
    }
    
    // Enhance agent's prompt with scheduling instructions
    console.log(`🔧 Enhancing agent prompt with scheduling awareness...`);
    
    const currentPrompt = agentData.conversation_config?.agent?.prompt?.prompt || '';
    
    // Check if scheduling instructions already exist (avoid duplication)
    if (!currentPrompt.includes('APPOINTMENT SCHEDULING CAPABILITIES')) {
      const schedulingEnhancement = `

--- APPOINTMENT SCHEDULING CAPABILITIES ---

You now have the ability to check availability and book appointments for ${businessName}. Use these capabilities naturally in conversation without changing your core personality or communication style.

SCHEDULING DECISION TREE:
1. Customer asks about availability → Use check_${businessSlug}_availability tool
2. Customer wants to book a specific time → First verify it's available, then use book_${businessSlug}_appointment tool
3. Customer confirms a time slot you presented → Collect name/email, then use book_${businessSlug}_appointment tool

KEY PRINCIPLES:
• Maintain your natural conversation flow - don't sound robotic
• Gather information conversationally, not like a form
• Check availability before attempting to book
• Always collect name and email before booking
• Confirm all details before finalizing an appointment
• Be helpful if customer needs to reschedule or has questions

NATURAL CONVERSATION EXAMPLES:
Customer: "When are you available?"
You: "Let me check the schedule for you. What day works best?"
Customer: "How about next Tuesday?"
You: [Use check_availability tool] "I have openings at 10am, 2pm, and 4pm on Tuesday. Which time works for you?"

Customer: "Book me for 2pm Tuesday"
You: "Perfect! To confirm your appointment, I'll need your name and email address."
Customer: "John Smith, john@example.com"
You: [Use book_appointment tool] "All set, John! You're confirmed for Tuesday at 2pm. You'll receive a confirmation email at john@example.com."

Remember: The scheduling tools are there to help customers book appointments seamlessly. Use them when appropriate, but stay true to your conversational style.`;

      const enhancedPrompt = currentPrompt + schedulingEnhancement;
      
      // Update the agent's prompt
      const updatePromptResponse = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
        method: "PATCH",
        headers: {
          "xi-api-key": elevenLabsApiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          conversation_config: {
            agent: {
              prompt: {
                prompt: enhancedPrompt
              }
            }
          }
        })
      });

      if (!updatePromptResponse.ok) {
        const error = await updatePromptResponse.text();
        console.warn("⚠️ Could not enhance agent prompt:", error);
        // Don't throw - tools are still attached even if prompt enhancement fails
      } else {
        console.log(`✅ Successfully enhanced agent prompt with scheduling awareness`);
      }
    } else {
      console.log(`ℹ️ Scheduling instructions already present in agent prompt`);
    }
    
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
  
  // Admin routes
  app.get("/api/admin/users", async (req: Request, res: Response) => {
    try {
      const adminUserId = req.query.adminUserId as string;
      if (!adminUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Verify admin status
      const isAdmin = await storage.isUserAdmin(adminUserId);
      if (!isAdmin) {
        return res.status(403).json({ message: "Forbidden - Admin access required" });
      }
      
      // Get all users
      const users = await storage.getAllUsers();
      
      // Remove passwords from response
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);
      
      res.status(200).json({ data: usersWithoutPasswords });
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get("/api/admin/check/:userId", async (req: Request, res: Response) => {
    try {
      const userId = req.params.userId;
      if (!userId) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const isAdmin = await storage.isUserAdmin(userId);
      res.status(200).json({ isAdmin });
    } catch (error) {
      console.error("Error checking admin status:", error);
      res.status(500).json({ message: "Failed to check admin status" });
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

  // Get SMS conversations by user ID
  app.get("/api/sms/user/:userId", async (req: Request, res: Response) => {
    try {
      const userId = req.params.userId;
      if (!userId) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      // Fetch SMS conversations for this user
      const { data: result, error } = await supabase
        .from('sms_conversations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(200);
      
      if (error) {
        throw new Error(error.message);
      }

      res.status(200).json({ 
        message: "SMS conversations retrieved successfully", 
        data: result || []
      });
    } catch (error) {
      console.error("Error fetching SMS conversations:", error);
      res.status(500).json({ message: "Failed to fetch SMS conversations" });
    }
  });

  // Get SMS conversation thread for a specific phone number
  app.get("/api/sms/thread/:userId/:phoneNumber", async (req: Request, res: Response) => {
    try {
      const { userId, phoneNumber } = req.params;
      if (!userId || !phoneNumber) {
        return res.status(400).json({ message: "Invalid parameters" });
      }
      
      const { data: result, error } = await supabase
        .from('sms_conversations')
        .select('*')
        .eq('user_id', userId)
        .eq('phone_number', phoneNumber)
        .order('created_at', { ascending: true }); // Oldest first for thread view
      
      if (error) {
        throw new Error(error.message);
      }

      res.status(200).json({ 
        message: "SMS thread retrieved successfully", 
        data: result || []
      });
    } catch (error) {
      console.error("Error fetching SMS thread:", error);
      res.status(500).json({ message: "Failed to fetch SMS thread" });
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
        userId: String(userId),
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
      const { twilioService } = await import("./twilioService.js");
      const result = await twilioService.processCallWebhook(req.body);
      
      // Socket.io removed - real-time updates handled via polling
      // if (result && result.callId) {
      //   console.log("📡 Emitting callCompleted event for call:", result.callId);
      //   io.emit("callCompleted", { ... });
      // }
      
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
      const { twilioService } = await import("./twilioService.js");
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

  // Create batch call with queue system (sends 2 at a time)
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

      const { batchName, recipients, scheduledTimeUnix, testMode } = validation.data;
      console.log(`✅ Validation passed. Recipients: ${recipients.length}, Test Mode: ${testMode}`);

      // Get user's ElevenLabs credentials (skip check in test mode)
      if (!testMode) {
        const businessInfo = await storage.getBusinessInfo(userId);
        if (!businessInfo?.elevenlabs_api_key || !businessInfo?.elevenlabs_agent_id || !businessInfo?.elevenlabs_phone_number_id) {
          return res.status(400).json({ message: "ElevenLabs credentials not configured" });
        }
      }

      // Create batch record in database
      const { data: batchData, error: batchError } = await supabase
        .from('batch_calls')
        .insert({
          user_id: userId,
          batch_name: batchName,
          status: 'pending',
          total_calls_scheduled: recipients.length,
          total_calls_dispatched: 0,
          scheduled_time_unix: scheduledTimeUnix || null,
          test_mode: testMode || false
        })
        .select()
        .single();

      if (batchError || !batchData) {
        console.error("❌ Error creating batch:", batchError);
        return res.status(500).json({ message: "Failed to create batch record" });
      }

      console.log(`✅ Created batch ${batchData.id}: ${batchName}`);

      // Store each recipient as individual record
      const recipientRecords = recipients.map((r: any) => {
        const { phone_number, ...customFields } = r;
        return {
          batch_id: batchData.id,
          phone_number,
          custom_fields: Object.keys(customFields).length > 0 ? customFields : null,
          status: 'pending'
        };
      });

      const { error: recipientsError } = await supabase
        .from('batch_call_recipients')
        .insert(recipientRecords);

      if (recipientsError) {
        console.error("❌ Error storing recipients:", recipientsError);
        // Rollback: delete batch
        await supabase.from('batch_calls').delete().eq('id', batchData.id);
        return res.status(500).json({ message: "Failed to store recipients" });
      }

      console.log(`✅ Stored ${recipients.length} recipients for batch ${batchData.id}`);

      // Submit to ElevenLabs Batch Calling API (unless in test mode)
      if (!testMode) {
        try {
          const businessInfo = await storage.getBusinessInfo(userId);
          
          // Format recipients for ElevenLabs batch API
          // Each recipient needs phone_number + custom fields wrapped in conversation_initiation_client_data
          const elevenLabsRecipients = recipients.map((r: any) => {
            const { phone_number, ...customFields } = r;
            const recipient: any = { phone_number };
            
            // Add custom fields as dynamic variables if any exist
            if (Object.keys(customFields).length > 0) {
              recipient.conversation_initiation_client_data = {
                dynamic_variables: customFields
              };
            }
            
            return recipient;
          });

          const batchPayload = {
            call_name: batchName,
            agent_id: businessInfo!.elevenlabs_agent_id,
            agent_phone_number_id: businessInfo!.elevenlabs_phone_number_id,
            recipients: elevenLabsRecipients,
            ...(scheduledTimeUnix ? { scheduled_time_unix: scheduledTimeUnix } : {})
          };

          console.log('📞 Submitting batch to ElevenLabs:', { 
            call_name: batchName, 
            recipients_count: elevenLabsRecipients.length,
            scheduled: !!scheduledTimeUnix
          });
          console.log('📦 ElevenLabs batch payload:', JSON.stringify(batchPayload, null, 2));

          const elevenLabsResponse = await fetch(
            'https://api.elevenlabs.io/v1/convai/batch-calling/submit',
            {
              method: 'POST',
              headers: {
                'xi-api-key': businessInfo!.elevenlabs_api_key!,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(batchPayload)
            }
          );

          if (!elevenLabsResponse.ok) {
            const errorText = await elevenLabsResponse.text();
            console.error('❌ ElevenLabs batch API error:', errorText);
            throw new Error(`ElevenLabs API error: ${elevenLabsResponse.status}`);
          }

          const elevenLabsResult = await elevenLabsResponse.json();
          console.log('✅ ElevenLabs batch submitted:', elevenLabsResult);

          // Update our batch record with ElevenLabs batch ID
          await supabase
            .from('batch_calls')
            .update({ 
              elevenlabs_batch_id: elevenLabsResult.id,
              status: scheduledTimeUnix ? 'scheduled' : 'in_progress'
            })
            .eq('id', batchData.id);

          console.log(`✅ Batch ${batchData.id} submitted to ElevenLabs as ${elevenLabsResult.id}`);
        } catch (error: any) {
          console.error('❌ Error submitting to ElevenLabs:', error);
          // Mark batch as failed
          await supabase
            .from('batch_calls')
            .update({ status: 'failed' })
            .eq('id', batchData.id);
          return res.status(500).json({ 
            message: "Failed to submit batch to ElevenLabs", 
            error: error.message 
          });
        }
      }

      res.json({ 
        message: testMode 
          ? "Batch created in TEST MODE - calls will be simulated" 
          : scheduledTimeUnix
            ? "Batch call scheduled successfully with ElevenLabs"
            : "Batch call submitted to ElevenLabs and processing",
        data: {
          ...batchData,
          test_mode: testMode || false
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
        .order('created_at', { ascending: false});

      if (error) throw error;

      res.json({ data: data || [] });
    } catch (error: any) {
      console.error("Error fetching batch calls:", error);
      res.status(500).json({ message: "Failed to fetch batch calls" });
    }
  });

  // Delete a batch call
  app.delete("/api/elevenlabs/batch/:batchId", async (req: Request, res: Response) => {
    try {
      const batchId = req.params.batchId;
      const userId = req.query.userId as string;

      if (!batchId) {
        return res.status(400).json({ message: "Batch ID is required" });
      }

      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      // First verify this batch belongs to the user
      const { data: batchToDelete, error: fetchError } = await supabase
        .from('batch_calls')
        .select('*')
        .eq('id', batchId)
        .single();

      if (fetchError || !batchToDelete) {
        return res.status(404).json({ message: "Batch call not found" });
      }

      if (batchToDelete.user_id !== userId) {
        return res.status(403).json({ message: "Not authorized to delete this batch call" });
      }

      // Delete the batch call from the database
      const { error: deleteError } = await supabase
        .from('batch_calls')
        .delete()
        .eq('id', batchId);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      res.status(200).json({ 
        message: "Batch call deleted successfully"
      });
    } catch (error: any) {
      console.error("Error deleting batch call:", error);
      res.status(500).json({ message: "Failed to delete batch call" });
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
  const { registerAdminRoutes } = await import("./adminRoutes.js");
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
