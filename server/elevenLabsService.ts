import { db } from "./db";
import { elevenLabsConversations, businessInfo } from "@shared/schema";
import { eq, and } from "drizzle-orm";

interface ElevenLabsConversation {
  conversation_id: string;
  agent_id: string;
  status: string;
  start_time?: string;
  end_time?: string;
  duration_seconds?: number;
  transcript?: string;
  summary?: string;
  metadata?: any;
  phone_number?: string;
}

interface ElevenLabsCredentials {
  apiKey: string;
  agentId?: string;
}

export class ElevenLabsService {
  private baseUrl = "https://api.elevenlabs.io/v1";

  /**
   * Get ElevenLabs credentials for a specific user
   */
  async getUserCredentials(userId: number): Promise<ElevenLabsCredentials | null> {
    const [business] = await db
      .select()
      .from(businessInfo)
      .where(eq(businessInfo.userId, userId));

    if (!business?.elevenLabsApiKey) {
      return null;
    }

    return {
      apiKey: business.elevenLabsApiKey,
      agentId: business.elevenLabsAgentId || undefined,
    };
  }

  /**
   * Fetch conversations from ElevenLabs API for a specific user
   */
  async fetchConversations(userId: number, limit = 50): Promise<ElevenLabsConversation[]> {
    const credentials = await this.getUserCredentials(userId);
    
    if (!credentials) {
      throw new Error("ElevenLabs credentials not configured for this user");
    }

    try {
      // Fetch agent conversations from ElevenLabs API
      const response = await fetch(`${this.baseUrl}/convai/conversations`, {
        headers: {
          "xi-api-key": credentials.apiKey,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      
      // Filter by agent ID if specified
      let conversations = data.conversations || [];
      if (credentials.agentId) {
        conversations = conversations.filter((conv: any) => conv.agent_id === credentials.agentId);
      }

      return conversations.slice(0, limit);
    } catch (error) {
      console.error("Error fetching ElevenLabs conversations:", error);
      throw error;
    }
  }

  /**
   * Get specific conversation transcript from ElevenLabs API
   */
  async getConversationTranscript(userId: number, conversationId: string): Promise<any> {
    const credentials = await this.getUserCredentials(userId);
    
    if (!credentials) {
      throw new Error("ElevenLabs credentials not configured for this user");
    }

    try {
      const response = await fetch(`${this.baseUrl}/convai/conversations/${conversationId}`, {
        headers: {
          "xi-api-key": credentials.apiKey,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching conversation transcript:", error);
      throw error;
    }
  }

  /**
   * Sync conversations from ElevenLabs to local database for a user
   */
  async syncConversations(userId: number): Promise<number> {
    try {
      const conversations = await this.fetchConversations(userId, 100);
      let syncedCount = 0;

      for (const conv of conversations) {
        // Check if conversation already exists
        const existing = await db
          .select()
          .from(elevenLabsConversations)
          .where(
            and(
              eq(elevenLabsConversations.userId, userId),
              eq(elevenLabsConversations.conversationId, conv.conversation_id)
            )
          );

        if (existing.length === 0) {
          // Insert new conversation
          await db.insert(elevenLabsConversations).values({
            userId,
            conversationId: conv.conversation_id,
            agentId: conv.agent_id,
            status: conv.status,
            startTime: conv.start_time ? new Date(conv.start_time) : undefined,
            endTime: conv.end_time ? new Date(conv.end_time) : undefined,
            duration: conv.duration_seconds || 0,
            transcript: conv.transcript || null,
            summary: conv.summary || null,
            metadata: conv.metadata ? JSON.stringify(conv.metadata) : null,
            phoneNumber: conv.phone_number || null,
          });
          syncedCount++;
        } else {
          // Update existing conversation if needed
          const existingConv = existing[0];
          if (existingConv.status !== conv.status || !existingConv.transcript) {
            await db
              .update(elevenLabsConversations)
              .set({
                status: conv.status,
                endTime: conv.end_time ? new Date(conv.end_time) : undefined,
                duration: conv.duration_seconds || existingConv.duration,
                transcript: conv.transcript || existingConv.transcript,
                summary: conv.summary || existingConv.summary,
                metadata: conv.metadata ? JSON.stringify(conv.metadata) : existingConv.metadata,
                updatedAt: new Date(),
              })
              .where(eq(elevenLabsConversations.id, existingConv.id));
          }
        }
      }

      return syncedCount;
    } catch (error) {
      console.error("Error syncing conversations:", error);
      throw error;
    }
  }

  /**
   * Get stored conversations for a user from local database
   */
  async getStoredConversations(userId: number, limit = 50, offset = 0) {
    return await db
      .select()
      .from(elevenLabsConversations)
      .where(eq(elevenLabsConversations.userId, userId))
      .orderBy(elevenLabsConversations.createdAt)
      .limit(limit)
      .offset(offset);
  }

  /**
   * Test ElevenLabs API connection with provided credentials
   */
  async testConnection(apiKey: string, agentId?: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/convai/conversations?limit=1`, {
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
      });

      return response.ok;
    } catch (error) {
      console.error("Error testing ElevenLabs connection:", error);
      return false;
    }
  }
}

export const elevenLabsService = new ElevenLabsService();