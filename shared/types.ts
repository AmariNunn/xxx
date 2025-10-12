import { z } from "zod";

// Service plan enum values
export const SERVICE_PLAN_VALUES = ['inbound', 'outbound', 'both'] as const;
export type ServicePlan = typeof SERVICE_PLAN_VALUES[number];

// Call status enum values  
export const CALL_STATUS_VALUES = ['completed', 'missed', 'failed'] as const;
export type CallStatus = typeof CALL_STATUS_VALUES[number];

// Call action enum values
export const CALL_ACTION_VALUES = ['none', 'follow-up', 'call-back', 'discount'] as const;
export type CallAction = typeof CALL_ACTION_VALUES[number];

// User type
export interface User {
  id: string;
  email: string;
  password: string;
  business_name: string;
  phone_number: string;
  website?: string;
  service_plan: ServicePlan;
  verified: boolean;
  created_at: string;
}

// Call type
export interface Call {
  id: string;
  user_id: string;
  phone_number: string;
  contact_name?: string;
  duration?: number;
  status: CallStatus;
  action?: CallAction;
  notes?: string;
  summary?: string;
  transcript?: string;
  twilio_call_sid?: string;
  direction?: string;
  recording_url?: string;
  is_from_twilio: boolean;
  created_at: string;
}

// Lead type (deprecated - kept for backward compatibility, consider removing if not used)
export interface Lead {
  id: number;
  user_id: string;
  name: string;
  phone_number: string;
  email?: string;
  company?: string;
  notes?: string;
  created_at: string;
}

// Business info type
export interface BusinessInfo {
  id: number;
  user_id: string;
  business_name?: string;
  business_email?: string;
  business_phone?: string;
  business_address?: string;
  description?: string;
  links?: string[];
  scraped_content?: string[];
  scraped_titles?: string[];
  scraped_urls?: string[];
  scraped_at?: string[];
  file_urls?: string[];
  file_names?: string[];
  file_types?: string[];
  file_sizes?: string[];
  document_content?: string[];
  document_titles?: string[];
  document_extracted_at?: string[];
  lead_urls?: string[];
  lead_names?: string[];
  lead_types?: string[];
  lead_sizes?: string[];
  logo_url?: string;
  twilio_account_sid?: string;
  twilio_auth_token?: string;
  twilio_phone_number?: string;
  elevenlabs_api_key?: string;
  elevenlabs_agent_id?: string;
  elevenlabs_phone_number_id?: string;
  cal_api_key?: string;
  cal_event_type_id?: string;
  timezone?: string;
  saved_prompts?: string[];
  updated_at: string;
}

// ElevenLabs conversation type (DEPRECATED - conversation data now stored in calls table)
// This table and type are no longer used and can be safely removed
export interface ElevenLabsConversation {
  id: number;
  user_id: string;
  conversation_id: string;
  agent_id: string;
  status: string;
  start_time?: string;
  end_time?: string;
  duration?: number;
  transcript?: string;
  summary?: string;
  metadata?: string;
  phone_number?: string;
  created_at: string;
  updated_at: string;
}

// Validation schemas
export const insertUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  businessName: z.string().min(1),
  phoneNumber: z.string().min(1),
  website: z.string().optional(),
  servicePlan: z.enum(SERVICE_PLAN_VALUES),
});

export const loginUserSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const insertCallSchema = z.object({
  userId: z.string(),
  phoneNumber: z.string(),
  contactName: z.string().optional(),
  duration: z.number().optional(),
  status: z.enum(CALL_STATUS_VALUES),
  action: z.enum(CALL_ACTION_VALUES).optional(),
  notes: z.string().optional(),
  summary: z.string().optional(),
  transcript: z.string().optional(),
  twilioCallSid: z.string().optional(),
  direction: z.string().optional(),
  recordingUrl: z.string().optional(),
  isFromTwilio: z.boolean().default(false),
});

export const insertLeadSchema = z.object({
  userId: z.string(),
  name: z.string(),
  phoneNumber: z.string(),
  email: z.string().optional(),
  company: z.string().optional(),
  notes: z.string().optional(),
});

export const upsertBusinessInfoSchema = z.object({
  userId: z.string(),
  businessName: z.string().optional(),
  businessEmail: z.string().optional(),
  businessPhone: z.string().optional(),
  businessAddress: z.string().optional(),
  description: z.string().optional(),
  links: z.array(z.string()).optional(),
  fileUrls: z.array(z.string()).optional(),
  fileNames: z.array(z.string()).optional(),
  fileTypes: z.array(z.string()).optional(),
  fileSizes: z.array(z.string()).optional(),
  logoUrl: z.string().optional(),
  twilioAccountSid: z.string().optional(),
  twilioAuthToken: z.string().optional(),
  twilioPhoneNumber: z.string().optional(),
});

export const insertElevenLabsConversationSchema = z.object({
  userId: z.string(),
  conversationId: z.string(),
  agentId: z.string(),
  status: z.string(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  duration: z.number().optional(),
  transcript: z.string().optional(),
  summary: z.string().optional(),
  metadata: z.string().optional(),
  phoneNumber: z.string().optional(),
});

// Type exports
export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginUser = z.infer<typeof loginUserSchema>;
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordSchema>;
export type InsertCall = z.infer<typeof insertCallSchema>;
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type UpsertBusinessInfo = z.infer<typeof upsertBusinessInfoSchema>;
export type InsertElevenLabsConversation = z.infer<typeof insertElevenLabsConversationSchema>;
