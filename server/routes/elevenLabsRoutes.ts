import { Router } from "express";
import { elevenLabsService } from "../elevenLabsService";
import { z } from "zod";

const router = Router();

// Validation schemas
const testConnectionSchema = z.object({
  apiKey: z.string().min(1, "API key is required"),
  agentId: z.string().optional(),
});

const syncConversationsSchema = z.object({
  userId: z.number().positive("Valid user ID is required"),
});

/**
 * Test ElevenLabs API connection
 * POST /api/eleven-labs/test-connection
 */
router.post("/test-connection", async (req, res) => {
  try {
    const { apiKey, agentId } = testConnectionSchema.parse(req.body);
    
    const isValid = await elevenLabsService.testConnection(apiKey, agentId);
    
    res.json({
      success: true,
      data: {
        valid: isValid,
        message: isValid ? "Connection successful" : "Invalid credentials or API error"
      }
    });
  } catch (error) {
    console.error("Error testing ElevenLabs connection:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to test connection"
    });
  }
});

/**
 * Sync conversations from ElevenLabs API to database
 * POST /api/eleven-labs/sync/:userId
 */
router.post("/sync/:userId", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    if (!userId || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid user ID is required"
      });
    }

    const syncedCount = await elevenLabsService.syncConversations(userId);
    
    res.json({
      success: true,
      data: {
        syncedCount,
        message: `Synced ${syncedCount} new conversations`
      }
    });
  } catch (error) {
    console.error("Error syncing conversations:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to sync conversations"
    });
  }
});

/**
 * Get stored conversations for a user
 * GET /api/eleven-labs/conversations/:userId
 */
router.get("/conversations/:userId", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    if (!userId || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid user ID is required"
      });
    }

    const conversations = await elevenLabsService.getStoredConversations(userId, limit, offset);
    
    res.json({
      success: true,
      data: conversations
    });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch conversations"
    });
  }
});

/**
 * Get specific conversation transcript
 * GET /api/eleven-labs/conversation/:userId/:conversationId
 */
router.get("/conversation/:userId/:conversationId", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { conversationId } = req.params;
    
    if (!userId || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid user ID is required"
      });
    }

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        message: "Conversation ID is required"
      });
    }

    const transcript = await elevenLabsService.getConversationTranscript(userId, conversationId);
    
    res.json({
      success: true,
      data: transcript
    });
  } catch (error) {
    console.error("Error fetching conversation transcript:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch transcript"
    });
  }
});

/**
 * Fetch fresh conversations directly from ElevenLabs API
 * GET /api/eleven-labs/fetch/:userId
 */
router.get("/fetch/:userId", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const limit = parseInt(req.query.limit as string) || 50;
    
    if (!userId || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid user ID is required"
      });
    }

    const conversations = await elevenLabsService.fetchConversations(userId, limit);
    
    res.json({
      success: true,
      data: conversations
    });
  } catch (error) {
    console.error("Error fetching fresh conversations:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch conversations from ElevenLabs"
    });
  }
});

export default router;