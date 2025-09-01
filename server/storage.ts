import { 
  users,
  businessInfo,
  calls,
  userContent,
  type User, 
  type InsertUser,
  type LoginUser,
  type ForgotPasswordRequest,
  type InsertCall,
  type Call,
  type UserContent,
  type InsertUserContent
} from "@shared/schema";
import * as crypto from "crypto";
import { db } from "./db";
import { eq, ne } from "drizzle-orm";
import { validatePassword, generateSecureToken, hashPassword as authHashPassword, verifyPassword, createTokenExpiration } from "./authUtils";
import { sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail } from "./emailService";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  validateUserCredentials(credentials: LoginUser): Promise<User | undefined>;
  requestPasswordReset(request: ForgotPasswordRequest): Promise<boolean>;
  verifyEmail(token: string): Promise<boolean>;
  resetPassword(token: string, newPassword: string): Promise<boolean>;
  resendVerificationEmail(email: string): Promise<boolean>;
  
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
  updateTwilioSettings(userId: number, settings: {accountSid: string | null, authToken: string | null, phoneNumber: string | null}): Promise<any>;
  getAllBusinessInfoWithTwilio(): Promise<any[]>;
  getAllUsers(): Promise<User[]>;
  getCallsByUserId(userId: number): Promise<Call[]>;
  createCall(callData: InsertCall): Promise<Call>;
  
  // User Content management for AI personalization
  addUserContent(userId: number, contentData: Omit<InsertUserContent, 'userId'>): Promise<UserContent>;
  getUserContent(userId: number): Promise<UserContent[]>;
  deleteUserContent(userId: number, contentId: number): Promise<boolean>;
}

// Helper function to hash passwords
// Using auth utility functions for password handling

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

    // Validate password strength
    const passwordValidation = validatePassword(insertUser.password);
    if (!passwordValidation.isValid) {
      throw new Error(passwordValidation.errors.join(', '));
    }

    // Hash the password and generate verification token
    const hashedPassword = authHashPassword(insertUser.password);
    const verificationToken = generateSecureToken();
    const verificationExpires = createTokenExpiration(24); // 24 hours to verify
    
    const userData = { 
      ...insertUser, 
      email: insertUser.email.toLowerCase(),
      password: hashedPassword,
      verified: false,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: verificationExpires,
      website: insertUser.website || null
    };
    
    const result = await db.insert(users).values(userData).returning();
    const newUser = result[0];
    
    // Send verification email
    try {
      await sendVerificationEmail(newUser.email, newUser.businessName, verificationToken);
    } catch (error) {
      console.error('Failed to send verification email:', error);
      // Don't fail user creation if email fails, but log it
    }
    
    return newUser;
  }

  async validateUserCredentials(credentials: LoginUser): Promise<User | undefined> {
    const user = await this.getUserByEmail(credentials.email);
    if (!user) {
      return undefined;
    }

    if (!verifyPassword(credentials.password, user.password)) {
      return undefined;
    }

    return user;
  }

  async requestPasswordReset(request: ForgotPasswordRequest): Promise<boolean> {
    const user = await this.getUserByEmail(request.email);
    if (!user) {
      // Return true for security reasons (don't reveal if email exists)
      return true;
    }

    const resetToken = generateSecureToken();
    const resetExpires = createTokenExpiration(1); // 1 hour to reset

    await db.update(users)
      .set({
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      })
      .where(eq(users.id, user.id));

    try {
      await sendPasswordResetEmail(user.email, user.businessName, resetToken);
    } catch (error) {
      console.error('Failed to send password reset email:', error);
    }

    return true;
  }

  async verifyEmail(token: string): Promise<boolean> {
    const user = await db.select().from(users)
      .where(eq(users.emailVerificationToken, token))
      .then(results => results[0]);

    if (!user || !user.emailVerificationExpires) {
      return false;
    }

    // Check if token is expired
    if (new Date() > user.emailVerificationExpires) {
      return false;
    }

    // Mark user as verified and clear verification token
    await db.update(users)
      .set({
        verified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      })
      .where(eq(users.id, user.id));

    // Send welcome email
    try {
      await sendWelcomeEmail(user.email, user.businessName);
    } catch (error) {
      console.error('Failed to send welcome email:', error);
    }

    return true;
  }

  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    const user = await db.select().from(users)
      .where(eq(users.passwordResetToken, token))
      .then(results => results[0]);

    if (!user || !user.passwordResetExpires) {
      return false;
    }

    // Check if token is expired
    if (new Date() > user.passwordResetExpires) {
      return false;
    }

    // Validate new password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      throw new Error(passwordValidation.errors.join(', '));
    }

    const hashedPassword = authHashPassword(newPassword);

    // Update password and clear reset token
    await db.update(users)
      .set({
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      })
      .where(eq(users.id, user.id));

    return true;
  }

  async resendVerificationEmail(email: string): Promise<boolean> {
    const user = await this.getUserByEmail(email);
    if (!user || user.verified) {
      return false;
    }

    const verificationToken = generateSecureToken();
    const verificationExpires = createTokenExpiration(24);

    await db.update(users)
      .set({
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
      })
      .where(eq(users.id, user.id));

    try {
      await sendVerificationEmail(user.email, user.businessName, verificationToken);
      return true;
    } catch (error) {
      console.error('Failed to resend verification email:', error);
      return false;
    }
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
        .from(businessInfo);
      return results.filter(record => record.twilioPhoneNumber !== null && record.twilioPhoneNumber !== '');
    } catch (error) {
      console.error("Error fetching business info with Twilio:", error);
      return [];
    }
  }

  async createCall(callData: InsertCall): Promise<Call> {
    try {
      // Ensure status is valid for database enum
      const validStatuses = ['completed', 'missed', 'failed'] as const;
      const statusToUse = validStatuses.includes(callData.status as any) 
        ? callData.status 
        : 'completed';

      const sanitizedCallData = {
        ...callData,
        status: statusToUse
      };

      const [call] = await db
        .insert(calls)
        .values(sanitizedCallData)
        .returning();
      return call;
    } catch (error) {
      console.error("Error creating call:", error);
      throw new Error("Failed to create call");
    }
  }

  async getAllUsers(): Promise<User[]> {
    try {
      const result = await db.select().from(users);
      return result;
    } catch (error) {
      console.error("Error getting all users:", error);
      throw new Error("Failed to get all users");
    }
  }

  async getCallsByUserId(userId: number): Promise<Call[]> {
    try {
      const result = await db.select().from(calls).where(eq(calls.userId, userId));
      return result;
    } catch (error) {
      console.error("Error getting calls by user ID:", error);
      throw new Error("Failed to get calls");
    }
  }

  // User Content Management for AI Personalization
  async addUserContent(userId: number, contentData: Omit<InsertUserContent, 'userId'>): Promise<UserContent> {
    try {
      const [content] = await db
        .insert(userContent)
        .values({
          userId,
          ...contentData
        })
        .returning();
      return content;
    } catch (error) {
      console.error("Error adding user content:", error);
      throw new Error("Failed to add user content");
    }
  }

  async getUserContent(userId: number): Promise<UserContent[]> {
    try {
      const content = await db
        .select()
        .from(userContent)
        .where(eq(userContent.userId, userId));
      return content;
    } catch (error) {
      console.error("Error fetching user content:", error);
      return [];
    }
  }

  async deleteUserContent(userId: number, contentId: number): Promise<boolean> {
    try {
      const [result] = await db
        .delete(userContent)
        .where(eq(userContent.id, contentId))
        .returning();
      return !!result;
    } catch (error) {
      console.error("Error deleting user content:", error);
      return false;
    }
  }
}

// Export an instance of DatabaseStorage instead of MemStorage
export const storage = new DatabaseStorage();
