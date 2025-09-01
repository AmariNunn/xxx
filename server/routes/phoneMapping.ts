import express from 'express';
import { storage } from '../storage';

const router = express.Router();

/**
 * Phone Number to User ID Mapping for External AI Integration
 * This endpoint helps your external AI voice agent identify which user
 * a phone call belongs to based on the incoming phone number
 */

// Find user by phone number for AI voice agent integration
router.get('/find-user/:phoneNumber', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    // Clean phone number (remove formatting)
    const cleanPhone = phoneNumber.replace(/[^\d]/g, '');
    
    // Search for user with this phone number in their Twilio settings
    const allBusinessInfo = await storage.getAllBusinessInfoWithTwilio();
    
    const matchingBusiness = allBusinessInfo.find(business => {
      if (!business.twilioPhoneNumber) return false;
      const businessCleanPhone = business.twilioPhoneNumber.replace(/[^\d]/g, '');
      return businessCleanPhone === cleanPhone;
    });

    if (matchingBusiness) {
      return res.json({
        success: true,
        userId: matchingBusiness.userId,
        businessName: matchingBusiness.businessName,
        phoneNumber: matchingBusiness.twilioPhoneNumber
      });
    }

    // If not found in business info, search user phone numbers
    const allUsers = await storage.getAllUsers();
    const matchingUser = allUsers.find(user => {
      if (!user.phoneNumber) return false;
      const userCleanPhone = user.phoneNumber.replace(/[^\d]/g, '');
      return userCleanPhone === cleanPhone;
    });

    if (matchingUser) {
      return res.json({
        success: true,
        userId: matchingUser.id,
        businessName: matchingUser.businessName,
        phoneNumber: matchingUser.phoneNumber
      });
    }

    // No matching user found
    return res.status(404).json({
      success: false,
      message: 'No user found for this phone number'
    });

  } catch (error) {
    console.error('Error finding user by phone number:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;