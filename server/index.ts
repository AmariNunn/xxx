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

// ElevenLabs API configuration
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_AGENT_ID = process.env.ELEVENLABS_AGENT_ID;
const ELEVENLABS_PHONE_NUMBER_ID = process.env.ELEVENLABS_PHONE_NUMBER_ID;
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
    summary TEXT, -- Added summary column
    conversation_id VARCHAR(255),
    phone_number VARCHAR(50), -- Added phone_number column
    twilio_call_sid VARCHAR(255) UNIQUE, -- Added twilio_call_sid for Twilio webhooks
    recording_url TEXT, -- Added recording_url for Twilio recordings
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
    console.log(`🔔 initiateOutboundCall called with phone number: ${phoneNumber}`);
    
    if (!ELEVENLABS_API_KEY || !ELEVENLABS_AGENT_ID || !ELEVENLABS_PHONE_NUMBER_ID) {
        const errorMsg = 'ElevenLabs configuration incomplete. Please set ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID, and ELEVENLABS_PHONE_NUMBER_ID environment variables.';
        console.error(`❌ ${errorMsg}`);
        console.error(`🔧 Configuration status:`, {
            apiKey: !!ELEVENLABS_API_KEY,
            agentId: !!ELEVENLABS_AGENT_ID,
            phoneNumberId: !!ELEVENLABS_PHONE_NUMBER_ID
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
            agent_id: ELEVENLABS_AGENT_ID,
            agent_phone_number_id: ELEVENLABS_PHONE_NUMBER_ID,
            to_number: formattedPhone,
            conversation_initiation_client_data: {}
        };

        console.log(`🚀 Making ElevenLabs API request:`, {
            url: ELEVENLABS_API_URL,
            agent_id: ELEVENLABS_AGENT_ID,
            agent_phone_number_id: ELEVENLABS_PHONE_NUMBER_ID,
            to_number: formattedPhone
        });

        const response = await fetch(ELEVENLABS_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'xi-api-key': ELEVENLABS_API_KEY
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

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
            throw error;
        }

        res.json({ success: true, prompt: data || null });
    } catch (error: any) {
        console.error('Error fetching prompt:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update prompt for a specific user
app.post('/api/prompt/:userId', async (req: Request, res: Response) => {
    try {
        const userId = req.params.userId;
        const { system_prompt, first_message, prompt } = req.body;

        // Validate required fields
        if (!system_prompt) {
            return res.status(400).json({ success: false, error: 'System prompt is required' });
        }

        // Extract first message if not provided
        const finalFirstMessage = first_message || extractFirstMessageFromPrompt(system_prompt);

        // Update ElevenLabs agent
        await updateElevenLabsAgent(system_prompt, finalFirstMessage);

        // Save to database
        const { data, error } = await supabase
            .from('prompts')
            .insert({
                user_id: userId,
                system_prompt,
                first_message: finalFirstMessage,
                prompt: prompt || system_prompt
            })
            .select();

        if (error) throw error;

        res.json({ success: true, prompt: data[0] });
    } catch (error: any) {
        console.error('Error updating prompt:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update prompt (legacy endpoint for backward compatibility)
app.post('/api/prompt', async (req: Request, res: Response) => {
    try {
        const { system_prompt, first_message, prompt } = req.body;

        // Validate required fields
        if (!system_prompt) {
            return res.status(400).json({ success: false, error: 'System prompt is required' });
        }

        // Extract first message if not provided
        const finalFirstMessage = first_message || extractFirstMessageFromPrompt(system_prompt);

        // Update ElevenLabs agent
        await updateElevenLabsAgent(system_prompt, finalFirstMessage);

        // Save to database
        const { data, error } = await supabase
            .from('prompts')
            .insert({
                system_prompt,
                first_message: finalFirstMessage,
                prompt: prompt || system_prompt
            })
            .select();

        if (error) throw error;

        res.json({ success: true, prompt: data[0] });
    } catch (error: any) {
        console.error('Error updating prompt:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Batch API endpoints

// Create a new batch
app.post('/api/batches', async (req: Request, res: Response) => {
    try {
        const { name, calls } = req.body;

        if (!name || !calls || !Array.isArray(calls)) {
            return res.status(400).json({ error: 'Batch name and calls array are required' });
        }

        const batchId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Create batch
        const { data: batchData, error: batchError } = await supabase
            .from('batches')
            .insert({
                id: batchId,
                name,
                status: 'pending',
                total_calls: calls.length,
                completed_calls: 0,
                successful_calls: 0,
                failed_calls: 0
            })
            .select();

        if (batchError) throw batchError;

        // Create batch calls
        const batchCallsData = calls.map((call: any) => ({
            id: `batch-call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            batch_id: batchId,
            phone_number: call.phone_number,
            first_name: call.first_name || '',
            last_name: call.last_name || '',
            company: call.company || '',
            status: 'pending'
        }));

        const { error: callsError } = await supabase
            .from('batch_calls')
            .insert(batchCallsData);

        if (callsError) throw callsError;

        res.json({ success: true, batch: batchData[0] });
    } catch (error: any) {
        console.error('Error creating batch:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get all batches
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
        res.status(500).json({ error: error.message });
    }
});

// =============================================================================
// NEW BATCH EDITING API ENDPOINTS
// =============================================================================

// 1. Get Batch Details with Calls
app.get('/api/batches/:batchId', async (req: Request, res: Response) => {
    try {
        const { batchId } = req.params;

        // Get batch info
        const { data: batchData, error: batchError } = await supabase
            .from('batches')
            .select('*')
            .eq('id', batchId)
            .single();

        if (batchError) {
            console.error('Error fetching batch:', batchError);
            return res.status(404).json({ error: 'Batch not found' });
        }

        // Get all calls for this batch
        const { data: callsData, error: callsError } = await supabase
            .from('batch_calls')
            .select('*')
            .eq('batch_id', batchId)
            .order('created_at', { ascending: true });

        if (callsError) {
            console.error('Error fetching batch calls:', callsError);
            return res.status(500).json({ error: 'Failed to fetch batch calls' });
        }

        res.json({
            success: true,
            batch: batchData,
            calls: callsData || []
        });
    } catch (error: any) {
        console.error('Error in GET /api/batches/:batchId:', error);
        res.status(500).json({ error: error.message });
    }
});

// 2. Update Individual Batch Call
app.put('/api/batches/:batchId/calls/:callId', async (req: Request, res: Response) => {
    try {
        const { batchId, callId } = req.params;
        const { first_name, last_name, company, phone_number } = req.body;

        // Validate required fields
        if (!phone_number) {
            return res.status(400).json({ error: 'Phone number is required' });
        }

        // Update the batch call
        const { data, error } = await supabase
            .from('batch_calls')
            .update({
                first_name: first_name || '',
                last_name: last_name || '',
                company: company || '',
                phone_number
            })
            .eq('id', callId)
            .eq('batch_id', batchId)
            .select();

        if (error) {
            console.error('Error updating batch call:', error);
            return res.status(500).json({ error: 'Failed to update batch call' });
        }

        if (!data || data.length === 0) {
            return res.status(404).json({ error: 'Batch call not found' });
        }

        res.json({
            success: true,
            call: data[0]
        });
    } catch (error: any) {
        console.error('Error in PUT /api/batches/:batchId/calls/:callId:', error);
        res.status(500).json({ error: error.message });
    }
});

// 3. Delete Batch Call
app.delete('/api/batches/:batchId/calls/:callId', async (req: Request, res: Response) {
    try {
        const { batchId, callId } = req.params;

        // Get the call to check if it exists and get its status for updating totals
        const { data: callData, error: callError } = await supabase
            .from('batch_calls')
            .select('status')
            .eq('id', callId)
            .eq('batch_id', batchId)
            .single();

        if (callError || !callData) {
            return res.status(404).json({ error: 'Batch call not found' });
        }

        // Delete the batch call
        const { error: deleteError } = await supabase
            .from('batch_calls')
            .delete()
            .eq('id', callId)
            .eq('batch_id', batchId);

        if (deleteError) {
            console.error('Error deleting batch call:', deleteError);
            return res.status(500).json({ error: 'Failed to delete batch call' });
        }

        // Update batch totals based on the deleted call's status
        const updateData: any = {};
        
        // Decrement total calls
        const { data: batchData } = await supabase
            .from('batches')
            .select('total_calls, completed_calls, successful_calls, failed_calls')
            .eq('id', batchId)
            .single();

        if (batchData) {
            updateData.total_calls = Math.max(0, (batchData.total_calls || 0) - 1);
            
            // Decrement status-specific counters
            if (callData.status === 'completed' || callData.status === 'successful') {
                updateData.successful_calls = Math.max(0, (batchData.successful_calls || 0) - 1);
                updateData.completed_calls = Math.max(0, (batchData.completed_calls || 0) - 1);
            } else if (callData.status === 'failed') {
                updateData.failed_calls = Math.max(0, (batchData.failed_calls || 0) - 1);
                updateData.completed_calls = Math.max(0, (batchData.completed_calls || 0) - 1);
            }
        }

        await supabase
            .from('batches')
            .update(updateData)
            .eq('id', batchId);

        res.json({
            success: true,
            message: 'Batch call deleted successfully'
        });
    } catch (error: any) {
        console.error('Error in DELETE /api/batches/:batchId/calls/:callId:', error);
        res.status(500).json({ error: error.message });
    }
});

// 4. Add New Call to Batch
app.post('/api/batches/:batchId/calls', async (req: Request, res: Response) => {
    try {
        const { batchId } = req.params;
        const { phone_number, first_name, last_name, company } = req.body;

        // Validate required fields
        if (!phone_number) {
            return res.status(400).json({ error: 'Phone number is required' });
        }

        // Verify batch exists
        const { data: batchData, error: batchError } = await supabase
            .from('batches')
            .select('id, status')
            .eq('id', batchId)
            .single();

        if (batchError || !batchData) {
            return res.status(404).json({ error: 'Batch not found' });
        }

        // Can't add calls to completed or processing batches
        if (batchData.status === 'completed' || batchData.status === 'processing') {
            return res.status(400).json({ error: 'Cannot add calls to a completed or processing batch' });
        }

        // Create new batch call
        const newCall = {
            id: `batch-call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            batch_id: batchId,
            phone_number,
            first_name: first_name || '',
            last_name: last_name || '',
            company: company || '',
            status: 'pending'
        };

        const { data, error } = await supabase
            .from('batch_calls')
            .insert(newCall)
            .select();

        if (error) {
            console.error('Error adding batch call:', error);
            return res.status(500).json({ error: 'Failed to add batch call' });
        }

        // Update batch total calls count
        const { data: currentBatch } = await supabase
            .from('batches')
            .select('total_calls')
            .eq('id', batchId)
            .single();

        await supabase
            .from('batches')
            .update({
                total_calls: (currentBatch?.total_calls || 0) + 1
            })
            .eq('id', batchId);

        res.json({
            success: true,
            call: data[0]
        });
    } catch (error: any) {
        console.error('Error in POST /api/batches/:batchId/calls:', error);
        res.status(500).json({ error: error.message });
    }
});

// 5. Update Batch Metadata
app.put('/api/batches/:batchId', async (req: Request, res: Response) => {
    try {
        const { batchId } = req.params;
        const { name, status } = req.body;

        // Validate at least one field to update
        if (!name && !status) {
            return res.status(400).json({ error: 'Either name or status must be provided' });
        }

        // Build update object
        const updateData: any = {};
        if (name) updateData.name = name;
        if (status) updateData.status = status;

        // Update batch
        const { data, error } = await supabase
            .from('batches')
            .update(updateData)
            .eq('id', batchId)
            .select();

        if (error) {
            console.error('Error updating batch:', error);
            return res.status(500).json({ error: 'Failed to update batch' });
        }

        if (!data || data.length === 0) {
            return res.status(404).json({ error: 'Batch not found' });
        }

        res.json({
            success: true,
            batch: data[0]
        });
    } catch (error: any) {
        console.error('Error in PUT /api/batches/:batchId:', error);
        res.status(500).json({ error: error.message });
    }
});

// 6. Delete Entire Batch
app.delete('/api/batches/:batchId', async (req: Request, res: Response) => {
    try {
        const { batchId } = req.params;

        // Verify batch exists
        const { data: batchData, error: batchError } = await supabase
            .from('batches')
            .select('id')
            .eq('id', batchId)
            .single();

        if (batchError || !batchData) {
            return res.status(404).json({ error: 'Batch not found' });
        }

        // Delete all batch calls first (foreign key constraint)
        const { error: callsError } = await supabase
            .from('batch_calls')
            .delete()
            .eq('batch_id', batchId);

        if (callsError) {
            console.error('Error deleting batch calls:', callsError);
            return res.status(500).json({ error: 'Failed to delete batch calls' });
        }

        // Delete the batch
        const { error: deleteError } = await supabase
            .from('batches')
            .delete()
            .eq('id', batchId);

        if (deleteError) {
            console.error('Error deleting batch:', deleteError);
            return res.status(500).json({ error: 'Failed to delete batch' });
        }

        res.json({
            success: true,
            message: 'Batch and all associated calls deleted successfully'
        });
    } catch (error: any) {
        console.error('Error in DELETE /api/batches/:batchId:', error);
        res.status(500).json({ error: error.message });
    }
});

// Start batch processing
app.post('/api/batches/:batchId/start', async (req: Request, res: Response) => {
    try {
        const { batchId } = req.params;

        // Check if batch exists and is pending
        const { data: batchData, error: batchError } = await supabase
            .from('batches')
            .select('*')
            .eq('id', batchId)
            .single();

        if (batchError) {
            return res.status(404).json({ error: 'Batch not found' });
        }

        if (batchData.status !== 'pending') {
            return res.status(400).json({ error: 'Batch can only be started if it is pending' });
        }

        // Check if there are pending calls
        const { data: pendingCalls, error: callsError } = await supabase
            .from('batch_calls')
            .select('id')
            .eq('batch_id', batchId)
            .eq('status', 'pending');

        if (callsError) throw callsError;

        if (!pendingCalls || pendingCalls.length === 0) {
            return res.status(400).json({ error: 'No pending calls in this batch' });
        }

        // Add to queue or start immediately
        if (currentBatch) {
            if (batchQueue.length >= 10) { // INCREASED FROM 5 TO 10
                return res.status(400).json({ error: 'Batch queue is full. Please try again later.' });
            }
            batchQueue.push(batchId);
        } else {
            currentBatch = batchId;
            processBatch(batchId);
        }

        res.json({ success: true, message: 'Batch started successfully' });
    } catch (error: any) {
        console.error('Error starting batch:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get batch calls
app.get('/api/batches/:batchId/calls', async (req: Request, res: Response) => {
    try {
        const { batchId } = req.params;

        const { data, error } = await supabase
            .from('batch_calls')
            .select('*')
            .eq('batch_id', batchId)
            .order('created_at', { ascending: true });

        if (error) throw error;

        res.json({ success: true, calls: data });
    } catch (error: any) {
        console.error('Error fetching batch calls:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get batch processing status
app.get('/api/batches/:batchId/status', async (req: Request, res: Response) => {
    try {
        const { batchId } = req.params;

        const { data: batchData, error: batchError } = await supabase
            .from('batches')
            .select('*')
            .eq('id', batchId)
            .single();

        if (batchError) throw batchError;

        const { data: callsData, error: callsError } = await supabase
            .from('batch_calls')
            .select('status')
            .eq('batch_id', batchId);

        if (callsError) throw callsError;

        const statusCounts = {
            pending: 0,
            processing: 0,
            completed: 0,
            failed: 0
        };

        callsData?.forEach(call => {
            statusCounts[call.status as keyof typeof statusCounts]++;
        });

        res.json({
            success: true,
            batch: batchData,
            statusCounts,
            queuePosition: batchQueue.indexOf(batchId) + 1,
            isProcessing: currentBatch === batchId
        });
    } catch (error: any) {
        console.error('Error fetching batch status:', error);
        res.status(500).json({ error: error.message });
    }
});

// File upload endpoint
app.post('/api/upload', upload.single('file'), async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const userId = req.body.userId;
        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        const file = req.file;
        console.log(`📁 Processing file upload: ${file.originalname} (${file.size} bytes) for user ${userId}`);

        // Upload file to Supabase Storage
        const fileExt = path.extname(file.originalname);
        const fileName = `${userId}/${Date.now()}${fileExt}`;
        
        const { data, error } = await supabase.storage
            .from('business-documents')
            .upload(fileName, file.buffer, {
                contentType: file.mimetype,
                upsert: false
            });

        if (error) {
            console.error('Error uploading file to Supabase:', error);
            return res.status(500).json({ error: 'Failed to upload file' });
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('business-documents')
            .getPublicUrl(fileName);

        // Update user's business info with file metadata
        const { data: existingBusinessInfo, error: selectError } = await supabase
            .from('business_info')
            .select('*')
            .eq('user_id', userId)
            .single();

        const fileMetadata = {
            name: file.originalname,
            type: file.mimetype,
            size: file.size,
            url: publicUrl,
            uploaded_at: new Date().toISOString()
        };

        if (selectError || !existingBusinessInfo) {
            // Create new business info record
            const { error: insertError } = await supabase
                .from('business_info')
                .insert({
                    user_id: userId,
                    file_names: [file.originalname],
                    file_types: [file.mimetype],
                    file_urls: [publicUrl],
                    file_sizes: [file.size],
                    document_extracted_at: new Date().toISOString()
                });

            if (insertError) throw insertError;
        } else {
            // Update existing business info record
            const { error: updateError } = await supabase
                .from('business_info')
                .update({
                    file_names: [...(existingBusinessInfo.file_names || []), file.originalname],
                    file_types: [...(existingBusinessInfo.file_types || []), file.mimetype],
                    file_urls: [...(existingBusinessInfo.file_urls || []), publicUrl],
                    file_sizes: [...(existingBusinessInfo.file_sizes || []), file.size],
                    document_extracted_at: new Date().toISOString()
                })
                .eq('user_id', userId);

            if (updateError) throw updateError;
        }

        console.log(`✅ File uploaded successfully: ${publicUrl}`);

        res.json({
            success: true,
            message: 'File uploaded successfully',
            file: fileMetadata
        });
    } catch (error: any) {
        console.error('Error uploading file:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get business context for a user
app.get('/api/business-context/:userId', async (req: Request, res: Response) => {
    try {
        const userId = req.params.userId;
        const businessContext = await fetchBusinessContext(userId);
        
        if (!businessContext) {
            return res.status(404).json({ error: 'Business context not found' });
        }

        res.json({
            success: true,
            businessContext
        });
    } catch (error: any) {
        console.error('Error fetching business context:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update business context for a user
app.post('/api/business-context/:userId', async (req: Request, res: Response) => {
    try {
        const userId = req.params.userId;
        const businessContext = req.body;

        // Validate required fields
        if (!businessContext.description) {
            return res.status(400).json({ error: 'Business description is required' });
        }

        // Check if business info already exists for this user
        const { data: existingBusinessInfo, error: selectError } = await supabase
            .from('business_info')
            .select('*')
            .eq('user_id', userId)
            .single();

        const businessInfoData = {
            user_id: userId,
            description: businessContext.description,
            links: businessContext.links || [],
            scraped_content: businessContext.scrapedContent || [],
            scraped_titles: businessContext.scrapedTitles || [],
            scraped_urls: businessContext.scrapedUrls || [],
            scraped_at: businessContext.scrapedAt,
            file_names: businessContext.fileNames || [],
            file_types: businessContext.fileTypes || [],
            file_urls: businessContext.fileUrls || [],
            file_sizes: businessContext.fileSizes || [],
            document_content: businessContext.documentContent || [],
            document_titles: businessContext.documentTitles || [],
            document_extracted_at: businessContext.documentExtractedAt,
            business_name: businessContext.businessName,
            business_phone: businessContext.businessPhone,
            business_address: businessContext.businessAddress
        };

        if (selectError || !existingBusinessInfo) {
            // Create new business info record
            const { data, error } = await supabase
                .from('business_info')
                .insert(businessInfoData)
                .select();

            if (error) throw error;
        } else {
            // Update existing business info record
            const { data, error } = await supabase
                .from('business_info')
                .update(businessInfoData)
                .eq('user_id', userId)
                .select();

            if (error) throw error;
        }

        res.json({
            success: true,
            message: 'Business context updated successfully'
        });
    } catch (error: any) {
        console.error('Error updating business context:', error);
        res.status(500).json({ error: error.message });
    }
});

// Webhook endpoint for ElevenLabs conversation updates
app.post('/api/webhook/elevenlabs', async (req: Request, res: Response) => {
    try {
        const webhookData = req.body;
        console.log('📥 Received ElevenLabs webhook:', JSON.stringify(webhookData, null, 2));

        // Extract conversation data from webhook
        const { conversation_id, status, transcript, summary, duration, phone_number } = webhookData;

        if (!conversation_id) {
            console.error('❌ Missing conversation_id in webhook');
            return res.status(400).json({ error: 'Missing conversation_id' });
        }

        // Find the user_id for this conversation
        const userId = await resolveUserIdForCall(conversation_id, phone_number);

        // Update or create conversation record
        const { data: existingConversation, error: selectError } = await supabase
            .from('eleven_labs_conversations')
            .select('*')
            .eq('conversation_id', conversation_id)
            .single();

        const conversationData = {
            user_id: userId,
            conversation_id,
            status: status || 'completed',
            duration: duration || 0,
            transcript: transcript || '',
            summary: summary || '',
            phone_number: phone_number || '',
            updated_at: new Date().toISOString()
        };

        if (selectError || !existingConversation) {
            // Create new conversation record
            const { error: insertError } = await supabase
                .from('eleven_labs_conversations')
                .insert(conversationData);

            if (insertError) {
                console.error('❌ Error creating conversation record:', insertError);
                return res.status(500).json({ error: 'Failed to create conversation record' });
            }
        } else {
            // Update existing conversation record
            const { error: updateError } = await supabase
                .from('eleven_labs_conversations')
                .update(conversationData)
                .eq('conversation_id', conversation_id);

            if (updateError) {
                console.error('❌ Error updating conversation record:', updateError);
                return res.status(500).json({ error: 'Failed to update conversation record' });
            }
        }

        // Also update the calls table if this conversation is associated with a call
        if (phone_number) {
            const { data: callData, error: callError } = await supabase
                .from('calls')
                .select('*')
                .eq('conversation_id', conversation_id)
                .single();

            if (!callError && callData) {
                const updateCallData: any = {
                    duration: duration || 0,
                    transcript: transcript || '',
                    updated_at: new Date().toISOString()
                };

                if (status === 'completed' && callData.status !== 'completed') {
                    updateCallData.status = 'completed';
                }

                await supabase
                    .from('calls')
                    .update(updateCallData)
                    .eq('conversation_id', conversation_id);
            }
        }

        console.log('✅ ElevenLabs webhook processed successfully');
        res.json({ success: true, message: 'Webhook processed successfully' });
    } catch (error: any) {
        console.error('❌ Error processing ElevenLabs webhook:', error);
        res.status(500).json({ error: error.message });
    }
});

// Webhook endpoint for Twilio call status updates
app.post('/api/webhook/twilio', async (req: Request, res: Response) => {
    try {
        const twilioData = req.body;
        console.log('📥 Received Twilio webhook:', JSON.stringify(twilioData, null, 2));

        const {
            CallSid,
            CallStatus,
            From,
            To,
            Direction,
            Duration,
            RecordingUrl,
            Timestamp
        } = twilioData;

        // Normalize phone numbers and direction
        const callerNumber = From;
        const calledNumber = To;
        const callDirection = normalizeDirection(Direction || 'outbound');
        const duration = parseInt(Duration) || 0;

        // Find existing call by Twilio CallSid
        const { data: existingCall, error: selectError } = await supabase
            .from('calls')
            .select('*')
            .eq('twilio_call_sid', CallSid)
            .single();

        if (selectError && selectError.code !== 'PGRST116') {
            console.error('❌ Error finding call:', selectError);
        }

        const callData = {
            twilio_call_sid: CallSid,
            caller_number: callerNumber,
            called_number: calledNumber,
            duration: duration,
            status: CallStatus,
            call_type: callDirection,
            recording_url: RecordingUrl || null,
            timestamp: Timestamp ? new Date(Timestamp).toISOString() : new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        if (!existingCall) {
            // Create new call record
            const newCall = {
                id: `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                ...callData,
                created_at: new Date().toISOString()
            };

            const { data, error } = await supabase
                .from('calls')
                .insert(newCall);

            if (error) {
                console.error('❌ Error creating call record:', error);
            } else {
                console.log('✅ New call record created from Twilio webhook');
                
                // Send email notification for inbound calls
                if (callDirection === 'inbound') {
                    await sendCallNotification(newCall);
                }

                // Broadcast new call to connected clients
                io.emit('newCall', newCall);
            }
        } else {
            // Update existing call record
            const { error } = await supabase
                .from('calls')
                .update(callData)
                .eq('twilio_call_sid', CallSid);

            if (error) {
                console.error('❌ Error updating call record:', error);
            } else {
                console.log('✅ Call record updated from Twilio webhook');
                
                // Broadcast call update to connected clients
                io.emit('callUpdated', { ...existingCall, ...callData });
            }
        }

        res.set('Content-Type', 'text/xml');
        res.send('<Response></Response>');
    } catch (error: any) {
        console.error('❌ Error processing Twilio webhook:', error);
        res.status(500).send('<Response><Say>Error processing webhook</Say></Response>');
    }
});

// Initiate outbound call endpoint
app.post('/api/calls/outbound', async (req: Request, res: Response) => {
    try {
        const { phoneNumber, userId } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({ error: 'Phone number is required' });
        }

        console.log(`📞 Initiating outbound call to ${phoneNumber} for user ${userId}`);

        // Get user's business context to enhance the prompt
        let enhancedPrompt = null;
        if (userId) {
            try {
                const businessContext = await fetchBusinessContext(userId);
                if (businessContext && hasBusinessContext(businessContext)) {
                    // Get the current base prompt
                    const { data: currentPrompt } = await supabase
                        .from('prompts')
                        .select('system_prompt')
                        .eq('user_id', userId)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .single();

                    if (currentPrompt) {
                        enhancedPrompt = await enhancePromptWithBusinessContext(userId, currentPrompt.system_prompt);
                    }
                }
            } catch (error) {
                console.error('Error enhancing prompt with business context:', error);
                // Continue with regular prompt if enhancement fails
            }
        }

        // Update ElevenLabs agent with enhanced prompt if available
        if (enhancedPrompt && userId) {
            try {
                const firstMessage = extractFirstMessageFromPrompt(enhancedPrompt);
                await updateElevenLabsAgent(enhancedPrompt, firstMessage);
                console.log('✅ ElevenLabs agent updated with enhanced business context');
            } catch (error) {
                console.error('Error updating ElevenLabs agent with enhanced prompt:', error);
                // Continue with existing agent configuration
            }
        }

        const callResult = await initiateOutboundCall(phoneNumber);

        // Create call record in database
        const callData = {
            id: `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            user_id: userId || null,
            timestamp: new Date().toISOString(),
            caller_number: phoneNumber,
            called_number: 'Agent',
            duration: 0,
            status: 'initiated',
            call_type: 'outbound',
            transcript: '',
            conversation_id: callResult.conversation_id
        };

        await supabase
            .from('calls')
            .insert(callData);

        // Broadcast new call to connected clients
        io.emit('newCall', callData);

        res.json({
            success: true,
            message: 'Outbound call initiated successfully',
            call: callData
        });
    } catch (error: any) {
        console.error('Error initiating outbound call:', error);
        res.status(500).json({ error: error.message });
    }
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id);
    });

    // Join a user-specific room for real-time updates
    socket.on('joinUserRoom', (userId: string) => {
        socket.join(`user:${userId}`);
        console.log(`👤 User ${userId} joined their room`);
    });

    // Leave user room
    socket.on('leaveUserRoom', (userId: string) => {
        socket.leave(`user:${userId}`);
        console.log(`👤 User ${userId} left their room`);
    });
});

// Error handling middleware
app.use((error: any, req: Request, res: Response, next: any) => {
    console.error('💥 Unhandled error:', error);
    res.status(500).json({ 
        success: false, 
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message 
    });
});

// 404 handler
app.use('*', (req: Request, res: Response) => {
    res.status(404).json({ 
        success: false, 
        error: 'Endpoint not found' 
    });
});

// Initialize and start server
const PORT = process.env.PORT || 5000;

async function startServer() {
    await initializeDatabase();
    
    // Setup Vite dev server in development
    if (process.env.NODE_ENV === 'development') {
        await setupVite(app, server);
    } else {
        serveStatic(app);
    }

    server.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🔧 ElevenLabs configured: ${!!ELEVENLABS_API_KEY}`);
        console.log(`📧 Email notifications: ${emailConfig.enabled ? 'enabled' : 'disabled'}`);
    });
}

startServer().catch(console.error);
