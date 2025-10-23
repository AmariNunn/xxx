import express, { type Request, Response } from "express";
import cors from 'cors';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { MailerSend, EmailParams, Sender, Recipient } from "mailersend";
import multer from 'multer';
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./supabaseStorage";
import businessRoutes from "./routes/business";
import { registerRoutes } from "./routes";
import { 
  insertUserSchema, 
  loginUserSchema, 
  forgotPasswordSchema
} from "../shared/types";
import { formatBusinessContext, hasBusinessContext, type BusinessContextData } from "./businessContextFormatter";
import { normalizeAndResolveNumbers, resolveUserIdForCall } from "./utils/callHelpers";

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "*",               // for testing, or use your frontend URL
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

// Database configuration for business context queries - now using Supabase

// ElevenLabs API configuration (credentials are per-user from Supabase, not env vars)
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1/convai/twilio/outbound-call';
const ELEVENLABS_AGENTS_URL = 'https://api.elevenlabs.io/v1/convai/agents';

// Phone normalization helpers (US-centric; extend as needed)
function onlyDigits(input?: string): string {
    return (input || '').replace(/\D+/g, '');
}
function toE164US(input?: string): string | null {
    const digits = onlyDigits(input);
    if (!digits) return null;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length > 1 && input?.startsWith('+')) return input as string;
    return null;
}
function candidateNumbers(input?: string): string[] {
    const raw = input || '';
    const digits = onlyDigits(raw);
    const e164 = toE164US(raw);
    const last10 = digits.length >= 10 ? digits.slice(-10) : digits;
    const candidates = new Set<string>();
    if (raw) candidates.add(raw);
    if (e164) candidates.add(e164);
    if (last10) candidates.add(`+1${last10}`);
    if (digits) candidates.add(digits);
    return Array.from(candidates).filter(Boolean);
}

// Twilio direction normalization
// Handles various Twilio direction values: 'inbound', 'inbound-api', 'outbound', 'outbound-api', 'outbound-dial'
function normalizeDirection(direction: string): 'inbound' | 'outbound' {
    if (!direction) return 'outbound';
    if (direction.startsWith('inbound')) return 'inbound';
    return 'outbound';
}

/**
 * Fetches business context data for a specific user
 */
async function fetchBusinessContext(userId: string): Promise<BusinessContextData | null> {
    try {
        const { data: result, error } = await supabase
            .from('business_info')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error || !result) {
            return null;
        }

        // Map database field names to interface field names
        const businessContext: BusinessContextData = {
            description: result.description,
            links: result.links,
            scrapedContent: result.scraped_content,
            scrapedTitles: result.scraped_titles,
            scrapedUrls: result.scraped_urls,
            scrapedAt: result.scraped_at,
            fileNames: result.file_names,
            fileTypes: result.file_types,
            fileUrls: result.file_urls,
            fileSizes: result.file_sizes,
            documentContent: result.document_content,
            documentTitles: result.document_titles,
            documentExtractedAt: result.document_extracted_at,
            businessName: result.business_name,
            businessPhone: result.business_phone,
            businessAddress: result.business_address
        };

        return businessContext;
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
    fromName: 'Sky IQ'
    // Note: Recipient email is now fetched dynamically from Supabase per user, not from env vars
};

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
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
            .order('timestamp', { ascending: false })
            .limit(50);

        if (error) throw error;

        // Transform the data to ensure consistent field names for the frontend
        const transformedData = (data || []).map((call: any) => ({
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

        res.json({ data: transformedData });
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

app.patch('/api/calls/:id/notes', async (req: Request, res: Response) => {
    try {
        const callId = req.params.id;
        const { notes } = req.body;
        
        const { error } = await supabase
            .from('calls')
            .update({ notes })
            .eq('id', callId);

        if (error) throw error;

        res.json({ success: true });
    } catch (error: any) {
        console.error('Error updating call notes:', error);
        res.status(500).json({ error: 'Failed to update call notes' });
    }
});

// Cal.com integration endpoints
app.post("/api/calcom/settings/:userId", async (req: Request, res: Response) => {
    try {
        const userId = req.params.userId;
        const { apiKey, eventTypeId, enabled } = req.body;

        // Get existing settings
        const existingInfo = await storage.getBusinessInfo(userId);
        
        // Determine what values to use (new values if provided, otherwise keep existing)
        const finalApiKey = apiKey || existingInfo?.cal_com_api_key;
        const finalEventTypeId = eventTypeId || existingInfo?.cal_com_event_type_id;
        const finalEnabled = enabled !== undefined ? enabled : (existingInfo?.cal_com_enabled || false);

        // Only require credentials if they don't exist yet
        if (!finalApiKey || !finalEventTypeId) {
            return res.status(400).json({ message: "Cal.com API Key and Event Type ID are required for initial setup" });
        }

        // Save Cal.com settings for the user
        const result = await storage.updateCalComSettings(userId, {
            apiKey: finalApiKey,
            eventTypeId: finalEventTypeId,
            enabled: finalEnabled
        });

        res.json({ 
            message: "Cal.com settings updated successfully", 
            data: result,
            enabled: finalEnabled
        });
    } catch (error) {
        console.error("Error updating Cal.com settings:", error);
        res.status(500).json({ message: "Failed to update Cal.com settings" });
    }
});

app.get("/api/calcom/settings/:userId", async (req: Request, res: Response) => {
    try {
        const userId = req.params.userId;
        const businessInfo = await storage.getBusinessInfo(userId);
        
        if (businessInfo && businessInfo.cal_com_api_key) {
            res.json({
                connected: true,
                eventTypeId: businessInfo.cal_com_event_type_id,
                apiKey: businessInfo.cal_com_api_key.substring(0, 12) + "...",
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

// Email notification function using MailerSend (for both inbound and outbound calls)
async function sendCallNotification(callData: any) {
    console.log('📧 sendCallNotification called with callData:', {
        user_id: callData.user_id,
        call_type: callData.call_type,
        phone: callData.caller_number || callData.called_number
    });

    if (!emailConfig.enabled || !process.env.MAILERSEND_API_TOKEN) {
        console.log('⚠️ Email notifications disabled or no API token');
        return;
    }

    // Fetch user's email from Supabase using user_id from callData
    let userEmail: string | null = null;
    let userName: string = 'SkyIQ User';
    
    if (callData.user_id) {
        console.log(`🔍 Fetching user email for user_id: ${callData.user_id}`);
        try {
            const { data: userData, error } = await supabase
                .from('users')
                .select('email, business_name')
                .eq('id', callData.user_id)
                .single();
            
            console.log('📊 Supabase user query result:', { userData, error });
            
            if (!error && userData) {
                userEmail = userData.email;
                userName = userData.business_name || userData.email;
                console.log(`✅ Found user email: ${userEmail}, name: ${userName}`);
            }
        } catch (error) {
            console.error('❌ Error fetching user email for notification:', error);
        }
    } else {
        console.log('⚠️ No user_id in callData');
    }
    
    // If we couldn't get user email, skip sending notification
    if (!userEmail) {
        console.log('⚠️ No user email found, skipping notification');
        return;
    }

    console.log(`📧 Sending email notification to: ${userEmail} (${userName})`);

    const sentFrom = new Sender(emailConfig.fromEmail, emailConfig.fromName);
    const recipients = [new Recipient(userEmail, userName)];

    const phoneNumber = callData.call_type === 'outbound' 
        ? (callData.called_number || callData.caller_number) 
        : callData.caller_number;
    
    // Format timestamp - just date for now (hiding time until timezone issue is resolved)
    let callDate: Date;
    const rawTimestamp = callData.timestamp || callData.created_at;
    
    if (rawTimestamp instanceof Date) {
        callDate = rawTimestamp;
    } else if (typeof rawTimestamp === 'number' || typeof rawTimestamp === 'bigint') {
        // Handle numeric timestamps (milliseconds since epoch)
        callDate = new Date(Number(rawTimestamp));
    } else if (typeof rawTimestamp === 'string') {
        // Append Z if no timezone info present to treat as UTC
        const hasTimezone = rawTimestamp.endsWith('Z') || rawTimestamp.includes('+') || rawTimestamp.includes('-', 10);
        const utcTimestamp = hasTimezone ? rawTimestamp : rawTimestamp + 'Z';
        callDate = new Date(utcTimestamp);
    } else {
        callDate = new Date();
    }
    
    // Get app URL for logo - use full Replit domain
    const appUrl = process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : 'https://SkyIQ.app';
    const logoUrl = `${appUrl}/skyiq-logo.png`;
    
    console.log('📧 Email logo URL:', logoUrl);
    
    const emailParams = new EmailParams()
        .setFrom(sentFrom)
        .setTo(recipients)
        .setSubject(`New Call Received from ${phoneNumber} | SkyIQ`)
        .setHtml(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
                    <tr>
                        <td align="center">
                            <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);">
                                
                                <!-- Header -->
                                <tr>
                                    <td style="background: linear-gradient(135deg, #009AEE 0%, #0077CC 100%); padding: 48px 40px; text-align: center;">
                                        <img src="${logoUrl}" alt="SkyIQ Logo" style="width: 120px; height: 120px; object-fit: contain; margin-bottom: 24px; display: block; margin-left: auto; margin-right: auto;" />
                                        <h1 style="margin: 0 0 12px 0; font-size: 28px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">New Call Received</h1>
                                        <p style="margin: 0; color: rgba(255,255,255,0.95); font-size: 16px; font-weight: 500;">${phoneNumber}</p>
                                        <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.85); font-size: 14px;">${callDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                    </td>
                                </tr>
                                
                                <!-- Call Details -->
                                <tr>
                                    <td style="padding: 40px;">
                                        <div style="background: #f8fafc; border-left: 4px solid #009AEE; border-radius: 8px; padding: 24px; margin-bottom: 32px;">
                                            <h2 style="margin: 0 0 16px 0; font-size: 14px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px;">Call Summary</h2>
                                            <p style="margin: 0; color: #1e293b; font-size: 16px; line-height: 1.7;">${callData.summary || 'Your AI assistant has successfully completed this call. Access the full conversation details and transcript in your dashboard.'}</p>
                                        </div>
                                        
                                        <!-- Call Info Grid -->
                                        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 32px;">
                                            <tr>
                                                <td style="padding: 16px; background: #f8fafc; border-radius: 8px; text-align: center;">
                                                    <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Duration</p>
                                                    <p style="margin: 0; font-size: 16px; font-weight: 600; color: #1e293b;">${formatDuration(callData.duration || 0)}</p>
                                                </td>
                                            </tr>
                                        </table>
                                        
                                        <!-- CTA Button -->
                                        <table width="100%" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td align="center" style="padding-top: 8px;">
                                                    <a href="https://SkyIQ.app" style="display: inline-block; background: #009AEE; color: #ffffff; padding: 16px 48px; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(0, 154, 238, 0.35);">
                                                        View Full Details
                                                    </a>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                
                                <!-- Footer -->
                                <tr>
                                    <td style="background: #f8fafc; padding: 32px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
                                        <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #1e293b;">SkyIQ</p>
                                        <p style="margin: 0; color: #64748b; font-size: 14px;">Smart Call Intelligence Platform</p>
                                        <p style="margin: 16px 0 0 0; color: #94a3b8; font-size: 12px;">© ${new Date().getFullYear()} SkyIQ. All rights reserved.</p>
                                    </td>
                                </tr>
                                
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
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
    summary TEXT, -- Added summary column
    conversation_id VARCHAR(255),
    phone_number VARCHAR(50), -- Added phone_number column
    twilio_call_sid VARCHAR(255) UNIQUE, -- Added twilio_call_sid for Twilio webhooks
    recording_url TEXT, -- Added recording_url for Twilio recordings
    action VARCHAR(50) DEFAULT 'none' CHECK (action IN ('none', 'follow-up', 'call-back', 'discount')), -- Added action column
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() -- Added updated_at column
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

// Update ElevenLabs agent with new prompt using per-user credentials from Supabase
async function updateElevenLabsAgent(systemPrompt: string, firstMessage: string, userId: string) {
    // Only use per-user credentials from Supabase - no fallback to env vars
    let apiKey: string | null = null;
    let agentId: string | null = null;

    try {
        const businessInfo = await storage.getBusinessInfo(userId);
        if (businessInfo) {
            if (businessInfo.elevenlabs_api_key) {
                apiKey = businessInfo.elevenlabs_api_key.trim();
                console.log(`🔑 Using user's ElevenLabs API key from Supabase`);
            }
            if (businessInfo.elevenlabs_agent_id) {
                agentId = businessInfo.elevenlabs_agent_id.trim();
                console.log(`🤖 Using user's ElevenLabs Agent ID from Supabase`);
            }
        }
    } catch (error) {
        console.error(`❌ Could not fetch user's ElevenLabs credentials from Supabase:`, error);
    }

    if (!apiKey || !agentId) {
        const errorMsg = 'Agent not set up';
        console.error(`❌ ${errorMsg}`);
        console.error(`🔧 Missing credentials in Supabase:`, {
            apiKey: !!apiKey,
            agentId: !!agentId,
            userId: userId
        });
        throw new Error(errorMsg);
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
        console.log('📍 URL:', `${ELEVENLABS_AGENTS_URL}/${agentId}`);
        console.log('📝 System Prompt:', systemPrompt.substring(0, 100) + '...');
        console.log('💬 First Message:', firstMessage);

        const response = await fetch(`${ELEVENLABS_AGENTS_URL}/${agentId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'xi-api-key': apiKey
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
async function initiateOutboundCall(phoneNumber: string, userId?: string) {
    console.log(`🔔 initiateOutboundCall called with phone number: ${phoneNumber}, userId: ${userId}`);
    
    // Only use per-user credentials from Supabase - no fallback to env vars
    let apiKey: string | null = null;
    let agentId: string | null = null;
    let phoneNumberId: string | null = null;
    
    if (userId) {
        try {
            const businessInfo = await storage.getBusinessInfo(userId);
            if (businessInfo) {
                // Only use user's credentials from Supabase
                if (businessInfo.elevenlabs_api_key) {
                    apiKey = businessInfo.elevenlabs_api_key.trim();
                    console.log(`🔑 Using user's ElevenLabs API key from Supabase`);
                }
                if (businessInfo.elevenlabs_agent_id) {
                    agentId = businessInfo.elevenlabs_agent_id.trim();
                    console.log(`🤖 Using user's ElevenLabs Agent ID from Supabase: ${agentId}`);
                }
                if (businessInfo.elevenlabs_phone_number_id) {
                    phoneNumberId = businessInfo.elevenlabs_phone_number_id.trim();
                    console.log(`📞 Using user's ElevenLabs Phone Number ID from Supabase`);
                }
            }
        } catch (error) {
            console.error(`❌ Could not fetch user's ElevenLabs credentials from Supabase:`, error);
        }
    }
    
    // If any credential is missing, throw error (no fallback)
    if (!apiKey || !agentId || !phoneNumberId) {
        const errorMsg = 'Agent not set up';
        console.error(`❌ ${errorMsg}`);
        console.error(`🔧 Missing credentials in Supabase:`, {
            apiKey: !!apiKey,
            agentId: !!agentId,
            phoneNumberId: !!phoneNumberId,
            userId: userId
        });
        throw new Error(errorMsg);
    }

    try {
        // Validate and format phone number
        const cleanedPhone = phoneNumber.replace(/[\s\-\(\)\.]/g, '');
        let formattedPhone = cleanedPhone;
        
        if (!formattedPhone.startsWith('+')) {
            if (formattedPhone.length === 10) {
                formattedPhone = '+1' + formattedPhone;
            } else if (formattedPhone.length === 11 && formattedPhone.startsWith('1')) {
                formattedPhone = '+' + formattedPhone;
            } else {
                throw new Error('Invalid phone number format. Please include country code (e.g., +1 for US numbers)');
            }
        }
        
        console.log(`📞 Formatted phone number: ${formattedPhone}`);

        const requestBody = {
            agent_id: agentId,
            agent_phone_number_id: phoneNumberId,
            to_number: formattedPhone,
            conversation_initiation_client_data: {}
        };

        console.log(`🚀 Making ElevenLabs API request:`, {
            url: ELEVENLABS_API_URL,
            agent_id: agentId,
            agent_phone_number_id: phoneNumberId,
            to_number: formattedPhone,
            using_user_credentials: !!userId
        });

        const response = await fetch(ELEVENLABS_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'xi-api-key': apiKey
            },
            body: JSON.stringify(requestBody)
        });

        console.log(`📡 ElevenLabs API response status: ${response.status}`);

        if (!response.ok) {
            const errorData = await response.text();
            console.error(`❌ ElevenLabs API error: ${response.status} - ${errorData}`);
            throw new Error(`ElevenLabs API error: ${response.status} - ${errorData}`);
        }

        const data = await response.json();
        console.log(`✅ ElevenLabs API response:`, data);
        
        return {
            conversation_id: data.conversation_id || data.id,
            call_sid: data.callSid || data.call_sid,
            status: 'initiated',
            message: data.message || 'Call initiated successfully'
        };
    } catch (error) {
        console.error(`❌ Error in initiateOutboundCall:`, error);
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
            await updateElevenLabsAgent(enhancedPrompt, extractedFirstMessage, userId);
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
            if (user_id) {
                await updateElevenLabsAgent(enhancedPrompt, extractedFirstMessage, user_id);
                console.log('✅ ElevenLabs agent updated with business context');
            } else {
                throw new Error('user_id is required to update agent');
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
        console.log('🔔 /api/calls/initiate endpoint called');
        console.log('📝 Request body:', req.body);
        
        const { phone_number, user_id } = req.body;

        if (!phone_number) {
            console.log('❌ Missing phone_number in request');
            return res.status(400).json({ success: false, error: 'phone_number is required' });
        }

        if (!user_id) {
            console.log('❌ Missing user_id in request');
            return res.status(400).json({ success: false, error: 'user_id is required' });
        }

        console.log(`🔍 Validating user_id: ${user_id}`);

        // Validate that the user exists
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('id', user_id)
            .single();
        
        if (userError || !userData) {
            console.log('❌ Invalid user_id:', userError);
            return res.status(401).json({ success: false, error: 'Invalid user_id' });
        }

        console.log(`✅ User validated: ${userData.id}`);
        console.log(`📞 Initiating call to: ${phone_number}`);

        const userId = userData.id;
        const callResult = await initiateOutboundCall(phone_number, userId);
        
        console.log(`✅ Call initiated successfully:`, callResult);
        
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

        console.log('💾 Saving call record to database:', callData);

        const { error } = await supabase
            .from('calls')
            .insert(callData);

        if (error) {
            console.error('❌ Database error saving call:', error);
            throw error;
        }

        console.log('✅ Call record saved successfully');

        // Broadcast to connected clients
        console.log('📡 Broadcasting newCall event');
        io.emit('newCall', callData);

        console.log('✅ Call initiation completed successfully');

        res.json({ 
            success: true, 
            message: 'Call initiated successfully',
            call: callData,
            elevenlabs_response: callResult
        });
    } catch (error: any) {
        console.error('❌ Error initiating call:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Test ElevenLabs configuration (per-user credentials from Supabase)
app.get('/api/test-elevenlabs/:userId', async (req: Request, res: Response) => {
    try {
        const userId = req.params.userId;
        console.log(`🔧 Testing ElevenLabs configuration for user: ${userId}`);
        
        // Fetch user's credentials from Supabase
        let apiKey: string | null = null;
        let agentId: string | null = null;
        let phoneNumberId: string | null = null;
        
        try {
            const businessInfo = await storage.getBusinessInfo(userId);
            if (businessInfo) {
                apiKey = businessInfo.elevenlabs_api_key?.trim() || null;
                agentId = businessInfo.elevenlabs_agent_id?.trim() || null;
                phoneNumberId = businessInfo.elevenlabs_phone_number_id?.trim() || null;
            }
        } catch (error) {
            console.error(`❌ Could not fetch user's ElevenLabs credentials:`, error);
        }
        
        const configStatus = {
            apiKey: !!apiKey,
            agentId: !!agentId,
            phoneNumberId: !!phoneNumberId,
            apiUrl: ELEVENLABS_API_URL,
            source: 'Supabase'
        };
        
        console.log('📊 Configuration status:', configStatus);
        
        if (!apiKey || !agentId || !phoneNumberId) {
            return res.status(400).json({
                success: false,
                error: 'Agent not set up',
                config: configStatus
            });
        }
        
        // Test API connectivity
        try {
            const response = await fetch('https://api.elevenlabs.io/v1/models', {
                headers: {
                    'xi-api-key': apiKey
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                res.json({
                    success: true,
                    message: 'ElevenLabs API is accessible',
                    config: configStatus,
                    availableModels: data.length || 0
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: 'ElevenLabs API not accessible',
                    status: response.status,
                    config: configStatus
                });
            }
        } catch (apiError: any) {
            res.status(500).json({
                success: false,
                error: 'Failed to connect to ElevenLabs API',
                details: apiError.message,
                config: configStatus
            });
        }
    } catch (error: any) {
        console.error('❌ Error testing ElevenLabs:', error);
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

// Webhook endpoint dispatcher - handles both Twilio and ElevenLabs events
app.post('/webhook', async (req: Request, res: Response) => {
  try {
    const body = req.body;
    console.log('🔔 Webhook received:', JSON.stringify(body, null, 2));

    if (body.CallSid) {
      // Twilio webhook
      console.log('📞 Detected Twilio webhook');
      await handleTwilioWebhook(body);
      return res.status(200).send('Twilio webhook processed');
    } else if (body.type || body.data) {
      // ElevenLabs webhook
      console.log('🤖 Detected ElevenLabs webhook');
      await handleElevenLabsWebhook(body);
      return res.status(200).send('ElevenLabs webhook processed');
    } else {
      console.warn('⚠️ Unknown webhook format');
      return res.status(400).json({ error: 'Unknown webhook format' });
    }
  } catch (error: any) {
    console.error('❌ Error processing webhook:', error);
    res.status(500).json({ error: 'Error processing webhook' });
  }
});

// --- Handlers ---

// Twilio handler
async function handleTwilioWebhook(data: any) {
  try {
    const callSid = data.CallSid;
    const from = data.From || '';
    const to = data.To || '';
    const status = data.CallStatus || 'in-progress';
    const duration = parseInt(data.CallDuration || data.Duration || '0', 10);
    const recordingUrl = data.RecordingUrl || null;

    console.log(`📞 Twilio webhook: ${from} → ${to}, status: ${status}, duration: ${duration}s`);

    // Determine call type based on direction (normalize Twilio direction values)
    const callType = normalizeDirection(data.Direction);
    console.log(`🔄 Twilio direction: "${data.Direction}" → normalized to: "${callType}"`);
    
    // Look up user based on phone number
    let userId: string | null = null;
    const phoneCandidates = candidateNumbers(callType === 'inbound' ? to : from);
    
    if (phoneCandidates.length > 0) {
      const { data: userData } = await supabase
        .from('users')
        .select('id, phone_number')
        .in('phone_number', phoneCandidates)
        .limit(1)
        .maybeSingle();
      userId = userData?.id || null;
    }

    // Fallback: if no specific user, use the default user (first user found)
    if (!userId) {
      const { data: firstUser } = await supabase
        .from('users')
        .select('id')
        .limit(1)
        .single();
      userId = firstUser?.id || null;
    }

    const callData = {
      twilio_call_sid: callSid,
      user_id: userId,
      caller_number: from,
      called_number: to,
      phone_number: from,
      status,
      duration,
      call_type: callType,
      recording_url: recordingUrl,
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: upsertedCall, error } = await supabase
      .from('calls')
      .upsert(callData, { onConflict: 'twilio_call_sid' })
      .select();

    if (error) {
      throw error;
    }

    console.log('✅ Twilio call upserted successfully');

    // Broadcast to connected clients
    io.emit('newCall', callData);

    // Note: Email notification will be sent after call completion in handlePostCallTranscription

  } catch (error: any) {
    console.error('❌ Error handling Twilio webhook:', error);
  }
}

// ElevenLabs dispatcher
async function handleElevenLabsWebhook(data: any) {
  try {
    let eventType = data.type || data.event || 'unknown';

    switch (eventType) {
      case 'call_started':
      case 'conversation_initiation':
        await handleCallStarted(data);
        break;
      case 'post_call_transcription':
        await handlePostCallTranscription(data);
        break;
      case 'call_ended':
        await handleCallEnded(data);
        break;
      case 'transcript':
        await handleTranscript(data);
        break;
      default:
        console.warn(`⚠️ Unhandled ElevenLabs event: ${eventType}`);
    }
  } catch (error: any) {
    console.error('❌ Error handling ElevenLabs webhook:', error);
  }
}

// Handle call started events
async function handleCallStarted(webhookData: any) {
    try {
        let callId = webhookData.data.conversation_initiation_client_data?.dynamic_variables?.system__call_sid || webhookData.data.phone_call?.call_sid || webhookData.data.conversation_id || webhookData.data.call_id;
        let fromNumber = webhookData.data.conversation_initiation_client_data?.dynamic_variables?.system__caller_id || webhookData.data.phone_call?.external_number || webhookData.data.from_number || webhookData.data.caller_id;
        let toNumber = webhookData.data.conversation_initiation_client_data?.dynamic_variables?.system__called_number || webhookData.data.phone_call?.agent_number || webhookData.data.to_number || webhookData.data.called_number;
        let conversationId = webhookData.data.conversation_initiation_client_data?.dynamic_variables?.system__call_sid || webhookData.data.phone_call?.call_sid || webhookData.data.conversation_id || webhookData.data.call_id;
        let callType = webhookData.data.phone_call?.direction || 'inbound'; // Determine call type

        console.log(`📞 Extracted fromNumber: ${fromNumber}, toNumber: ${toNumber}, Conversation ID: ${conversationId}, Call Type: ${callType}`);
        console.log(`🔍 Conversation ID sources: system__call_sid=${webhookData.data.conversation_initiation_client_data?.dynamic_variables?.system__call_sid}, phone_call.call_sid=${webhookData.data.phone_call?.call_sid}, conversation_id=${webhookData.data.conversation_id}`);
        
        // No need for the conditional block here anymore as dynamic_variables are prioritized above
        // if (webhookData.conversation_initiation_metadata_type === 'conversation_initiation_client_data' && webhookData.data.conversation_initiation_client_data?.dynamic_variables) {
        //     fromNumber = webhookData.data.conversation_initiation_client_data.dynamic_variables.system__caller_id || fromNumber;
        //     toNumber = webhookData.data.conversation_initiation_client_data.dynamic_variables.system__called_number || toNumber;
        //     conversationId = webhookData.data.conversation_initiation_client_data.dynamic_variables.system__conversation_id || conversationId;
        //     callId = webhookData.data.conversation_initiation_client_data.dynamic_variables.system__call_sid || callId;
        // }
        
        console.log(`📞 Debug: fromNumber = ${fromNumber}, toNumber = ${toNumber}, conversationId = ${conversationId}`);
        console.log(`📞 Processing call start: ${fromNumber} → ${toNumber}, Conversation ID: ${conversationId}`);
        
        // Check if call already exists
        console.log(`🔍 Checking for existing call with conversation_id: ${conversationId}`);
        const { data: existingCall, error: checkError } = await supabase
            .from('calls')
            .select('id')
            .eq('conversation_id', conversationId)
            .limit(1);

        if (checkError) throw checkError;
        
        if (!existingCall || existingCall.length === 0) {
            // Look up user for this call
            let promptId: number | null = null;

            // Use shared utility for number normalization and user resolution
            const { callerNumber, calledNumber, canonicalPhone } = normalizeAndResolveNumbers(webhookData);
            const userId = await resolveUserIdForCall(callType, callerNumber, calledNumber);
            
            console.log(`📞 Normalized numbers: caller=${callerNumber}, called=${calledNumber}, canonical=${canonicalPhone}`);
            console.log(`👤 Resolved user: ${userId}`);

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
                created_at: new Date().toISOString(), // Add created_at for frontend compatibility
                caller_number: callerNumber,   // ✅ normalized
                called_number: calledNumber,   // ✅ normalized
                phone_number: canonicalPhone,  // ✅ never null
                duration: 0,
                status: 'in-progress',
                call_type: callType,
                transcript: '',
                conversation_id: conversationId || callId
            };

            const { data: insertedCall, error: insertError } = await supabase
                .from('calls')
                .insert(callData)
                .select();

            if (insertError) throw insertError;

            const newCallId = insertedCall[0]?.id;
            console.log(`✅ Created new call record: ${newCallId}`);

            // Note: Email notification will be sent after call completion in handlePostCallTranscription

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
        // Normalize conversation ID so all events map to the same call
        const conversationId =
            webhookData.data.conversation_initiation_client_data?.dynamic_variables?.system__call_sid ||
            webhookData.data.phone_call?.call_sid ||
            webhookData.data.call_id ||
            webhookData.data.conversation_id; // fallback if nothing else
        
        console.log(`🔍 Conversation ID sources: system__call_sid=${webhookData.data.conversation_initiation_client_data?.dynamic_variables?.system__call_sid}, phone_call.call_sid=${webhookData.data.phone_call?.call_sid}, call_id=${webhookData.data.call_id}, conversation_id=${webhookData.data.conversation_id}`);
        console.log(`🎯 Using conversation ID: ${conversationId}`);
        const transcript = webhookData.data.transcript ? JSON.stringify(webhookData.data.transcript) : '';
        const summary = webhookData.data.analysis?.transcript_summary || webhookData.data.summary || '';
        const duration = webhookData.data.metadata?.call_duration_secs || webhookData.data.duration_seconds || webhookData.data.duration || 0;
        
        // console.log(`📋 Extracted Transcript: ${transcript.substring(0, 200)}...`); // Log first 200 chars
        console.log(`📋 Processing post-call transcription for: ${conversationId}`);
        console.log(`📝 Transcript length: ${transcript.length} characters`);
        console.log(`📄 Summary: ${summary.substring(0, 100)}...`);
        console.log(`⏱️ Duration: ${duration} seconds`);
        
        // Update the existing call record with complete conversation data
        let updatedCall: any[] | null = null;
        let updateError: any = null;
        
        // Try updating with system__call_sid first
        const { data: initialUpdate, error: initialError } = await supabase
            .from('calls')
            .update({
                transcript: transcript, // Added transcript
                summary: summary,     // Added summary
                duration: duration,   // Ensure duration is updated
                status: 'completed',
                updated_at: new Date().toISOString(),
                // Ensure created_at is set if it doesn't exist
                created_at: new Date().toISOString()
            })
            .eq('conversation_id', conversationId)
            .select();

        if (initialError) {
            console.error('❌ Error updating call record:', initialError);
            updateError = initialError;
        } else if (initialUpdate && initialUpdate.length > 0) {
            updatedCall = initialUpdate;
            console.log(`✅ Successfully updated call ${updatedCall[0].id} with status: completed`);
        } else if (webhookData.data.conversation_id) {
            // Fallback: try with ElevenLabs conversation_id if system__call_sid didn't match
            console.warn(`⚠️ No match on ${conversationId}, retrying with ElevenLabs conv_id: ${webhookData.data.conversation_id}`);
            const { data: altUpdate, error: altError } = await supabase
                .from('calls')
                .update({
                    transcript: transcript,
                    summary: summary,
                    duration: duration,
                    status: 'completed',
                    updated_at: new Date().toISOString(),
                    created_at: new Date().toISOString()
                })
                .eq('conversation_id', webhookData.data.conversation_id)
                .select();

            if (altError) {
                console.error('❌ Alternative conversation_id update failed:', altError);
                updateError = altError;
            } else if (altUpdate && altUpdate.length > 0) {
                updatedCall = altUpdate;
                console.log(`✅ Updated call via ElevenLabs conversation_id: ${altUpdate[0].id}`);
            } else {
                // If no call was found with conversation_id, try alternative lookup
                console.warn(`⚠️ No call found with conversation_id: ${conversationId}, trying alternative lookup...`);
                
                const { data: alternativeCall, error: altError } = await supabase
                    .from('calls')
                    .update({
                        transcript: transcript,
                        summary: summary,
                        duration: duration,
                        status: 'completed',
                        updated_at: new Date().toISOString(),
                        created_at: new Date().toISOString()
                    })
                    .eq('status', 'in-progress')
                    .eq('conversation_id', conversationId)
                    .select();
                    
                if (altError) {
                    console.error('❌ Alternative call update failed:', altError);
                } else if (alternativeCall && alternativeCall.length > 0) {
                    updatedCall = alternativeCall;
                    console.log(`✅ Updated call via alternative lookup: ${alternativeCall[0].id}`);
                } else {
                    // Try one more fallback - update any call with this conversation_id regardless of current status
                    const { data: fallbackCall, error: fallbackError } = await supabase
                        .from('calls')
                        .update({
                            transcript: transcript,
                            summary: summary,
                            duration: duration,
                            status: 'completed',
                            updated_at: new Date().toISOString(),
                            created_at: new Date().toISOString()
                        })
                        .eq('conversation_id', conversationId)
                        .select();
                        
                    if (fallbackError) {
                        console.error('❌ Fallback call update failed:', fallbackError);
                        return;
                    } else if (fallbackCall && fallbackCall.length > 0) {
                        updatedCall = fallbackCall;
                        console.log(`✅ Updated call via fallback: ${fallbackCall[0].id}`);
                    } else {
                        // Create fallback call record if none exists
                        console.warn(`⚠️ No existing call for ${conversationId}, creating fallback record...`);
                    
                    // Use shared utility for number normalization and user resolution
                    const { callerNumber, calledNumber, canonicalPhone } = normalizeAndResolveNumbers(webhookData);
                    const userId = await resolveUserIdForCall('inbound', callerNumber, calledNumber); // Post-call transcription only arrives after inbound
                    
                    console.log(`📞 Fallback numbers: caller=${callerNumber}, called=${calledNumber}, canonical=${canonicalPhone}`);
                    console.log(`👤 Fallback user resolution: userId=${userId}`);
                    
                    // Fallback call record
                    const callData = {
                        user_id: userId,
                        conversation_id: conversationId,
                        transcript,
                        summary,
                        duration,
                        status: 'completed',
                        caller_number: callerNumber,   // ✅ normalized
                        called_number: calledNumber,   // ✅ normalized
                        phone_number: canonicalPhone,  // ✅ never null
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    };

                    const { data: fallbackInserted, error: fallbackInsertError } = await supabase
                        .from('calls')
                        .insert(callData)
                        .select();

                    if (fallbackInsertError) {
                        console.error('❌ Failed to insert fallback call:', fallbackInsertError);
                        return;
                    }

                        console.log(`✅ Fallback call record created for conversation ${conversationId}`);
                        updatedCall = fallbackInserted;
                    }
                }
            }
        }

        if (updateError) {
            throw updateError;
        }

        if (!updatedCall || updatedCall.length === 0) {
            console.error(`❌ No call record found or updated for conversation_id: ${conversationId}`);
            return;
        }

        console.log(`✅ Updated call record ID: ${updatedCall[0]?.id} with complete conversation data`);
        
        // Also store in ElevenLabs conversations table if needed
        try {
            const { error: elevenLabsError } = await supabase
                .from('eleven_labs_conversations')
                .upsert({
                    user_id: updatedCall[0]?.user_id,
                    conversation_id: conversationId,
                    agent_id: webhookData.agent_id || 'unknown',
                    status: 'completed',
                    duration: duration,
                    transcript: transcript,
                    summary: summary,
                    phone_number: updatedCall[0]?.phone_number,
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

        // Emit to connected clients with more detailed information
        const callUpdateData = {
            conversation_id: conversationId, 
            transcript, 
            summary, 
            duration,
            status: 'completed',
            call_id: updatedCall?.[0]?.id,
            user_id: updatedCall?.[0]?.user_id
        };
        
        console.log('📡 Emitting callCompleted event:', callUpdateData);
        io.emit('callCompleted', callUpdateData);
        
        // Send email notification after call is complete with all data
        if (updatedCall && updatedCall.length > 0) {
            const completedCallData = {
                ...updatedCall[0],
                summary: summary,
                transcript: transcript,
                caller_number: updatedCall[0].caller_number,
                called_number: updatedCall[0].called_number,
                call_type: updatedCall[0].direction || updatedCall[0].call_type || 'inbound',
                timestamp: updatedCall[0].timestamp || updatedCall[0].created_at
            };
            
            await sendCallNotification(completedCallData);
        }
        
        console.log('✅ Post-call transcription processed successfully');

    } catch (error: any) {
        console.error('❌ Error handling post-call transcription:', error);
    }
}

// Handle call ended events
async function handleCallEnded(webhookData: any) {
    try {
        const conversationId = webhookData.data.conversation_id || webhookData.data.call_sid || webhookData.data.call_id;
        const duration = webhookData.data.metadata?.call_duration_secs || webhookData.data.duration_seconds || webhookData.data.duration || 0;
        
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
        const conversationId = webhookData.data.conversation_id || webhookData.data.call_sid || webhookData.data.call_id;
        const transcript = webhookData.data.transcript || webhookData.data.text || '';
        
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
            credentialsSource: 'per-user (Supabase)',
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
    console.log('✅ Client connected to Socket.IO');
    
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
        console.log('❌ Client disconnected from Socket.IO');
    });
});

// Initialize on startup
(async () => {
  await initializeDatabase();
  
  // Register all API routes from routes.ts
  registerRoutes(app, server, io);
  
  // Setup Vite in development
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Use environment PORT variable for deployment compatibility (Render, etc)
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen(port, "0.0.0.0", () => {
    log(`✅ SkyIQ Dashboard Server running on port ${port}`);
    log(`📡 Webhook endpoint: http://localhost:${port}/webhook`);
    log(`📊 Dashboard: http://localhost:${port}`);
    log(`🏥 Health check: http://localhost:${port}/health`);
    log(`🗃️ Database: ${process.env.SUPABASE_URL ? 'Supabase Connected' : 'Not configured'}`);
    log(`📧 Email notifications: ${emailConfig.enabled ? 'Enabled (inbound only)' : 'Disabled'}`);
    log(`🔑 Credentials: Per-user from Supabase (no global env fallback)`);
  });
})();
