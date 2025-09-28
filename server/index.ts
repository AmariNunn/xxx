import express, { type Request, Response } from "express";
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { MailerSend, EmailParams, Sender, Recipient } from "mailersend";
import multer from 'multer';
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";
import businessRoutes from "./routes/business";
import { 
  insertUserSchema, 
  loginUserSchema, 
  forgotPasswordSchema,
  businessInfo
} from "@shared/schema";
import { formatBusinessContext, hasBusinessContext, type BusinessContextData } from "./businessContextFormatter";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Configure multer for file uploads
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Supabase configuration
const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Database configuration for business context queries
const queryClient = postgres(process.env.DATABASE_URL!);
const db = drizzle(queryClient);

// ElevenLabs API configuration
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_AGENT_ID = process.env.ELEVENLABS_AGENT_ID;
const ELEVENLABS_PHONE_NUMBER_ID = process.env.ELEVENLABS_PHONE_NUMBER_ID;
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1/convai/twilio/outbound-call';
const ELEVENLABS_AGENTS_URL = 'https://api.elevenlabs.io/v1/convai/agents';

/**
 * Fetches business context data for a specific user
 */
async function fetchBusinessContext(userId: string): Promise<BusinessContextData | null> {
    try {
        const result = await db
            .select()
            .from(businessInfo)
            .where(eq(businessInfo.userId, userId))
            .limit(1);

        if (result.length === 0) {
            return null;
        }

        return result[0] as BusinessContextData;
    } catch (error) {
        console.error('Error fetching business context:', error);
        return null;
    }
}

/**
 * Enhances a system prompt with business context
 */
async function enhancePromptWithBusinessContext(userId: string, basePrompt: string): Promise<string> {
    const businessContext = await fetchBusinessContext(userId);
    
    if (!businessContext || !hasBusinessContext(businessContext)) {
        return basePrompt;
    }

    const contextSection = formatBusinessContext(businessContext);
    return basePrompt + contextSection;
}

// MailerSend configuration
const mailerSend = new MailerSend({
    apiKey: process.env.MAILERSEND_API_TOKEN!,
});

// Email notification configuration
const emailConfig = {
    enabled: process.env.EMAIL_NOTIFICATIONS !== 'false',
    fromEmail: process.env.MAILERSEND_FROM_EMAIL || 'notifications@yourdomain.com',
    fromName: 'SkyIQ Dashboard',
    toEmail: process.env.NOTIFICATION_EMAIL,
    toName: 'SkyIQ User'
};

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Business routes
app.use(businessRoutes);

// Authentication routes
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


// User API endpoint for auth hook
app.get("/api/auth/user/:userId", async (req: Request, res: Response) => {
    try {
        const userId = req.params.userId;
        
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id, email, business_name, phone_number, service_plan, verified, created_at')
            .eq('id', userId)
            .single();
            
        if (userError || !userData) {
            return res.status(404).json({ message: "User not found" });
        }
        
        // Return user data without password
        const responseData = {
            id: userData.id,
            email: userData.email,
            businessName: userData.business_name,
            phoneNumber: userData.phone_number,
            servicePlan: userData.service_plan,
            verified: userData.verified,
            createdAt: userData.created_at
        };
        
        res.status(200).json({ data: responseData });
    } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({ message: "Failed to fetch user data" });
    }
});

// Calls API endpoints
app.get('/api/calls/user/:userId', async (req: Request, res: Response) => {
    try {
        const userId = req.params.userId;
        const { data, error } = await supabase
            .from('calls')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        res.json({ data: data || [] });
    } catch (error: any) {
        console.error('Error fetching user calls:', error);
        res.status(500).json({ error: 'Failed to fetch calls' });
    }
});

app.post('/api/calls', async (req: Request, res: Response) => {
    try {
        const callData = req.body;
        const { data, error } = await supabase
            .from('calls')
            .insert([callData])
            .select();

        if (error) throw error;

        res.json({ data: data[0] });
    } catch (error: any) {
        console.error('Error creating call:', error);
        res.status(500).json({ error: 'Failed to create call' });
    }
});

app.delete('/api/calls/:id', async (req: Request, res: Response) => {
    try {
        const callId = req.params.id;
        const userId = req.query.userId;
        
        const { error } = await supabase
            .from('calls')
            .delete()
            .eq('id', callId)
            .eq('user_id', userId);

        if (error) throw error;

        res.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting call:', error);
        res.status(500).json({ error: 'Failed to delete call' });
    }
});

// Business API endpoints are now handled by business routes

// Global batch processing state
let currentBatch: string | null = null;
let batchQueue: string[] = [];

// Helper function for duration formatting
function formatDuration(seconds: number): string {
    if (!seconds || seconds === 0) return '0m 0s';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
        return `${hours}h ${mins}m ${secs}s`;
    } else {
        return `${mins}m ${secs}s`;
    }
}

// Email notification function using MailerSend (only for inbound calls)
async function sendCallNotification(callData: any) {
    if (!emailConfig.enabled || !emailConfig.toEmail || !process.env.MAILERSEND_API_TOKEN || callData.call_type === 'outbound') {
        return;
    }

    const sentFrom = new Sender(emailConfig.fromEmail, emailConfig.fromName);
    const recipients = [new Recipient(emailConfig.toEmail, emailConfig.toName)];

    const emailParams = new EmailParams()
        .setFrom(sentFrom)
        .setTo(recipients)
        .setSubject(`📞 Inbound Call - ${callData.caller_number} - SkyIQ`)
        .setHtml(`
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, system-ui, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
                <div style="background: linear-gradient(135deg, #4f46e5, #06b6d4); padding: 30px 20px; text-align: center; color: white; border-radius: 12px 12px 0 0;">
                    <div style="display: inline-block; background: rgba(255,255,255,0.2); padding: 12px; border-radius: 50%; margin-bottom: 15px; font-size: 24px;">📞</div>
                    <h1 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 700;">New Inbound Call</h1>
                    <p style="margin: 0; opacity: 0.9; font-size: 16px;">SkyIQ Dashboard Notification</p>
                </div>
                
                <div style="padding: 30px 20px; background: #f8fafc;">
                    <h2 style="color: #1e293b; margin: 0 0 20px 0; font-size: 20px; font-weight: 600;">📋 Call Details</h2>
                    
                    <div style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); margin-bottom: 25px;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 12px 0; font-weight: 600; color: #4f46e5; width: 130px; vertical-align: top;">📞 Phone:</td>
                                <td style="padding: 12px 0; font-family: 'SF Mono', Monaco, monospace; font-size: 16px; color: #1e293b;">${callData.caller_number}</td>
                            </tr>
                            <tr style="border-top: 1px solid #e2e8f0;">
                                <td style="padding: 12px 0; font-weight: 600; color: #4f46e5; vertical-align: top;">📅 Date:</td>
                                <td style="padding: 12px 0; color: #1e293b;">${new Date(callData.timestamp).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td>
                            </tr>
                            <tr style="border-top: 1px solid #e2e8f0;">
                                <td style="padding: 12px 0; font-weight: 600; color: #4f46e5; vertical-align: top;">⏱️ Duration:</td>
                                <td style="padding: 12px 0; color: #1e293b;">${formatDuration(callData.duration)}</td>
                            </tr>
                        </table>
                    </div>
                    
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="${process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'}" 
                           style="display: inline-block; background: linear-gradient(135deg, #4f46e5, #7c3aed); color: white; padding: 15px 30px; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);">
                            🖥️ View Dashboard
                        </a>
                    </div>
                </div>
            </div>
        `);

    try {
        await mailerSend.email.send(emailParams);
        console.log('📧 Email notification sent successfully');
    } catch (error: any) {
        console.error('❌ Email notification failed:', error.message);
    }
}

// Initialize database tables - Supabase version
async function initializeDatabase() {
    try {
        console.log('🔧 Initializing Supabase database...');
        
        // Check if tables exist by trying to select from them
        try {
            await supabase.from('calls').select('id').limit(1);
            console.log('✅ Calls table already exists');
        } catch (error) {
            console.log('📝 Note: Create tables manually in Supabase Dashboard or via SQL editor');
            console.log('SQL for calls table:');
            console.log(`
CREATE TABLE IF NOT EXISTS calls (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) REFERENCES users(id), -- Added user_id
    prompt_id INTEGER REFERENCES prompts(id), -- Added prompt_id
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    caller_number VARCHAR(50),
    called_number VARCHAR(50),
    duration INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'completed',
    call_type VARCHAR(50) DEFAULT 'inbound',
    transcript TEXT,
    conversation_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
            `);
        }

        // Check prompts table
        try {
            const { data: promptsData, error: promptsError } = await supabase
                .from('prompts')
                .select('id')
                .limit(1);
            
            if (promptsError) {
                console.log('📝 Create prompts table in Supabase:');
                console.log(`
CREATE TABLE IF NOT EXISTS prompts (
    id SERIAL PRIMARY KEY,
    system_prompt TEXT,
    first_message TEXT,
    prompt TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
                `);
            } else {
                // Insert default prompt if none exists
                const { data: existingPrompts, error } = await supabase
                    .from('prompts')
                    .select('id')
                    .limit(1);

                if (!error && existingPrompts && existingPrompts.length === 0) {
                    await supabase.from('prompts').insert({
                        system_prompt: `You are Andy, a professional AI voice agent for SkyIQ, specializing in AI voice solutions and customer service automation.

**Your Role:**
- Handle both inbound customer inquiries and outbound sales calls
- Provide expert guidance on AI voice technology
- Maintain a professional, helpful, and engaging demeanor
- Focus on understanding customer needs and providing valuable solutions

**For Inbound Calls:**
- Greet warmly: "Thank you for calling SkyIQ! This is Andy. How can I help you today?"
- Listen actively to understand their specific needs
- Ask clarifying questions to better serve them
- Provide detailed information about SkyIQ's AI voice solutions
- Collect contact information when appropriate
- Always end with clear next steps and follow-up commitments

**For Outbound Calls:**
- Introduce yourself: "Hi, this is Andy calling from SkyIQ. Is this [Customer Name]?"
- Ask for permission: "Do you have a moment to discuss how AI voice technology could benefit your business?"
- Clearly explain the purpose of your call
- Focus on how SkyIQ's solutions can solve their specific challenges
- Schedule demos or follow-up meetings when appropriate

**Key Topics You Can Discuss:**
- AI voice agent implementation and benefits
- Automated customer service solutions
- Sales call automation and lead qualification
- Custom voice application development
- Integration with existing business systems
- ROI and cost savings from AI voice solutions
- Technical specifications and requirements

**Conversation Guidelines:**
- Keep responses conversational and concise (1-2 sentences typically)
- Show genuine interest in their business challenges
- Use examples and case studies when relevant
- Handle objections professionally and with empathy
- If you don't know something specific, offer to connect them with a specialist
- Always maintain confidence in SkyIQ's capabilities while being honest about limitations

**Data Collection Priority:**
- Company name and industry
- Current communication/customer service challenges
- Contact information (name, email, phone)
- Decision-making timeline
- Budget considerations (when appropriate)

Remember: Every conversation is an opportunity to build trust and demonstrate SkyIQ's commitment to solving real business problems with advanced AI voice technology.`,
                        first_message: "Hello! This is Andy from SkyIQ. Thanks for taking my call. How are you doing today?"
                    });
                }
            }
        } catch (error) {
            console.log('📝 Create prompts table in Supabase Dashboard');
        }

        // Check batches table
        try {
            await supabase.from('batches').select('id').limit(1);
        } catch (error) {
            console.log('📝 Create batches table in Supabase:');
            console.log(`
CREATE TABLE IF NOT EXISTS batches (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'pending',
    total_calls INTEGER DEFAULT 0,
    completed_calls INTEGER DEFAULT 0,
    successful_calls INTEGER DEFAULT 0,
    failed_calls INTEGER DEFAULT 0
);
            `);
        }

        // Check batch_calls table
        try {
            await supabase.from('batch_calls').select('id').limit(1);
        } catch (error) {
            console.log('📝 Create batch_calls table in Supabase:');
            console.log(`
CREATE TABLE IF NOT EXISTS batch_calls (
    id VARCHAR(255) PRIMARY KEY,
    batch_id VARCHAR(255),
    phone_number VARCHAR(50),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    company VARCHAR(200),
    status VARCHAR(50) DEFAULT 'pending',
    call_id VARCHAR(255),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    FOREIGN KEY (batch_id) REFERENCES batches(id)
);
            `);
        }

        // Check eleven_labs_conversations table
        try {
            await supabase.from('eleven_labs_conversations').select('id').limit(1);
        } catch (error) {
            console.log('📝 Create eleven_labs_conversations table in Supabase:');
            console.log(`
CREATE TABLE IF NOT EXISTS eleven_labs_conversations (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) REFERENCES users(id),
    conversation_id VARCHAR(255) UNIQUE NOT NULL,
    agent_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'completed',
    duration INTEGER DEFAULT 0,
    transcript TEXT,
    summary TEXT,
    phone_number VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
            `);
        }

        console.log('✅ Database initialization complete');
    } catch (error: any) {
        console.error('❌ Database initialization error:', error);
    }
}

// Smart first message extraction
function extractFirstMessageFromPrompt(systemPrompt: string): string {
    const lines = systemPrompt.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // Strategy 1: Look for explicit greeting patterns
    for (const line of lines) {
        const cleaned = line.replace(/^[-*•"']\s*/, '').replace(/["']$/, '').trim();
        
        if (cleaned.match(/^(hello|hi|good\s+(morning|afternoon|evening)|thank\s+you\s+for\s+calling)/i) && cleaned.length < 200) {
            return cleaned;
        }
        
        if (cleaned.match(/^this\s+is\s+\w+/i) && cleaned.length < 150) {
            return cleaned.startsWith('Hello') ? cleaned : `Hello! ${cleaned}`;
        }
    }
    
    // Strategy 2: Extract from "You are [Name]" and build greeting
    const nameCompanyMatch = systemPrompt.match(/you\s+are\s+(\w+).*?(?:from|at|for|work\s+for)\s+([^.!?\n]+)/i);
    if (nameCompanyMatch) {
        const name = nameCompanyMatch[1];
        const company = nameCompanyMatch[2].replace(/[,.].*/, '').trim();
        return `Hello! This is ${name} from ${company}. How can I help you today?`;
    }
    
    // Strategy 3: Look for any name in the prompt
    const simpleNameMatch = systemPrompt.match(/you\s+are\s+(\w+)/i);
    if (simpleNameMatch) {
        const name = simpleNameMatch[1];
        return `Hello! This is ${name}. How can I help you today?`;
    }
    
    // Fallback
    return "Hello! How can I help you today?";
}

// Update ElevenLabs agent with new prompt
async function updateElevenLabsAgent(systemPrompt: string, firstMessage: string) {
    if (!ELEVENLABS_API_KEY || !ELEVENLABS_AGENT_ID) {
        throw new Error('ElevenLabs configuration incomplete. Please set ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID environment variables.');
    }

    try {
        const updateData = {
            conversation_config: {
                agent: {
                    first_message: firstMessage,
                    prompt: {
                        prompt: systemPrompt
                    }
                }
            }
        };

        console.log('🔧 ElevenLabs Update Request:');
        console.log('📍 URL:', `${ELEVENLABS_AGENTS_URL}/${ELEVENLABS_AGENT_ID}`);
        console.log('📝 System Prompt:', systemPrompt.substring(0, 100) + '...');
        console.log('💬 First Message:', firstMessage);

        const response = await fetch(`${ELEVENLABS_AGENTS_URL}/${ELEVENLABS_AGENT_ID}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'xi-api-key': ELEVENLABS_API_KEY
            },
            body: JSON.stringify(updateData)
        });

        console.log('📡 ElevenLabs Response Status:', response.status);

        if (!response.ok) {
            const errorData = await response.text();
            console.error('❌ ElevenLabs API Error Response:', errorData);
            throw new Error(`ElevenLabs API error: ${response.status} - ${errorData}`);
        }

        const result = await response.json();
        console.log('✅ ElevenLabs agent updated successfully');
        return result;
    } catch (error: any) {
        console.error('❌ Error updating ElevenLabs agent:', error);
        throw error;
    }
}

// Function to initiate outbound call via ElevenLabs API
async function initiateOutboundCall(phoneNumber: string) {
    if (!ELEVENLABS_API_KEY || !ELEVENLABS_AGENT_ID || !ELEVENLABS_PHONE_NUMBER_ID) {
        throw new Error('ElevenLabs configuration incomplete. Please set ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID, and ELEVENLABS_PHONE_NUMBER_ID environment variables.');
    }

    try {
        const requestBody = {
            agent_id: ELEVENLABS_AGENT_ID,
            agent_phone_number_id: ELEVENLABS_PHONE_NUMBER_ID,
            to_number: phoneNumber,
            conversation_initiation_client_data: {}
        };

        const response = await fetch(ELEVENLABS_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'xi-api-key': ELEVENLABS_API_KEY
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`ElevenLabs API error: ${response.status} - ${errorData}`);
        }

        const data = await response.json();
        
        return {
            conversation_id: data.conversation_id || data.id,
            call_sid: data.callSid || data.call_sid,
            status: 'initiated',
            message: data.message || 'Call initiated successfully'
        };
    } catch (error) {
        throw error;
    }
}

// Process batch calls sequentially - Supabase version
async function processBatch(batchId: string) {
    try {
        console.log(`📞 Starting batch processing for batch: ${batchId}`);
        
        // Update batch status to processing
        await supabase
            .from('batches')
            .update({ status: 'processing' })
            .eq('id', batchId);

        // Get all pending calls for this batch
        const { data: batchCalls, error: batchCallsError } = await supabase
            .from('batch_calls')
            .select('*')
            .eq('batch_id', batchId)
            .eq('status', 'pending')
            .order('created_at', { ascending: true });

        if (batchCallsError) throw batchCallsError;

        for (const batchCall of batchCalls || []) {
            try {
                const customerName = batchCall.first_name && batchCall.last_name 
                    ? `${batchCall.first_name} ${batchCall.last_name}`
                    : batchCall.first_name || 'Customer';
                
                console.log(`📞 Calling ${customerName} at ${batchCall.phone_number}...`);
                
                // Update call status to processing
                await supabase
                    .from('batch_calls')
                    .update({ status: 'processing' })
                    .eq('id', batchCall.id);

                // Initiate the call
                const callResult = await initiateOutboundCall(batchCall.phone_number);
                
                // Create call record
                const callData = {
                    id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    timestamp: new Date().toISOString(),
                    caller_number: batchCall.phone_number,
                    called_number: 'Agent',
                    duration: 0,
                    status: 'initiated',
                    call_type: 'outbound',
                    transcript: '',
                    conversation_id: callResult.conversation_id
                };

                // Save call to Supabase
                await supabase
                    .from('calls')
                    .insert(callData);

                // Update batch call status
                await supabase
                    .from('batch_calls')
                    .update({
                        status: 'completed',
                        call_id: callData.id,
                        completed_at: new Date().toISOString()
                    })
                    .eq('id', batchCall.id);

                // Broadcast new call
                io.emit('newCall', callData);

                console.log(`✅ Call initiated successfully to ${customerName} (${batchCall.phone_number})`);

                // Wait 2 seconds between calls
                await new Promise(resolve => setTimeout(resolve, 2000));

            } catch (error: any) {
                console.error(`❌ Failed to call ${batchCall.phone_number}:`, error.message);
                
                // Update batch call with error
                await supabase
                    .from('batch_calls')
                    .update({
                        status: 'failed',
                        error_message: error.message,
                        completed_at: new Date().toISOString()
                    })
                    .eq('id', batchCall.id);

                continue;
            }
        }

        // Mark batch as completed
        await supabase
            .from('batches')
            .update({ status: 'completed' })
            .eq('id', batchId);

        console.log(`🎉 Batch ${batchId} completed!`);

    } catch (error: any) {
        console.error(`💥 Batch processing failed for ${batchId}:`, error);
        
        // Mark batch as failed
        await supabase
            .from('batches')
            .update({ status: 'failed' })
            .eq('id', batchId);
    }

    // Clear current batch and process next in queue
    currentBatch = null;
    if (batchQueue.length > 0) {
        const nextBatchId = batchQueue.shift()!;
        currentBatch = nextBatchId;
        processBatch(nextBatchId);
    }
}

// API Routes

// Get current prompt for a specific user
app.get('/api/prompt/:userId', async (req: Request, res: Response) => {
    try {
        const userId = req.params.userId;
        const { data, error } = await supabase
            .from('prompts')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
            throw error;
        }

        res.json({ success: true, prompt: data || null });
    } catch (error: any) {
        console.error('Error fetching prompt:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get current prompt (legacy endpoint for backward compatibility)
app.get('/api/prompt', async (req: Request, res: Response) => {
    try {
        const { data, error } = await supabase
            .from('prompts')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error) throw error;

        res.json({ success: true, prompt: data });
    } catch (error: any) {
        console.error('Error fetching prompt:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update prompt for a specific user
app.put('/api/prompt/:userId', async (req: Request, res: Response) => {
    try {
        const userId = req.params.userId;
        const { system_prompt, first_message } = req.body;

        if (!system_prompt) {
            return res.status(400).json({ success: false, error: 'system_prompt is required' });
        }

        // Enhance the system prompt with business context
        const enhancedPrompt = await enhancePromptWithBusinessContext(userId, system_prompt);
        const extractedFirstMessage = first_message || extractFirstMessageFromPrompt(enhancedPrompt);

        console.log('🔍 Enhanced prompt with business context for user:', userId);
        console.log('📝 Original prompt length:', system_prompt.length);
        console.log('🚀 Enhanced prompt length:', enhancedPrompt.length);

        // Update in Supabase for specific user (store the original prompt)
        const { data, error } = await supabase
            .from('prompts')
            .upsert({
                user_id: userId,
                system_prompt,
                first_message: extractedFirstMessage,
                prompt: system_prompt,
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        // Update ElevenLabs agent with enhanced prompt (includes business context)
        try {
            await updateElevenLabsAgent(enhancedPrompt, extractedFirstMessage);
            console.log('✅ ElevenLabs agent updated with business context');
        } catch (elevenLabsError: any) {
            console.error('ElevenLabs update failed:', elevenLabsError);
            return res.status(500).json({
                success: false,
                error: 'Failed to update ElevenLabs agent',
                details: elevenLabsError.message
            });
        }

        res.json({ 
            success: true, 
            message: 'Prompt updated successfully for user with business context',
            prompt: data
        });
    } catch (error: any) {
        console.error('Error updating prompt:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update prompt (legacy endpoint for backward compatibility)
app.put('/api/prompt', async (req: Request, res: Response) => {
    try {
        const { system_prompt, first_message, user_id } = req.body;

        if (!system_prompt) {
            return res.status(400).json({ success: false, error: 'system_prompt is required' });
        }

        // Try to enhance with business context if user_id is provided
        let enhancedPrompt = system_prompt;
        if (user_id) {
            enhancedPrompt = await enhancePromptWithBusinessContext(user_id, system_prompt);
            console.log('🔍 Enhanced legacy prompt with business context for user:', user_id);
        }

        const extractedFirstMessage = first_message || extractFirstMessageFromPrompt(enhancedPrompt);

        // Update in Supabase (store original prompt)
        const { data, error } = await supabase
            .from('prompts')
            .upsert({
                user_id: user_id || null,
                system_prompt,
                first_message: extractedFirstMessage,
                prompt: system_prompt,
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        // Update ElevenLabs agent with enhanced prompt
        try {
            await updateElevenLabsAgent(enhancedPrompt, extractedFirstMessage);
            if (user_id) {
                console.log('✅ ElevenLabs agent updated with business context');
            }
        } catch (elevenLabsError: any) {
            console.error('ElevenLabs update failed:', elevenLabsError);
            return res.status(500).json({
                success: false,
                error: 'Failed to update ElevenLabs agent',
                details: elevenLabsError.message
            });
        }

        res.json({ 
            success: true, 
            message: user_id ? 'Prompt updated successfully with business context' : 'Prompt updated successfully',
            prompt: data
        });
    } catch (error: any) {
        console.error('Error updating prompt:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Initiate single call
app.post('/api/calls/initiate', async (req: Request, res: Response) => {
    try {
        const { phone_number, user_id } = req.body;

        if (!phone_number) {
            return res.status(400).json({ success: false, error: 'phone_number is required' });
        }

        if (!user_id) {
            return res.status(400).json({ success: false, error: 'user_id is required' });
        }

        // Validate that the user exists
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('id', user_id)
            .single();
        
        if (userError || !userData) {
            return res.status(401).json({ success: false, error: 'Invalid user_id' });
        }

        const callResult = await initiateOutboundCall(phone_number);
        const userId = userData.id;
        
        // Create call record (ID will be auto-generated)
        const callData = {
            user_id: userId,
            timestamp: new Date().toISOString(),
            caller_number: phone_number,
            called_number: 'Agent',
            duration: 0,
            status: 'initiated',
            call_type: 'outbound',
            transcript: '',
            conversation_id: callResult.conversation_id,
            phone_number: phone_number
        };

        const { error } = await supabase
            .from('calls')
            .insert(callData);

        if (error) throw error;

        // Broadcast to connected clients
        io.emit('newCall', callData);

        res.json({ 
            success: true, 
            message: 'Call initiated successfully',
            call: callData,
            elevenlabs_response: callResult
        });
    } catch (error: any) {
        console.error('Error initiating call:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Upload and process batch
app.post('/api/batch/upload', upload.single('file'), async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        const { name } = req.body;
        const csvContent = req.file.buffer.toString('utf-8');
        const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        
        if (lines.length < 2) {
            return res.status(400).json({ success: false, error: 'CSV must contain header row and at least one data row' });
        }

        const header = lines[0].toLowerCase();
        const phoneIndex = header.indexOf('phone') !== -1 ? header.split(',').findIndex(col => col.includes('phone')) : -1;
        const firstNameIndex = header.split(',').findIndex(col => col.includes('first'));
        const lastNameIndex = header.split(',').findIndex(col => col.includes('last'));
        const companyIndex = header.split(',').findIndex(col => col.includes('company'));

        if (phoneIndex === -1) {
            return res.status(400).json({ success: false, error: 'CSV must contain a phone number column' });
        }

        // Create batch
        const batchId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const batchData = {
            id: batchId,
            name: name || `Batch ${new Date().toLocaleString()}`,
            total_calls: lines.length - 1,
            status: 'pending'
        };

        const { error: batchError } = await supabase
            .from('batches')
            .insert(batchData);

        if (batchError) throw batchError;

        // Process CSV rows and create batch calls
        const batchCalls = lines.slice(1).map((line, index) => {
            const columns = line.split(',').map(col => col.trim().replace(/^"|"$/g, ''));
            return {
                id: `call-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
                batch_id: batchId,
                phone_number: columns[phoneIndex] || '',
                first_name: firstNameIndex !== -1 ? columns[firstNameIndex] || '' : '',
                last_name: lastNameIndex !== -1 ? columns[lastNameIndex] || '' : '',
                company: companyIndex !== -1 ? columns[companyIndex] || '' : '',
                status: 'pending'
            };
        }).filter(call => call.phone_number.length > 0);

        if (batchCalls.length === 0) {
            return res.status(400).json({ success: false, error: 'No valid phone numbers found in CSV' });
        }

        const { error: callsError } = await supabase
            .from('batch_calls')
            .insert(batchCalls);

        if (callsError) throw callsError;

        // Update batch with actual call count
        await supabase
            .from('batches')
            .update({ total_calls: batchCalls.length })
            .eq('id', batchId);

        // Add to processing queue
        if (!currentBatch) {
            currentBatch = batchId;
            processBatch(batchId);
        } else {
            batchQueue.push(batchId);
        }

        res.json({ 
            success: true, 
            message: `Batch created with ${batchCalls.length} calls`,
            batch: { ...batchData, total_calls: batchCalls.length },
            calls: batchCalls.length
        });
    } catch (error: any) {
        console.error('Error processing batch upload:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get batches
app.get('/api/batches', async (req: Request, res: Response) => {
    try {
        const { data, error } = await supabase
            .from('batches')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({ success: true, batches: data });
    } catch (error: any) {
        console.error('Error fetching batches:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Webhook endpoint for ElevenLabs
app.post('/webhook', async (req: Request, res: Response) => {
    try {
        const webhookData = req.body;
        console.log('🔔 Webhook received:', JSON.stringify(webhookData, null, 2));

        // Handle conversation initiation
        if (webhookData.conversation_initiation_metadata_type === 'conversation_initiation_client_data') {
            console.log('🎯 Conversation initiation request detected');
            
            // Get current prompt from database
            const { data: promptData, error: promptError } = await supabase
                .from('prompts')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            let currentPrompt = 'Hello! How can I help you today?';
            let firstMessage = 'Hello! How can I help you today?';

            if (!promptError && promptData) {
                currentPrompt = promptData.system_prompt || promptData.prompt || currentPrompt;
                firstMessage = promptData.first_message || extractFirstMessageFromPrompt(currentPrompt);
            }

            // Return the required format for ElevenLabs conversation initiation
            const response = {
                agent: {
                    prompt: {
                        prompt: currentPrompt
                    },
                    first_message: firstMessage
                }
            };

            console.log('✅ Sending conversation config:', JSON.stringify(response, null, 2));
            return res.status(200).json(response);
        }

        // Handle other webhook types (call tracking, etc.)
        let eventType = webhookData.event;
        
        // Infer event type from data structure and ElevenLabs event types
        if (!eventType) {
            // Check for specific ElevenLabs event types first
            if (webhookData.event_type === 'post_call_transcription' || 
                (webhookData.transcript && webhookData.summary && webhookData.conversation_id)) {
                eventType = 'post_call_transcription';
            } else if (webhookData.duration_seconds !== undefined || webhookData.duration !== undefined) {
                eventType = 'call_ended';
            } else if (webhookData.call_sid && webhookData.caller_id) {
                eventType = 'call_started';
            } else if (webhookData.transcript) {
                eventType = 'transcript';
            } else {
                eventType = 'unknown';
            }
        }

        console.log(`🔍 Inferred event type: ${eventType}`);

        // Handle different webhook event types
        switch (eventType) {
            case 'call_started':
                await handleCallStarted(webhookData);
                break;
                
            case 'post_call_transcription':
                await handlePostCallTranscription(webhookData);
                break;
                
            case 'call_ended':
                await handleCallEnded(webhookData);
                break;
                
            case 'transcript':
                await handleTranscript(webhookData);
                break;
                
            default:
                console.log(`⚠️ Unhandled webhook event: ${eventType}`, webhookData);
                if (webhookData.call_sid || webhookData.caller_id) {
                    await handleCallStarted(webhookData);
                }
        }

        res.status(200).send('Webhook processed successfully');
    } catch (error: any) {
        console.error('❌ Error processing webhook:', error);
        res.status(500).json({ error: 'Error processing webhook' });
    }
});

// Handle call started events
async function handleCallStarted(webhookData: any) {
    try {
        const callId = webhookData.call_id || webhookData.call_sid || webhookData.conversation_id;
        const fromNumber = webhookData.from_number || webhookData.caller_id;
        const toNumber = webhookData.to_number || webhookData.called_number;
        const conversationId = webhookData.conversation_id || webhookData.call_sid || callId;
        
        console.log(`📞 Processing call start: ${fromNumber} → ${toNumber}`);
        
        // Check if call already exists
        const { data: existingCall, error: checkError } = await supabase
            .from('calls')
            .select('id')
            .eq('conversation_id', conversationId)
            .limit(1);

        if (checkError) throw checkError;
        
        if (!existingCall || existingCall.length === 0) {
            // Look up user for this call
            let userId: string | null = null;
            let promptId: number | null = null;

            // Attempt to find user by matching `toNumber` (the number called) with a user's `phone_number`
            if (toNumber) {
                const { data: userData } = await supabase
                    .from('users')
                    .select('id')
                    .eq('phone_number', toNumber)
                    .single();
                userId = userData?.id;
            }

            // Fallback: if no specific user, use the default user (first user found)
            if (!userId) {
                const { data: firstUser } = await supabase
                    .from('users')
                    .select('id')
                    .limit(1)
                    .single();
                userId = firstUser?.id || null; // Ensure userId is null if no user is found
            }

            // Get current prompt data for the user
            if (userId) {
                const { data: promptData, error: promptError } = await supabase
                    .from('prompts')
                    .select('id')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();
                if (!promptError && promptData) {
                    promptId = promptData.id;
                }
            } else {
                // If no user, try to get the most recent prompt without a user_id (legacy/default)
                const { data: promptData, error: promptError } = await supabase
                    .from('prompts')
                    .select('id')
                    .is('user_id', null)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();
                if (!promptError && promptData) {
                    promptId = promptData.id;
                }
            }

            // Create new call record (ID will be auto-generated)
            const callData = {
                user_id: userId,
                prompt_id: promptId,
                timestamp: new Date().toISOString(),
                caller_number: fromNumber,
                called_number: toNumber,
                phone_number: fromNumber,
                duration: 0,
                status: 'in-progress',
                call_type: 'inbound',
                transcript: '',
                conversation_id: conversationId || callId
            };

            const { data: insertedCall, error: insertError } = await supabase
                .from('calls')
                .insert(callData)
                .select()
                .single();

            if (insertError) throw insertError;

            const newCallId = insertedCall?.id;
            console.log(`✅ Created new call record: ${newCallId}`);

            // Send email notification for inbound calls
            if (callData.call_type === 'inbound') {
                await sendCallNotification(callData);
            }

            // Emit to connected clients
            io.emit('newCall', callData);
        } else {
            console.log(`📝 Call already exists, updating status`);
            // Update existing call status
            const { error: updateError } = await supabase
                .from('calls')
                .update({ status: 'in-progress' })
                .eq('conversation_id', conversationId);

            if (updateError) throw updateError;
        }

        console.log('✅ Call started event processed');
    } catch (error: any) {
        console.error('❌ Error handling call started event:', error);
    }
}

// Handle post-call transcription events from ElevenLabs
async function handlePostCallTranscription(webhookData: any) {
    try {
        const conversationId = webhookData.conversation_id || webhookData.call_id;
        const transcript = webhookData.transcript || '';
        const summary = webhookData.summary || '';
        const duration = webhookData.duration_seconds || webhookData.duration || 0;
        
        console.log(`📋 Processing post-call transcription for: ${conversationId}`);
        console.log(`📝 Transcript length: ${transcript.length} characters`);
        console.log(`📄 Summary: ${summary.substring(0, 100)}...`);
        console.log(`⏱️ Duration: ${duration} seconds`);
        
        // Update the existing call record with complete conversation data
        const { data: updatedCall, error: updateError } = await supabase
            .from('calls')
            .update({
                transcript: transcript,
                summary: summary,
                duration: duration,
                status: 'completed',
                updated_at: new Date().toISOString()
            })
            .eq('conversation_id', conversationId)
            .select()
            .single();

        if (updateError) {
            console.error('❌ Error updating call record:', updateError);
            throw updateError;
        }

        console.log(`✅ Updated call record ID: ${updatedCall?.id} with complete conversation data`);
        
        // Also store in ElevenLabs conversations table if needed
        try {
            const { error: elevenLabsError } = await supabase
                .from('eleven_labs_conversations')
                .upsert({
                    user_id: updatedCall?.user_id,
                    conversation_id: conversationId,
                    agent_id: webhookData.agent_id || 'unknown',
                    status: 'completed',
                    duration: duration,
                    transcript: transcript,
                    summary: summary,
                    phone_number: updatedCall?.phone_number,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'conversation_id'
                });

            if (elevenLabsError) {
                console.warn('⚠️ Warning: Could not store in ElevenLabs conversations table:', elevenLabsError);
            } else {
                console.log('✅ Also stored in ElevenLabs conversations table');
            }
        } catch (elevenLabsStoreError) {
            console.warn('⚠️ Warning: ElevenLabs conversation storage failed:', elevenLabsStoreError);
        }

        // Emit to connected clients
        io.emit('callCompleted', { 
            conversation_id: conversationId, 
            transcript, 
            summary, 
            duration,
            status: 'completed'
        });
        
        console.log('✅ Post-call transcription processed successfully');

    } catch (error: any) {
        console.error('❌ Error handling post-call transcription:', error);
    }
}

// Handle call ended events
async function handleCallEnded(webhookData: any) {
    try {
        const conversationId = webhookData.conversation_id || webhookData.call_sid || webhookData.call_id;
        const duration = webhookData.duration_seconds || webhookData.duration || 0;
        
        console.log(`📞 Processing call end: ${conversationId}, duration: ${duration}s`);
        
        // Update call in calls table
        const { error: callUpdateError } = await supabase
            .from('calls')
            .update({
                status: 'completed',
                duration: duration
            })
            .eq('conversation_id', conversationId);

        if (callUpdateError) throw callUpdateError;

        io.emit('callEnded', { conversation_id: conversationId, duration });
        
        console.log('✅ Call ended event processed');

    } catch (error: any) {
        console.error('❌ Error handling call ended event:', error);
    }
}

// Handle transcript events
async function handleTranscript(webhookData: any) {
    try {
        const conversationId = webhookData.conversation_id || webhookData.call_sid || webhookData.call_id;
        const transcript = webhookData.transcript || webhookData.text || '';
        
        console.log(`📝 Processing transcript update for: ${conversationId}`);
        
        // Get current transcript
        const { data: currentCall, error: selectError } = await supabase
            .from('calls')
            .select('transcript')
            .eq('conversation_id', conversationId)
            .single();

        if (selectError) throw selectError;

        const updatedTranscript = (currentCall?.transcript || '') + transcript + ' ';

        // Update transcript
        const { error: updateError } = await supabase
            .from('calls')
            .update({ transcript: updatedTranscript })
            .or(`conversation_id.eq.${conversationId},id.eq.${conversationId}`);

        if (updateError) throw updateError;

        io.emit('transcriptUpdate', { conversation_id: conversationId, transcript });
        
        console.log('✅ Transcript updated');

    } catch (error: any) {
        console.error('❌ Error handling transcript event:', error);
    }
}

// API endpoint to get call history
app.get('/api/calls', async (req: Request, res: Response) => {
    try {
        const { data, error } = await supabase
            .from('calls')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(50);

        if (error) throw error;

        res.json({ calls: data });
    } catch (error: any) {
        console.error('Database query error:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Health check endpoint
app.get('/health', async (req: Request, res: Response) => {
    try {
        const { count, error } = await supabase
            .from('calls')
            .select('*', { count: 'exact', head: true });

        if (error) throw error;

        res.json({ 
            status: 'healthy', 
            uptime: process.uptime(),
            callCount: count,
            emailNotifications: emailConfig.enabled,
            elevenLabsConfigured: !!(ELEVENLABS_API_KEY && ELEVENLABS_AGENT_ID && ELEVENLABS_PHONE_NUMBER_ID),
            currentBatch: currentBatch,
            queueLength: batchQueue.length,
            supabaseConnected: true,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        res.status(500).json({ 
            status: 'unhealthy', 
            error: error.message,
            supabaseConnected: false,
            timestamp: new Date().toISOString()
        });
    }
});

// Socket.io connection handling
io.on('connection', async (socket) => {
    console.log('Client connected');
    
    try {
        // Send call history
        const { data: callHistory, error: callError } = await supabase
            .from('calls')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(50);

        if (!callError && callHistory) {
            socket.emit('callHistory', callHistory);
        }
        
        // Send current batches
        const { data: batches, error: batchError } = await supabase
            .from('batches')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);

        if (!batchError && batches) {
            socket.emit('batchHistory', batches);
        }
    } catch (error: any) {
        console.error('Error sending initial data:', error);
    }
    
    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Initialize on startup
(async () => {
  await initializeDatabase();
  
  // Setup Vite in development
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Use environment PORT variable for deployment compatibility (Render, etc)
  const port = parseInt(process.env.PORT || '3000', 10);
  server.listen(port, "0.0.0.0", () => {
    log(`✅ SkyIQ Dashboard Server running on port ${port}`);
    log(`📡 Webhook endpoint: http://localhost:${port}/webhook`);
    log(`📊 Dashboard: http://localhost:${port}`);
    log(`🏥 Health check: http://localhost:${port}/health`);
    log(`🗃️ Database: ${process.env.SUPABASE_URL ? 'Supabase Connected' : 'Not configured'}`);
    log(`📧 Email notifications: ${emailConfig.enabled ? 'Enabled (inbound only)' : 'Disabled'}`);
    log(`🤖 ElevenLabs API: ${ELEVENLABS_API_KEY && ELEVENLABS_AGENT_ID && ELEVENLABS_PHONE_NUMBER_ID ? 'Configured' : 'Not configured'}`);
  });
})();
