import { pgTable, text, serial, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Define service plan enum
export const servicePlanEnum = pgEnum('service_plan_enum', ['inbound', 'outbound', 'both']);

// Define call status enum
export const callStatusEnum = pgEnum('call_status_enum', ['completed', 'missed', 'failed']);

// Users table
export const users = pgTable("users", {
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
  createdAt: timestamp("created_at").defaultNow(),
});

// Call logs table
export const calls = pgTable("calls", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  phoneNumber: text("phone_number").notNull(),
  contactName: text("contact_name"),
  duration: integer("duration"), // Duration in seconds
  status: callStatusEnum("status").notNull(),
  notes: text("notes"),
  summary: text("summary"),
  transcript: text("transcript"), // Full conversation transcript
  twilioCallSid: text("twilio_call_sid"), // Twilio unique call identifier
  direction: text("direction"), // inbound or outbound
  recordingUrl: text("recording_url"), // URL to call recording if available
  isFromTwilio: boolean("is_from_twilio").default(false), // Track if call came from Twilio webhook
  createdAt: timestamp("created_at").defaultNow(),
});

// Leads table
export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  phoneNumber: text("phone_number").notNull(),
  email: text("email"),
  company: text("company"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Business info table
export const businessInfo = pgTable("business_info", {
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
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User relations
export const usersRelations = relations(users, ({ many }) => ({
  calls: many(calls),
  leads: many(leads),
  businessInfo: many(businessInfo),
}));

// Call relations
export const callsRelations = relations(calls, ({ one }) => ({
  user: one(users, {
    fields: [calls.userId],
    references: [users.id],
  }),
}));

// Lead relations
export const leadsRelations = relations(leads, ({ one }) => ({
  user: one(users, {
    fields: [leads.userId],
    references: [users.id],
  }),
}));

// Business info relations
export const businessInfoRelations = relations(businessInfo, ({ one }) => ({
  user: one(users, {
    fields: [businessInfo.userId],
    references: [users.id],
  }),
}));

// Schema for user insertion
export const insertUserSchema = createInsertSchema(users).omit({ 
  id: true, 
  verified: true, 
  createdAt: true,
  emailVerificationToken: true,
  emailVerificationExpires: true,
  passwordResetToken: true,
  passwordResetExpires: true
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Schema for call insertion
export const insertCallSchema = createInsertSchema(calls).omit({ id: true, createdAt: true });

export type InsertCall = z.infer<typeof insertCallSchema>;
export type Call = typeof calls.$inferSelect;

// Schema for lead insertion
export const insertLeadSchema = createInsertSchema(leads).omit({ id: true, createdAt: true });

export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;

// Schema for business info insertion/update
export const upsertBusinessInfoSchema = createInsertSchema(businessInfo).omit({ id: true, updatedAt: true });

export type UpsertBusinessInfo = z.infer<typeof upsertBusinessInfoSchema>;
export type BusinessInfo = typeof businessInfo.$inferSelect;

// Login schema
export const loginUserSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export type LoginUser = z.infer<typeof loginUserSchema>;

// Forgot password schema
export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export type ForgotPasswordRequest = z.infer<typeof forgotPasswordSchema>;

// RAG (Retrieval Augmented Generation) tables for document processing

// Documents table - stores processed files and links
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  sourceType: text("source_type").notNull(), // "file" or "link"
  sourceUrl: text("source_url").notNull(), // Original file URL or web link
  title: text("title").notNull(),
  contentType: text("content_type"), // MIME type for files, "webpage" for links
  fileSize: integer("file_size"), // Size in bytes for files
  extractedText: text("extracted_text"), // Full extracted text content
  status: text("status").notNull().default("pending"), // "pending", "processing", "completed", "failed"
  errorMessage: text("error_message"), // Error details if processing failed
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Document chunks table - stores text segments for search
export const documentChunks = pgTable("document_chunks", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull().references(() => documents.id),
  userId: integer("user_id").notNull().references(() => users.id),
  chunkIndex: integer("chunk_index").notNull(), // Order within the document
  content: text("content").notNull(), // Chunk text content
  wordCount: integer("word_count").notNull(),
  summary: text("summary"), // AI-generated summary of chunk
  keywords: text("keywords").array(), // Extracted keywords for search
  createdAt: timestamp("created_at").defaultNow(),
});

// Search queries table - logs search queries for analytics
export const searchQueries = pgTable("search_queries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  query: text("query").notNull(),
  resultsCount: integer("results_count").notNull(),
  responseTime: integer("response_time"), // Response time in milliseconds
  createdAt: timestamp("created_at").defaultNow(),
});

// Document relations
export const documentsRelations = relations(documents, ({ one, many }) => ({
  user: one(users, {
    fields: [documents.userId],
    references: [users.id],
  }),
  chunks: many(documentChunks),
}));

// Document chunk relations
export const documentChunksRelations = relations(documentChunks, ({ one }) => ({
  document: one(documents, {
    fields: [documentChunks.documentId],
    references: [documents.id],
  }),
  user: one(users, {
    fields: [documentChunks.userId],
    references: [users.id],
  }),
}));

// Search query relations
export const searchQueriesRelations = relations(searchQueries, ({ one }) => ({
  user: one(users, {
    fields: [searchQueries.userId],
    references: [users.id],
  }),
}));

// Schema for document insertion
export const insertDocumentSchema = createInsertSchema(documents).omit({ 
  id: true, 
  createdAt: true,
  processedAt: true 
});

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

// Schema for document chunk insertion
export const insertDocumentChunkSchema = createInsertSchema(documentChunks).omit({ 
  id: true, 
  createdAt: true 
});

export type InsertDocumentChunk = z.infer<typeof insertDocumentChunkSchema>;
export type DocumentChunk = typeof documentChunks.$inferSelect;

// Schema for search query insertion
export const insertSearchQuerySchema = createInsertSchema(searchQueries).omit({ 
  id: true, 
  createdAt: true 
});

export type InsertSearchQuery = z.infer<typeof insertSearchQuerySchema>;
export type SearchQuery = typeof searchQueries.$inferSelect;
