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
import { validatePassword, generateSecureToken, hashPassword as authHashPassword, verifyPassword, createTokenExpiration } from "./authUtils";
import { sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail, sendEmail } from "./emailService";

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
  async updateTwilioSettings(userId: number, settings: {accountSid: string | null, authToken: string | null, phoneNumber: string | null}): Promise<any> {
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

  // Update call with recording URL
  async updateCallRecording(twilioCallSid: string, recordingUrl: string): Promise<void> {
    try {
      await db
        .update(calls)
        .set({ recordingUrl })
        .where(eq(calls.twilioCallSid, twilioCallSid));
      console.log(`Recording URL updated for call ${twilioCallSid}`);
    } catch (error) {
      console.error("Error updating call recording:", error);
      throw error;
    }
  }

  // Update call with transcript and generate intelligent summary
  async updateCallTranscript(twilioCallSid: string, transcript: string): Promise<void> {
    try {
      // Generate intelligent summary from transcript
      const summary = this.generateCallSummary(transcript);

      await db
        .update(calls)
        .set({
          transcript,
          summary
        })
        .where(eq(calls.twilioCallSid, twilioCallSid));
      console.log(`Transcript and summary updated for call ${twilioCallSid}`);
    } catch (error) {
      console.error("Error updating call transcript:", error);
      throw error;
    }
  }

  // Generate intelligent business-focused call summary from transcript
  private generateCallSummary(transcript: string): string {
    if (!transcript || transcript.length < 10) {
      return "Brief call - transcript too short for summary";
    }

    const lowerTranscript = transcript.toLowerCase();
    const summaryParts = [];

    // 1. REVENUE OPPORTUNITY DETECTION (Priority #1 for business owners)
    const revenueIndicators = this.extractRevenueIndicators(lowerTranscript);
    if (revenueIndicators.length > 0) {
      summaryParts.push(`💰 ${revenueIndicators.join(', ')}`);
    }

    // 2. DECISION MAKER & AUTHORITY LEVEL
    const decisionMaker = this.detectDecisionMaker(lowerTranscript);
    if (decisionMaker) {
      summaryParts.push(`👤 ${decisionMaker}`);
    }

    // 3. TIMELINE & URGENCY (Critical for follow-up prioritization)
    const timeline = this.extractTimeline(lowerTranscript);
    if (timeline) {
      summaryParts.push(`⏰ ${timeline}`);
    }

    // 4. PRODUCT INTEREST (More comprehensive detection)
    const products = this.detectProductInterest(lowerTranscript);
    if (products.length > 0) {
      summaryParts.push(`🎯 ${products.join(', ')}`);
    }

    // 5. LEAD QUALITY SCORE
    const leadQuality = this.assessLeadQuality(lowerTranscript);
    summaryParts.push(`📊 ${leadQuality}`);

    // 6. NEXT ACTION REQUIRED (Most actionable for business owners)
    const nextAction = this.determineNextAction(lowerTranscript);
    if (nextAction) {
      summaryParts.push(`🎬 ${nextAction}`);
    }

    // 7. COMPETITIVE INTELLIGENCE
    const competitive = this.detectCompetitiveInfo(lowerTranscript);
    if (competitive) {
      summaryParts.push(`⚡ ${competitive}`);
    }

    return summaryParts.length > 0 ? summaryParts.join(' | ') : 'General inquiry - review transcript for details';
  }

  private extractRevenueIndicators(transcript: string): string[] {
    const indicators = [];

    // Quantity detection
    const quantityMatches = transcript.match(/(\d+)\s*(hundred|thousand|pieces|units|dozen)/gi);
    if (quantityMatches) {
      indicators.push(`Large order: ${quantityMatches[0]}`);
    }

    // Budget mentions
    const budgetMatches = transcript.match(/\$\d+|\d+\s*dollars?|\d+k|\d+\s*thousand/gi);
    if (budgetMatches) {
      indicators.push(`Budget: ${budgetMatches[0]}`);
    }

    // High-value signals
    if (transcript.includes('bulk') || transcript.includes('wholesale') || transcript.includes('volume')) {
      indicators.push('Bulk order potential');
    }
    if (transcript.includes('annual') || transcript.includes('yearly') || transcript.includes('contract')) {
      indicators.push('Recurring business opportunity');
    }

    return indicators;
  }

  private detectDecisionMaker(transcript: string): string | null {
    if (transcript.includes('owner') || transcript.includes('ceo') || transcript.includes('president')) {
      return 'Decision maker (Owner/Executive)';
    }
    if (transcript.includes('manager') || transcript.includes('director') || transcript.includes('supervisor')) {
      return 'Management level';
    }
    if (transcript.includes('purchasing') || transcript.includes('procurement') || transcript.includes('buyer')) {
      return 'Purchasing authority';
    }
    if (transcript.includes('need to check with') || transcript.includes('ask my boss') || transcript.includes('approval')) {
      return 'Needs approval from higher-up';
    }
    return null;
  }

  private extractTimeline(transcript: string): string | null {
    if (transcript.includes('today') || transcript.includes('right now') || transcript.includes('immediately')) {
      return 'IMMEDIATE NEED';
    }
    if (transcript.includes('this week') || transcript.includes('urgent') || transcript.includes('asap')) {
      return 'Urgent - This week';
    }
    if (transcript.includes('next week') || transcript.includes('soon')) {
      return 'Soon - Next week';
    }
    if (transcript.includes('next month') || transcript.includes('by the end of')) {
      return 'Next month timeline';
    }
    if (transcript.includes('planning ahead') || transcript.includes('future') || transcript.includes('eventually')) {
      return 'Future planning';
    }
    return null;
  }

  private detectProductInterest(transcript: string): string[] {
    const products = [];

    // Apparel
    if (transcript.match(/shirt|t-shirt|polo|hoodie|jacket|uniform|apparel|clothing/i)) {
      products.push('Custom Apparel');
    }
    // Drinkware
    if (transcript.match(/mug|cup|bottle|tumbler|drinkware|beverage/i)) {
      products.push('Drinkware');
    }
    // Promotional items
    if (transcript.match(/pen|keychain|magnet|calendar|promotional|giveaway|swag/i)) {
      products.push('Promotional Items');
    }
    // Bags
    if (transcript.match(/bag|tote|backpack|duffel|briefcase/i)) {
      products.push('Bags');
    }
    // Tech accessories
    if (transcript.match(/usb|charger|speaker|tech|electronics|power bank/i)) {
      products.push('Tech Accessories');
    }
    // Awards & Recognition
    if (transcript.match(/trophy|plaque|award|recognition|crystal|medal/i)) {
      products.push('Awards & Recognition');
    }

    return products;
  }

  private assessLeadQuality(transcript: string): string {
    let score = 0;
    const factors = [];

    // Positive indicators
    if (transcript.includes('ready to order') || transcript.includes('want to buy')) {
      score += 3;
      factors.push('Ready to buy');
    }
    if (transcript.includes('budget') || transcript.includes('price is fine') || transcript.includes('approved')) {
      score += 2;
      factors.push('Budget confirmed');
    }
    if (transcript.includes('deadline') || transcript.includes('event') || transcript.includes('date')) {
      score += 2;
      factors.push('Time-sensitive');
    }
    if (transcript.includes('recommend') || transcript.includes('referred')) {
      score += 2;
      factors.push('Referral');
    }
    if (transcript.includes('repeat customer') || transcript.includes('ordered before')) {
      score += 2;
      factors.push('Repeat customer');
    }

    // Negative indicators
    if (transcript.includes('just looking') || transcript.includes('just browsing')) {
      score -= 1;
      factors.push('Just browsing');
    }
    if (transcript.includes('expensive') || transcript.includes('too much') || transcript.includes('cheaper')) {
      score -= 1;
      factors.push('Price sensitive');
    }

    // Determine quality level
    if (score >= 5) return `HOT Lead (${factors.join(', ')})`;
    if (score >= 3) return `WARM Lead (${factors.join(', ')})`;
    if (score >= 1) return `COLD Lead (${factors.join(', ')})`;
    return 'Information gathering stage';
  }

  private determineNextAction(transcript: string): string | null {
    if (transcript.includes('send quote') || transcript.includes('get pricing') || transcript.includes('proposal')) {
      return 'ACTION: Send quote/proposal';
    }
    if (transcript.includes('call back') || transcript.includes('follow up') || transcript.includes('check back')) {
      return 'ACTION: Schedule follow-up call';
    }
    if (transcript.includes('email') || transcript.includes('send info') || transcript.includes('catalog')) {
      return 'ACTION: Send information/catalog';
    }
    if (transcript.includes('samples') || transcript.includes('see examples') || transcript.includes('mock up')) {
      return 'ACTION: Provide samples/mockups';
    }
    if (transcript.includes('ready to order') || transcript.includes('place order')) {
      return 'ACTION: Process order immediately';
    }
    if (transcript.includes('meeting') || transcript.includes('visit') || transcript.includes('appointment')) {
      return 'ACTION: Schedule in-person meeting';
    }
    return null;
  }

  private detectCompetitiveInfo(transcript: string): string | null {
    if (transcript.includes('competitor') || transcript.includes('other company') || transcript.includes('comparing')) {
      return 'Shopping competitors';
    }
    if (transcript.includes('better price') || transcript.includes('beat') || transcript.includes('match')) {
      return 'Price comparison request';
    }
    if (transcript.includes('unhappy with') || transcript.includes('switching from') || transcript.includes('problems with')) {
      return 'Switching from competitor';
    }
    return null;
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

      const [newCall] = await db
        .insert(calls)
        .values(sanitizedCallData)
        .returning();

      // Send email notification to the user for the call
      try {
        const user = await this.getUser(callData.userId); // Assuming getUser takes userId
        if (user && user.email) {
          await this.sendCallNotificationEmail(user, newCall);
        }
      } catch (error) {
        console.error("Failed to send call notification email:", error);
        // Don't fail the call creation if email fails
      }

      return newCall;
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

  // API Key management
  async generateApiKey(userId: number): Promise<string> {
    const apiKey = crypto.randomBytes(32).toString('hex');
    const hashedKey = await bcrypt.hash(apiKey, 10);

    await db.update(users)
      .set({ apiKey: hashedKey })
      .where(eq(users.id, userId));

    return apiKey;
  },

  async sendCallNotificationEmail(user: User, call: Call): Promise<void> {
    const callDuration = call.duration
      ? `${Math.floor(call.duration / 60)}m ${call.duration % 60}s`
      : 'Unknown duration';

    const callDirection = call.direction === 'inbound' ? 'Incoming' : 'Outgoing';
    const callStatus = call.status?.toUpperCase() || 'UNKNOWN';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>New Call Activity - Sky IQ</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; background: #f9fafb; }
          .call-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
          .detail-label { font-weight: bold; color: #666; }
          .status-completed { color: #059669; font-weight: bold; }
          .status-missed { color: #dc2626; font-weight: bold; }
          .status-failed { color: #dc2626; font-weight: bold; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📞 New Call Activity</h1>
          </div>
          <div class="content">
            <h2>Hi ${user.businessName || user.email},</h2>
            <p>You have new call activity on your Sky IQ account:</p>

            <div class="call-details">
              <h3>Call Details</h3>
              <div class="detail-row">
                <span class="detail-label">Direction:</span>
                <span>${callDirection} Call</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Phone Number:</span>
                <span>${call.phoneNumber || 'Unknown'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Contact:</span>
                <span>${call.contactName || 'Unknown Caller'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Duration:</span>
                <span>${callDuration}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Status:</span>
                <span class="status-${call.status}">${callStatus}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Time:</span>
                <span>${call.createdAt ? new Date(call.createdAt).toLocaleString() : 'Unknown'}</span>
              </div>
              ${call.summary ? `
              <div class="detail-row">
                <span class="detail-label">Summary:</span>
                <span>${call.summary}</span>
              </div>
              ` : ''}
              ${call.notes ? `
              <div class="detail-row">
                <span class="detail-label">Notes:</span>
                <span>${call.notes}</span>
              </div>
              ` : ''}
            </div>

            <p>You can view more details and manage your calls in your Sky IQ dashboard.</p>
            <p>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5000'}/call-dashboard"
                 style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0;">
                View Call Dashboard
              </a>
            </p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Sky IQ. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      New Call Activity - Sky IQ

      Hi ${user.businessName || user.email},

      You have new call activity on your Sky IQ account:

      Call Details:
      - Direction: ${callDirection} Call
      - Phone Number: ${call.phoneNumber || 'Unknown'}
      - Contact: ${call.contactName || 'Unknown Caller'}
      - Duration: ${callDuration}
      - Status: ${callStatus}
      - Time: ${call.createdAt ? new Date(call.createdAt).toLocaleString() : 'Unknown'}
      ${call.summary ? `- Summary: ${call.summary}` : ''}
      ${call.notes ? `- Notes: ${call.notes}` : ''}

      View your call dashboard: ${process.env.FRONTEND_URL || 'http://localhost:5000'}/call-dashboard

      © ${new Date().getFullYear()} Sky IQ. All rights reserved.
    `;

    const subject = `📞 ${callDirection} Call ${callStatus} - ${call.phoneNumber || 'Unknown Number'}`;

    await sendEmail({
      to: user.email,
      toName: user.businessName || user.email,
      subject,
      html,
      text
    });
  },

  async validateApiKey(apiKey: string): Promise<User | null> {
    try {
      const [user] = await db.select().from(users).where(eq(users.apiKey, apiKey));

      if (user) {
        // Update last used timestamp
        await db
          .update(users)
          .set({ apiKeyLastUsed: new Date() })
          .where(eq(users.id, user.id));
      }

      return user || null;
    } catch (error) {
      console.error("Error validating API key:", error);
      return null;
    }
  }

  async revokeApiKey(userId: number): Promise<void> {
    try {
      await db
        .update(users)
        .set({
          apiKey: null,
          apiKeyCreatedAt: null,
          apiKeyLastUsed: null
        })
        .where(eq(users.id, userId));
    } catch (error) {
      console.error("Error revoking API key:", error);
      throw new Error("Failed to revoke API key");
    }
  }

}

// Export an instance of DatabaseStorage instead of MemStorage
export const storage = new DatabaseStorage();