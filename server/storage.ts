import { 
  users, 
  type User, 
  type InsertUser,
  type LoginUser,
  type ForgotPasswordRequest 
} from "@shared/schema";
import * as crypto from "crypto";
import { db } from "./db";
import { eq } from "drizzle-orm";

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
}

// Export an instance of DatabaseStorage instead of MemStorage
export const storage = new DatabaseStorage();
