import { Router, Request, Response } from "express";
import { ragService } from "../ragService";
import { storage } from "../storage";

const router = Router();

// Process all documents for a user (manual trigger)
router.post("/api/rag/process/:userId", async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    // Verify user exists
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    console.log(`Starting RAG processing for user ${userId}`);
    
    // Process documents in background
    ragService.processUserDocuments(userId).catch(error => {
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

// Search through processed documents
router.get("/api/rag/search/:userId", async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const query = req.query.q as string;
    const limit = parseInt(req.query.limit as string) || 10;

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

// Get document processing status for a user
router.get("/api/rag/status/:userId", async (req: Request, res: Response) => {
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

// Auto-process documents when files are added (webhook style)
router.post("/api/rag/auto-process/:userId", async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    // This endpoint can be called whenever new files are added
    console.log(`Auto-processing triggered for user ${userId}`);
    
    // Process in background
    setTimeout(() => {
      ragService.processUserDocuments(userId).catch(error => {
        console.error(`Auto RAG processing failed for user ${userId}:`, error);
      });
    }, 1000); // Small delay to ensure file is saved

    res.json({ 
      message: "Auto-processing initiated",
      userId
    });
  } catch (error) {
    console.error("Error in auto-processing:", error);
    res.status(500).json({ message: "Auto-processing failed" });
  }
});

export default router;