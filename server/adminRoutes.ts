import type { Express, Request, Response } from "express";
import { storage } from "./storage";

/**
 * Admin-only routes for managing user Twilio configurations
 * These endpoints are for backend administration and should be secured in production
 */
export function registerAdminRoutes(app: Express) {
  
  // Admin endpoint to configure Twilio for a specific user
  app.post("/admin/users/:userId/twilio", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      const { accountSid, authToken, phoneNumber } = req.body;

      if (!accountSid || !authToken || !phoneNumber) {
        return res.status(400).json({ message: "Missing required Twilio settings" });
      }

      // Validate Twilio credentials before saving
      const { twilioService } = await import("./twilioService");
      const isValid = await twilioService.validateUserTwilioCredentials(accountSid, authToken);
      
      if (!isValid) {
        return res.status(400).json({ message: "Invalid Twilio credentials" });
      }

      // Save Twilio settings for the user
      const result = await storage.updateTwilioSettings(userId, {
        accountSid,
        authToken,
        phoneNumber
      });

      res.json({ 
        message: `Twilio configured for user ${userId}`, 
        data: result,
        userId,
        phoneNumber 
      });
    } catch (error) {
      console.error("Error configuring Twilio for user:", error);
      res.status(500).json({ message: "Failed to configure Twilio" });
    }
  });

  // Admin endpoint to get all users with Twilio configurations
  app.get("/admin/twilio/users", async (req: Request, res: Response) => {
    try {
      const usersWithTwilio = await storage.getAllBusinessInfoWithTwilio();
      
      const userList = usersWithTwilio.map(info => ({
        userId: info.userId,
        phoneNumber: info.twilioPhoneNumber,
        accountSid: info.twilioAccountSid ? `${info.twilioAccountSid.substring(0, 8)}...` : null,
        configured: !!info.twilioAccountSid
      }));

      res.json({ users: userList });
    } catch (error) {
      console.error("Error fetching Twilio users:", error);
      res.status(500).json({ message: "Failed to fetch Twilio users" });
    }
  });

  // Admin endpoint to remove Twilio configuration for a user
  app.delete("/admin/users/:userId/twilio", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);

      // Clear Twilio settings for the user
      await storage.updateTwilioSettings(userId, {
        accountSid: "",
        authToken: "",
        phoneNumber: ""
      });

      res.json({ message: `Twilio configuration removed for user ${userId}` });
    } catch (error) {
      console.error("Error removing Twilio configuration:", error);
      res.status(500).json({ message: "Failed to remove Twilio configuration" });
    }
  });

  // Admin endpoint to test webhook processing
  app.post("/admin/twilio/test-webhook", async (req: Request, res: Response) => {
    try {
      const { twilioService } = await import("./twilioService");
      
      // Test webhook data - you can customize this for testing
      const testWebhookData = {
        CallSid: "CA" + Math.random().toString(36).substring(7),
        From: "+1234567890",
        To: "+1987654321", // Should match a configured user's phone number
        CallStatus: "completed",
        CallDuration: "45",
        Direction: "inbound",
        RecordingUrl: null
      };

      await twilioService.processCallWebhook(testWebhookData);
      res.json({ 
        message: "Test webhook processed successfully", 
        testData: testWebhookData 
      });
    } catch (error) {
      console.error("Error testing webhook:", error);
      res.status(500).json({ message: "Failed to test webhook" });
    }
  });

  // Admin endpoint to get call logs for a specific user
  app.get("/admin/users/:userId/calls", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      const response = await fetch(`/api/calls/user/${userId}`);
      
      if (response.ok) {
        const data = await response.json();
        res.json(data);
      } else {
        res.status(404).json({ message: "User calls not found" });
      }
    } catch (error) {
      console.error("Error fetching user calls:", error);
      res.status(500).json({ message: "Failed to fetch calls" });
    }
  });
}