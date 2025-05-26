import { 
  users,
  businessInfo,
  calls,
  type User, 
  type InsertUser,
  type LoginUser,
  type ForgotPasswordRequest,
  type InsertCall,
  type Call
} from "@shared/schema";
import * as crypto from "crypto";
import { db } from "./db";
import { eq, ne } from "drizzle-orm";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  validateUserCredentials(credentials: LoginUser): Promise<User | undefined>;
  requestPasswordReset(request: ForgotPasswordRequest): Promise<boolean>;
  
  // Business info operations
  getBusinessInfo(userId: number): Promise<any>;
  updateBusinessInfo(userId: number, data: any): Promise<any>;
  addBusinessLink(userId: number, link: string): Promise<any>;
  removeBusinessLink(userId: number, index: number): Promise<any>;
  addBusinessFile(userId: number, fileData: {fileName: string, fileType: string, fileUrl: string, fileSize?: string}): Promise<any>;
  removeBusinessFile(userId: number, index: number): Promise<any>;
  updateBusinessDescription(userId: number, description: string): Promise<any>;
  updateBusinessProfile(userId: number, profileData: any): Promise<any>;
  updateBusinessLogo(userId: number, logoUrl: string): Promise<any>;
  
  // Twilio integration operations
  updateTwilioSettings(userId: number, settings: {accountSid: string, authToken: string, phoneNumber: string}): Promise<any>;
  getAllBusinessInfoWithTwilio(): Promise<any[]>;
  createCall(callData: InsertCall): Promise<Call>;
}

// Helper function to hash passwords
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const existingUser = await this.getUserByEmail(insertUser.email);
    if (existingUser) {
      throw new Error("User with this email already exists");
    }

    // Hash the password before saving
    const hashedPassword = hashPassword(insertUser.password);
    
    const userData = { 
      ...insertUser, 
      email: insertUser.email.toLowerCase(),
      password: hashedPassword,
      verified: false,
      website: insertUser.website || null
    };
    
    const result = await db.insert(users).values(userData).returning();
    return result[0];
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
    // (in a real implementation, we would only send email if user exists)
    return true;
  }
  
  // Business info operations
  async getBusinessInfo(userId: number): Promise<any> {
    try {
      const result = await db.select().from(businessInfo).where(eq(businessInfo.userId, userId));
      return result[0];
    } catch (error) {
      console.error("Error getting business info:", error);
      return undefined;
    }
  }
  
  async updateBusinessInfo(userId: number, data: any): Promise<any> {
    try {
      // Check if the record already exists
      const existingInfo = await this.getBusinessInfo(userId);
      
      if (existingInfo) {
        // Update existing record
        const result = await db.update(businessInfo)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(businessInfo.userId, userId))
          .returning();
          
        return result[0];
      } else {
        // Create new record
        const result = await db.insert(businessInfo)
          .values({ userId, ...data })
          .returning();
          
        return result[0];
      }
    } catch (error) {
      console.error("Error updating business info:", error);
      throw new Error("Failed to update business info");
    }
  }
  
  async addBusinessLink(userId: number, link: string): Promise<any> {
    try {
      const info = await this.getBusinessInfo(userId);
      
      if (info) {
        // Add to existing links array
        const links = info.links || [];
        const updatedLinks = [...links, link];
        
        const result = await db.update(businessInfo)
          .set({ 
            links: updatedLinks,
            updatedAt: new Date() 
          })
          .where(eq(businessInfo.userId, userId))
          .returning();
          
        return result[0];
      } else {
        // Create new record with link
        const result = await db.insert(businessInfo)
          .values({ 
            userId, 
            links: [link] 
          })
          .returning();
          
        return result[0];
      }
    } catch (error) {
      console.error("Error adding business link:", error);
      throw new Error("Failed to add link");
    }
  }
  
  async removeBusinessLink(userId: number, index: number): Promise<any> {
    try {
      const info = await this.getBusinessInfo(userId);
      
      if (!info || !info.links || index >= info.links.length) {
        throw new Error("Link not found");
      }
      
      // Remove the link at the specified index
      const updatedLinks = [...info.links];
      updatedLinks.splice(index, 1);
      
      const result = await db.update(businessInfo)
        .set({ 
          links: updatedLinks,
          updatedAt: new Date() 
        })
        .where(eq(businessInfo.userId, userId))
        .returning();
        
      return result[0];
    } catch (error) {
      console.error("Error removing business link:", error);
      throw new Error("Failed to remove link");
    }
  }
  
  async addBusinessFile(userId: number, fileData: {fileName: string, fileType: string, fileUrl: string, fileSize?: string}): Promise<any> {
    try {
      const info = await this.getBusinessInfo(userId);
      const { fileName, fileType, fileUrl, fileSize = "Unknown" } = fileData;
      
      if (info) {
        // Add to existing arrays
        const fileNames = info.fileNames || [];
        const fileTypes = info.fileTypes || [];
        const fileUrls = info.fileUrls || [];
        const fileSizes = info.fileSizes || [];
        
        const result = await db.update(businessInfo)
          .set({ 
            fileNames: [...fileNames, fileName],
            fileTypes: [...fileTypes, fileType],
            fileUrls: [...fileUrls, fileUrl],
            fileSizes: [...fileSizes, fileSize],
            updatedAt: new Date() 
          })
          .where(eq(businessInfo.userId, userId))
          .returning();
          
        return result[0];
      } else {
        // Create new record with file
        const result = await db.insert(businessInfo)
          .values({ 
            userId, 
            fileNames: [fileName],
            fileTypes: [fileType],
            fileUrls: [fileUrl],
            fileSizes: [fileSize]
          })
          .returning();
          
        return result[0];
      }
    } catch (error) {
      console.error("Error adding business file:", error);
      throw new Error("Failed to add file");
    }
  }
  
  async removeBusinessFile(userId: number, index: number): Promise<any> {
    try {
      const info = await this.getBusinessInfo(userId);
      
      if (!info || !info.fileNames || index >= info.fileNames.length) {
        throw new Error("File not found");
      }
      
      // Remove file data at the specified index
      const fileNames = [...info.fileNames];
      const fileTypes = [...info.fileTypes];
      const fileUrls = [...info.fileUrls];
      const fileSizes = info.fileSizes ? [...info.fileSizes] : [];
      
      fileNames.splice(index, 1);
      fileTypes.splice(index, 1);
      fileUrls.splice(index, 1);
      if (fileSizes.length > index) {
        fileSizes.splice(index, 1);
      }
      
      const result = await db.update(businessInfo)
        .set({ 
          fileNames,
          fileTypes,
          fileUrls,
          fileSizes,
          updatedAt: new Date() 
        })
        .where(eq(businessInfo.userId, userId))
        .returning();
        
      return result[0];
    } catch (error) {
      console.error("Error removing business file:", error);
      throw new Error("Failed to remove file");
    }
  }
  
  async updateBusinessDescription(userId: number, description: string): Promise<any> {
    try {
      const info = await this.getBusinessInfo(userId);
      
      if (info) {
        // Update existing record
        const result = await db.update(businessInfo)
          .set({ 
            description,
            updatedAt: new Date() 
          })
          .where(eq(businessInfo.userId, userId))
          .returning();
          
        return result[0];
      } else {
        // Create new record
        const result = await db.insert(businessInfo)
          .values({ 
            userId, 
            description 
          })
          .returning();
          
        return result[0];
      }
    } catch (error) {
      console.error("Error updating business description:", error);
      throw new Error("Failed to update description");
    }
  }
  
  async updateBusinessProfile(userId: number, profileData: any): Promise<any> {
    try {
      return await this.updateBusinessInfo(userId, profileData);
    } catch (error) {
      console.error("Error updating business profile:", error);
      throw new Error("Failed to update profile");
    }
  }
  
  async updateBusinessLogo(userId: number, logoUrl: string): Promise<any> {
    try {
      const info = await this.getBusinessInfo(userId);
      
      if (info) {
        // Update existing record
        const result = await db.update(businessInfo)
          .set({ 
            logoUrl,
            updatedAt: new Date() 
          })
          .where(eq(businessInfo.userId, userId))
          .returning();
          
        return result[0];
      } else {
        // Create new record
        const result = await db.insert(businessInfo)
          .values({ 
            userId, 
            logoUrl 
          })
          .returning();
          
        return result[0];
      }
    } catch (error) {
      console.error("Error updating business logo:", error);
      throw new Error("Failed to update logo");
    }
  }

  // Twilio integration methods
  async updateTwilioSettings(userId: number, settings: {accountSid: string, authToken: string, phoneNumber: string}): Promise<any> {
    try {
      const info = await this.getBusinessInfo(userId);
      
      if (info) {
        // Update existing record
        const result = await db.update(businessInfo)
          .set({ 
            twilioAccountSid: settings.accountSid,
            twilioAuthToken: settings.authToken,
            twilioPhoneNumber: settings.phoneNumber,
            updatedAt: new Date() 
          })
          .where(eq(businessInfo.userId, userId))
          .returning();
          
        return result[0];
      } else {
        // Create new record
        const result = await db.insert(businessInfo)
          .values({ 
            userId, 
            twilioAccountSid: settings.accountSid,
            twilioAuthToken: settings.authToken,
            twilioPhoneNumber: settings.phoneNumber
          })
          .returning();
          
        return result[0];
      }
    } catch (error) {
      console.error("Error updating Twilio settings:", error);
      throw new Error("Failed to update Twilio settings");
    }
  }

  async getAllBusinessInfoWithTwilio(): Promise<any[]> {
    try {
      const results = await db
        .select()
        .from(businessInfo)
        .where(ne(businessInfo.twilioPhoneNumber, null));
      return results;
    } catch (error) {
      console.error("Error fetching business info with Twilio:", error);
      return [];
    }
  }

  async createCall(callData: InsertCall): Promise<Call> {
    try {
      const [call] = await db
        .insert(calls)
        .values(callData)
        .returning();
      return call;
    } catch (error) {
      console.error("Error creating call:", error);
      throw new Error("Failed to create call");
    }
  }
}

// Export an instance of DatabaseStorage instead of MemStorage
export const storage = new DatabaseStorage();
