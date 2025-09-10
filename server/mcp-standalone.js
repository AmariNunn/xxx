var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  businessInfo: () => businessInfo,
  businessInfoRelations: () => businessInfoRelations,
  callStatusEnum: () => callStatusEnum,
  calls: () => calls,
  callsRelations: () => callsRelations,
  documentChunks: () => documentChunks,
  documentChunksRelations: () => documentChunksRelations,
  documents: () => documents,
  documentsRelations: () => documentsRelations,
  elevenLabsConversations: () => elevenLabsConversations,
  elevenLabsConversationsRelations: () => elevenLabsConversationsRelations,
  forgotPasswordSchema: () => forgotPasswordSchema,
  insertCallSchema: () => insertCallSchema,
  insertDocumentChunkSchema: () => insertDocumentChunkSchema,
  insertDocumentSchema: () => insertDocumentSchema,
  insertElevenLabsConversationSchema: () => insertElevenLabsConversationSchema,
  insertLeadSchema: () => insertLeadSchema,
  insertSearchQuerySchema: () => insertSearchQuerySchema,
  insertUserSchema: () => insertUserSchema,
  leads: () => leads,
  leadsRelations: () => leadsRelations,
  loginUserSchema: () => loginUserSchema,
  searchQueries: () => searchQueries,
  searchQueriesRelations: () => searchQueriesRelations,
  servicePlanEnum: () => servicePlanEnum,
  upsertBusinessInfoSchema: () => upsertBusinessInfoSchema,
  users: () => users,
  usersRelations: () => usersRelations
});
import { pgTable, text, serial, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";
var servicePlanEnum, callStatusEnum, users, calls, leads, businessInfo, usersRelations, callsRelations, leadsRelations, businessInfoRelations, insertUserSchema, insertCallSchema, insertLeadSchema, upsertBusinessInfoSchema, loginUserSchema, forgotPasswordSchema, documents, documentChunks, searchQueries, documentsRelations, documentChunksRelations, searchQueriesRelations, insertDocumentSchema, insertDocumentChunkSchema, insertSearchQuerySchema, elevenLabsConversations, elevenLabsConversationsRelations, insertElevenLabsConversationSchema;
var init_schema = __esm({
  "shared/schema.ts"() {
    "use strict";
    servicePlanEnum = pgEnum("service_plan_enum", ["inbound", "outbound", "both"]);
    callStatusEnum = pgEnum("call_status_enum", ["completed", "missed", "failed"]);
    users = pgTable("users", {
      id: serial("id").primaryKey(),
      email: text("email").notNull().unique(),
      password: text("password").notNull(),
      businessName: text("business_name").notNull(),
      phoneNumber: text("phone_number").notNull(),
      website: text("website"),
      servicePlan: servicePlanEnum("service_plan").notNull(),
      verified: boolean("verified").default(false),
      emailVerificationToken: text("email_verification_token"),
      emailVerificationExpires: timestamp("email_verification_expires"),
      passwordResetToken: text("password_reset_token"),
      passwordResetExpires: timestamp("password_reset_expires"),
      apiKey: text("api_key").unique(),
      apiKeyCreatedAt: timestamp("api_key_created_at"),
      apiKeyLastUsed: timestamp("api_key_last_used"),
      createdAt: timestamp("created_at").defaultNow()
    });
    calls = pgTable("calls", {
      id: serial("id").primaryKey(),
      userId: integer("user_id").notNull().references(() => users.id),
      phoneNumber: text("phone_number").notNull(),
      contactName: text("contact_name"),
      duration: integer("duration"),
      // Duration in seconds
      status: callStatusEnum("status").notNull(),
      notes: text("notes"),
      summary: text("summary"),
      transcript: text("transcript"),
      // Full conversation transcript
      twilioCallSid: text("twilio_call_sid"),
      // Twilio unique call identifier
      direction: text("direction"),
      // inbound or outbound
      recordingUrl: text("recording_url"),
      // URL to call recording if available
      isFromTwilio: boolean("is_from_twilio").default(false),
      // Track if call came from Twilio webhook
      createdAt: timestamp("created_at").defaultNow()
    });
    leads = pgTable("leads", {
      id: serial("id").primaryKey(),
      userId: integer("user_id").notNull().references(() => users.id),
      name: text("name").notNull(),
      phoneNumber: text("phone_number").notNull(),
      email: text("email"),
      company: text("company"),
      notes: text("notes"),
      createdAt: timestamp("created_at").defaultNow()
    });
    businessInfo = pgTable("business_info", {
      id: serial("id").primaryKey(),
      userId: integer("user_id").notNull().references(() => users.id).unique(),
      businessName: text("business_name"),
      businessEmail: text("business_email"),
      businessPhone: text("business_phone"),
      businessAddress: text("business_address"),
      description: text("description"),
      links: text("links").array(),
      fileUrls: text("file_urls").array(),
      fileNames: text("file_names").array(),
      fileTypes: text("file_types").array(),
      fileSizes: text("file_sizes").array(),
      leadUrls: text("lead_urls").array(),
      leadNames: text("lead_names").array(),
      leadTypes: text("lead_types").array(),
      leadSizes: text("lead_sizes").array(),
      logoUrl: text("logo_url"),
      twilioAccountSid: text("twilio_account_sid"),
      twilioAuthToken: text("twilio_auth_token"),
      twilioPhoneNumber: text("twilio_phone_number"),
      elevenLabsApiKey: text("eleven_labs_api_key"),
      elevenLabsAgentId: text("eleven_labs_agent_id"),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    usersRelations = relations(users, ({ many }) => ({
      calls: many(calls),
      leads: many(leads),
      businessInfo: many(businessInfo),
      elevenLabsConversations: many(elevenLabsConversations)
    }));
    callsRelations = relations(calls, ({ one }) => ({
      user: one(users, {
        fields: [calls.userId],
        references: [users.id]
      })
    }));
    leadsRelations = relations(leads, ({ one }) => ({
      user: one(users, {
        fields: [leads.userId],
        references: [users.id]
      })
    }));
    businessInfoRelations = relations(businessInfo, ({ one }) => ({
      user: one(users, {
        fields: [businessInfo.userId],
        references: [users.id]
      })
    }));
    insertUserSchema = createInsertSchema(users).omit({
      id: true,
      verified: true,
      createdAt: true,
      emailVerificationToken: true,
      emailVerificationExpires: true,
      passwordResetToken: true,
      passwordResetExpires: true
    });
    insertCallSchema = createInsertSchema(calls).omit({ id: true, createdAt: true });
    insertLeadSchema = createInsertSchema(leads).omit({ id: true, createdAt: true });
    upsertBusinessInfoSchema = createInsertSchema(businessInfo).omit({ id: true, updatedAt: true });
    loginUserSchema = z.object({
      email: z.string().email(),
      password: z.string()
    });
    forgotPasswordSchema = z.object({
      email: z.string().email()
    });
    documents = pgTable("documents", {
      id: serial("id").primaryKey(),
      userId: integer("user_id").notNull().references(() => users.id),
      sourceType: text("source_type").notNull(),
      // "file" or "link"
      sourceUrl: text("source_url").notNull(),
      // Original file URL or web link
      title: text("title").notNull(),
      contentType: text("content_type"),
      // MIME type for files, "webpage" for links
      fileSize: integer("file_size"),
      // Size in bytes for files
      extractedText: text("extracted_text"),
      // Full extracted text content
      status: text("status").notNull().default("pending"),
      // "pending", "processing", "completed", "failed"
      errorMessage: text("error_message"),
      // Error details if processing failed
      processedAt: timestamp("processed_at"),
      createdAt: timestamp("created_at").defaultNow()
    });
    documentChunks = pgTable("document_chunks", {
      id: serial("id").primaryKey(),
      documentId: integer("document_id").notNull().references(() => documents.id),
      userId: integer("user_id").notNull().references(() => users.id),
      chunkIndex: integer("chunk_index").notNull(),
      // Order within the document
      content: text("content").notNull(),
      // Chunk text content
      wordCount: integer("word_count").notNull(),
      summary: text("summary"),
      // AI-generated summary of chunk
      keywords: text("keywords").array(),
      // Extracted keywords for search
      createdAt: timestamp("created_at").defaultNow()
    });
    searchQueries = pgTable("search_queries", {
      id: serial("id").primaryKey(),
      userId: integer("user_id").notNull().references(() => users.id),
      query: text("query").notNull(),
      resultsCount: integer("results_count").notNull(),
      responseTime: integer("response_time"),
      // Response time in milliseconds
      createdAt: timestamp("created_at").defaultNow()
    });
    documentsRelations = relations(documents, ({ one, many }) => ({
      user: one(users, {
        fields: [documents.userId],
        references: [users.id]
      }),
      chunks: many(documentChunks)
    }));
    documentChunksRelations = relations(documentChunks, ({ one }) => ({
      document: one(documents, {
        fields: [documentChunks.documentId],
        references: [documents.id]
      }),
      user: one(users, {
        fields: [documentChunks.userId],
        references: [users.id]
      })
    }));
    searchQueriesRelations = relations(searchQueries, ({ one }) => ({
      user: one(users, {
        fields: [searchQueries.userId],
        references: [users.id]
      })
    }));
    insertDocumentSchema = createInsertSchema(documents).omit({
      id: true,
      createdAt: true,
      processedAt: true
    });
    insertDocumentChunkSchema = createInsertSchema(documentChunks).omit({
      id: true,
      createdAt: true
    });
    insertSearchQuerySchema = createInsertSchema(searchQueries).omit({
      id: true,
      createdAt: true
    });
    elevenLabsConversations = pgTable("eleven_labs_conversations", {
      id: serial("id").primaryKey(),
      userId: integer("user_id").notNull().references(() => users.id),
      conversationId: text("conversation_id").notNull(),
      // ElevenLabs conversation ID
      agentId: text("agent_id").notNull(),
      // ElevenLabs agent ID
      status: text("status").notNull(),
      // conversation status from ElevenLabs
      startTime: timestamp("start_time"),
      endTime: timestamp("end_time"),
      duration: integer("duration"),
      // Duration in seconds
      transcript: text("transcript"),
      // Full conversation transcript
      summary: text("summary"),
      // AI-generated summary
      metadata: text("metadata"),
      // JSON string with additional data
      phoneNumber: text("phone_number"),
      // Caller's phone number if available
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    elevenLabsConversationsRelations = relations(elevenLabsConversations, ({ one }) => ({
      user: one(users, {
        fields: [elevenLabsConversations.userId],
        references: [users.id]
      })
    }));
    insertElevenLabsConversationSchema = createInsertSchema(elevenLabsConversations).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
  }
});

// server/db.ts
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
var pool, db;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    neonConfig.webSocketConstructor = ws;
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL must be set. Did you forget to provision a database?"
      );
    }
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzle({ client: pool, schema: schema_exports });
  }
});

// server/authUtils.ts
import crypto from "crypto";
function validatePassword(password) {
  const errors = [];
  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    errors.push(`Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters long`);
  }
  if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (PASSWORD_REQUIREMENTS.requireNumbers && !/\d/.test(password)) {
    errors.push("Password must contain at least one number");
  }
  if (PASSWORD_REQUIREMENTS.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*(),.?":{}|<>)');
  }
  return {
    isValid: errors.length === 0,
    errors
  };
}
function generateSecureToken() {
  return crypto.randomBytes(32).toString("hex");
}
function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}
function verifyPassword(password, hashedPassword) {
  const hashedInput = crypto.createHash("sha256").update(password).digest("hex");
  return hashedInput === hashedPassword;
}
function createTokenExpiration(hours = 24) {
  const expiration = /* @__PURE__ */ new Date();
  expiration.setHours(expiration.getHours() + hours);
  return expiration;
}
var PASSWORD_REQUIREMENTS;
var init_authUtils = __esm({
  "server/authUtils.ts"() {
    "use strict";
    PASSWORD_REQUIREMENTS = {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true
    };
  }
});

// server/emailService.ts
async function sendEmail(options) {
  try {
    const emailData = {
      from: {
        email: SENDER_EMAIL,
        name: SENDER_NAME
      },
      to: [
        {
          email: options.to,
          name: options.toName || "User"
        }
      ],
      subject: options.subject,
      html: options.html,
      text: options.text || ""
    };
    console.log(`Sending email to ${options.to} via MailerSend...`);
    const response = await fetch(MAILERSEND_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
        "Authorization": `Bearer ${process.env.MAILERSEND_API_TOKEN}`
      },
      body: JSON.stringify(emailData)
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error("MailerSend API error:", response.status, errorText);
      return false;
    }
    console.log(`Email sent successfully to ${options.to} (Status: ${response.status})`);
    return true;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}
async function sendVerificationEmail(email, name, verificationToken) {
  const verificationUrl = `${process.env.FRONTEND_URL || "http://localhost:5000"}/verify-email?token=${verificationToken}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Verify Your Sky IQ Account</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px 20px; background: #f9fafb; }
        .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to Sky IQ</h1>
        </div>
        <div class="content">
          <h2>Hi ${name},</h2>
          <p>Thank you for signing up for Sky IQ! To complete your registration and start managing your AI call intelligence, please verify your email address.</p>
          <p>
            <a href="${verificationUrl}" class="button">Verify Email Address</a>
          </p>
          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p><a href="${verificationUrl}">${verificationUrl}</a></p>
          <p>This verification link will expire in 24 hours.</p>
          <p>If you didn't create an account with Sky IQ, please ignore this email.</p>
        </div>
        <div class="footer">
          <p>&copy; ${(/* @__PURE__ */ new Date()).getFullYear()} Sky IQ. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  const text2 = `
    Welcome to Sky IQ!
    
    Hi ${name},
    
    Thank you for signing up for Sky IQ! To complete your registration, please verify your email address by clicking the link below:
    
    ${verificationUrl}
    
    This verification link will expire in 24 hours.
    
    If you didn't create an account with Sky IQ, please ignore this email.
    
    \xA9 ${(/* @__PURE__ */ new Date()).getFullYear()} Sky IQ. All rights reserved.
  `;
  return sendEmail({
    to: email,
    toName: name,
    subject: "Verify Your Sky IQ Account",
    html,
    text: text2
  });
}
async function sendPasswordResetEmail(email, name, resetToken) {
  const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:5000"}/reset-password?token=${resetToken}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Reset Your Sky IQ Password</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px 20px; background: #f9fafb; }
        .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Reset Your Password</h1>
        </div>
        <div class="content">
          <h2>Hi ${name},</h2>
          <p>You requested to reset your Sky IQ password. Click the button below to create a new password:</p>
          <p>
            <a href="${resetUrl}" class="button">Reset Password</a>
          </p>
          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p><a href="${resetUrl}">${resetUrl}</a></p>
          <p>This reset link will expire in 1 hour for security reasons.</p>
          <p>If you didn't request a password reset, please ignore this email and your password will remain unchanged.</p>
        </div>
        <div class="footer">
          <p>&copy; ${(/* @__PURE__ */ new Date()).getFullYear()} Sky IQ. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  const text2 = `
    Reset Your Sky IQ Password
    
    Hi ${name},
    
    You requested to reset your Sky IQ password. Click the link below to create a new password:
    
    ${resetUrl}
    
    This reset link will expire in 1 hour for security reasons.
    
    If you didn't request a password reset, please ignore this email and your password will remain unchanged.
    
    \xA9 ${(/* @__PURE__ */ new Date()).getFullYear()} Sky IQ. All rights reserved.
  `;
  return sendEmail({
    to: email,
    toName: name,
    subject: "Reset Your Sky IQ Password",
    html,
    text: text2
  });
}
async function sendWelcomeEmail(email, name) {
  const loginUrl = `${process.env.FRONTEND_URL || "http://localhost:5000"}/login`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Welcome to Sky IQ</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px 20px; background: #f9fafb; }
        .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
        .feature { margin: 15px 0; padding: 10px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to Sky IQ!</h1>
        </div>
        <div class="content">
          <h2>Hi ${name},</h2>
          <p>Your Sky IQ account has been successfully verified! You're now ready to start using our AI call intelligence platform.</p>
          
          <h3>What you can do now:</h3>
          <div class="feature">\u{1F4DE} Set up your business profile and call preferences</div>
          <div class="feature">\u{1F4CA} Track and analyze your phone conversations</div>
          <div class="feature">\u{1F916} Connect with Railway AI for automated call handling</div>
          <div class="feature">\u{1F4C8} View detailed call analytics and reports</div>
          
          <p>
            <a href="${loginUrl}" class="button">Get Started</a>
          </p>
          
          <p>If you have any questions or need help getting started, feel free to reach out to our support team.</p>
        </div>
        <div class="footer">
          <p>&copy; ${(/* @__PURE__ */ new Date()).getFullYear()} Sky IQ. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  return sendEmail({
    to: email,
    toName: name,
    subject: "Welcome to Sky IQ - You're All Set!",
    html
  });
}
var MAILERSEND_API_URL, SENDER_EMAIL, SENDER_NAME;
var init_emailService = __esm({
  "server/emailService.ts"() {
    "use strict";
    if (!process.env.MAILERSEND_API_TOKEN) {
      throw new Error("MAILERSEND_API_TOKEN environment variable must be set");
    }
    MAILERSEND_API_URL = "https://api.mailersend.com/v1/email";
    SENDER_EMAIL = "info@skyiq.app";
    SENDER_NAME = "Sky IQ";
  }
});

// server/storage.ts
import { eq } from "drizzle-orm";
var DatabaseStorage, storage;
var init_storage = __esm({
  "server/storage.ts"() {
    "use strict";
    init_schema();
    init_db();
    init_authUtils();
    init_emailService();
    DatabaseStorage = class {
      async getUser(id) {
        const result = await db.select().from(users).where(eq(users.id, id));
        return result[0];
      }
      async getUserByEmail(email) {
        const result = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
        return result[0];
      }
      async createUser(insertUser) {
        const existingUser = await this.getUserByEmail(insertUser.email);
        if (existingUser) {
          throw new Error("User with this email already exists");
        }
        const passwordValidation = validatePassword(insertUser.password);
        if (!passwordValidation.isValid) {
          throw new Error(passwordValidation.errors.join(", "));
        }
        const hashedPassword = hashPassword(insertUser.password);
        const verificationToken = generateSecureToken();
        const verificationExpires = createTokenExpiration(24);
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
        try {
          await sendVerificationEmail(newUser.email, newUser.businessName, verificationToken);
        } catch (error) {
          console.error("Failed to send verification email:", error);
        }
        return newUser;
      }
      async validateUserCredentials(credentials) {
        const user = await this.getUserByEmail(credentials.email);
        if (!user) {
          return void 0;
        }
        if (!verifyPassword(credentials.password, user.password)) {
          return void 0;
        }
        return user;
      }
      async requestPasswordReset(request) {
        const user = await this.getUserByEmail(request.email);
        if (!user) {
          return true;
        }
        const resetToken = generateSecureToken();
        const resetExpires = createTokenExpiration(1);
        await db.update(users).set({
          passwordResetToken: resetToken,
          passwordResetExpires: resetExpires
        }).where(eq(users.id, user.id));
        try {
          await sendPasswordResetEmail(user.email, user.businessName, resetToken);
        } catch (error) {
          console.error("Failed to send password reset email:", error);
        }
        return true;
      }
      async verifyEmail(token) {
        const user = await db.select().from(users).where(eq(users.emailVerificationToken, token)).then((results) => results[0]);
        if (!user || !user.emailVerificationExpires) {
          return false;
        }
        if (/* @__PURE__ */ new Date() > user.emailVerificationExpires) {
          return false;
        }
        await db.update(users).set({
          verified: true,
          emailVerificationToken: null,
          emailVerificationExpires: null
        }).where(eq(users.id, user.id));
        try {
          await sendWelcomeEmail(user.email, user.businessName);
        } catch (error) {
          console.error("Failed to send welcome email:", error);
        }
        return true;
      }
      async resetPassword(token, newPassword) {
        const user = await db.select().from(users).where(eq(users.passwordResetToken, token)).then((results) => results[0]);
        if (!user || !user.passwordResetExpires) {
          return false;
        }
        if (/* @__PURE__ */ new Date() > user.passwordResetExpires) {
          return false;
        }
        const passwordValidation = validatePassword(newPassword);
        if (!passwordValidation.isValid) {
          throw new Error(passwordValidation.errors.join(", "));
        }
        const hashedPassword = hashPassword(newPassword);
        await db.update(users).set({
          password: hashedPassword,
          passwordResetToken: null,
          passwordResetExpires: null
        }).where(eq(users.id, user.id));
        return true;
      }
      async resendVerificationEmail(email) {
        const user = await this.getUserByEmail(email);
        if (!user || user.verified) {
          return false;
        }
        const verificationToken = generateSecureToken();
        const verificationExpires = createTokenExpiration(24);
        await db.update(users).set({
          emailVerificationToken: verificationToken,
          emailVerificationExpires: verificationExpires
        }).where(eq(users.id, user.id));
        try {
          await sendVerificationEmail(user.email, user.businessName, verificationToken);
          return true;
        } catch (error) {
          console.error("Failed to resend verification email:", error);
          return false;
        }
      }
      // Business info operations
      async getBusinessInfo(userId) {
        try {
          const result = await db.select().from(businessInfo).where(eq(businessInfo.userId, userId));
          return result[0];
        } catch (error) {
          console.error("Error getting business info:", error);
          return void 0;
        }
      }
      async updateBusinessInfo(userId, data) {
        try {
          const existingInfo = await this.getBusinessInfo(userId);
          if (existingInfo) {
            const result = await db.update(businessInfo).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(businessInfo.userId, userId)).returning();
            return result[0];
          } else {
            const result = await db.insert(businessInfo).values({ userId, ...data }).returning();
            return result[0];
          }
        } catch (error) {
          console.error("Error updating business info:", error);
          throw new Error("Failed to update business info");
        }
      }
      async addBusinessLink(userId, link) {
        try {
          const info = await this.getBusinessInfo(userId);
          if (info) {
            const links = info.links || [];
            const updatedLinks = [...links, link];
            const result = await db.update(businessInfo).set({
              links: updatedLinks,
              updatedAt: /* @__PURE__ */ new Date()
            }).where(eq(businessInfo.userId, userId)).returning();
            return result[0];
          } else {
            const result = await db.insert(businessInfo).values({
              userId,
              links: [link]
            }).returning();
            return result[0];
          }
        } catch (error) {
          console.error("Error adding business link:", error);
          throw new Error("Failed to add link");
        }
      }
      async removeBusinessLink(userId, index) {
        try {
          const info = await this.getBusinessInfo(userId);
          if (!info || !info.links || index >= info.links.length) {
            throw new Error("Link not found");
          }
          const updatedLinks = [...info.links];
          updatedLinks.splice(index, 1);
          const result = await db.update(businessInfo).set({
            links: updatedLinks,
            updatedAt: /* @__PURE__ */ new Date()
          }).where(eq(businessInfo.userId, userId)).returning();
          return result[0];
        } catch (error) {
          console.error("Error removing business link:", error);
          throw new Error("Failed to remove link");
        }
      }
      async addBusinessFile(userId, fileData) {
        try {
          const info = await this.getBusinessInfo(userId);
          const { fileName, fileType, fileUrl, fileSize = "Unknown" } = fileData;
          if (info) {
            const fileNames = info.fileNames || [];
            const fileTypes = info.fileTypes || [];
            const fileUrls = info.fileUrls || [];
            const fileSizes = info.fileSizes || [];
            const result = await db.update(businessInfo).set({
              fileNames: [...fileNames, fileName],
              fileTypes: [...fileTypes, fileType],
              fileUrls: [...fileUrls, fileUrl],
              fileSizes: [...fileSizes, fileSize],
              updatedAt: /* @__PURE__ */ new Date()
            }).where(eq(businessInfo.userId, userId)).returning();
            return result[0];
          } else {
            const result = await db.insert(businessInfo).values({
              userId,
              fileNames: [fileName],
              fileTypes: [fileType],
              fileUrls: [fileUrl],
              fileSizes: [fileSize]
            }).returning();
            return result[0];
          }
        } catch (error) {
          console.error("Error adding business file:", error);
          throw new Error("Failed to add file");
        }
      }
      async removeBusinessFile(userId, index) {
        try {
          const info = await this.getBusinessInfo(userId);
          if (!info || !info.fileNames || index >= info.fileNames.length) {
            throw new Error("File not found");
          }
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
          const result = await db.update(businessInfo).set({
            fileNames,
            fileTypes,
            fileUrls,
            fileSizes,
            updatedAt: /* @__PURE__ */ new Date()
          }).where(eq(businessInfo.userId, userId)).returning();
          return result[0];
        } catch (error) {
          console.error("Error removing business file:", error);
          throw new Error("Failed to remove file");
        }
      }
      async updateBusinessDescription(userId, description) {
        try {
          const info = await this.getBusinessInfo(userId);
          if (info) {
            const result = await db.update(businessInfo).set({
              description,
              updatedAt: /* @__PURE__ */ new Date()
            }).where(eq(businessInfo.userId, userId)).returning();
            return result[0];
          } else {
            const result = await db.insert(businessInfo).values({
              userId,
              description
            }).returning();
            return result[0];
          }
        } catch (error) {
          console.error("Error updating business description:", error);
          throw new Error("Failed to update description");
        }
      }
      async updateBusinessProfile(userId, profileData) {
        try {
          return await this.updateBusinessInfo(userId, profileData);
        } catch (error) {
          console.error("Error updating business profile:", error);
          throw new Error("Failed to update profile");
        }
      }
      async updateBusinessLogo(userId, logoUrl) {
        try {
          const info = await this.getBusinessInfo(userId);
          if (info) {
            const result = await db.update(businessInfo).set({
              logoUrl,
              updatedAt: /* @__PURE__ */ new Date()
            }).where(eq(businessInfo.userId, userId)).returning();
            return result[0];
          } else {
            const result = await db.insert(businessInfo).values({
              userId,
              logoUrl
            }).returning();
            return result[0];
          }
        } catch (error) {
          console.error("Error updating business logo:", error);
          throw new Error("Failed to update logo");
        }
      }
      // Twilio integration methods
      async updateTwilioSettings(userId, settings) {
        try {
          const info = await this.getBusinessInfo(userId);
          if (info) {
            const result = await db.update(businessInfo).set({
              twilioAccountSid: settings.accountSid,
              twilioAuthToken: settings.authToken,
              twilioPhoneNumber: settings.phoneNumber,
              updatedAt: /* @__PURE__ */ new Date()
            }).where(eq(businessInfo.userId, userId)).returning();
            return result[0];
          } else {
            const result = await db.insert(businessInfo).values({
              userId,
              twilioAccountSid: settings.accountSid,
              twilioAuthToken: settings.authToken,
              twilioPhoneNumber: settings.phoneNumber
            }).returning();
            return result[0];
          }
        } catch (error) {
          console.error("Error updating Twilio settings:", error);
          throw new Error("Failed to update Twilio settings");
        }
      }
      async getAllBusinessInfoWithTwilio() {
        try {
          const results = await db.select().from(businessInfo);
          return results.filter((record) => record.twilioPhoneNumber !== null && record.twilioPhoneNumber !== "");
        } catch (error) {
          console.error("Error fetching business info with Twilio:", error);
          return [];
        }
      }
      // Update call with recording URL
      async updateCallRecording(twilioCallSid, recordingUrl) {
        try {
          await db.update(calls).set({ recordingUrl }).where(eq(calls.twilioCallSid, twilioCallSid));
          console.log(`Recording URL updated for call ${twilioCallSid}`);
        } catch (error) {
          console.error("Error updating call recording:", error);
          throw error;
        }
      }
      // Update call with transcript and generate intelligent summary
      async updateCallTranscript(twilioCallSid, transcript) {
        try {
          const summary = this.generateCallSummary(transcript);
          await db.update(calls).set({
            transcript,
            summary
          }).where(eq(calls.twilioCallSid, twilioCallSid));
          console.log(`Transcript and summary updated for call ${twilioCallSid}`);
        } catch (error) {
          console.error("Error updating call transcript:", error);
          throw error;
        }
      }
      // Generate intelligent business-focused call summary from transcript
      generateCallSummary(transcript) {
        if (!transcript || transcript.length < 10) {
          return "Brief call - transcript too short for summary";
        }
        const lowerTranscript = transcript.toLowerCase();
        const summaryParts = [];
        const revenueIndicators = this.extractRevenueIndicators(lowerTranscript);
        if (revenueIndicators.length > 0) {
          summaryParts.push(`\u{1F4B0} ${revenueIndicators.join(", ")}`);
        }
        const decisionMaker = this.detectDecisionMaker(lowerTranscript);
        if (decisionMaker) {
          summaryParts.push(`\u{1F464} ${decisionMaker}`);
        }
        const timeline = this.extractTimeline(lowerTranscript);
        if (timeline) {
          summaryParts.push(`\u23F0 ${timeline}`);
        }
        const products = this.detectProductInterest(lowerTranscript);
        if (products.length > 0) {
          summaryParts.push(`\u{1F3AF} ${products.join(", ")}`);
        }
        const leadQuality = this.assessLeadQuality(lowerTranscript);
        summaryParts.push(`\u{1F4CA} ${leadQuality}`);
        const nextAction = this.determineNextAction(lowerTranscript);
        if (nextAction) {
          summaryParts.push(`\u{1F3AC} ${nextAction}`);
        }
        const competitive = this.detectCompetitiveInfo(lowerTranscript);
        if (competitive) {
          summaryParts.push(`\u26A1 ${competitive}`);
        }
        return summaryParts.length > 0 ? summaryParts.join(" | ") : "General inquiry - review transcript for details";
      }
      extractRevenueIndicators(transcript) {
        const indicators = [];
        const quantityMatches = transcript.match(/(\d+)\s*(hundred|thousand|pieces|units|dozen)/gi);
        if (quantityMatches) {
          indicators.push(`Large order: ${quantityMatches[0]}`);
        }
        const budgetMatches = transcript.match(/\$\d+|\d+\s*dollars?|\d+k|\d+\s*thousand/gi);
        if (budgetMatches) {
          indicators.push(`Budget: ${budgetMatches[0]}`);
        }
        if (transcript.includes("bulk") || transcript.includes("wholesale") || transcript.includes("volume")) {
          indicators.push("Bulk order potential");
        }
        if (transcript.includes("annual") || transcript.includes("yearly") || transcript.includes("contract")) {
          indicators.push("Recurring business opportunity");
        }
        return indicators;
      }
      detectDecisionMaker(transcript) {
        if (transcript.includes("owner") || transcript.includes("ceo") || transcript.includes("president")) {
          return "Decision maker (Owner/Executive)";
        }
        if (transcript.includes("manager") || transcript.includes("director") || transcript.includes("supervisor")) {
          return "Management level";
        }
        if (transcript.includes("purchasing") || transcript.includes("procurement") || transcript.includes("buyer")) {
          return "Purchasing authority";
        }
        if (transcript.includes("need to check with") || transcript.includes("ask my boss") || transcript.includes("approval")) {
          return "Needs approval from higher-up";
        }
        return null;
      }
      extractTimeline(transcript) {
        if (transcript.includes("today") || transcript.includes("right now") || transcript.includes("immediately")) {
          return "IMMEDIATE NEED";
        }
        if (transcript.includes("this week") || transcript.includes("urgent") || transcript.includes("asap")) {
          return "Urgent - This week";
        }
        if (transcript.includes("next week") || transcript.includes("soon")) {
          return "Soon - Next week";
        }
        if (transcript.includes("next month") || transcript.includes("by the end of")) {
          return "Next month timeline";
        }
        if (transcript.includes("planning ahead") || transcript.includes("future") || transcript.includes("eventually")) {
          return "Future planning";
        }
        return null;
      }
      detectProductInterest(transcript) {
        const products = [];
        if (transcript.match(/shirt|t-shirt|polo|hoodie|jacket|uniform|apparel|clothing/i)) {
          products.push("Custom Apparel");
        }
        if (transcript.match(/mug|cup|bottle|tumbler|drinkware|beverage/i)) {
          products.push("Drinkware");
        }
        if (transcript.match(/pen|keychain|magnet|calendar|promotional|giveaway|swag/i)) {
          products.push("Promotional Items");
        }
        if (transcript.match(/bag|tote|backpack|duffel|briefcase/i)) {
          products.push("Bags");
        }
        if (transcript.match(/usb|charger|speaker|tech|electronics|power bank/i)) {
          products.push("Tech Accessories");
        }
        if (transcript.match(/trophy|plaque|award|recognition|crystal|medal/i)) {
          products.push("Awards & Recognition");
        }
        return products;
      }
      assessLeadQuality(transcript) {
        let score = 0;
        const factors = [];
        if (transcript.includes("ready to order") || transcript.includes("want to buy")) {
          score += 3;
          factors.push("Ready to buy");
        }
        if (transcript.includes("budget") || transcript.includes("price is fine") || transcript.includes("approved")) {
          score += 2;
          factors.push("Budget confirmed");
        }
        if (transcript.includes("deadline") || transcript.includes("event") || transcript.includes("date")) {
          score += 2;
          factors.push("Time-sensitive");
        }
        if (transcript.includes("recommend") || transcript.includes("referred")) {
          score += 2;
          factors.push("Referral");
        }
        if (transcript.includes("repeat customer") || transcript.includes("ordered before")) {
          score += 2;
          factors.push("Repeat customer");
        }
        if (transcript.includes("just looking") || transcript.includes("just browsing")) {
          score -= 1;
          factors.push("Just browsing");
        }
        if (transcript.includes("expensive") || transcript.includes("too much") || transcript.includes("cheaper")) {
          score -= 1;
          factors.push("Price sensitive");
        }
        if (score >= 5) return `HOT Lead (${factors.join(", ")})`;
        if (score >= 3) return `WARM Lead (${factors.join(", ")})`;
        if (score >= 1) return `COLD Lead (${factors.join(", ")})`;
        return "Information gathering stage";
      }
      determineNextAction(transcript) {
        if (transcript.includes("send quote") || transcript.includes("get pricing") || transcript.includes("proposal")) {
          return "ACTION: Send quote/proposal";
        }
        if (transcript.includes("call back") || transcript.includes("follow up") || transcript.includes("check back")) {
          return "ACTION: Schedule follow-up call";
        }
        if (transcript.includes("email") || transcript.includes("send info") || transcript.includes("catalog")) {
          return "ACTION: Send information/catalog";
        }
        if (transcript.includes("samples") || transcript.includes("see examples") || transcript.includes("mock up")) {
          return "ACTION: Provide samples/mockups";
        }
        if (transcript.includes("ready to order") || transcript.includes("place order")) {
          return "ACTION: Process order immediately";
        }
        if (transcript.includes("meeting") || transcript.includes("visit") || transcript.includes("appointment")) {
          return "ACTION: Schedule in-person meeting";
        }
        return null;
      }
      detectCompetitiveInfo(transcript) {
        if (transcript.includes("competitor") || transcript.includes("other company") || transcript.includes("comparing")) {
          return "Shopping competitors";
        }
        if (transcript.includes("better price") || transcript.includes("beat") || transcript.includes("match")) {
          return "Price comparison request";
        }
        if (transcript.includes("unhappy with") || transcript.includes("switching from") || transcript.includes("problems with")) {
          return "Switching from competitor";
        }
        return null;
      }
      async createCall(callData) {
        try {
          const validStatuses = ["completed", "missed", "failed"];
          const statusToUse = validStatuses.includes(callData.status) ? callData.status : "completed";
          const sanitizedCallData = {
            ...callData,
            status: statusToUse
          };
          const [call] = await db.insert(calls).values(sanitizedCallData).returning();
          return call;
        } catch (error) {
          console.error("Error creating call:", error);
          throw new Error("Failed to create call");
        }
      }
      async getAllUsers() {
        try {
          const result = await db.select().from(users);
          return result;
        } catch (error) {
          console.error("Error getting all users:", error);
          throw new Error("Failed to get all users");
        }
      }
      async getCallsByUserId(userId) {
        try {
          const result = await db.select().from(calls).where(eq(calls.userId, userId));
          return result;
        } catch (error) {
          console.error("Error getting calls by user ID:", error);
          throw new Error("Failed to get calls");
        }
      }
      // API Key management
      async generateApiKey(userId) {
        try {
          const apiKey = `skyiq_${userId}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
          await db.update(users).set({
            apiKey,
            apiKeyCreatedAt: /* @__PURE__ */ new Date()
          }).where(eq(users.id, userId));
          return apiKey;
        } catch (error) {
          console.error("Error generating API key:", error);
          throw new Error("Failed to generate API key");
        }
      }
      async validateApiKey(apiKey) {
        try {
          const [user] = await db.select().from(users).where(eq(users.apiKey, apiKey));
          if (user) {
            await db.update(users).set({ apiKeyLastUsed: /* @__PURE__ */ new Date() }).where(eq(users.id, user.id));
          }
          return user || null;
        } catch (error) {
          console.error("Error validating API key:", error);
          return null;
        }
      }
      async revokeApiKey(userId) {
        try {
          await db.update(users).set({
            apiKey: null,
            apiKeyCreatedAt: null,
            apiKeyLastUsed: null
          }).where(eq(users.id, userId));
        } catch (error) {
          console.error("Error revoking API key:", error);
          throw new Error("Failed to revoke API key");
        }
      }
    };
    storage = new DatabaseStorage();
  }
});

// server/ragService.ts
var ragService_exports = {};
__export(ragService_exports, {
  RAGService: () => RAGService,
  ragService: () => ragService
});
import { eq as eq2, and, like, or } from "drizzle-orm";
var RAGService, ragService;
var init_ragService = __esm({
  "server/ragService.ts"() {
    "use strict";
    init_db();
    init_schema();
    RAGService = class {
      // Process all files and links for a user
      async processUserDocuments(userId) {
        console.log(`Starting document processing for user ${userId}`);
        const userBusiness = await db.select().from(businessInfo).where(eq2(businessInfo.userId, userId)).limit(1);
        if (userBusiness.length === 0) {
          console.log(`No business info found for user ${userId}`);
          return;
        }
        const business = userBusiness[0];
        if (business.fileUrls && business.fileNames && business.fileTypes) {
          for (let i = 0; i < business.fileUrls.length; i++) {
            const fileUrl = business.fileUrls[i];
            const fileName = business.fileNames[i];
            const fileType = business.fileTypes[i];
            await this.processDocument(userId, {
              sourceType: "file",
              sourceUrl: fileUrl,
              title: fileName,
              contentType: fileType
            });
          }
        }
        if (business.links) {
          for (const link of business.links) {
            await this.processDocument(userId, {
              sourceType: "link",
              sourceUrl: link,
              title: this.extractDomainFromUrl(link),
              contentType: "webpage"
            });
          }
        }
      }
      // Process individual document or link
      async processDocument(userId, docInfo) {
        try {
          const existingDoc = await db.select().from(documents).where(and(
            eq2(documents.userId, userId),
            eq2(documents.sourceUrl, docInfo.sourceUrl)
          )).limit(1);
          if (existingDoc.length > 0) {
            console.log(`Document ${docInfo.title} already processed`);
            return;
          }
          const [newDoc] = await db.insert(documents).values({
            userId,
            sourceType: docInfo.sourceType,
            sourceUrl: docInfo.sourceUrl,
            title: docInfo.title,
            contentType: docInfo.contentType,
            status: "processing"
          }).returning();
          console.log(`Processing document: ${docInfo.title}`);
          let extractedText = "";
          if (docInfo.sourceType === "link") {
            extractedText = await this.extractTextFromWebpage(docInfo.sourceUrl);
          } else if (docInfo.sourceType === "file") {
            extractedText = await this.extractTextFromFile(docInfo.sourceUrl, docInfo.contentType);
          }
          if (!extractedText || extractedText.trim().length === 0) {
            await this.updateDocumentStatus(newDoc.id, "failed", "No text content extracted");
            return;
          }
          await db.update(documents).set({
            extractedText,
            status: "completed",
            processedAt: /* @__PURE__ */ new Date()
          }).where(eq2(documents.id, newDoc.id));
          await this.createDocumentChunks(newDoc.id, userId, extractedText);
          console.log(`Successfully processed: ${docInfo.title}`);
        } catch (error) {
          console.error(`Error processing document ${docInfo.title}:`, error);
        }
      }
      // Extract text from webpage
      async extractTextFromWebpage(url) {
        try {
          const response = await fetch(url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (compatible; Sky IQ Document Processor)"
            }
          });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          const html = await response.text();
          let text2 = html.replace(/<script[^>]*>.*?<\/script>/gi, "").replace(/<style[^>]*>.*?<\/style>/gi, "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
          text2 = text2.replace(/\b(cookie|privacy policy|terms of service|subscribe|newsletter)\b/gi, "").replace(/^\s*[\r\n]/gm, "").trim();
          return text2.slice(0, 5e4);
        } catch (error) {
          console.error(`Error extracting text from webpage ${url}:`, error);
          return "";
        }
      }
      // Extract text from file (basic implementation)
      async extractTextFromFile(fileUrl, contentType) {
        try {
          if (contentType?.includes("text/")) {
            const response = await fetch(fileUrl);
            if (response.ok) {
              return await response.text();
            }
          }
          const filename = fileUrl.split("/").pop() || "unknown";
          return `Document: ${filename}
Type: ${contentType}
Content: This document is available for reference.`;
        } catch (error) {
          console.error(`Error extracting text from file ${fileUrl}:`, error);
          return "";
        }
      }
      // Create searchable chunks from extracted text
      async createDocumentChunks(documentId, userId, text2) {
        const chunkSize = 1e3;
        const chunks = this.splitTextIntoChunks(text2, chunkSize);
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const wordCount = chunk.split(/\s+/).length;
          const keywords = this.extractKeywords(chunk);
          const summary = this.generateSimpleSummary(chunk);
          await db.insert(documentChunks).values({
            documentId,
            userId,
            chunkIndex: i,
            content: chunk,
            wordCount,
            summary,
            keywords
          });
        }
      }
      // Split text into manageable chunks
      splitTextIntoChunks(text2, chunkSize) {
        const chunks = [];
        const sentences = text2.split(/[.!?]+/).filter((s) => s.trim().length > 0);
        let currentChunk = "";
        for (const sentence of sentences) {
          const trimmedSentence = sentence.trim();
          if ((currentChunk + trimmedSentence).length <= chunkSize) {
            currentChunk += (currentChunk ? ". " : "") + trimmedSentence;
          } else {
            if (currentChunk) {
              chunks.push(currentChunk + ".");
            }
            currentChunk = trimmedSentence;
          }
        }
        if (currentChunk) {
          chunks.push(currentChunk + ".");
        }
        return chunks;
      }
      // Extract keywords using simple text analysis
      extractKeywords(text2) {
        const commonWords = /* @__PURE__ */ new Set([
          "the",
          "a",
          "an",
          "and",
          "or",
          "but",
          "in",
          "on",
          "at",
          "to",
          "for",
          "of",
          "with",
          "by",
          "is",
          "are",
          "was",
          "were",
          "be",
          "been",
          "being",
          "have",
          "has",
          "had",
          "do",
          "does",
          "did",
          "will",
          "would",
          "could",
          "should",
          "may",
          "might",
          "can",
          "this",
          "that",
          "these",
          "those",
          "i",
          "you",
          "he",
          "she",
          "it",
          "we",
          "they",
          "me",
          "him",
          "her",
          "us",
          "them"
        ]);
        const words = text2.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter((word) => word.length > 3 && !commonWords.has(word));
        const wordCounts = {};
        words.forEach((word) => {
          wordCounts[word] = (wordCounts[word] || 0) + 1;
        });
        return Object.entries(wordCounts).sort(([, a], [, b]) => b - a).slice(0, 10).map(([word]) => word);
      }
      // Generate simple summary (first sentence + key points)
      generateSimpleSummary(text2) {
        const sentences = text2.split(/[.!?]+/).filter((s) => s.trim().length > 0);
        if (sentences.length === 0) return "";
        if (sentences.length === 1) return sentences[0].trim() + ".";
        let summary = sentences[0].trim();
        const keywordPatterns = /\b(important|key|main|primary|essential|critical|significant|major)\b/i;
        const keySentences = sentences.slice(1, 4).filter((s) => keywordPatterns.test(s));
        if (keySentences.length > 0) {
          summary += ". " + keySentences[0].trim();
        }
        return summary + ".";
      }
      // Search through document chunks
      async searchDocuments(userId, query, limit = 10) {
        const startTime = Date.now();
        const queryKeywords = query.toLowerCase().split(/\s+/).filter((word) => word.length > 2);
        const searchConditions = queryKeywords.map(
          (keyword) => or(
            like(documentChunks.content, `%${keyword}%`),
            like(documentChunks.summary, `%${keyword}%`)
          )
        );
        const results = await db.select({
          chunkId: documentChunks.id,
          documentId: documentChunks.documentId,
          content: documentChunks.content,
          summary: documentChunks.summary,
          keywords: documentChunks.keywords,
          chunkIndex: documentChunks.chunkIndex,
          documentTitle: documents.title,
          sourceType: documents.sourceType,
          sourceUrl: documents.sourceUrl
        }).from(documentChunks).innerJoin(documents, eq2(documentChunks.documentId, documents.id)).where(and(
          eq2(documentChunks.userId, userId),
          or(...searchConditions)
        )).limit(limit);
        const responseTime = Date.now() - startTime;
        const { searchQueries: searchQueries2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
        await db.insert(searchQueries2).values({
          userId,
          query,
          resultsCount: results.length,
          responseTime
        });
        return results;
      }
      // Get document status for a user
      async getDocumentStatus(userId) {
        const docs = await db.select().from(documents).where(eq2(documents.userId, userId));
        const totalChunks = await db.select({ count: documentChunks.id }).from(documentChunks).where(eq2(documentChunks.userId, userId));
        return {
          totalDocuments: docs.length,
          processedDocuments: docs.filter((d) => d.status === "completed").length,
          failedDocuments: docs.filter((d) => d.status === "failed").length,
          totalChunks: totalChunks.length,
          documents: docs.map((d) => ({
            id: d.id,
            title: d.title,
            sourceType: d.sourceType,
            status: d.status,
            processedAt: d.processedAt
          }))
        };
      }
      // Update document status
      async updateDocumentStatus(documentId, status, errorMessage) {
        await db.update(documents).set({
          status,
          errorMessage,
          processedAt: status === "completed" || status === "failed" ? /* @__PURE__ */ new Date() : void 0
        }).where(eq2(documents.id, documentId));
      }
      // Extract domain from URL for title
      extractDomainFromUrl(url) {
        try {
          const urlObj = new URL(url);
          return urlObj.hostname.replace("www.", "");
        } catch {
          return url;
        }
      }
    };
    ragService = new RAGService();
  }
});

// server/promptBuilder.ts
function buildPrompt(businessInfo2, calls2) {
  const { businessName, description, businessAddress, businessPhone, businessEmail, website } = businessInfo2;
  const intro = `You are a helpful, professional voice agent representing ${businessName}.`;
  const businessDetails = `
Business Details:
- Name: ${businessName}
- Description: ${description || "No description provided"}
- Address: ${businessAddress || "Not available"}
- Phone: ${businessPhone || "Not available"}
- Email: ${businessEmail || "Not available"}
- Website: ${website || "Not available"}
  `;
  const recentExamples = calls2.filter((c) => c.status === "completed" && c.summary).slice(-3).map((c) => `\u2022 ${c.summary}`).join("\n") || "No recent call summaries available.";
  const callExamples = `
Recent Conversation Examples:
${recentExamples}
  `;
  return `
${intro}

${businessDetails}

${callExamples}

Instructions:
- Always speak as if you are part of ${businessName}.
- Be polite, concise, and helpful.
- Use the business details above when answering questions.
- If asked something outside of scope, politely redirect to call ${businessPhone || "the business"}.
`;
}
var init_promptBuilder = __esm({
  "server/promptBuilder.ts"() {
    "use strict";
  }
});

// server/twilioService.ts
var twilioService_exports = {};
__export(twilioService_exports, {
  TwilioService: () => TwilioService,
  twilioService: () => twilioService
});
import twilio from "twilio";
var TwilioService, twilioService;
var init_twilioService = __esm({
  "server/twilioService.ts"() {
    "use strict";
    init_storage();
    init_promptBuilder();
    TwilioService = class {
      constructor() {
      }
      /**
       * Process recording webhook to save recording URL
       */
      async processRecordingWebhook(webhookData) {
        try {
          const { CallSid, RecordingUrl, RecordingSid } = webhookData;
          if (!CallSid || !RecordingUrl) {
            console.log("Recording webhook missing CallSid or RecordingUrl");
            return;
          }
          await storage.updateCallRecording(CallSid, RecordingUrl);
          console.log(`\u{1F3B5} Recording saved for call ${CallSid}: ${RecordingUrl}`);
        } catch (error) {
          console.error("Error processing recording webhook:", error);
        }
      }
      /**
       * Process transcription webhook to save transcript
       */
      async processTranscriptionWebhook(webhookData) {
        try {
          const { CallSid, TranscriptionText, TranscriptionUrl } = webhookData;
          if (!CallSid || !TranscriptionText) {
            console.log("Transcription webhook missing CallSid or TranscriptionText");
            return;
          }
          await storage.updateCallTranscript(CallSid, TranscriptionText);
          console.log(`\u{1F4DD} Transcript saved for call ${CallSid}: ${TranscriptionText.substring(0, 100)}...`);
        } catch (error) {
          console.error("Error processing transcription webhook:", error);
        }
      }
      /**
       * Process incoming Twilio webhook and create call record for the correct user
       */
      async processCallWebhook(webhookData) {
        try {
          const {
            CallSid,
            From,
            To,
            CallStatus,
            CallDuration,
            Direction,
            RecordingUrl
          } = webhookData;
          const user = await this.findUserByTwilioNumber(To, From, Direction);
          if (!user) {
            console.log(
              `No user found for call to/from ${Direction === "inbound" ? From : To}`
            );
            return;
          }
          const businessInfo2 = await storage.getBusinessInfo(user.id);
          const userCalls = await storage.getCallsByUserId(user.id);
          const prompt = buildPrompt(businessInfo2, userCalls);
          const status = this.mapTwilioStatus(CallStatus);
          const callData = {
            userId: user.id,
            phoneNumber: Direction === "inbound" ? From : To,
            contactName: null,
            duration: CallDuration ? parseInt(CallDuration) : null,
            status,
            notes: this.getCallStatusNote(status, CallStatus, CallDuration),
            summary: null,
            twilioCallSid: CallSid,
            direction: Direction,
            recordingUrl: RecordingUrl || null,
            isFromTwilio: true,
            // ✅ save generated prompt in the DB
            aiPrompt: prompt
          };
          await storage.createCall(callData);
          console.log(`\u{1F4DE} Call logged for user ${user.id}: ${CallSid}`);
          console.log(`\u{1F4E3} Generated prompt: ${prompt}`);
        } catch (error) {
          console.error("Error processing Twilio webhook:", error);
        }
      }
      /**
       * Find user by matching their Twilio phone number with strict isolation
       */
      async findUserByTwilioNumber(to, from, direction) {
        try {
          const businessInfos = await storage.getAllBusinessInfoWithTwilio();
          for (const info of businessInfos) {
            if (!info.twilioPhoneNumber) continue;
            const userNumber = this.normalizePhoneNumber(info.twilioPhoneNumber);
            const callNumber = this.normalizePhoneNumber(direction === "inbound" ? to : from);
            if (userNumber === callNumber) {
              const user = await storage.getUser(info.userId);
              if (user) {
                console.log(`Call routed to user ${user.id} (${user.email}) via Twilio number ${info.twilioPhoneNumber}`);
                return user;
              }
            }
          }
          console.log(`No user found for Twilio number: ${direction === "inbound" ? to : from}`);
          return null;
        } catch (error) {
          console.error("Error finding user by Twilio number:", error);
          return null;
        }
      }
      /**
       * Normalize phone numbers for comparison
       */
      normalizePhoneNumber(phoneNumber) {
        return phoneNumber.replace(/[^\d]/g, "");
      }
      /**
       * Get descriptive note for call based on status
       */
      getCallStatusNote(status, twilioStatus, duration) {
        const callDuration = duration ? `${Math.floor(parseInt(duration) / 60)}m ${parseInt(duration) % 60}s` : "";
        switch (twilioStatus.toLowerCase()) {
          case "completed":
            return duration && parseInt(duration) < 10 ? "Customer ended call quickly" : `Call completed ${callDuration}`;
          case "busy":
            return "Customer line was busy";
          case "no-answer":
            return "Customer did not answer";
          case "failed":
            return "Call failed to connect";
          case "canceled":
          case "cancelled":
            return "Call was canceled";
          case "ringing":
            return "Call was ringing";
          case "queued":
            return "Call was queued";
          default:
            return `Call status: ${twilioStatus}`;
        }
      }
      /**
       * Map Twilio call status to our enum values - handles ALL call types
       */
      mapTwilioStatus(twilioStatus) {
        switch (twilioStatus.toLowerCase()) {
          // Successful completed calls
          case "completed":
          case "in-progress":
            return "completed";
          // Customer/caller ended calls early or didn't answer
          case "busy":
          case "no-answer":
          case "ringing":
          case "queued":
            return "missed";
          // Failed or canceled calls  
          case "failed":
          case "canceled":
          case "cancelled":
            return "failed";
          // Default for any other status - log it so we can see what we're missing
          default:
            console.log(`\u{1F4CB} Unmapped call status: ${twilioStatus} - defaulting to 'completed'`);
            return "completed";
        }
      }
      /**
       * Set up webhooks for a user's Twilio account
       */
      async setupWebhooksForUser(userId, accountSid, authToken, phoneNumber) {
        try {
          const userTwilioClient = twilio(accountSid, authToken);
          const webhookUrl = `${process.env.REPLIT_DOMAINS?.split(",")[0] ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}` : "http://localhost:5000"}/api/twilio/webhook`;
          const phoneNumbers = await userTwilioClient.incomingPhoneNumbers.list();
          const targetNumber = phoneNumbers.find((num) => num.phoneNumber === phoneNumber);
          if (targetNumber) {
            await userTwilioClient.incomingPhoneNumbers(targetNumber.sid).update({
              statusCallback: webhookUrl,
              statusCallbackMethod: "POST"
            });
            console.log(`\u2705 Webhook configured for ${phoneNumber} - calls will sync to Sky IQ`);
            return true;
          } else {
            console.log(`\u274C Phone number ${phoneNumber} not found in Twilio account`);
            return false;
          }
        } catch (error) {
          console.error("Error setting up Twilio webhooks:", error);
          return false;
        }
      }
      /**
       * Validate that user's Twilio credentials are correct
       */
      async validateUserTwilioCredentials(accountSid, authToken) {
        try {
          const userClient = twilio(accountSid, authToken);
          await userClient.api.accounts(accountSid).fetch();
          return true;
        } catch (error) {
          console.error("Invalid Twilio credentials:", error);
          return false;
        }
      }
      /**
       * Create isolated Twilio client for specific user
       */
      createUserTwilioClient(accountSid, authToken) {
        return twilio(accountSid, authToken);
      }
      /**
       * Get user's phone numbers from their Twilio account
       */
      async getUserTwilioNumbers(accountSid, authToken) {
        try {
          const userClient = this.createUserTwilioClient(accountSid, authToken);
          const phoneNumbers = await userClient.incomingPhoneNumbers.list();
          return phoneNumbers.map((num) => num.phoneNumber);
        } catch (error) {
          console.error("Error fetching user Twilio numbers:", error);
          return [];
        }
      }
      /**
       * Ensure no phone number conflicts between users
       */
      async validateUniquePhoneNumber(userId, phoneNumber) {
        try {
          const businessInfos = await storage.getAllBusinessInfoWithTwilio();
          for (const info of businessInfos) {
            if (info.userId !== userId && info.twilioPhoneNumber === phoneNumber) {
              console.error(`Phone number ${phoneNumber} already in use by user ${info.userId}`);
              return false;
            }
          }
          return true;
        } catch (error) {
          console.error("Error validating phone number uniqueness:", error);
          return false;
        }
      }
      /**
       * Set up complete Twilio integration for a user with validation
       */
      async setupUserTwilioIntegration(userId, accountSid, authToken, phoneNumber) {
        try {
          const credentialsValid = await this.validateUserTwilioCredentials(accountSid, authToken);
          if (!credentialsValid) {
            return { success: false, message: "Invalid Twilio credentials" };
          }
          const phoneNumberUnique = await this.validateUniquePhoneNumber(userId, phoneNumber);
          if (!phoneNumberUnique) {
            return { success: false, message: "Phone number already in use by another account" };
          }
          const userNumbers = await this.getUserTwilioNumbers(accountSid, authToken);
          if (!userNumbers.includes(phoneNumber)) {
            return { success: false, message: "Phone number not found in your Twilio account" };
          }
          await storage.updateTwilioSettings(userId, { accountSid, authToken, phoneNumber });
          const webhookSetup = await this.setupWebhooksForUser(userId, accountSid, authToken, phoneNumber);
          if (!webhookSetup) {
            return { success: false, message: "Failed to configure webhooks" };
          }
          console.log(`\u2705 Complete Twilio integration setup for user ${userId} with number ${phoneNumber}`);
          return { success: true, message: "Twilio integration configured successfully" };
        } catch (error) {
          console.error("Error setting up Twilio integration:", error);
          return { success: false, message: "Failed to set up Twilio integration" };
        }
      }
    };
    twilioService = new TwilioService();
  }
});

// server/enhancedWebScraper.ts
import { JSDOM } from "jsdom";
var EnhancedWebScraper, enhancedWebScraper;
var init_enhancedWebScraper = __esm({
  "server/enhancedWebScraper.ts"() {
    "use strict";
    EnhancedWebScraper = class {
      MAX_CONTENT_LENGTH = 1e5;
      // 100KB limit
      TIMEOUT_MS = 3e4;
      // 30 second timeout
      async scrapeWebsite(url) {
        try {
          console.log(`Starting comprehensive scrape of: ${url}`);
          const response = await this.fetchWithTimeout(url);
          const html = await response.text();
          const dom = new JSDOM(html);
          const document = dom.window.document;
          const result = {
            url,
            title: this.extractTitle(document),
            description: this.extractDescription(document),
            keywords: this.extractKeywords(document),
            content: this.extractMainContent(document),
            contactInfo: this.extractContactInfo(document, html),
            businessInfo: this.extractBusinessInfo(document, html),
            structuredData: this.extractStructuredData(document),
            metaData: this.extractMetaData(document),
            navigationStructure: this.extractNavigation(document),
            extractedText: this.extractCleanText(document),
            lastScraped: /* @__PURE__ */ new Date()
          };
          console.log(`Successfully scraped ${url}: ${result.extractedText.length} chars, ${result.contactInfo.emails.length} emails, ${result.businessInfo.services.length} services`);
          return result;
        } catch (error) {
          console.error(`Error scraping ${url}:`, error);
          return this.createErrorResult(url, error);
        }
      }
      async fetchWithTimeout(url) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);
        try {
          const response = await fetch(url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (compatible; Sky IQ Business Intelligence Bot) AppleWebKit/537.36",
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.5",
              "Accept-Encoding": "gzip, deflate",
              "Connection": "keep-alive"
            },
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          return response;
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      }
      extractTitle(document) {
        const sources = [
          () => document.querySelector('meta[property="og:title"]')?.getAttribute("content"),
          () => document.querySelector('meta[name="twitter:title"]')?.getAttribute("content"),
          () => document.querySelector("title")?.textContent,
          () => document.querySelector("h1")?.textContent,
          () => document.querySelector(".title, .page-title, .entry-title")?.textContent
        ];
        for (const source of sources) {
          const title = source()?.trim();
          if (title && title.length > 0) {
            return title.slice(0, 200);
          }
        }
        return "Untitled Page";
      }
      extractDescription(document) {
        const sources = [
          () => document.querySelector('meta[name="description"]')?.getAttribute("content"),
          () => document.querySelector('meta[property="og:description"]')?.getAttribute("content"),
          () => document.querySelector('meta[name="twitter:description"]')?.getAttribute("content"),
          () => document.querySelector(".description, .summary, .excerpt")?.textContent,
          () => document.querySelector("p")?.textContent
        ];
        for (const source of sources) {
          const desc2 = source()?.trim();
          if (desc2 && desc2.length > 0) {
            return desc2.slice(0, 500);
          }
        }
        return "";
      }
      extractKeywords(document) {
        const keywords = /* @__PURE__ */ new Set();
        const metaKeywords = document.querySelector('meta[name="keywords"]')?.getAttribute("content");
        if (metaKeywords) {
          metaKeywords.split(",").forEach((kw) => keywords.add(kw.trim().toLowerCase()));
        }
        const headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
        headings.forEach((heading) => {
          const text2 = heading.textContent?.trim();
          if (text2) {
            this.extractWordsFromText(text2).forEach((word) => keywords.add(word));
          }
        });
        const emphasized = document.querySelectorAll("strong, em, b, i");
        emphasized.forEach((el) => {
          const text2 = el.textContent?.trim();
          if (text2) {
            this.extractWordsFromText(text2).forEach((word) => keywords.add(word));
          }
        });
        return Array.from(keywords).slice(0, 50);
      }
      extractContactInfo(document, html) {
        const emails = /* @__PURE__ */ new Set();
        const phones = /* @__PURE__ */ new Set();
        const addresses = /* @__PURE__ */ new Set();
        const socialMedia = [];
        const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
        const emailMatches = html.match(emailRegex);
        if (emailMatches) {
          emailMatches.forEach((email) => {
            if (!email.includes("example.com") && !email.includes("placeholder")) {
              emails.add(email.toLowerCase());
            }
          });
        }
        const phoneRegex = /(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g;
        const phoneMatches = html.match(phoneRegex);
        if (phoneMatches) {
          phoneMatches.forEach((phone) => phones.add(phone.trim()));
        }
        const addressPatterns = [
          /\d+\s+[A-Za-z0-9\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Plaza|Circle|Cir)\s*,?\s*[A-Za-z\s]+,?\s*[A-Z]{2}\s*\d{5}/g,
          /\b\d+\s+[A-Za-z0-9\s]+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln)\b/g
        ];
        addressPatterns.forEach((pattern) => {
          const matches = html.match(pattern);
          if (matches) {
            matches.forEach((addr) => addresses.add(addr.trim()));
          }
        });
        const socialPatterns = {
          facebook: /(?:https?:\/\/)?(?:www\.)?facebook\.com\/[a-zA-Z0-9.]+/g,
          twitter: /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/[a-zA-Z0-9_]+/g,
          linkedin: /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:in|company)\/[a-zA-Z0-9-]+/g,
          instagram: /(?:https?:\/\/)?(?:www\.)?instagram\.com\/[a-zA-Z0-9_.]+/g,
          youtube: /(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:c\/|channel\/|user\/)?[a-zA-Z0-9_-]+/g
        };
        Object.entries(socialPatterns).forEach(([platform, pattern]) => {
          const matches = html.match(pattern);
          if (matches) {
            matches.forEach((url) => {
              socialMedia.push({ platform, url: url.trim() });
            });
          }
        });
        return {
          emails: Array.from(emails).slice(0, 10),
          phones: Array.from(phones).slice(0, 10),
          addresses: Array.from(addresses).slice(0, 5),
          socialMedia: socialMedia.slice(0, 20)
        };
      }
      extractBusinessInfo(document, html) {
        const hours = [];
        const services = /* @__PURE__ */ new Set();
        const products = /* @__PURE__ */ new Set();
        const aboutSections = [];
        const testimonials = [];
        const teamMembers = [];
        const hourPatterns = [
          /(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*:?\s*\d{1,2}:\d{2}\s*(?:am|pm)?\s*-\s*\d{1,2}:\d{2}\s*(?:am|pm)?/gi,
          /\d{1,2}:\d{2}\s*(?:am|pm)?\s*-\s*\d{1,2}:\d{2}\s*(?:am|pm)?/g
        ];
        hourPatterns.forEach((pattern) => {
          const matches = html.match(pattern);
          if (matches) {
            matches.forEach((hour) => hours.push(hour.trim()));
          }
        });
        const serviceKeywords = [
          "service",
          "services",
          "consulting",
          "support",
          "maintenance",
          "repair",
          "installation",
          "design",
          "development",
          "marketing",
          "strategy",
          "training",
          "coaching",
          "therapy",
          "treatment",
          "care",
          "management",
          "planning",
          "analysis",
          "assessment"
        ];
        const serviceElements = document.querySelectorAll('.service, .services, [class*="service"], [id*="service"]');
        serviceElements.forEach((el) => {
          const text2 = el.textContent?.trim();
          if (text2 && text2.length > 0 && text2.length < 200) {
            services.add(text2);
          }
        });
        const lists = document.querySelectorAll("ul li, ol li");
        lists.forEach((item) => {
          const text2 = item.textContent?.trim();
          if (text2 && serviceKeywords.some((keyword) => text2.toLowerCase().includes(keyword))) {
            if (text2.length > 5 && text2.length < 100) {
              services.add(text2);
            }
          }
        });
        const productElements = document.querySelectorAll('.product, .products, [class*="product"], [id*="product"]');
        productElements.forEach((el) => {
          const text2 = el.textContent?.trim();
          if (text2 && text2.length > 0 && text2.length < 200) {
            products.add(text2);
          }
        });
        const aboutSelectors = [
          'section[class*="about"]',
          ".about",
          "#about",
          ".about-us",
          "#about-us",
          ".company",
          ".story",
          ".mission",
          ".vision",
          ".values"
        ];
        aboutSelectors.forEach((selector) => {
          const elements = document.querySelectorAll(selector);
          elements.forEach((el) => {
            const text2 = el.textContent?.trim();
            if (text2 && text2.length > 50) {
              aboutSections.push(text2.slice(0, 1e3));
            }
          });
        });
        const testimonialSelectors = [
          ".testimonial",
          ".testimonials",
          ".review",
          ".reviews",
          '[class*="testimonial"]',
          '[class*="review"]'
        ];
        testimonialSelectors.forEach((selector) => {
          const elements = document.querySelectorAll(selector);
          elements.forEach((el) => {
            const text2 = el.textContent?.trim();
            if (text2 && text2.length > 20 && text2.length < 500) {
              testimonials.push(text2);
            }
          });
        });
        const teamSelectors = [
          ".team",
          ".staff",
          ".employee",
          '[class*="team"]',
          '[class*="staff"]',
          '[class*="member"]'
        ];
        teamSelectors.forEach((selector) => {
          const elements = document.querySelectorAll(selector);
          elements.forEach((el) => {
            const name = el.querySelector("h1, h2, h3, h4, h5, h6, .name")?.textContent?.trim();
            if (name && name.length > 0 && name.length < 50) {
              teamMembers.push(name);
            }
          });
        });
        return {
          hours: hours.slice(0, 7),
          services: Array.from(services).slice(0, 20),
          products: Array.from(products).slice(0, 20),
          aboutSections: aboutSections.slice(0, 5),
          testimonials: testimonials.slice(0, 10),
          teamMembers: teamMembers.slice(0, 15)
        };
      }
      extractStructuredData(document) {
        const structuredData = [];
        const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
        jsonLdScripts.forEach((script) => {
          try {
            const data = JSON.parse(script.textContent || "");
            structuredData.push(data);
          } catch (error) {
            console.warn("Invalid JSON-LD found", error);
          }
        });
        const microdataElements = document.querySelectorAll("[itemscope]");
        microdataElements.forEach((el) => {
          const itemType = el.getAttribute("itemtype");
          const itemProps = {};
          const propElements = el.querySelectorAll("[itemprop]");
          propElements.forEach((propEl) => {
            const propName = propEl.getAttribute("itemprop");
            const propValue = propEl.textContent?.trim();
            if (propName && propValue) {
              itemProps[propName] = propValue;
            }
          });
          if (itemType && Object.keys(itemProps).length > 0) {
            structuredData.push({ "@type": itemType, ...itemProps });
          }
        });
        return structuredData;
      }
      extractMetaData(document) {
        return {
          ogTitle: document.querySelector('meta[property="og:title"]')?.getAttribute("content") || void 0,
          ogDescription: document.querySelector('meta[property="og:description"]')?.getAttribute("content") || void 0,
          twitterTitle: document.querySelector('meta[name="twitter:title"]')?.getAttribute("content") || void 0,
          twitterDescription: document.querySelector('meta[name="twitter:description"]')?.getAttribute("content") || void 0,
          author: document.querySelector('meta[name="author"]')?.getAttribute("content") || void 0,
          language: document.documentElement.lang || document.querySelector('meta[http-equiv="content-language"]')?.getAttribute("content") || void 0
        };
      }
      extractNavigation(document) {
        const navItems = [];
        const navSelectors = ["nav a", ".navigation a", ".menu a", ".navbar a", "header a"];
        navSelectors.forEach((selector) => {
          const links = document.querySelectorAll(selector);
          links.forEach((link) => {
            const text2 = link.textContent?.trim();
            if (text2 && text2.length > 0 && text2.length < 50) {
              navItems.push(text2);
            }
          });
        });
        return Array.from(new Set(navItems)).slice(0, 20);
      }
      extractMainContent(document) {
        const unwanted = document.querySelectorAll(
          "script, style, nav, header, footer, aside, .sidebar, .advertisement, .ads, .cookie, .popup, .modal, .share, .social, .comment, .comments"
        );
        unwanted.forEach((el) => el.remove());
        const contentSelectors = [
          "main",
          '[role="main"]',
          ".content",
          ".main-content",
          ".page-content",
          ".entry-content",
          ".post-content",
          ".article-content",
          "article"
        ];
        for (const selector of contentSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            return this.cleanText(element.textContent || "");
          }
        }
        return this.cleanText(document.body.textContent || "");
      }
      extractCleanText(document) {
        const unwanted = document.querySelectorAll(
          "script, style, nav, header, footer, aside, .sidebar, .advertisement, .ads, .cookie, .popup, .modal, .share, .social, .menu, .navigation"
        );
        unwanted.forEach((el) => el.remove());
        const text2 = document.body.textContent || "";
        return this.cleanText(text2).slice(0, this.MAX_CONTENT_LENGTH);
      }
      cleanText(text2) {
        return text2.replace(/\s+/g, " ").replace(/\n\s*\n/g, "\n").replace(/^\s+|\s+$/g, "").trim();
      }
      extractWordsFromText(text2) {
        return text2.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter((word) => word.length > 3 && word.length < 20).slice(0, 10);
      }
      createErrorResult(url, error) {
        return {
          url,
          title: "Error Loading Page",
          description: `Failed to scrape: ${error.message}`,
          keywords: [],
          content: "",
          contactInfo: { emails: [], phones: [], addresses: [], socialMedia: [] },
          businessInfo: { hours: [], services: [], products: [], aboutSections: [], testimonials: [], teamMembers: [] },
          structuredData: [],
          metaData: {},
          navigationStructure: [],
          extractedText: "",
          lastScraped: /* @__PURE__ */ new Date()
        };
      }
    };
    enhancedWebScraper = new EnhancedWebScraper();
  }
});

// server/dataAggregationService.ts
var dataAggregationService_exports = {};
__export(dataAggregationService_exports, {
  DataAggregationService: () => DataAggregationService,
  dataAggregationService: () => dataAggregationService
});
import { eq as eq5, desc, and as and3 } from "drizzle-orm";
var DataAggregationService, dataAggregationService;
var init_dataAggregationService = __esm({
  "server/dataAggregationService.ts"() {
    "use strict";
    init_db();
    init_schema();
    init_enhancedWebScraper();
    init_ragService();
    DataAggregationService = class {
      CACHE_DURATION_MS = 30 * 60 * 1e3;
      // 30 minutes
      cache = /* @__PURE__ */ new Map();
      async aggregateBusinessData(userId, forceRefresh = false) {
        if (!forceRefresh) {
          const cached = this.cache.get(userId);
          if (cached && cached.expires > Date.now()) {
            console.log(`Returning cached business data for user ${userId}`);
            return cached.data;
          }
        }
        console.log(`Aggregating comprehensive business data for user ${userId}${forceRefresh ? " (forced refresh)" : ""}`);
        try {
          const [
            businessProfile,
            recentLeads,
            documentStatus,
            documentChunks2
          ] = await Promise.all([
            this.getBusinessProfile(userId),
            this.getLeadInsights(userId),
            ragService.getDocumentStatus(userId),
            this.getDocumentChunks(userId)
          ]);
          const webPresence = await this.processWebPresence(businessProfile);
          const aggregatedData = {
            businessProfile,
            webPresence,
            documentKnowledge: this.processDocumentKnowledge(documentStatus, documentChunks2),
            leadInsights: this.processLeadInsights(recentLeads),
            competitiveIntel: this.analyzeCompetitiveIntelligence(businessProfile, webPresence, documentChunks2),
            contentAnalysis: this.analyzeContentThemes(businessProfile, webPresence, documentChunks2),
            operationalData: this.extractOperationalData(businessProfile, webPresence),
            lastUpdated: /* @__PURE__ */ new Date()
          };
          this.cache.set(userId, {
            data: aggregatedData,
            expires: Date.now() + this.CACHE_DURATION_MS
          });
          console.log(`Successfully aggregated business data for user ${userId}: ${webPresence.length} websites, ${documentChunks2.length} document chunks, ${recentLeads.length} leads`);
          return aggregatedData;
        } catch (error) {
          console.error(`Error aggregating business data for user ${userId}:`, error);
          throw error;
        }
      }
      async getBusinessProfile(userId) {
        const [profile] = await db.select().from(businessInfo).where(eq5(businessInfo.userId, userId)).limit(1);
        if (!profile) {
          throw new Error(`No business profile found for user ${userId}`);
        }
        return profile;
      }
      async getLeadInsights(userId) {
        return await db.select().from(leads).where(eq5(leads.userId, userId)).orderBy(desc(leads.createdAt)).limit(25);
      }
      async getDocumentChunks(userId) {
        const chunks = await db.select({
          id: documentChunks.id,
          documentId: documentChunks.documentId,
          content: documentChunks.content,
          summary: documentChunks.summary,
          keywords: documentChunks.keywords,
          chunkIndex: documentChunks.chunkIndex,
          documentTitle: documents.title,
          sourceType: documents.sourceType,
          sourceUrl: documents.sourceUrl
        }).from(documentChunks).innerJoin(documents, eq5(documentChunks.documentId, documents.id)).where(and3(
          eq5(documentChunks.userId, userId),
          eq5(documents.status, "completed")
        )).orderBy(desc(documentChunks.id)).limit(100);
        return chunks;
      }
      async processWebPresence(businessProfile) {
        const webData = [];
        const linksToScrape = /* @__PURE__ */ new Set();
        if (businessProfile.links) {
          businessProfile.links.forEach((link) => {
            if (link && this.isValidUrl(link)) {
              linksToScrape.add(link);
            }
          });
        }
        const scrapePromises = Array.from(linksToScrape).map(async (url) => {
          try {
            const scrapedData = await enhancedWebScraper.scrapeWebsite(url);
            return scrapedData;
          } catch (error) {
            console.error(`Failed to scrape ${url}:`, error);
            return null;
          }
        });
        const results = await Promise.all(scrapePromises);
        results.forEach((result) => {
          if (result) {
            webData.push(result);
          }
        });
        return webData;
      }
      processDocumentKnowledge(documentStatus, chunks) {
        const allKeywords = /* @__PURE__ */ new Set();
        const summaries = [];
        chunks.forEach((chunk) => {
          if (chunk.keywords) {
            chunk.keywords.forEach((kw) => allKeywords.add(kw));
          }
          if (chunk.summary) {
            summaries.push(chunk.summary);
          }
        });
        return {
          totalDocuments: documentStatus.totalDocuments,
          processedDocuments: documentStatus.processedDocuments,
          chunks,
          keyTopics: Array.from(allKeywords).slice(0, 30),
          summaries: summaries.slice(0, 20)
        };
      }
      processLeadInsights(leads2) {
        const leadSources = /* @__PURE__ */ new Set();
        const conversionPatterns = [];
        leads2.forEach((lead) => {
          if (lead.company) {
            leadSources.add(lead.company);
          }
          if (lead.notes) {
            conversionPatterns.push(lead.notes);
          }
        });
        return {
          totalLeads: leads2.length,
          recentLeads: leads2.slice(0, 10),
          leadSources: Array.from(leadSources).slice(0, 15),
          conversionPatterns: conversionPatterns.slice(0, 10)
        };
      }
      analyzeCompetitiveIntelligence(businessProfile, webData, documentChunks2) {
        const industryKeywords = /* @__PURE__ */ new Set();
        const uniqueValueProps = [];
        webData.forEach((site) => {
          site.keywords.forEach((kw) => industryKeywords.add(kw));
          const valueIndicators = ["unique", "exclusive", "only", "first", "leading", "expert", "specialized"];
          site.businessInfo.aboutSections.forEach((section) => {
            valueIndicators.forEach((indicator) => {
              if (section.toLowerCase().includes(indicator)) {
                const sentence = this.extractSentenceContaining(section, indicator);
                if (sentence) uniqueValueProps.push(sentence);
              }
            });
          });
        });
        documentChunks2.forEach((chunk) => {
          if (chunk.keywords) {
            chunk.keywords.forEach((kw) => industryKeywords.add(kw));
          }
        });
        const businessDesc = businessProfile.description?.toLowerCase() || "";
        let marketPosition = "established business";
        if (businessDesc.includes("startup") || businessDesc.includes("new")) {
          marketPosition = "emerging startup";
        } else if (businessDesc.includes("leading") || businessDesc.includes("established")) {
          marketPosition = "market leader";
        } else if (businessDesc.includes("boutique") || businessDesc.includes("specialized")) {
          marketPosition = "niche specialist";
        }
        return {
          industryKeywords: Array.from(industryKeywords).slice(0, 25),
          marketPosition,
          uniqueValueProps: uniqueValueProps.slice(0, 10)
        };
      }
      analyzeContentThemes(businessProfile, webData, documentChunks2) {
        const brandVoice = [];
        const messagingThemes = /* @__PURE__ */ new Set();
        const expertiseAreas = /* @__PURE__ */ new Set();
        const customerPainPoints = [];
        webData.forEach((site) => {
          site.businessInfo.aboutSections.forEach((section) => {
            if (section.length > 100) {
              brandVoice.push(this.analyzeToneFromText(section));
            }
          });
          site.businessInfo.services.forEach((service) => messagingThemes.add(service));
          site.businessInfo.products.forEach((product) => messagingThemes.add(product));
          if (site.structuredData) {
            site.structuredData.forEach((data) => {
              if (data.expertise) expertiseAreas.add(data.expertise);
              if (data.specialty) expertiseAreas.add(data.specialty);
            });
          }
        });
        documentChunks2.forEach((chunk) => {
          if (chunk.content) {
            const painPointPatterns = [
              /problem[s]?\s+with/gi,
              /challenge[s]?\s+of/gi,
              /issue[s]?\s+in/gi,
              /difficulty\s+in/gi,
              /struggle[s]?\s+with/gi,
              /concern[s]?\s+about/gi
            ];
            painPointPatterns.forEach((pattern) => {
              const matches = chunk.content.match(pattern);
              if (matches) {
                const context = this.extractContextAroundMatch(chunk.content, matches[0]);
                if (context) customerPainPoints.push(context);
              }
            });
          }
        });
        return {
          brandVoice: brandVoice.slice(0, 5),
          messagingThemes: Array.from(messagingThemes).slice(0, 20),
          expertiseAreas: Array.from(expertiseAreas).slice(0, 15),
          customerPainPoints: customerPainPoints.slice(0, 10)
        };
      }
      extractOperationalData(businessProfile, webData) {
        const businessHours = /* @__PURE__ */ new Set();
        const contactMethods = /* @__PURE__ */ new Set();
        const serviceDelivery = [];
        const teamStructure = [];
        webData.forEach((site) => {
          site.businessInfo.hours.forEach((hour) => businessHours.add(hour));
          site.businessInfo.teamMembers.forEach((member) => teamStructure.push(member));
          if (site.contactInfo.emails.length > 0) contactMethods.add("Email");
          if (site.contactInfo.phones.length > 0) contactMethods.add("Phone");
          if (site.contactInfo.socialMedia.length > 0) contactMethods.add("Social Media");
        });
        if (businessProfile.businessPhone) contactMethods.add("Phone");
        if (businessProfile.businessEmail) contactMethods.add("Email");
        return {
          businessHours: Array.from(businessHours).slice(0, 7),
          contactMethods: Array.from(contactMethods),
          serviceDelivery: serviceDelivery.slice(0, 10),
          teamStructure: teamStructure.slice(0, 15)
        };
      }
      isValidUrl(string) {
        try {
          new URL(string);
          return true;
        } catch (_) {
          return false;
        }
      }
      extractSentenceContaining(text2, keyword) {
        const sentences = text2.split(/[.!?]+/);
        const targetSentence = sentences.find(
          (sentence) => sentence.toLowerCase().includes(keyword.toLowerCase())
        );
        return targetSentence?.trim() || "";
      }
      analyzeToneFromText(text2) {
        const professionalIndicators = ["expertise", "professional", "certified", "licensed", "qualified"];
        const friendlyIndicators = ["welcome", "happy", "love", "enjoy", "passion"];
        const authoritativeIndicators = ["leading", "industry", "expert", "proven", "established"];
        const textLower = text2.toLowerCase();
        if (professionalIndicators.some((ind) => textLower.includes(ind))) {
          return "Professional and Expert";
        } else if (friendlyIndicators.some((ind) => textLower.includes(ind))) {
          return "Warm and Approachable";
        } else if (authoritativeIndicators.some((ind) => textLower.includes(ind))) {
          return "Authoritative and Confident";
        }
        return "Informative and Clear";
      }
      extractContextAroundMatch(text2, match) {
        const index = text2.toLowerCase().indexOf(match.toLowerCase());
        if (index === -1) return "";
        const start = Math.max(0, index - 50);
        const end = Math.min(text2.length, index + match.length + 50);
        return text2.slice(start, end).trim();
      }
      // Clear cache for a specific user or all users
      clearCache(userId) {
        if (userId) {
          this.cache.delete(userId);
          console.log(`Cleared cache for user ${userId}`);
        } else {
          this.cache.clear();
          console.log("Cleared all cached business data");
        }
      }
      // Get cache statistics
      getCacheStats() {
        return {
          totalCached: this.cache.size,
          cacheHitRate: 0
          // Would need to track hits/misses for accurate rate
        };
      }
    };
    dataAggregationService = new DataAggregationService();
  }
});

// server/intelligentPromptBuilder.ts
var intelligentPromptBuilder_exports = {};
__export(intelligentPromptBuilder_exports, {
  IntelligentPromptBuilder: () => IntelligentPromptBuilder,
  intelligentPromptBuilder: () => intelligentPromptBuilder
});
var IntelligentPromptBuilder, intelligentPromptBuilder;
var init_intelligentPromptBuilder = __esm({
  "server/intelligentPromptBuilder.ts"() {
    "use strict";
    IntelligentPromptBuilder = class {
      /**
       * Build a dynamic, context-aware prompt for voice agents using comprehensive business data
       */
      buildDynamicPrompt(businessData, context = {}) {
        const {
          businessProfile,
          webPresence,
          documentKnowledge,
          leadInsights,
          competitiveIntel,
          contentAnalysis,
          operationalData
        } = businessData;
        const systemPrompt = this.constructSystemPrompt(businessData, context);
        const contextualKnowledge = this.extractContextualKnowledge(businessData, context);
        const suggestedResponses = this.generateSuggestedResponses(businessData, context);
        const handoffTriggers = this.defineHandoffTriggers(businessData, context);
        const confidenceScore = this.calculateConfidenceScore(businessData);
        return {
          systemPrompt,
          contextualKnowledge,
          suggestedResponses,
          handoffTriggers,
          metadata: {
            dataSourcesUsed: this.getDataSourcesUsed(businessData),
            confidenceScore,
            lastUpdated: businessData.lastUpdated
          }
        };
      }
      constructSystemPrompt(businessData, context) {
        const { businessProfile, contentAnalysis, competitiveIntel, operationalData } = businessData;
        const businessPersonality = this.determineBrandPersonality(contentAnalysis);
        const expertiseLevel = this.determineExpertiseLevel(businessData);
        let intro = `You are an intelligent AI assistant representing ${businessProfile.businessName}`;
        if (expertiseLevel === "expert") {
          intro += `, a ${competitiveIntel.marketPosition.toLowerCase()} in the industry.`;
        } else if (expertiseLevel === "specialized") {
          intro += `, specializing in ${contentAnalysis.expertiseAreas.slice(0, 3).join(", ")}.`;
        } else {
          intro += `, committed to providing excellent service to our customers.`;
        }
        const identity = this.buildIdentitySection(businessData);
        const operations = this.buildOperationalContext(businessData, context);
        const expertise = this.buildExpertiseSection(businessData);
        const communicationStyle = this.buildCommunicationStyle(businessData, context);
        const callHandling = this.buildCallHandlingInstructions(businessData, context);
        return `${intro}

${identity}

${operations}

${expertise}

${communicationStyle}

${callHandling}

CRITICAL GUIDELINES:
- Always represent yourself as part of ${businessProfile.businessName}
- Use "we", "our", and "us" when referring to the business
- Never say "according to documentation" or "based on our files"
- Speak with authority and knowledge as if the information is your own expertise
- If you don't know something specific, offer to connect them with a team member
- Stay professional, helpful, and aligned with our brand voice
- Focus on solving the customer's needs and providing value`;
      }
      buildIdentitySection(businessData) {
        const { businessProfile, competitiveIntel, contentAnalysis } = businessData;
        let section = `BUSINESS IDENTITY:
- Company: ${businessProfile.businessName}`;
        if (businessProfile.description) {
          section += `
- Mission: ${businessProfile.description}`;
        }
        if (competitiveIntel.uniqueValueProps.length > 0) {
          section += `
- Unique Value: ${competitiveIntel.uniqueValueProps.slice(0, 2).join(", ")}`;
        }
        if (contentAnalysis.brandVoice.length > 0) {
          section += `
- Brand Voice: ${contentAnalysis.brandVoice[0]}`;
        }
        return section;
      }
      buildOperationalContext(businessData, context) {
        const { businessProfile, operationalData } = businessData;
        let section = `OPERATIONAL CONTEXT:`;
        if (businessProfile.businessPhone || businessProfile.businessEmail) {
          section += `
- Contact: `;
          const contacts = [];
          if (businessProfile.businessPhone) contacts.push(`Phone: ${businessProfile.businessPhone}`);
          if (businessProfile.businessEmail) contacts.push(`Email: ${businessProfile.businessEmail}`);
          section += contacts.join(", ");
        }
        if (businessProfile.businessAddress) {
          section += `
- Location: ${businessProfile.businessAddress}`;
        }
        if (operationalData.businessHours.length > 0) {
          section += `
- Hours: ${operationalData.businessHours.slice(0, 3).join(", ")}`;
        }
        if (operationalData.contactMethods.length > 0) {
          section += `
- Available Contact Methods: ${operationalData.contactMethods.join(", ")}`;
        }
        if (context.timeOfDay) {
          section += `
- Current Context: ${context.timeOfDay} call`;
        }
        return section;
      }
      buildExpertiseSection(businessData) {
        const { webPresence, documentKnowledge, contentAnalysis, competitiveIntel } = businessData;
        let section = `EXPERTISE & KNOWLEDGE:`;
        if (contentAnalysis.expertiseAreas.length > 0) {
          section += `
- Core Expertise: ${contentAnalysis.expertiseAreas.slice(0, 5).join(", ")}`;
        }
        const allServices = /* @__PURE__ */ new Set();
        webPresence.forEach((site) => {
          site.businessInfo.services.forEach((service) => allServices.add(service));
          site.businessInfo.products.forEach((product) => allServices.add(product));
        });
        if (allServices.size > 0) {
          section += `
- Services/Products: ${Array.from(allServices).slice(0, 8).join(", ")}`;
        }
        if (documentKnowledge.totalDocuments > 0) {
          section += `
- Knowledge Base: ${documentKnowledge.processedDocuments} processed documents covering key topics`;
          if (documentKnowledge.keyTopics.length > 0) {
            section += `
- Key Topics: ${documentKnowledge.keyTopics.slice(0, 10).join(", ")}`;
          }
        }
        if (competitiveIntel.marketPosition) {
          section += `
- Market Position: ${competitiveIntel.marketPosition}`;
        }
        return section;
      }
      buildCommunicationStyle(businessData, context) {
        const { contentAnalysis } = businessData;
        let section = `COMMUNICATION STYLE:`;
        if (contentAnalysis.brandVoice.length > 0) {
          section += `
- Tone: ${contentAnalysis.brandVoice[0]}`;
        }
        switch (context.callType) {
          case "inbound":
            section += `
- Approach: Welcoming and solution-focused for incoming inquiries`;
            break;
          case "outbound":
            section += `
- Approach: Confident and value-driven for outbound contact`;
            break;
          default:
            section += `
- Approach: Adaptive to customer needs and inquiry type`;
        }
        if (context.urgency === "high") {
          section += `
- Priority: Address urgent concerns immediately and efficiently`;
        } else if (context.urgency === "low") {
          section += `
- Priority: Take time to educate and build relationship`;
        }
        section += `
- Response Style: Concise, helpful, and professional
- Length: Keep responses focused and actionable
- Personality: Knowledgeable team member who genuinely cares about helping`;
        return section;
      }
      buildCallHandlingInstructions(businessData, context) {
        const { leadInsights, contentAnalysis } = businessData;
        let section = `CALL HANDLING INSTRUCTIONS:`;
        if (contentAnalysis.customerPainPoints.length > 0) {
          section += `
- Pain Points: Understand common customer challenges and position solutions`;
        }
        if (context.callType === "outbound" && leadInsights.totalLeads > 0) {
          section += `
- Lead Qualification: Identify needs and qualification criteria based on successful patterns`;
        }
        if (context.specificTopic) {
          section += `
- Topic Focus: This call is specifically about ${context.specificTopic}`;
        }
        section += `
- Information Gathering: Ask relevant questions to understand needs
- Solution Positioning: Connect customer needs to our capabilities
- Next Steps: Always provide clear next steps or call-to-action
- Escalation: Know when to involve human team members for complex issues`;
        return section;
      }
      extractContextualKnowledge(businessData, context) {
        const knowledge = [];
        const { webPresence, documentKnowledge } = businessData;
        if (context.specificTopic) {
          const relevantSummaries = documentKnowledge.summaries.filter(
            (summary) => summary.toLowerCase().includes(context.specificTopic.toLowerCase())
          );
          knowledge.push(...relevantSummaries.slice(0, 5));
        } else {
          knowledge.push(...documentKnowledge.summaries.slice(0, 8));
        }
        webPresence.forEach((site) => {
          if (site.businessInfo.aboutSections.length > 0) {
            knowledge.push(`About: ${site.businessInfo.aboutSections[0].slice(0, 300)}...`);
          }
          if (site.businessInfo.testimonials.length > 0) {
            knowledge.push(`Customer Feedback: ${site.businessInfo.testimonials[0]}`);
          }
        });
        return knowledge.slice(0, 12);
      }
      generateSuggestedResponses(businessData, context) {
        const responses = [];
        const { businessProfile, webPresence } = businessData;
        responses.push(`Thank you for calling ${businessProfile.businessName}. How can I help you today?`);
        responses.push(`Hi, this is ${businessProfile.businessName}. What can I assist you with?`);
        webPresence.forEach((site) => {
          site.businessInfo.services.slice(0, 3).forEach((service) => {
            responses.push(`I'd be happy to discuss our ${service} services with you.`);
          });
        });
        if (context.callType === "outbound") {
          responses.push(`I'm calling to follow up on your interest in our services.`);
          responses.push(`I wanted to reach out to discuss how we might be able to help your business.`);
        }
        if (context.timeOfDay === "evening") {
          responses.push(`Thanks for calling this evening. I have a few minutes to help you.`);
        }
        responses.push(`Let me connect you with someone who specializes in that area.`);
        responses.push(`I'll have one of our experts get back to you with detailed information.`);
        return responses.slice(0, 10);
      }
      defineHandoffTriggers(businessData, context) {
        const triggers = [];
        const { contentAnalysis, operationalData } = businessData;
        triggers.push("When customer requests pricing for custom solutions");
        triggers.push("When technical specifications are needed");
        triggers.push("When customer wants to schedule an appointment");
        triggers.push("When complaint resolution requires management");
        if (contentAnalysis.expertiseAreas.length > 0) {
          contentAnalysis.expertiseAreas.slice(0, 3).forEach((area) => {
            triggers.push(`When deep expertise in ${area} is required`);
          });
        }
        if (operationalData.businessHours.length > 0) {
          triggers.push("When calling outside business hours");
        }
        if (context.urgency === "high") {
          triggers.push("When urgent issues require immediate expert attention");
        }
        return triggers.slice(0, 8);
      }
      calculateConfidenceScore(businessData) {
        let score = 0;
        const maxScore = 100;
        const profile = businessData.businessProfile;
        if (profile.businessName) score += 8;
        if (profile.description) score += 7;
        if (profile.businessPhone || profile.businessEmail) score += 5;
        if (profile.businessAddress) score += 5;
        if (businessData.webPresence.length > 0) score += 20;
        if (businessData.webPresence.some((site) => site.businessInfo.services.length > 0)) score += 15;
        if (businessData.documentKnowledge.processedDocuments > 0) score += 15;
        if (businessData.documentKnowledge.chunks.length > 10) score += 10;
        if (businessData.contentAnalysis.expertiseAreas.length > 0) score += 8;
        if (businessData.contentAnalysis.brandVoice.length > 0) score += 7;
        return Math.min(score, maxScore);
      }
      getDataSourcesUsed(businessData) {
        const sources = [];
        if (businessData.businessProfile.businessName) sources.push("Business Profile");
        if (businessData.webPresence.length > 0) sources.push("Website Content");
        if (businessData.documentKnowledge.processedDocuments > 0) sources.push("Document Knowledge");
        if (businessData.leadInsights.totalLeads > 0) sources.push("Lead Data");
        if (businessData.competitiveIntel.industryKeywords.length > 0) sources.push("Market Intelligence");
        return sources;
      }
      determineBrandPersonality(contentAnalysis) {
        if (contentAnalysis.brandVoice.includes("Professional and Expert")) {
          return "expert";
        } else if (contentAnalysis.brandVoice.includes("Warm and Approachable")) {
          return "friendly";
        } else if (contentAnalysis.brandVoice.includes("Authoritative and Confident")) {
          return "authoritative";
        }
        return "balanced";
      }
      determineExpertiseLevel(businessData) {
        const { documentKnowledge, contentAnalysis, competitiveIntel } = businessData;
        let expertiseIndicators = 0;
        if (documentKnowledge.processedDocuments > 10) expertiseIndicators++;
        if (contentAnalysis.expertiseAreas.length > 5) expertiseIndicators++;
        if (competitiveIntel.marketPosition.includes("leader")) expertiseIndicators++;
        if (contentAnalysis.brandVoice.includes("Expert")) expertiseIndicators++;
        if (expertiseIndicators >= 3) return "expert";
        if (expertiseIndicators >= 2) return "specialized";
        return "general";
      }
    };
    intelligentPromptBuilder = new IntelligentPromptBuilder();
  }
});

// server/mcp-standalone.ts
import express3 from "express";

// server/routes.ts
init_storage();
init_schema();
import { createServer } from "http";

// server/routes/business.ts
init_db();
init_schema();
import express from "express";
import { eq as eq3 } from "drizzle-orm";
var router = express.Router();
router.get("/api/business/:userId", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    const result = await db.select().from(businessInfo).where(eq3(businessInfo.userId, userId));
    if (result.length === 0) {
      const defaultBusinessInfo = {
        userId,
        businessName: "Your Business Name",
        businessEmail: "contact@yourbusiness.com",
        businessPhone: "(123) 456-7890",
        businessAddress: "123 Business St, Business City, 12345",
        description: "Describe your business and how the AI assistant should represent you.",
        links: [],
        fileUrls: [],
        fileNames: [],
        fileTypes: [],
        fileSizes: [],
        logoUrl: null
      };
      const [newInfo] = await db.insert(businessInfo).values(defaultBusinessInfo).returning();
      return res.status(200).json({ data: newInfo });
    }
    res.status(200).json({ data: result[0] });
  } catch (error) {
    console.error("Error fetching business info:", error);
    res.status(500).json({ message: "Failed to fetch business info" });
  }
});
router.post("/api/business/:userId", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    const existing = await db.select().from(businessInfo).where(eq3(businessInfo.userId, userId));
    const data = {
      userId,
      businessName: req.body.businessName || null,
      businessEmail: req.body.businessEmail || null,
      businessPhone: req.body.businessPhone || null,
      businessAddress: req.body.businessAddress || null,
      description: req.body.description || null,
      links: req.body.links || [],
      fileUrls: req.body.fileUrls || [],
      fileNames: req.body.fileNames || [],
      fileTypes: req.body.fileTypes || [],
      fileSizes: req.body.fileSizes || [],
      logoUrl: req.body.logoUrl || null
    };
    let result;
    if (existing.length === 0) {
      result = await db.insert(businessInfo).values(data).returning();
    } else {
      result = await db.update(businessInfo).set(data).where(eq3(businessInfo.userId, userId)).returning();
    }
    res.status(200).json({ message: "Business info saved successfully", data: result[0] });
  } catch (error) {
    console.error("Error saving business info:", error);
    res.status(500).json({ message: "Failed to save business info" });
  }
});
router.post("/api/business/:userId/links", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    const { link } = req.body;
    if (!link) {
      return res.status(400).json({ message: "Link is required" });
    }
    const existing = await db.select().from(businessInfo).where(eq3(businessInfo.userId, userId));
    let result;
    if (existing.length === 0) {
      result = await db.insert(businessInfo).values({
        userId,
        description: null,
        links: [link],
        fileUrls: [],
        fileNames: [],
        fileTypes: []
      }).returning();
    } else {
      const currentLinks = existing[0].links || [];
      result = await db.update(businessInfo).set({
        links: [...currentLinks, link]
      }).where(eq3(businessInfo.userId, userId)).returning();
    }
    res.status(200).json({ message: "Link added successfully", data: result[0] });
  } catch (error) {
    console.error("Error adding link:", error);
    res.status(500).json({ message: "Failed to add link" });
  }
});
router.delete("/api/business/:userId/links/:index", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const index = parseInt(req.params.index);
    if (isNaN(userId) || isNaN(index)) {
      return res.status(400).json({ message: "Invalid parameters" });
    }
    const existing = await db.select().from(businessInfo).where(eq3(businessInfo.userId, userId));
    if (existing.length === 0) {
      return res.status(404).json({ message: "Business info not found" });
    }
    const currentLinks = existing[0].links || [];
    if (index < 0 || index >= currentLinks.length) {
      return res.status(400).json({ message: "Invalid link index" });
    }
    const updatedLinks = [...currentLinks];
    updatedLinks.splice(index, 1);
    const result = await db.update(businessInfo).set({
      links: updatedLinks
    }).where(eq3(businessInfo.userId, userId)).returning();
    res.status(200).json({ message: "Link removed successfully", data: result[0] });
  } catch (error) {
    console.error("Error removing link:", error);
    res.status(500).json({ message: "Failed to remove link" });
  }
});
router.post("/api/business/:userId/files", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    const { fileUrl, fileName, fileType, fileSize } = req.body;
    if (!fileUrl || !fileName || !fileType) {
      return res.status(400).json({ message: "File details are required" });
    }
    const existing = await db.select().from(businessInfo).where(eq3(businessInfo.userId, userId));
    let result;
    if (existing.length === 0) {
      result = await db.insert(businessInfo).values({
        userId,
        description: null,
        links: [],
        fileUrls: [fileUrl],
        fileNames: [fileName],
        fileTypes: [fileType],
        fileSizes: fileSize ? [fileSize] : []
      }).returning();
    } else {
      const currentFileUrls = existing[0].fileUrls || [];
      const currentFileNames = existing[0].fileNames || [];
      const currentFileTypes = existing[0].fileTypes || [];
      const currentFileSizes = existing[0].fileSizes || [];
      result = await db.update(businessInfo).set({
        fileUrls: [...currentFileUrls, fileUrl],
        fileNames: [...currentFileNames, fileName],
        fileTypes: [...currentFileTypes, fileType],
        fileSizes: fileSize ? [...currentFileSizes, fileSize] : currentFileSizes
      }).where(eq3(businessInfo.userId, userId)).returning();
    }
    setTimeout(async () => {
      try {
        const { ragService: ragService2 } = await Promise.resolve().then(() => (init_ragService(), ragService_exports));
        await ragService2.processUserDocuments(userId);
        console.log(`Auto RAG processing completed for user ${userId}`);
      } catch (error) {
        console.error(`Auto RAG processing failed for user ${userId}:`, error);
      }
    }, 2e3);
    res.status(200).json({ message: "File added successfully", data: result[0] });
  } catch (error) {
    console.error("Error adding file:", error);
    res.status(500).json({ message: "Failed to add file" });
  }
});
router.post("/api/business/:userId/leads", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    const { fileUrl, fileName, fileType, fileSize } = req.body;
    if (!fileUrl || !fileName || !fileType) {
      return res.status(400).json({ message: "Lead file details are required" });
    }
    const existing = await db.select().from(businessInfo).where(eq3(businessInfo.userId, userId));
    let result;
    if (existing.length === 0) {
      result = await db.insert(businessInfo).values({
        userId,
        description: null,
        links: [],
        fileUrls: [],
        fileNames: [],
        fileTypes: [],
        fileSizes: [],
        leadUrls: [fileUrl],
        leadNames: [fileName],
        leadTypes: [fileType],
        leadSizes: fileSize ? [fileSize] : []
      }).returning();
    } else {
      const currentLeadUrls = existing[0].leadUrls || [];
      const currentLeadNames = existing[0].leadNames || [];
      const currentLeadTypes = existing[0].leadTypes || [];
      const currentLeadSizes = existing[0].leadSizes || [];
      result = await db.update(businessInfo).set({
        leadUrls: [...currentLeadUrls, fileUrl],
        leadNames: [...currentLeadNames, fileName],
        leadTypes: [...currentLeadTypes, fileType],
        leadSizes: fileSize ? [...currentLeadSizes, fileSize] : currentLeadSizes
      }).where(eq3(businessInfo.userId, userId)).returning();
    }
    res.status(200).json({ message: "Lead file added successfully", data: result[0] });
  } catch (error) {
    console.error("Error adding lead file:", error);
    res.status(500).json({ message: "Failed to add lead file" });
  }
});
router.delete("/api/business/:userId/files/:index", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const index = parseInt(req.params.index);
    if (isNaN(userId) || isNaN(index)) {
      return res.status(400).json({ message: "Invalid parameters" });
    }
    const existing = await db.select().from(businessInfo).where(eq3(businessInfo.userId, userId));
    if (existing.length === 0) {
      return res.status(404).json({ message: "Business info not found" });
    }
    const currentFileUrls = existing[0].fileUrls || [];
    const currentFileNames = existing[0].fileNames || [];
    const currentFileTypes = existing[0].fileTypes || [];
    const currentFileSizes = existing[0].fileSizes || [];
    if (index < 0 || index >= currentFileUrls.length || index >= currentFileNames.length || index >= currentFileTypes.length) {
      return res.status(400).json({ message: "Invalid file index" });
    }
    const updatedFileUrls = [...currentFileUrls];
    const updatedFileNames = [...currentFileNames];
    const updatedFileTypes = [...currentFileTypes];
    const updatedFileSizes = [...currentFileSizes];
    updatedFileUrls.splice(index, 1);
    updatedFileNames.splice(index, 1);
    updatedFileTypes.splice(index, 1);
    if (index < updatedFileSizes.length) {
      updatedFileSizes.splice(index, 1);
    }
    const result = await db.update(businessInfo).set({
      fileUrls: updatedFileUrls,
      fileNames: updatedFileNames,
      fileTypes: updatedFileTypes,
      fileSizes: updatedFileSizes
    }).where(eq3(businessInfo.userId, userId)).returning();
    res.status(200).json({ message: "File removed successfully", data: result[0] });
  } catch (error) {
    console.error("Error removing file:", error);
    res.status(500).json({ message: "Failed to remove file" });
  }
});
router.delete("/api/business/:userId/leads/:index", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const index = parseInt(req.params.index);
    if (isNaN(userId) || isNaN(index)) {
      return res.status(400).json({ message: "Invalid parameters" });
    }
    const existing = await db.select().from(businessInfo).where(eq3(businessInfo.userId, userId));
    if (existing.length === 0) {
      return res.status(404).json({ message: "Business info not found" });
    }
    const currentLeadUrls = existing[0].leadUrls || [];
    const currentLeadNames = existing[0].leadNames || [];
    const currentLeadTypes = existing[0].leadTypes || [];
    const currentLeadSizes = existing[0].leadSizes || [];
    if (index < 0 || index >= currentLeadUrls.length || index >= currentLeadNames.length || index >= currentLeadTypes.length) {
      return res.status(400).json({ message: "Invalid lead file index" });
    }
    const updatedLeadUrls = [...currentLeadUrls];
    const updatedLeadNames = [...currentLeadNames];
    const updatedLeadTypes = [...currentLeadTypes];
    const updatedLeadSizes = [...currentLeadSizes];
    updatedLeadUrls.splice(index, 1);
    updatedLeadNames.splice(index, 1);
    updatedLeadTypes.splice(index, 1);
    if (index < updatedLeadSizes.length) {
      updatedLeadSizes.splice(index, 1);
    }
    const result = await db.update(businessInfo).set({
      leadUrls: updatedLeadUrls,
      leadNames: updatedLeadNames,
      leadTypes: updatedLeadTypes,
      leadSizes: updatedLeadSizes
    }).where(eq3(businessInfo.userId, userId)).returning();
    res.status(200).json({ message: "Lead file removed successfully", data: result[0] });
  } catch (error) {
    console.error("Error removing lead file:", error);
    res.status(500).json({ message: "Failed to remove lead file" });
  }
});
router.post("/api/business/:userId/profile", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    const profileData = req.body;
    const responseData = {
      userId,
      businessName: profileData.businessName,
      businessEmail: profileData.businessEmail,
      businessPhone: profileData.businessPhone,
      businessAddress: profileData.businessAddress,
      description: profileData.description,
      links: [],
      fileUrls: [],
      fileNames: [],
      fileTypes: [],
      fileSizes: [],
      updatedAt: /* @__PURE__ */ new Date()
    };
    res.status(200).json({
      message: "Profile updated successfully",
      data: responseData
    });
    try {
      const existing = await db.select().from(businessInfo).where(eq3(businessInfo.userId, userId));
      if (existing.length === 0) {
        await db.insert(businessInfo).values({
          userId,
          businessName: profileData.businessName || null,
          businessEmail: profileData.businessEmail || null,
          businessPhone: profileData.businessPhone || null,
          businessAddress: profileData.businessAddress || null,
          description: profileData.description || null,
          links: [],
          fileUrls: [],
          fileNames: [],
          fileTypes: [],
          fileSizes: []
        });
      } else {
        await db.update(businessInfo).set({
          businessName: profileData.businessName || existing[0].businessName,
          businessEmail: profileData.businessEmail || existing[0].businessEmail,
          businessPhone: profileData.businessPhone || existing[0].businessPhone,
          businessAddress: profileData.businessAddress || existing[0].businessAddress,
          description: profileData.description || existing[0].description,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq3(businessInfo.userId, userId));
      }
    } catch (dbError) {
      console.error("Background DB update error:", dbError);
    }
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Failed to update profile" });
  }
});
router.post("/api/business/:userId/description", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    const { description } = req.body;
    if (description === void 0) {
      return res.status(400).json({ message: "Description is required" });
    }
    const existing = await db.select().from(businessInfo).where(eq3(businessInfo.userId, userId));
    let result;
    if (existing.length === 0) {
      result = await db.insert(businessInfo).values({
        userId,
        description,
        links: [],
        fileUrls: [],
        fileNames: [],
        fileTypes: []
      }).returning();
    } else {
      result = await db.update(businessInfo).set({
        description
      }).where(eq3(businessInfo.userId, userId)).returning();
    }
    res.status(200).json({ message: "Description updated successfully", data: result[0] });
  } catch (error) {
    console.error("Error updating description:", error);
    res.status(500).json({ message: "Failed to update description" });
  }
});
var business_default = router;

// server/adminRoutes.ts
init_storage();
init_twilioService();
import { Router } from "express";
var router2 = Router();
router2.get("/admin/users", async (req, res) => {
  try {
    const users2 = await storage.getAllUsers();
    const usersWithTwilioStatus = await Promise.all(
      users2.map(async (user) => {
        const businessInfo2 = await storage.getBusinessInfo(user.id);
        return {
          id: user.id,
          email: user.email,
          businessName: user.businessName,
          createdAt: user.createdAt,
          twilioConfigured: !!(businessInfo2?.twilioAccountSid && businessInfo2?.twilioAuthToken),
          twilioPhone: businessInfo2?.twilioPhoneNumber || null
        };
      })
    );
    res.json({
      message: "Users retrieved successfully",
      users: usersWithTwilioStatus,
      count: usersWithTwilioStatus.length
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});
router2.post("/admin/users/:userId/twilio/setup", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { accountSid, authToken, phoneNumber } = req.body;
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    if (!accountSid || !authToken || !phoneNumber) {
      return res.status(400).json({
        message: "Missing required fields: accountSid, authToken, phoneNumber"
      });
    }
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    console.log(`\u{1F527} Admin setting up Twilio for user ${userId} (${user.email})`);
    const result = await twilioService.setupUserTwilioIntegration(
      userId,
      accountSid,
      authToken,
      phoneNumber
    );
    if (result.success) {
      console.log(`\u2705 Admin successfully configured Twilio for user ${userId}`);
      res.json({
        message: `Twilio integration configured for ${user.email}`,
        success: true,
        user: {
          id: userId,
          email: user.email,
          phoneNumber
        }
      });
    } else {
      console.log(`\u274C Admin failed to configure Twilio for user ${userId}: ${result.message}`);
      res.status(400).json({
        message: result.message,
        success: false
      });
    }
  } catch (error) {
    console.error("Admin error setting up Twilio integration:", error);
    res.status(500).json({
      message: "Admin failed to set up Twilio integration",
      success: false
    });
  }
});
router2.post("/admin/users/:userId/twilio/numbers", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { accountSid, authToken } = req.body;
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    if (!accountSid || !authToken) {
      return res.status(400).json({
        message: "Missing required fields: accountSid, authToken"
      });
    }
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    console.log(`\u{1F527} Admin fetching Twilio numbers for user ${userId} (${user.email})`);
    const credentialsValid = await twilioService.validateUserTwilioCredentials(accountSid, authToken);
    if (!credentialsValid) {
      return res.status(400).json({
        message: "Invalid Twilio credentials",
        phoneNumbers: []
      });
    }
    const phoneNumbers = await twilioService.getUserTwilioNumbers(accountSid, authToken);
    console.log(`\u{1F4DE} Found ${phoneNumbers.length} phone numbers for user ${userId}`);
    res.json({
      phoneNumbers,
      message: `Found ${phoneNumbers.length} phone number(s) for ${user.email}`,
      user: {
        id: userId,
        email: user.email
      }
    });
  } catch (error) {
    console.error("Admin error fetching Twilio numbers:", error);
    res.status(500).json({
      message: "Admin failed to fetch phone numbers",
      phoneNumbers: []
    });
  }
});
router2.get("/admin/users/:userId/twilio/config", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const businessInfo2 = await storage.getBusinessInfo(userId);
    const twilioConfig = {
      configured: !!(businessInfo2?.twilioAccountSid && businessInfo2?.twilioAuthToken),
      phoneNumber: businessInfo2?.twilioPhoneNumber || null,
      accountSid: businessInfo2?.twilioAccountSid ? `${businessInfo2.twilioAccountSid.substring(0, 8)}...` : null
      // Masked for security
    };
    res.json({
      user: {
        id: userId,
        email: user.email,
        businessName: user.businessName
      },
      twilioConfig,
      message: `Twilio configuration for ${user.email}`
    });
  } catch (error) {
    console.error("Admin error fetching Twilio config:", error);
    res.status(500).json({
      message: "Admin failed to fetch Twilio configuration"
    });
  }
});
router2.delete("/admin/users/:userId/twilio", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    console.log(`\u{1F527} Admin removing Twilio integration for user ${userId} (${user.email})`);
    await storage.updateTwilioSettings(userId, {
      accountSid: "",
      authToken: "",
      phoneNumber: ""
    });
    console.log(`\u2705 Admin successfully removed Twilio integration for user ${userId}`);
    res.json({
      message: `Twilio integration removed for ${user.email}`,
      success: true,
      user: {
        id: userId,
        email: user.email
      }
    });
  } catch (error) {
    console.error("Admin error removing Twilio integration:", error);
    res.status(500).json({
      message: "Admin failed to remove Twilio integration",
      success: false
    });
  }
});
router2.get("/admin/calls/stats", async (req, res) => {
  try {
    const users2 = await storage.getAllUsers();
    const callStats = await Promise.all(
      users2.map(async (user) => {
        const calls2 = await storage.getCallsByUserId(user.id);
        return {
          userId: user.id,
          email: user.email,
          businessName: user.businessName,
          totalCalls: calls2.length,
          recentCalls: calls2.filter((call) => {
            const callDate = new Date(call.createdAt);
            const weekAgo = /* @__PURE__ */ new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return callDate > weekAgo;
          }).length
        };
      })
    );
    const totalCalls = callStats.reduce((sum, stat) => sum + stat.totalCalls, 0);
    const totalRecentCalls = callStats.reduce((sum, stat) => sum + stat.recentCalls, 0);
    res.json({
      message: "Call statistics retrieved successfully",
      stats: {
        totalUsers: users2.length,
        totalCalls,
        recentCalls: totalRecentCalls,
        userStats: callStats
      }
    });
  } catch (error) {
    console.error("Admin error fetching call stats:", error);
    res.status(500).json({
      message: "Admin failed to fetch call statistics"
    });
  }
});
var adminRoutes_default = router2;

// server/routes/clientApi.ts
init_storage();
import { Router as Router2 } from "express";

// server/enhancedPromptBuilder.ts
function buildEnhancedPrompt(businessInfo2, documentChunks2 = []) {
  const {
    businessName,
    description,
    businessAddress,
    businessPhone,
    businessEmail,
    links,
    fileNames,
    fileTypes
  } = businessInfo2;
  const intro = `You are an intelligent, professional voice agent representing ${businessName}. You have access to comprehensive knowledge about this business through their uploaded documents and web content.`;
  const businessDetails = `
BUSINESS PROFILE:
- Company Name: ${businessName}
- Business Description: ${description || "No specific description provided"}
- Contact Information:
  \u2022 Address: ${businessAddress || "Not specified"}
  \u2022 Phone: ${businessPhone || "Not available"}
  \u2022 Email: ${businessEmail || "Not available"}
- Website & Resources: ${links?.join(", ") || "No websites listed"}
- Available Documents: ${fileNames?.length || 0} files uploaded (${fileTypes?.join(", ") || "none"})
  `;
  let knowledgeBase = "";
  if (documentChunks2 && documentChunks2.length > 0) {
    const documentGroups = groupChunksByDocument(documentChunks2);
    knowledgeBase = `
KNOWLEDGE BASE FROM DOCUMENTS:
${Object.entries(documentGroups).map(([docTitle, chunks]) => `
\u{1F4C4} ${docTitle}:
${chunks.slice(0, 3).map((chunk) => `\u2022 ${chunk.summary || chunk.content.slice(0, 200)}...`).join("\n")}
${chunks.length > 3 ? `... and ${chunks.length - 3} more sections` : ""}
`).join("\n")}

KEY TOPICS COVERED:
${extractKeyTopics(documentChunks2)}
    `;
  } else {
    knowledgeBase = `
KNOWLEDGE BASE:
No processed documents available yet. Base responses on business profile information only.
    `;
  }
  const instructions = `
INSTRUCTIONS FOR VOICE AGENT:

1. IDENTITY & ROLE:
   - Always represent yourself as part of ${businessName}
   - Use "we", "our", and "us" when referring to the business
   - Be professional, knowledgeable, and helpful

2. CONVERSATION STYLE:
   - Be conversational, natural, and professional
   - Speak as if you work directly for the company
   - Keep responses concise but informative
   - Never say "based on our documentation" or reference documents directly
   - Answer naturally as if the information is your own knowledge

3. KNOWLEDGE USAGE:
   - Use information from the knowledge base to answer questions naturally
   - When discussing services/products, provide details confidently
   - Stay on topic and relevant to the business
   - If you don't have specific information, don't make it up

4. WHEN YOU DON'T KNOW THE ANSWER:
   - If you can't answer a question with available information, offer to have a team member get back to them
   - Collect their contact information naturally as part of the conversation
   - Stay helpful and professional throughout

5. CALL-TO-ACTION:
   - Guide conversations toward helpful outcomes
   - Offer callbacks when appropriate
   - Provide contact information when requested
   - Suggest relevant services based on customer needs
`;
  return `${intro}

${businessDetails}

${knowledgeBase}

${instructions}`;
}
function groupChunksByDocument(chunks) {
  const groups = {};
  chunks.forEach((chunk) => {
    const key = chunk.documentTitle || `Document ${chunk.documentId}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(chunk);
  });
  return groups;
}
function extractKeyTopics(chunks) {
  const allKeywords = [];
  chunks.forEach((chunk) => {
    if (chunk.keywords) {
      allKeywords.push(...chunk.keywords);
    }
  });
  const keywordCounts = {};
  allKeywords.forEach((keyword) => {
    keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
  });
  const topKeywords = Object.entries(keywordCounts).sort(([, a], [, b]) => b - a).slice(0, 15).map(([keyword]) => keyword);
  return topKeywords.length > 0 ? `\u2022 ${topKeywords.join(" \u2022 ")}` : "No specific topics identified yet";
}

// server/routes/clientApi.ts
init_db();
init_schema();
import { eq as eq4, and as and2 } from "drizzle-orm";
var router3 = Router2();
async function validateApiKey(req, res, next) {
  const apiKey = req.headers["x-api-key"];
  if (!apiKey) {
    return res.status(401).json({
      error: "API key required",
      message: "Include your API key in the X-API-Key header"
    });
  }
  try {
    const user = await storage.validateApiKey(apiKey);
    if (!user) {
      return res.status(401).json({
        error: "Invalid API key",
        message: "The provided API key is not valid or has been revoked"
      });
    }
    req.user = user;
    next();
  } catch (error) {
    console.error("API key validation error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to validate API key"
    });
  }
}
router3.use(validateApiKey);
router3.get("/business", async (req, res) => {
  try {
    const user = req.user;
    const businessInfo2 = await storage.getBusinessInfo(user.id);
    if (!businessInfo2) {
      return res.status(404).json({
        error: "Business info not found",
        message: "No business information available for this client"
      });
    }
    const voiceAgentData = {
      businessName: businessInfo2.businessName,
      businessEmail: businessInfo2.businessEmail,
      businessPhone: businessInfo2.businessPhone,
      businessAddress: businessInfo2.businessAddress,
      description: businessInfo2.description,
      links: businessInfo2.links || [],
      servicePlan: user.servicePlan,
      website: user.website,
      files: businessInfo2.fileNames?.map((name, index) => ({
        name,
        type: businessInfo2.fileTypes?.[index],
        url: businessInfo2.fileUrls?.[index]
      })) || [],
      leadSources: businessInfo2.leadNames?.map((name, index) => ({
        name,
        type: businessInfo2.leadTypes?.[index],
        url: businessInfo2.leadUrls?.[index]
      })) || []
    };
    res.json({
      success: true,
      data: voiceAgentData,
      clientId: user.id,
      lastUpdated: businessInfo2.updatedAt
    });
  } catch (error) {
    console.error("Error fetching client business data:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to retrieve business information"
    });
  }
});
router3.get("/calls", async (req, res) => {
  try {
    const user = req.user;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const calls2 = await storage.getCallsByUserId(user.id);
    const paginatedCalls = calls2.slice(offset, offset + limit);
    const voiceAgentCalls = paginatedCalls.map((call) => ({
      id: call.id,
      phoneNumber: call.phoneNumber,
      contactName: call.contactName,
      duration: call.duration,
      status: call.status,
      direction: call.direction,
      summary: call.summary,
      transcript: call.transcript,
      notes: call.notes,
      createdAt: call.createdAt,
      isFromTwilio: call.isFromTwilio
    }));
    res.json({
      success: true,
      data: voiceAgentCalls,
      pagination: {
        total: calls2.length,
        limit,
        offset,
        hasMore: offset + limit < calls2.length
      },
      clientId: user.id
    });
  } catch (error) {
    console.error("Error fetching client calls:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to retrieve call data"
    });
  }
});
router3.get("/call-patterns", async (req, res) => {
  try {
    const user = req.user;
    const days = parseInt(req.query.days) || 30;
    const calls2 = await storage.getCallsByUserId(user.id);
    const cutoffDate = /* @__PURE__ */ new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const recentCalls = calls2.filter(
      (call) => call.createdAt && new Date(call.createdAt) > cutoffDate
    );
    const patterns = {
      totalCalls: recentCalls.length,
      averageDuration: recentCalls.length > 0 ? Math.round(recentCalls.reduce((sum, call) => sum + (call.duration || 0), 0) / recentCalls.length) : 0,
      statusBreakdown: {
        completed: recentCalls.filter((c) => c.status === "completed").length,
        missed: recentCalls.filter((c) => c.status === "missed").length,
        failed: recentCalls.filter((c) => c.status === "failed").length
      },
      directionBreakdown: {
        inbound: recentCalls.filter((c) => c.direction === "inbound").length,
        outbound: recentCalls.filter((c) => c.direction === "outbound").length
      },
      commonContacts: recentCalls.filter((call) => call.contactName).reduce((acc, call) => {
        acc[call.contactName] = (acc[call.contactName] || 0) + 1;
        return acc;
      }, {}),
      busyHours: recentCalls.reduce((acc, call) => {
        if (call.createdAt) {
          const hour = new Date(call.createdAt).getHours();
          acc[hour] = (acc[hour] || 0) + 1;
        }
        return acc;
      }, {}),
      successfulExamples: recentCalls.filter((call) => call.status === "completed" && call.summary).slice(-5).map((call) => ({
        summary: call.summary,
        duration: call.duration,
        notes: call.notes
      }))
    };
    res.json({
      success: true,
      data: patterns,
      dateRange: {
        from: cutoffDate.toISOString(),
        to: (/* @__PURE__ */ new Date()).toISOString(),
        days
      },
      clientId: user.id
    });
  } catch (error) {
    console.error("Error analyzing call patterns:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to analyze call patterns"
    });
  }
});
router3.get("/leads", async (req, res) => {
  try {
    const user = req.user;
    const leads2 = await storage.getLeadsByUserId(user.id);
    const voiceAgentLeads = leads2.map((lead) => ({
      id: lead.id,
      name: lead.name,
      phoneNumber: lead.phoneNumber,
      email: lead.email,
      company: lead.company,
      notes: lead.notes,
      createdAt: lead.createdAt
    }));
    res.json({
      success: true,
      data: voiceAgentLeads,
      total: leads2.length,
      clientId: user.id
    });
  } catch (error) {
    console.error("Error fetching client leads:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to retrieve leads"
    });
  }
});
router3.get("/profile", async (req, res) => {
  try {
    const user = req.user;
    const businessInfo2 = await storage.getBusinessInfo(user.id);
    const calls2 = await storage.getCallsByUserId(user.id);
    const leads2 = await storage.getLeadsByUserId(user.id);
    const profile = {
      client: {
        id: user.id,
        businessName: user.businessName,
        email: user.email,
        phone: user.phoneNumber,
        website: user.website,
        servicePlan: user.servicePlan,
        joinedDate: user.createdAt
      },
      business: businessInfo2 ? {
        description: businessInfo2.description,
        address: businessInfo2.businessAddress,
        email: businessInfo2.businessEmail,
        phone: businessInfo2.businessPhone
      } : null,
      activity: {
        totalCalls: calls2.length,
        totalLeads: leads2.length,
        recentCallsCount: calls2.filter((call) => {
          if (!call.createdAt) return false;
          const weekAgo = /* @__PURE__ */ new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return new Date(call.createdAt) > weekAgo;
        }).length,
        lastCallDate: calls2.length > 0 ? calls2.filter((call) => call.createdAt).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]?.createdAt || null : null
      },
      preferences: {
        servicePlan: user.servicePlan,
        autoLogging: true
      }
    };
    res.json({
      success: true,
      data: profile,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (error) {
    console.error("Error generating client profile:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to generate client profile"
    });
  }
});
router3.get("/prompt", async (req, res) => {
  try {
    const user = req.user;
    const businessInfo2 = await storage.getBusinessInfo(user.id);
    if (!businessInfo2) {
      return res.status(404).json({
        error: "Business info not found",
        message: "No business information available for this client"
      });
    }
    let rawDocumentChunks = [];
    let documentsCount = 0;
    try {
      rawDocumentChunks = await db.select({
        id: documentChunks.id,
        documentId: documentChunks.documentId,
        content: documentChunks.content,
        summary: documentChunks.summary,
        keywords: documentChunks.keywords,
        chunkIndex: documentChunks.chunkIndex,
        wordCount: documentChunks.wordCount,
        userId: documentChunks.userId,
        createdAt: documentChunks.createdAt,
        documentTitle: documents.title,
        sourceType: documents.sourceType
      }).from(documentChunks).innerJoin(documents, eq4(documentChunks.documentId, documents.id)).where(and2(
        eq4(documentChunks.userId, user.id),
        eq4(documents.status, "completed")
      )).orderBy(documentChunks.documentId, documentChunks.chunkIndex).limit(50);
      const uniqueDocumentIds = new Set(rawDocumentChunks.map((c) => c.documentId));
      documentsCount = Array.from(uniqueDocumentIds).length;
    } catch (error) {
      console.log("RAG tables not ready yet, using basic prompt");
      rawDocumentChunks = [];
      documentsCount = 0;
    }
    const aiPrompt = buildEnhancedPrompt(businessInfo2, rawDocumentChunks);
    res.json({
      success: true,
      prompt: aiPrompt,
      clientId: user.id,
      knowledgeBaseSize: rawDocumentChunks.length,
      documentsProcessed: documentsCount,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (error) {
    console.error("Error building enhanced prompt:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to generate enhanced prompt"
    });
  }
});
router3.get("/health", (req, res) => {
  const user = req.user;
  res.json({
    success: true,
    message: "Client API is operational",
    clientId: user.id,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
var clientApi_default = router3;

// server/routes/apiKeyRoutes.ts
init_storage();
import { Router as Router3 } from "express";
var router4 = Router3();
router4.post("/users/:userId/api-key/generate", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const apiKey = await storage.generateApiKey(userId);
    res.json({
      success: true,
      message: "API key generated successfully",
      apiKey,
      userId,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      instructions: {
        usage: "Include this API key in the X-API-Key header when making requests",
        baseUrl: "https://your-domain.com/api/client",
        endpoints: [
          "GET /api/client/business - Get business information",
          "GET /api/client/calls - Get call data",
          "GET /api/client/call-patterns - Get call analytics",
          "GET /api/client/leads - Get leads data",
          "GET /api/client/profile - Get complete client profile"
        ]
      }
    });
  } catch (error) {
    console.error("Error generating API key:", error);
    res.status(500).json({ message: "Failed to generate API key" });
  }
});
router4.get("/users/:userId/api-key/info", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({
      success: true,
      hasApiKey: !!user.apiKey,
      apiKeyCreatedAt: user.apiKeyCreatedAt,
      apiKeyLastUsed: user.apiKeyLastUsed,
      apiKeyPreview: user.apiKey ? `${user.apiKey.substring(0, 20)}...` : null,
      userId,
      email: user.email,
      businessName: user.businessName
    });
  } catch (error) {
    console.error("Error fetching API key info:", error);
    res.status(500).json({ message: "Failed to fetch API key information" });
  }
});
router4.delete("/users/:userId/api-key", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    await storage.revokeApiKey(userId);
    res.json({
      success: true,
      message: "API key revoked successfully",
      userId
    });
  } catch (error) {
    console.error("Error revoking API key:", error);
    res.status(500).json({ message: "Failed to revoke API key" });
  }
});
router4.get("/api-keys/status", async (req, res) => {
  try {
    const users2 = await storage.getAllUsers();
    const usersWithApiKeyStatus = users2.map((user) => ({
      id: user.id,
      email: user.email,
      businessName: user.businessName,
      hasApiKey: !!user.apiKey,
      apiKeyCreatedAt: user.apiKeyCreatedAt,
      apiKeyLastUsed: user.apiKeyLastUsed,
      apiKeyPreview: user.apiKey ? `${user.apiKey.substring(0, 20)}...` : null
    }));
    res.json({
      success: true,
      message: "API key status retrieved successfully",
      users: usersWithApiKeyStatus,
      total: users2.length,
      activeApiKeys: users2.filter((user) => !!user.apiKey).length
    });
  } catch (error) {
    console.error("Error fetching API key status:", error);
    res.status(500).json({ message: "Failed to fetch API key status" });
  }
});
var apiKeyRoutes_default = router4;

// server/routes/ragRoutes.ts
init_ragService();
init_storage();
import { Router as Router4 } from "express";
var router5 = Router4();
router5.post("/api/rag/process/:userId", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    console.log(`Starting RAG processing for user ${userId}`);
    ragService.processUserDocuments(userId).catch((error) => {
      console.error(`Background RAG processing failed for user ${userId}:`, error);
    });
    res.json({
      message: "Document processing started",
      userId,
      note: "Processing will continue in the background"
    });
  } catch (error) {
    console.error("Error starting RAG processing:", error);
    res.status(500).json({ message: "Failed to start document processing" });
  }
});
router5.get("/api/rag/search/:userId", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const query = req.query.q;
    const limit = parseInt(req.query.limit) || 10;
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    if (!query || query.trim().length === 0) {
      return res.status(400).json({ message: "Search query is required" });
    }
    console.log(`RAG search for user ${userId}: "${query}"`);
    const results = await ragService.searchDocuments(userId, query, limit);
    res.json({
      success: true,
      query,
      results,
      count: results.length,
      userId
    });
  } catch (error) {
    console.error("Error searching documents:", error);
    res.status(500).json({ message: "Search failed" });
  }
});
router5.get("/api/rag/status/:userId", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    const status = await ragService.getDocumentStatus(userId);
    res.json({
      success: true,
      userId,
      status
    });
  } catch (error) {
    console.error("Error getting document status:", error);
    res.status(500).json({ message: "Failed to get document status" });
  }
});
router5.post("/api/rag/auto-process/:userId", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    console.log(`Auto-processing triggered for user ${userId}`);
    setTimeout(() => {
      ragService.processUserDocuments(userId).catch((error) => {
        console.error(`Auto RAG processing failed for user ${userId}:`, error);
      });
    }, 1e3);
    res.json({
      message: "Auto-processing initiated",
      userId
    });
  } catch (error) {
    console.error("Error in auto-processing:", error);
    res.status(500).json({ message: "Auto-processing failed" });
  }
});
var ragRoutes_default = router5;

// server/routes.ts
init_db();
import { eq as eq6 } from "drizzle-orm";
async function registerRoutes(app2) {
  app2.get("/healthz", (req, res) => {
    res.status(200).json({ status: "healthy" });
  });
  app2.get("/api/health", (req, res) => {
    res.status(200).json({
      status: "healthy",
      service: "Sky IQ Platform",
      uptime: process.uptime()
    });
  });
  app2.get("/api/auth/user/:id", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const { password, ...userWithoutPassword } = user;
      res.status(200).json({ data: userWithoutPassword });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user data" });
    }
  });
  app2.use(business_default);
  app2.use(adminRoutes_default);
  app2.use("/api/client", clientApi_default);
  app2.use("/api", apiKeyRoutes_default);
  app2.use(ragRoutes_default);
  app2.post("/api/auth/register", async (req, res) => {
    try {
      const validation = insertUserSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Invalid input data",
          errors: validation.error.format()
        });
      }
      const newUser = await storage.createUser(validation.data);
      const { password, ...userWithoutPassword } = newUser;
      res.status(201).json({
        message: "User registered successfully",
        user: userWithoutPassword
      });
    } catch (error) {
      res.status(400).json({ message: error.message || "Registration failed" });
    }
  });
  app2.post("/api/auth/login", async (req, res) => {
    try {
      const validation = loginUserSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Invalid input data",
          errors: validation.error.format()
        });
      }
      const user = await storage.validateUserCredentials(validation.data);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      const { password, ...userWithoutPassword } = user;
      res.status(200).json({
        message: "Login successful",
        user: userWithoutPassword
      });
    } catch (error) {
      res.status(500).json({ message: error.message || "Login failed" });
    }
  });
  app2.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const validation = forgotPasswordSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Invalid input data",
          errors: validation.error.format()
        });
      }
      await storage.requestPasswordReset(validation.data);
      res.status(200).json({ message: "Password reset instructions sent if email exists" });
    } catch (error) {
      res.status(500).json({ message: "Password reset request failed" });
    }
  });
  app2.get("/api/auth/verify-email/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const success = await storage.verifyEmail(token);
      if (success) {
        res.json({ message: "Email verified successfully! You can now log in." });
      } else {
        res.status(400).json({ message: "Invalid or expired verification token" });
      }
    } catch (error) {
      console.error("Email verification error:", error);
      res.status(500).json({ message: "Failed to verify email" });
    }
  });
  app2.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;
      if (!token || !password) {
        return res.status(400).json({ message: "Token and password are required" });
      }
      const success = await storage.resetPassword(token, password);
      if (success) {
        res.json({ message: "Password reset successfully! You can now log in with your new password." });
      } else {
        res.status(400).json({ message: "Invalid or expired reset token" });
      }
    } catch (error) {
      console.error("Password reset error:", error);
      res.status(400).json({ message: error.message || "Failed to reset password" });
    }
  });
  app2.post("/api/auth/resend-verification", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      const success = await storage.resendVerificationEmail(email);
      if (success) {
        res.json({ message: "Verification email sent successfully" });
      } else {
        res.status(400).json({ message: "Email not found or already verified" });
      }
    } catch (error) {
      console.error("Resend verification error:", error);
      res.status(500).json({ message: "Failed to resend verification email" });
    }
  });
  app2.get("/api/health/detailed", async (req, res) => {
    try {
      const user = await storage.getUser(1);
      res.json({
        status: "healthy",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        uptime: process.uptime(),
        database: "connected",
        version: "1.0.0",
        environment: process.env.NODE_ENV || "development",
        databaseTest: user ? "passed" : "no_user_found"
      });
    } catch (error) {
      res.status(503).json({
        status: "unhealthy",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        error: "Database connection failed"
      });
    }
  });
  app2.post("/api/test-email", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      const emailData = {
        from: {
          email: "info@skyiq.app",
          name: "Sky IQ"
        },
        to: [
          {
            email,
            name: "Test User"
          }
        ],
        subject: "Sky IQ Email Service Test",
        html: `
          <h2>Email Test Successful!</h2>
          <p>This is a test email from Sky IQ to verify that email sending is working correctly.</p>
          <p>If you received this email, the email service is properly configured with info@skyiq.app.</p>
        `,
        text: "Email Test Successful! This is a test email from Sky IQ to verify that email sending is working correctly."
      };
      console.log(`Testing MailerSend API with verified domain...`);
      const response = await fetch("https://api.mailersend.com/v1/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
          "Authorization": `Bearer ${process.env.MAILERSEND_API_TOKEN}`
        },
        body: JSON.stringify(emailData)
      });
      console.log(`MailerSend API response status: ${response.status}`);
      if (!response.ok) {
        const responseText = await response.text();
        console.error("MailerSend API error:", response.status, responseText);
        return res.status(500).json({ message: "Failed to send test email", error: responseText });
      }
      console.log(`Test email sent successfully via MailerSend API`);
      res.json({ message: "Test email sent successfully via MailerSend", status: response.status });
    } catch (error) {
      console.error("Test email error:", error);
      res.status(500).json({ message: "Failed to send test email", error: error.message });
    }
  });
  app2.post("/api/calls", async (req, res) => {
    try {
      const callData = req.body;
      if (!callData.userId || isNaN(parseInt(callData.userId))) {
        return res.status(400).json({ message: "Valid user ID is required" });
      }
      let duration = 0;
      if (callData.duration) {
        if (typeof callData.duration === "number") {
          duration = callData.duration;
        } else if (typeof callData.duration === "string" && callData.duration.includes("m")) {
          const parts = callData.duration.split("m ");
          const minutes = parseInt(parts[0]) || 0;
          const seconds = parseInt(parts[1]?.split("s")[0]) || 0;
          duration = minutes * 60 + seconds;
        }
      }
      const result = await db.insert(calls).values({
        userId: parseInt(callData.userId),
        phoneNumber: callData.number || callData.phoneNumber,
        contactName: callData.name || callData.contactName || null,
        duration,
        status: callData.status || "completed",
        notes: callData.notes || null,
        summary: callData.summary || null,
        createdAt: callData.date ? /* @__PURE__ */ new Date(`${callData.date} ${callData.time || "00:00:00"}`) : /* @__PURE__ */ new Date()
      }).returning();
      res.status(201).json({
        message: "Call created successfully",
        data: result[0]
      });
    } catch (error) {
      console.error("Error creating call:", error);
      res.status(500).json({ message: "Failed to create call" });
    }
  });
  app2.delete("/api/calls/:id", async (req, res) => {
    try {
      const callId = parseInt(req.params.id);
      const userId = parseInt(req.query.userId);
      if (isNaN(callId)) {
        return res.status(400).json({ message: "Invalid call ID" });
      }
      if (isNaN(userId)) {
        return res.status(400).json({ message: "User ID is required" });
      }
      const callToDelete = await db.select().from(calls).where(eq6(calls.id, callId)).limit(1);
      if (callToDelete.length === 0) {
        return res.status(404).json({ message: "Call not found" });
      }
      if (callToDelete[0].userId !== userId) {
        return res.status(403).json({ message: "Not authorized to delete this call" });
      }
      const result = await db.delete(calls).where(eq6(calls.id, callId)).returning();
      res.status(200).json({
        message: "Call deleted successfully",
        data: result[0]
      });
    } catch (error) {
      console.error("Error deleting call:", error);
      res.status(500).json({ message: "Failed to delete call" });
    }
  });
  app2.get("/api/calls/user/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      const result = await db.select().from(calls).where(eq6(calls.userId, userId)).orderBy(calls.createdAt);
      console.log(`Retrieved ${result.length} calls for user ${userId}`);
      res.status(200).json({
        message: "Calls retrieved successfully",
        data: result,
        count: result.length
      });
    } catch (error) {
      console.error("Error fetching calls:", error);
      res.status(500).json({ message: "Failed to fetch calls" });
    }
  });
  app2.post("/api/railway/sarah-calls", async (req, res) => {
    try {
      const {
        phoneNumber,
        contactName,
        duration,
        status,
        summary,
        notes,
        transcript,
        direction = "inbound",
        callStartTime,
        callEndTime
      } = req.body;
      if (!phoneNumber) {
        return res.status(400).json({
          message: "Missing required field: phoneNumber"
        });
      }
      const targetUser = await storage.getUserByEmail("audamaur@gmail.com");
      if (!targetUser) {
        return res.status(404).json({
          message: "Target user Audamaur@gmail.com not found in system"
        });
      }
      const mapStatus = (rawStatus) => {
        const statusLower = (rawStatus || "").toLowerCase();
        if (statusLower.includes("completed") || statusLower.includes("success")) return "completed";
        if (statusLower.includes("missed") || statusLower.includes("no-answer")) return "missed";
        if (statusLower.includes("failed") || statusLower.includes("error")) return "failed";
        return "completed";
      };
      const callData = {
        userId: targetUser.id,
        phoneNumber,
        contactName: contactName || "Unknown Caller",
        duration: duration || 0,
        status: mapStatus(status),
        summary: summary || "AI assistant call via Railway",
        notes: notes || "",
        transcript: transcript || "",
        direction,
        isFromTwilio: false,
        // Mark as Railway integration
        createdAt: callStartTime ? new Date(callStartTime) : /* @__PURE__ */ new Date()
      };
      const newCall = await storage.createCall(callData);
      console.log(`Railway call logged for ${targetUser.email}:`, newCall);
      res.status(200).json({
        message: "Call logged successfully for Audamaur@gmail.com",
        callId: newCall.id,
        userId: targetUser.id
      });
    } catch (error) {
      console.error("Error processing Sarah's Railway call webhook:", error);
      res.status(500).json({
        message: "Error logging call for Audamaur@gmail.com",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app2.post("/api/railway/call-webhook", async (req, res) => {
    try {
      const {
        userId,
        phoneNumber,
        contactName,
        duration,
        status,
        summary,
        notes,
        transcript,
        direction = "inbound",
        callStartTime,
        recordingUrl,
        twilioCallSid
      } = req.body;
      if (!userId || !phoneNumber) {
        return res.status(400).json({
          message: "Missing required fields: userId and phoneNumber are required"
        });
      }
      const mapStatus = (rawStatus) => {
        const statusLower = (rawStatus || "").toLowerCase();
        if (statusLower.includes("completed") || statusLower.includes("success")) return "completed";
        if (statusLower.includes("missed") || statusLower.includes("no-answer")) return "missed";
        if (statusLower.includes("failed") || statusLower.includes("error")) return "failed";
        return "completed";
      };
      const callData = {
        userId: parseInt(userId),
        phoneNumber,
        contactName: contactName || "Unknown",
        duration: duration || 0,
        status: mapStatus(status),
        summary: summary || "AI call completed",
        notes: notes || "",
        transcript: transcript || "",
        direction,
        recordingUrl: recordingUrl || null,
        twilioCallSid: twilioCallSid || null,
        isFromTwilio: false,
        // Mark as Railway integration
        createdAt: callStartTime ? new Date(callStartTime) : /* @__PURE__ */ new Date()
      };
      const newCall = await storage.createCall(callData);
      console.log("Railway AI call logged:", newCall);
      res.status(200).json({
        message: "Call logged successfully in Sky IQ",
        callId: newCall.id
      });
    } catch (error) {
      console.error("Error processing Railway call webhook:", error);
      res.status(500).json({
        message: "Error logging call",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app2.post("/api/twilio/webhook", async (req, res) => {
    try {
      const { twilioService: twilioService2 } = await Promise.resolve().then(() => (init_twilioService(), twilioService_exports));
      await twilioService2.processCallWebhook(req.body);
      res.status(200).send("OK");
    } catch (error) {
      console.error("Error processing Twilio webhook:", error);
      res.status(500).send("Error processing webhook");
    }
  });
  app2.post("/api/twilio/log-only", async (req, res) => {
    try {
      console.log("\u{1F4CB} DEBUG: Call logging webhook received:", req.body);
      console.log("\u{1F4CB} DEBUG: To number:", req.body.To, "From number:", req.body.From);
      const { twilioService: twilioService2 } = await Promise.resolve().then(() => (init_twilioService(), twilioService_exports));
      await twilioService2.processCallWebhook(req.body);
      console.log("\u{1F4CB} DEBUG: Webhook processing completed successfully");
      res.status(200).send("LOGGED");
    } catch (error) {
      console.error("\u274C DEBUG: Error logging call:", error);
      res.status(500).send("Error logging call");
    }
  });
  app2.post("/api/twilio/recording", async (req, res) => {
    try {
      console.log("\u{1F3B5} Recording webhook received:", req.body);
      const { twilioService: twilioService2 } = await Promise.resolve().then(() => (init_twilioService(), twilioService_exports));
      await twilioService2.processRecordingWebhook(req.body);
      res.status(200).send("OK");
    } catch (error) {
      console.error("Error processing recording webhook:", error);
      res.status(500).send("Error processing recording");
    }
  });
  app2.post("/api/twilio/transcription", async (req, res) => {
    try {
      console.log("\u{1F4DD} Transcription webhook received:", req.body);
      const { twilioService: twilioService2 } = await Promise.resolve().then(() => (init_twilioService(), twilioService_exports));
      await twilioService2.processTranscriptionWebhook(req.body);
      res.status(200).send("OK");
    } catch (error) {
      console.error("Error processing transcription webhook:", error);
      res.status(500).send("Error processing transcription");
    }
  });
  app2.post("/api/twilio/setup/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const { accountSid, authToken, phoneNumber } = req.body;
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      if (!accountSid || !authToken || !phoneNumber) {
        return res.status(400).json({
          message: "Missing required fields: accountSid, authToken, phoneNumber"
        });
      }
      const { twilioService: twilioService2 } = await Promise.resolve().then(() => (init_twilioService(), twilioService_exports));
      const result = await twilioService2.setupUserTwilioIntegration(
        userId,
        accountSid,
        authToken,
        phoneNumber
      );
      if (result.success) {
        res.json({
          message: result.message,
          success: true,
          phoneNumber
        });
      } else {
        res.status(400).json({
          message: result.message,
          success: false
        });
      }
    } catch (error) {
      console.error("Error setting up Twilio integration:", error);
      res.status(500).json({
        message: "Failed to set up Twilio integration",
        success: false
      });
    }
  });
  app2.post("/api/twilio/numbers/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const { accountSid, authToken } = req.body;
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      if (!accountSid || !authToken) {
        return res.status(400).json({
          message: "Missing required fields: accountSid, authToken"
        });
      }
      const { twilioService: twilioService2 } = await Promise.resolve().then(() => (init_twilioService(), twilioService_exports));
      const credentialsValid = await twilioService2.validateUserTwilioCredentials(accountSid, authToken);
      if (!credentialsValid) {
        return res.status(400).json({
          message: "Invalid Twilio credentials",
          phoneNumbers: []
        });
      }
      const phoneNumbers = await twilioService2.getUserTwilioNumbers(accountSid, authToken);
      res.json({
        phoneNumbers,
        message: `Found ${phoneNumbers.length} phone number(s) in your Twilio account`
      });
    } catch (error) {
      console.error("Error fetching Twilio numbers:", error);
      res.status(500).json({
        message: "Failed to fetch phone numbers",
        phoneNumbers: []
      });
    }
  });
  app2.post("/api/twilio/settings/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const { accountSid, authToken, phoneNumber } = req.body;
      if (!accountSid || !authToken || !phoneNumber) {
        return res.status(400).json({ message: "Missing required Twilio settings" });
      }
      const { twilioService: twilioService2 } = await Promise.resolve().then(() => (init_twilioService(), twilioService_exports));
      const isValid = await twilioService2.validateUserTwilioCredentials(accountSid, authToken);
      if (!isValid) {
        return res.status(400).json({ message: "Invalid Twilio credentials" });
      }
      const result = await storage.updateTwilioSettings(userId, {
        accountSid,
        authToken,
        phoneNumber
      });
      res.json({ message: "Twilio settings updated successfully", data: result });
    } catch (error) {
      console.error("Error updating Twilio settings:", error);
      res.status(500).json({ message: "Failed to update Twilio settings" });
    }
  });
  app2.get("/api/twilio/settings/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const businessInfo2 = await storage.getBusinessInfo(userId);
      if (businessInfo2 && businessInfo2.twilioAccountSid) {
        res.json({
          connected: true,
          phoneNumber: businessInfo2.twilioPhoneNumber,
          accountSid: businessInfo2.twilioAccountSid.substring(0, 8) + "..."
          // Only show partial for security
        });
      } else {
        res.json({ connected: false });
      }
    } catch (error) {
      console.error("Error fetching Twilio settings:", error);
      res.status(500).json({ message: "Failed to fetch Twilio settings" });
    }
  });
  app2.get("/api/users/:userId/review-doc", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const callsResponse = await fetch(`http://localhost:5000/api/calls/user/${userId}`);
      const callsData = await callsResponse.json();
      const calls2 = callsData.data || [];
      const businessResponse = await fetch(`http://localhost:5000/api/business/${userId}`);
      const businessData = await businessResponse.json();
      const businessInfo2 = businessData.data || {};
      const businessName = businessInfo2.businessName || `User ${userId}`;
      const docTitle = `Call Review & Analytics - ${businessName}`;
      const docUrl = `https://docs.google.com/document/create?title=${encodeURIComponent(docTitle)}`;
      const formattedContent = generateCallReviewContent(calls2, businessInfo2);
      res.json({
        docUrl,
        content: formattedContent,
        callCount: calls2.length,
        businessName,
        generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        instructions: "Copy the content below and paste it into your new Google Doc"
      });
    } catch (error) {
      console.error("Error generating review document:", error);
      res.status(500).json({ message: "Failed to generate review document" });
    }
  });
  app2.post("/api/voice-prompt/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      const { dataAggregationService: dataAggregationService2 } = await Promise.resolve().then(() => (init_dataAggregationService(), dataAggregationService_exports));
      const { intelligentPromptBuilder: intelligentPromptBuilder2 } = await Promise.resolve().then(() => (init_intelligentPromptBuilder(), intelligentPromptBuilder_exports));
      const {
        callType = "general",
        customerIntent,
        timeOfDay,
        urgency = "medium",
        previousInteractions = [],
        specificTopic,
        refreshWebContent = false,
        includeBusinessData = false
      } = req.body;
      console.log(`Generating voice agent prompt for user ${userId} with context:`, {
        callType,
        customerIntent,
        timeOfDay,
        urgency,
        specificTopic,
        refreshWebContent
      });
      if (refreshWebContent) {
        console.log(`Refreshing web content for user ${userId}`);
        const { ragService: ragService2 } = await Promise.resolve().then(() => (init_ragService(), ragService_exports));
        dataAggregationService2.clearCache(userId);
        await ragService2.processUserDocuments(userId);
      }
      const businessData = await dataAggregationService2.aggregateBusinessData(userId, refreshWebContent);
      const context = {
        callType,
        customerIntent,
        timeOfDay,
        urgency,
        previousInteractions,
        specificTopic
      };
      const generatedPrompt = intelligentPromptBuilder2.buildDynamicPrompt(businessData, context);
      const response = {
        message: "Voice agent prompt generated successfully",
        prompt: generatedPrompt.systemPrompt,
        contextualKnowledge: generatedPrompt.contextualKnowledge,
        suggestedResponses: generatedPrompt.suggestedResponses,
        handoffTriggers: generatedPrompt.handoffTriggers,
        metadata: {
          businessName: businessData.businessProfile.businessName,
          confidenceScore: generatedPrompt.metadata.confidenceScore,
          dataSourcesUsed: generatedPrompt.metadata.dataSourcesUsed,
          lastUpdated: generatedPrompt.metadata.lastUpdated
        }
      };
      if (includeBusinessData) {
        response.businessData = {
          businessProfile: {
            name: businessData.businessProfile.businessName,
            description: businessData.businessProfile.description?.slice(0, 200),
            hasContactInfo: !!(businessData.businessProfile.businessPhone || businessData.businessProfile.businessEmail),
            linksCount: businessData.businessProfile.links?.length || 0
          },
          webPresence: businessData.webPresence.map((site) => ({
            url: site.url,
            title: site.title,
            servicesFound: site.businessInfo.services.length,
            contactEmailsFound: site.contactInfo.emails.length,
            socialMediaFound: site.contactInfo.socialMedia.length
          })),
          documentKnowledge: {
            totalDocuments: businessData.documentKnowledge.totalDocuments,
            processedDocuments: businessData.documentKnowledge.processedDocuments,
            chunksAvailable: businessData.documentKnowledge.chunks.length,
            keyTopicsCount: businessData.documentKnowledge.keyTopics.length
          },
          contentAnalysis: {
            expertiseAreas: businessData.contentAnalysis.expertiseAreas.slice(0, 10),
            brandVoice: businessData.contentAnalysis.brandVoice,
            messagingThemes: businessData.contentAnalysis.messagingThemes.slice(0, 10)
          },
          performance: {
            webPagesScraped: businessData.webPresence.length,
            documentsProcessed: businessData.documentKnowledge.processedDocuments,
            leadsAnalyzed: businessData.leadInsights.totalLeads,
            totalContentSources: businessData.webPresence.length + businessData.documentKnowledge.processedDocuments
          }
        };
      }
      res.status(200).json(response);
    } catch (error) {
      console.error("Error generating voice agent prompt:", error);
      res.status(500).json({
        message: "Failed to generate voice agent prompt",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app2.get("/api/public/voice-prompt/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      const { dataAggregationService: dataAggregationService2 } = await Promise.resolve().then(() => (init_dataAggregationService(), dataAggregationService_exports));
      const { intelligentPromptBuilder: intelligentPromptBuilder2 } = await Promise.resolve().then(() => (init_intelligentPromptBuilder(), intelligentPromptBuilder_exports));
      const {
        callType = "general",
        customerIntent,
        timeOfDay,
        urgency = "medium",
        specificTopic
      } = req.query;
      console.log(`Generating public voice agent prompt for user ${userId} with context:`, {
        callType,
        customerIntent,
        timeOfDay,
        urgency,
        specificTopic
      });
      const businessData = await dataAggregationService2.aggregateBusinessData(userId, false);
      const context = {
        callType: callType === "inbound" || callType === "outbound" || callType === "general" ? callType : "general",
        customerIntent,
        timeOfDay,
        urgency,
        previousInteractions: [],
        specificTopic
      };
      const generatedPrompt = intelligentPromptBuilder2.buildDynamicPrompt(businessData, context);
      res.status(200).json({
        prompt: generatedPrompt.systemPrompt,
        businessName: businessData.businessProfile.businessName,
        suggestedResponses: generatedPrompt.suggestedResponses,
        handoffTriggers: generatedPrompt.handoffTriggers,
        confidenceScore: generatedPrompt.metadata.confidenceScore,
        lastUpdated: generatedPrompt.metadata.lastUpdated
      });
    } catch (error) {
      console.error("Error generating public voice agent prompt:", error);
      res.status(500).json({
        message: "Failed to generate voice agent prompt",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}
function generateCallReviewContent(calls2, businessInfo2) {
  const businessName = businessInfo2.businessName || "Your Business";
  const totalCalls = calls2.length;
  const completedCalls = calls2.filter((call) => call.status === "completed").length;
  const missedCalls = calls2.filter((call) => call.status === "missed").length;
  const failedCalls = calls2.filter((call) => call.status === "failed").length;
  const callsWithDuration = calls2.filter((call) => call.duration);
  const totalDuration = callsWithDuration.reduce((sum, call) => {
    return sum + (call.duration || 0);
  }, 0);
  const avgDuration = callsWithDuration.length > 0 ? Math.round(totalDuration / callsWithDuration.length) : 0;
  const recentCalls = calls2.slice(-10);
  const content = `
\u{1F534} LIVE CALL OPERATIONS DASHBOARD
${businessName}
Last Updated: ${(/* @__PURE__ */ new Date()).toLocaleString()}

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
\u{1F6A8} IMMEDIATE ACTION REQUIRED
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

\u26A1 PRIORITY CALLBACKS:
${calls2.filter((call) => call.status === "missed" || call.notes?.includes("callback")).slice(0, 5).map((call, index) => `
${index + 1}. \u{1F4DE} ${call.contactName || call.phoneNumber}
   \u{1F550} MISSED: ${call.createdAt ? new Date(call.createdAt).toLocaleDateString() : "Recently"}
   \u{1F4DD} Action: CALL BACK IMMEDIATELY
   \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
`).join("") || "\u2705 No urgent callbacks needed"}

\u{1F3AF} FOLLOW-UP QUEUE:
${calls2.filter((call) => call.summary?.includes("follow") || call.notes?.includes("follow")).slice(0, 3).map((call, index) => `
${index + 1}. \u{1F4DE} ${call.contactName || call.phoneNumber}
   \u{1F4CB} Reason: ${call.summary || call.notes || "Follow-up required"}
   \u23F0 Due: Today
   \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
`).join("") || "\u2705 No follow-ups pending"}

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
\u{1F4CA} TODAY'S CALL PERFORMANCE
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

\u{1F4C8} LIVE STATS:
\u2022 Total Calls Today: ${totalCalls}
\u2022 Success Rate: ${totalCalls > 0 ? Math.round(completedCalls / totalCalls * 100) : 0}%
\u2022 Avg Call Time: ${Math.floor(avgDuration / 60)}m ${avgDuration % 60}s
\u2022 Missed Calls: ${missedCalls} (${missedCalls > 0 ? "\u26A0\uFE0F NEEDS ATTENTION" : "\u2705 Good"})

\u{1F3AF} CALL TARGETS:
\u25A1 Daily Goal: 20 calls
\u25A1 Completion Rate: >85%
\u25A1 Follow-up Rate: 100%
\u25A1 Customer Satisfaction: Track after each call

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
\u{1F525} ACTIVE CALL LOG
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

${calls2.slice(-5).reverse().map((call, index) => `
\u{1F4DE} CALL #${calls2.length - index}
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u{1F464} Contact: ${call.contactName || "Unknown"}
\u{1F4F1} Number: ${call.phoneNumber}
\u{1F550} Time: ${call.createdAt ? new Date(call.createdAt).toLocaleTimeString() : "Recent"}
\u23F1\uFE0F Duration: ${call.duration ? `${Math.floor(call.duration / 60)}m ${call.duration % 60}s` : "N/A"}
\u{1F4CA} Status: ${call.status?.toUpperCase() || "PENDING"}

\u{1F4DD} CALL SUMMARY:
${call.summary || "No summary recorded"}

\u{1F4CB} NOTES & ACTIONS:
${call.notes || "No notes"}

${call.isFromTwilio ? "\u{1F517} AUTO-LOGGED" : "\u270D\uFE0F MANUAL ENTRY"}
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501

`).join("")}

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
\u{1F4DD} CALL SCRIPT & GUIDELINES
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

\u{1F3AF} OPENING SCRIPT:
"Hi [Name], this is [Your Name] from ${businessName}. I'm calling about [reason]. Do you have 2-3 minutes to chat?"

\u{1F4CB} KEY TALKING POINTS:
\u2022 ${businessInfo2.description || "Your value proposition"}
\u2022 Benefits and features
\u2022 Address common objections
\u2022 Next steps and follow-up

\u{1F3AF} CLOSING SCRIPT:
"Thank you for your time today. I'll [specific next step] and follow up with you on [date]. Have a great day!"

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
\u26A1 REAL-TIME CALL TRACKING
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

\u{1F4DD} QUICK CALL LOG TEMPLATE:
Copy and paste for each new call:

CALL DATE: ${(/* @__PURE__ */ new Date()).toLocaleDateString()}
TIME: ${(/* @__PURE__ */ new Date()).toLocaleTimeString()}
CONTACT: ________________
NUMBER: ________________
DURATION: _______________
STATUS: [Completed/Missed/Failed]

SUMMARY:
_____________________________
_____________________________

NEXT ACTION:
\u25A1 Callback required
\u25A1 Follow-up email
\u25A1 Schedule meeting
\u25A1 Close deal
\u25A1 No action needed

NOTES:
_____________________________
_____________________________

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

\u{1F4A1} This document updates automatically with your live call data.
Keep this open during calling sessions for real-time tracking!
`;
  return content;
}

// server/vite.ts
import express2 from "express";
import fs from "fs";
import path2 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express2.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/mcp-standalone.ts
import http from "http";
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});
var app = express3();
app.use(express3.json());
app.use(express3.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Express error handler:", err);
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = 5e3;
  const serverInstance = http.createServer(app);
  log("HTTP server configured for deployment");
  serverInstance.listen(port, "0.0.0.0", () => {
    log(`Sky IQ Platform serving on port ${port}`);
  });
})();
