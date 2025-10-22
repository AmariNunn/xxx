import { createClient } from '@supabase/supabase-js';
import * as crypto from "crypto";
import type {
  User,
  Call,
  Lead,
  BusinessInfo,
  ElevenLabsConversation,
  InsertUser,
  LoginUser,
  ForgotPasswordRequest,
  InsertCall,
  InsertLead,
  UpsertBusinessInfo,
  InsertElevenLabsConversation
} from '../shared/types';

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper function to hash passwords
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  validateUserCredentials(credentials: LoginUser): Promise<User | undefined>;
  requestPasswordReset(request: ForgotPasswordRequest): Promise<boolean>;
  
  // Business info operations
  getBusinessInfo(userId: string): Promise<BusinessInfo | undefined>;
  updateBusinessInfo(userId: string, data: Partial<UpsertBusinessInfo>): Promise<BusinessInfo>;
  addBusinessLink(userId: string, link: string): Promise<BusinessInfo>;
  removeBusinessLink(userId: string, index: number): Promise<BusinessInfo>;
  addBusinessFile(userId: string, fileData: {fileName: string, fileType: string, fileUrl: string, fileSize?: string}): Promise<BusinessInfo>;
  removeBusinessFile(userId: string, index: number): Promise<BusinessInfo>;
  updateBusinessDescription(userId: string, description: string): Promise<BusinessInfo>;
  updateBusinessProfile(userId: string, profileData: any): Promise<BusinessInfo>;
  updateBusinessLogo(userId: string, logoUrl: string): Promise<BusinessInfo>;
  
  // Twilio integration operations
  updateTwilioSettings(userId: string, settings: {accountSid: string, authToken: string, phoneNumber: string}): Promise<BusinessInfo>;
  getAllBusinessInfoWithTwilio(): Promise<BusinessInfo[]>;
  
  // ElevenLabs integration operations
  updateElevenLabsSettings(userId: string, settings: {apiKey: string, agentId: string, phoneNumberId: string}): Promise<BusinessInfo>;
  
  // Cal.com integration operations
  updateCalComSettings(userId: string, settings: {apiKey: string, eventTypeId: string, enabled: boolean}): Promise<BusinessInfo>;
  
  createCall(callData: InsertCall): Promise<Call>;
}

export class SupabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !data) return undefined;
    return data as User;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();
    
    if (error || !data) return undefined;
    return data as User;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const existingUser = await this.getUserByEmail(insertUser.email);
    if (existingUser) {
      throw new Error("User with this email already exists");
    }

    // Hash the password before saving
    const hashedPassword = hashPassword(insertUser.password);
    
    const userData = {
      email: insertUser.email.toLowerCase(),
      password: hashedPassword,
      business_name: insertUser.businessName,
      phone_number: insertUser.phoneNumber,
      website: insertUser.website || null,
      service_plan: insertUser.servicePlan,
      verified: false
    };
    
    const { data, error } = await supabase
      .from('users')
      .insert(userData)
      .select()
      .single();
    
    if (error) throw new Error(error.message);
    return data as User;
  }

  async validateUserCredentials(credentials: LoginUser): Promise<User | undefined> {
    const user = await this.getUserByEmail(credentials.email);
    if (!user) {
      return undefined;
    }

    const hashedPassword = hashPassword(credentials.password);
    if (user.password !== hashedPassword) {
      return undefined;
    }

    return user;
  }

  async requestPasswordReset(request: ForgotPasswordRequest): Promise<boolean> {
    const user = await this.getUserByEmail(request.email);
    // Return true even if user not found for security reasons
    return true;
  }
  
  // Business info operations
  async getBusinessInfo(userId: string): Promise<BusinessInfo | undefined> {
    try {
      const { data, error } = await supabase
        .from('business_info')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error || !data) return undefined;
      return data as BusinessInfo;
    } catch (error) {
      console.error("Error getting business info:", error);
      return undefined;
    }
  }
  
  async updateBusinessInfo(userId: string, data: Partial<UpsertBusinessInfo>): Promise<BusinessInfo> {
    try {
      // Check if the record already exists
      const existingInfo = await this.getBusinessInfo(userId);
      
      if (existingInfo) {
        // Update existing record
        const { data: result, error } = await supabase
          .from('business_info')
          .update({ 
            ...data, 
            updated_at: new Date().toISOString() 
          })
          .eq('user_id', userId)
          .select()
          .single();
          
        if (error) throw new Error(error.message);
        return result as BusinessInfo;
      } else {
        // Create new record
        const { data: result, error } = await supabase
          .from('business_info')
          .insert({ user_id: userId, ...data })
          .select()
          .single();
          
        if (error) throw new Error(error.message);
        return result as BusinessInfo;
      }
    } catch (error) {
      console.error("Error updating business info:", error);
      throw new Error("Failed to update business info");
    }
  }
  
  async addBusinessLink(userId: string, link: string): Promise<BusinessInfo> {
    try {
      const info = await this.getBusinessInfo(userId);
      
      if (info) {
        // Add to existing links array
        const links = info.links || [];
        const updatedLinks = [...links, link];
        
        const { data: result, error } = await supabase
          .from('business_info')
          .update({ 
            links: updatedLinks,
            updated_at: new Date().toISOString() 
          })
          .eq('user_id', userId)
          .select()
          .single();
          
        if (error) throw new Error(error.message);
        return result as BusinessInfo;
      } else {
        // Create new record with link
        const { data: result, error } = await supabase
          .from('business_info')
          .insert({ 
            user_id: userId, 
            links: [link] 
          })
          .select()
          .single();
          
        if (error) throw new Error(error.message);
        return result as BusinessInfo;
      }
    } catch (error) {
      console.error("Error adding business link:", error);
      throw new Error("Failed to add link");
    }
  }
  
  async removeBusinessLink(userId: string, index: number): Promise<BusinessInfo> {
    try {
      const info = await this.getBusinessInfo(userId);
      
      if (!info || !info.links || index >= info.links.length) {
        throw new Error("Link not found");
      }
      
      // Remove the link at the specified index
      const updatedLinks = [...info.links];
      updatedLinks.splice(index, 1);
      
      const { data: result, error } = await supabase
        .from('business_info')
        .update({ 
          links: updatedLinks,
          updated_at: new Date().toISOString() 
        })
        .eq('user_id', userId)
        .select()
        .single();
        
      if (error) throw new Error(error.message);
      return result as BusinessInfo;
    } catch (error) {
      console.error("Error removing business link:", error);
      throw new Error("Failed to remove link");
    }
  }
  
  async addBusinessFile(userId: string, fileData: {fileName: string, fileType: string, fileUrl: string, fileSize?: string}): Promise<BusinessInfo> {
    try {
      const info = await this.getBusinessInfo(userId);
      const { fileName, fileType, fileUrl, fileSize = "Unknown" } = fileData;
      
      if (info) {
        // Add to existing arrays
        const fileNames = info.file_names || [];
        const fileTypes = info.file_types || [];
        const fileUrls = info.file_urls || [];
        const fileSizes = info.file_sizes || [];
        
        const { data: result, error } = await supabase
          .from('business_info')
          .update({ 
            file_names: [...fileNames, fileName],
            file_types: [...fileTypes, fileType],
            file_urls: [...fileUrls, fileUrl],
            file_sizes: [...fileSizes, fileSize],
            updated_at: new Date().toISOString() 
          })
          .eq('user_id', userId)
          .select()
          .single();
          
        if (error) throw new Error(error.message);
        return result as BusinessInfo;
      } else {
        // Create new record with file
        const { data: result, error } = await supabase
          .from('business_info')
          .insert({ 
            user_id: userId, 
            file_names: [fileName],
            file_types: [fileType],
            file_urls: [fileUrl],
            file_sizes: [fileSize]
          })
          .select()
          .single();
          
        if (error) throw new Error(error.message);
        return result as BusinessInfo;
      }
    } catch (error) {
      console.error("Error adding business file:", error);
      throw new Error("Failed to add file");
    }
  }
  
  async removeBusinessFile(userId: string, index: number): Promise<BusinessInfo> {
    try {
      const info = await this.getBusinessInfo(userId);
      
      if (!info || !info.file_names || index >= info.file_names.length) {
        throw new Error("File not found");
      }
      
      // Remove file data at the specified index
      const fileNames = [...(info.file_names || [])];
      const fileTypes = [...(info.file_types || [])];
      const fileUrls = [...(info.file_urls || [])];
      const fileSizes = info.file_sizes ? [...info.file_sizes] : [];
      
      fileNames.splice(index, 1);
      fileTypes.splice(index, 1);
      fileUrls.splice(index, 1);
      if (fileSizes.length > index) {
        fileSizes.splice(index, 1);
      }
      
      const { data: result, error } = await supabase
        .from('business_info')
        .update({ 
          file_names: fileNames,
          file_types: fileTypes,
          file_urls: fileUrls,
          file_sizes: fileSizes,
          updated_at: new Date().toISOString() 
        })
        .eq('user_id', userId)
        .select()
        .single();
        
      if (error) throw new Error(error.message);
      return result as BusinessInfo;
    } catch (error) {
      console.error("Error removing business file:", error);
      throw new Error("Failed to remove file");
    }
  }
  
  async updateBusinessDescription(userId: string, description: string): Promise<BusinessInfo> {
    try {
      const info = await this.getBusinessInfo(userId);
      
      if (info) {
        // Update existing record
        const { data: result, error } = await supabase
          .from('business_info')
          .update({ 
            description,
            updated_at: new Date().toISOString() 
          })
          .eq('user_id', userId)
          .select()
          .single();
          
        if (error) throw new Error(error.message);
        return result as BusinessInfo;
      } else {
        // Create new record
        const { data: result, error } = await supabase
          .from('business_info')
          .insert({ 
            user_id: userId, 
            description 
          })
          .select()
          .single();
          
        if (error) throw new Error(error.message);
        return result as BusinessInfo;
      }
    } catch (error) {
      console.error("Error updating business description:", error);
      throw new Error("Failed to update description");
    }
  }
  
  async updateBusinessProfile(userId: string, profileData: any): Promise<BusinessInfo> {
    try {
      return await this.updateBusinessInfo(userId, profileData);
    } catch (error) {
      console.error("Error updating business profile:", error);
      throw new Error("Failed to update profile");
    }
  }
  
  async updateBusinessLogo(userId: string, logoUrl: string): Promise<BusinessInfo> {
    try {
      const info = await this.getBusinessInfo(userId);
      
      if (info) {
        // Update existing record
        const { data: result, error } = await supabase
          .from('business_info')
          .update({ 
            logo_url: logoUrl,
            updated_at: new Date().toISOString() 
          })
          .eq('user_id', userId)
          .select()
          .single();
          
        if (error) throw new Error(error.message);
        return result as BusinessInfo;
      } else {
        // Create new record
        const { data: result, error } = await supabase
          .from('business_info')
          .insert({ 
            user_id: userId, 
            logo_url: logoUrl 
          })
          .select()
          .single();
          
        if (error) throw new Error(error.message);
        return result as BusinessInfo;
      }
    } catch (error) {
      console.error("Error updating business logo:", error);
      throw new Error("Failed to update logo");
    }
  }

  // Twilio integration methods
  async updateTwilioSettings(userId: string, settings: {accountSid: string, authToken: string, phoneNumber: string}): Promise<BusinessInfo> {
    try {
      const info = await this.getBusinessInfo(userId);
      
      if (info) {
        // Update existing record
        const { data: result, error } = await supabase
          .from('business_info')
          .update({ 
            twilio_account_sid: settings.accountSid,
            twilio_auth_token: settings.authToken,
            twilio_phone_number: settings.phoneNumber,
            updated_at: new Date().toISOString() 
          })
          .eq('user_id', userId)
          .select()
          .single();
          
        if (error) throw new Error(error.message);
        return result as BusinessInfo;
      } else {
        // Create new record
        const { data: result, error } = await supabase
          .from('business_info')
          .insert({ 
            user_id: userId, 
            twilio_account_sid: settings.accountSid,
            twilio_auth_token: settings.authToken,
            twilio_phone_number: settings.phoneNumber
          })
          .select()
          .single();
          
        if (error) throw new Error(error.message);
        return result as BusinessInfo;
      }
    } catch (error) {
      console.error("Error updating Twilio settings:", error);
      throw new Error("Failed to update Twilio settings");
    }
  }

  async getAllBusinessInfoWithTwilio(): Promise<BusinessInfo[]> {
    try {
      const { data, error } = await supabase
        .from('business_info')
        .select('*')
        .not('twilio_phone_number', 'is', null)
        .neq('twilio_phone_number', '');
        
      if (error) throw new Error(error.message);
      return data as BusinessInfo[];
    } catch (error) {
      console.error("Error fetching business info with Twilio:", error);
      return [];
    }
  }

  // ElevenLabs integration methods
  async updateElevenLabsSettings(userId: string, settings: {apiKey: string, agentId: string, phoneNumberId: string}): Promise<BusinessInfo> {
    try {
      const info = await this.getBusinessInfo(userId);
      
      if (info) {
        // Update existing record
        const { data: result, error } = await supabase
          .from('business_info')
          .update({ 
            elevenlabs_api_key: settings.apiKey,
            elevenlabs_agent_id: settings.agentId,
            elevenlabs_phone_number_id: settings.phoneNumberId,
            updated_at: new Date().toISOString() 
          })
          .eq('user_id', userId)
          .select()
          .single();
          
        if (error) throw new Error(error.message);
        return result as BusinessInfo;
      } else {
        // Create new record
        const { data: result, error } = await supabase
          .from('business_info')
          .insert({ 
            user_id: userId, 
            elevenlabs_api_key: settings.apiKey,
            elevenlabs_agent_id: settings.agentId,
            elevenlabs_phone_number_id: settings.phoneNumberId
          })
          .select()
          .single();
          
        if (error) throw new Error(error.message);
        return result as BusinessInfo;
      }
    } catch (error) {
      console.error("Error updating ElevenLabs settings:", error);
      throw new Error("Failed to update ElevenLabs settings");
    }
  }

  // Cal.com integration methods
  async updateCalComSettings(userId: string, settings: {apiKey: string, eventTypeId: string, enabled: boolean}): Promise<BusinessInfo> {
    try {
      const info = await this.getBusinessInfo(userId);
      
      // Generate a unique webhook token for authenticating Cal.com webhook requests
      // This prevents confused-deputy attacks where someone with just a user ID could abuse the webhooks
      const webhookToken = info?.cal_com_webhook_token || crypto.randomBytes(32).toString('hex');
      
      if (info) {
        // Update existing record
        const { data: result, error } = await supabase
          .from('business_info')
          .update({ 
            cal_com_api_key: settings.apiKey,
            cal_com_event_type_id: settings.eventTypeId,
            cal_com_enabled: settings.enabled,
            cal_com_webhook_token: webhookToken,
            updated_at: new Date().toISOString() 
          })
          .eq('user_id', userId)
          .select()
          .single();
          
        if (error) throw new Error(error.message);
        return result as BusinessInfo;
      } else {
        // Create new record
        const { data: result, error } = await supabase
          .from('business_info')
          .insert({ 
            user_id: userId, 
            cal_com_api_key: settings.apiKey,
            cal_com_event_type_id: settings.eventTypeId,
            cal_com_enabled: settings.enabled,
            cal_com_webhook_token: webhookToken
          })
          .select()
          .single();
          
        if (error) throw new Error(error.message);
        return result as BusinessInfo;
      }
    } catch (error) {
      console.error("Error updating Cal.com settings:", error);
      throw new Error("Failed to update Cal.com settings");
    }
  }

  async createCall(callData: InsertCall): Promise<Call> {
    try {
        // Validate that userId is provided since it's required in your business logic
        if (!callData.userId) {
            throw new Error("User ID is required to create a call");
        }

        // Verify the user exists before creating the call
        const user = await this.getUser(callData.userId);
        if (!user) {
            throw new Error(`User with ID ${callData.userId} not found`);
        }

        const { data, error } = await supabase
            .from('calls')
            .insert({
                user_id: callData.userId,
                phone_number: callData.phoneNumber,
                contact_name: callData.contactName || null,
                duration: callData.duration || 0,
                status: callData.status || 'completed',
                notes: callData.notes || null,
                summary: callData.summary || null,
                transcript: callData.transcript || null,
                twilio_call_sid: callData.twilioCallSid || null,
                direction: callData.direction || 'inbound',
                recording_url: callData.recordingUrl || null,
                is_from_twilio: callData.isFromTwilio || false
            })
            .select()
            .single();
            
        if (error) {
            console.error("Supabase error creating call:", error);
            throw new Error(`Failed to create call: ${error.message}`);
        }
        return data as Call;
    } catch (error) {
        console.error("Error creating call:", error);
        throw error; // Re-throw the original error to preserve the message
    }
  }

  // Enhanced method with fallback for user validation issues
  async createCallWithUserValidation(callData: InsertCall): Promise<Call> {
    try {
        return await this.createCall(callData);
    } catch (error: any) {
        if (error.message.includes('foreign key constraint') || error.message.includes('user not found')) {
            // Handle the case where user doesn't exist
            console.warn('Call creation failed due to user validation, attempting fallback...');
            
            // Option: Use a system default user if available
            const systemUserId = '00000000-0000-0000-0000-000000000000';
            const fallbackCallData = {
                ...callData,
                userId: systemUserId
            };
            
            // Verify system user exists or create it
            try {
                const systemUser = await this.getUser(systemUserId);
                if (!systemUser) {
                    console.warn('System default user not found, cannot create call');
                    throw new Error('No valid user available for call creation');
                }
                
                return await this.createCall(fallbackCallData);
            } catch (fallbackError) {
                console.error('Fallback call creation failed:', fallbackError);
                throw new Error('Failed to create call: No valid user available');
            }
        }
        throw error;
    }
  }
}

// Export an instance of SupabaseStorage
export const storage = new SupabaseStorage();
