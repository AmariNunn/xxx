import { 
  users, 
  type User, 
  type InsertUser,
  type LoginUser,
  type ForgotPasswordRequest 
} from "@shared/schema";
import * as crypto from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  validateUserCredentials(credentials: LoginUser): Promise<User | undefined>;
  requestPasswordReset(request: ForgotPasswordRequest): Promise<boolean>;
}

// Helper function to hash passwords
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  currentId: number;

  constructor() {
    this.users = new Map();
    this.currentId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email.toLowerCase() === email.toLowerCase(),
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const existingUser = await this.getUserByEmail(insertUser.email);
    if (existingUser) {
      throw new Error("User with this email already exists");
    }

    const id = this.currentId++;
    // Hash the password before saving
    const hashedPassword = hashPassword(insertUser.password);
    
    const user: User = { 
      ...insertUser, 
      id, 
      password: hashedPassword,
      verified: false,
      website: insertUser.website || null
    };
    
    this.users.set(id, user);
    return user;
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

export const storage = new MemStorage();
