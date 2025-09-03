import { Router, Request, Response } from "express";
import { storage } from "../storage";

const router = Router();

// Generate API key for a user
router.post('/users/:userId/api-key/generate', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    // Check if user exists
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate new API key
    const apiKey = await storage.generateApiKey(userId);

    res.json({
      success: true,
      message: "API key generated successfully",
      apiKey,
      userId,
      createdAt: new Date().toISOString(),
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

// Get API key information for a user
router.get('/users/:userId/api-key/info', async (req: Request, res: Response) => {
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

// Revoke API key for a user
router.delete('/users/:userId/api-key', async (req: Request, res: Response) => {
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

// List all users with their API key status (admin only)
router.get('/api-keys/status', async (req: Request, res: Response) => {
  try {
    const users = await storage.getAllUsers();
    
    const usersWithApiKeyStatus = users.map(user => ({
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
      total: users.length,
      activeApiKeys: users.filter(user => !!user.apiKey).length
    });
  } catch (error) {
    console.error("Error fetching API key status:", error);
    res.status(500).json({ message: "Failed to fetch API key status" });
  }
});

export default router;