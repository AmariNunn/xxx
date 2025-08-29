import { Router, Request, Response } from "express";
import { storage } from "./storage";
import { twilioService } from "./twilioService";
import { requireAdmin, requireAuth } from "./authMiddleware";

const router = Router();

/**
 * ADMIN BACKEND ROUTES
 * These routes allow backend administration of user accounts
 * without requiring client interaction
 */

// Get all users with their Twilio status
router.get("/admin/users", requireAdmin, async (req: Request, res: Response) => {
  try {
    const users = await storage.getAllUsers();
    const usersWithTwilioStatus = await Promise.all(
      users.map(async (user) => {
        const businessInfo = await storage.getBusinessInfo(user.id);
        return {
          id: user.id,
          email: user.email,
          businessName: user.businessName,
          createdAt: user.createdAt,
          twilioConfigured: !!(businessInfo?.twilioAccountSid && businessInfo?.twilioAuthToken),
          twilioPhone: businessInfo?.twilioPhoneNumber || null
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

// Setup Twilio integration for a specific user (ADMIN ONLY)
router.post("/admin/users/:userId/twilio/setup", requireAdmin, async (req: Request, res: Response) => {
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

    // Verify user exists
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    console.log(`🔧 Admin setting up Twilio for user ${userId} (${user.email})`);

    // Setup complete Twilio integration
    const result = await twilioService.setupUserTwilioIntegration(
      userId, 
      accountSid, 
      authToken, 
      phoneNumber
    );

    if (result.success) {
      console.log(`✅ Admin successfully configured Twilio for user ${userId}`);
      res.json({ 
        message: `Twilio integration configured for ${user.email}`,
        success: true,
        user: {
          id: userId,
          email: user.email,
          phoneNumber: phoneNumber
        }
      });
    } else {
      console.log(`❌ Admin failed to configure Twilio for user ${userId}: ${result.message}`);
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

// Get user's Twilio phone numbers (ADMIN ONLY)
router.post("/admin/users/:userId/twilio/numbers", requireAdmin, async (req: Request, res: Response) => {
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

    // Verify user exists
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    console.log(`🔧 Admin fetching Twilio numbers for user ${userId} (${user.email})`);

    // Validate credentials first
    const credentialsValid = await twilioService.validateUserTwilioCredentials(accountSid, authToken);
    if (!credentialsValid) {
      return res.status(400).json({ 
        message: "Invalid Twilio credentials",
        phoneNumbers: [] 
      });
    }

    // Get available phone numbers
    const phoneNumbers = await twilioService.getUserTwilioNumbers(accountSid, authToken);
    
    console.log(`📞 Found ${phoneNumbers.length} phone numbers for user ${userId}`);
    
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

// Get user's current Twilio configuration (ADMIN ONLY)
router.get("/admin/users/:userId/twilio/config", requireAdmin, async (req: Request, res: Response) => {
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

    // Get business info with Twilio config
    const businessInfo = await storage.getBusinessInfo(userId);
    
    const twilioConfig = {
      configured: !!(businessInfo?.twilioAccountSid && businessInfo?.twilioAuthToken),
      phoneNumber: businessInfo?.twilioPhoneNumber || null,
      accountSid: businessInfo?.twilioAccountSid ? 
        `${businessInfo.twilioAccountSid.substring(0, 8)}...` : null // Masked for security
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

// Remove Twilio integration for a user (ADMIN ONLY)
router.delete("/admin/users/:userId/twilio", requireAdmin, async (req: Request, res: Response) => {
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

    console.log(`🔧 Admin removing Twilio integration for user ${userId} (${user.email})`);

    // Remove Twilio settings
    await storage.updateTwilioSettings(userId, { 
      accountSid: "", 
      authToken: "", 
      phoneNumber: "" 
    });

    console.log(`✅ Admin successfully removed Twilio integration for user ${userId}`);

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

// Get call statistics for all users (ADMIN ONLY)
router.get("/admin/calls/stats", requireAdmin, async (req: Request, res: Response) => {
  try {
    const users = await storage.getAllUsers();
    const callStats = await Promise.all(
      users.map(async (user) => {
        const calls = await storage.getCallsByUserId(user.id);
        return {
          userId: user.id,
          email: user.email,
          businessName: user.businessName,
          totalCalls: calls.length,
          recentCalls: calls.filter((call: any) => {
            const callDate = new Date(call.createdAt);
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return callDate > weekAgo;
          }).length
        };
      })
    );

    const totalCalls = callStats.reduce((sum: number, stat: any) => sum + stat.totalCalls, 0);
    const totalRecentCalls = callStats.reduce((sum: number, stat: any) => sum + stat.recentCalls, 0);

    res.json({ 
      message: "Call statistics retrieved successfully",
      stats: {
        totalUsers: users.length,
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

export default router;