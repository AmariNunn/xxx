import twilio from 'twilio';
import { storage } from './storage';
import type { InsertCall } from '@shared/schema';

export class TwilioService {
  private twilioClient: any;

  constructor() {
    // Initialize with main Twilio credentials for webhook validation
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      this.twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    }
  }

  /**
   * Process incoming Twilio webhook and create call record for the correct user
   */
  async processCallWebhook(webhookData: any): Promise<void> {
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

      // Find user by their Twilio phone number
      const user = await this.findUserByTwilioNumber(To, From, Direction);
      
      if (!user) {
        console.log(`No user found for call to/from ${Direction === 'inbound' ? From : To}`);
        return;
      }

      // Map Twilio status to our status enum
      const status = this.mapTwilioStatus(CallStatus);
      
      // Create call record for the user
      const callData: InsertCall = {
        userId: user.id,
        phoneNumber: Direction === 'inbound' ? From : To,
        contactName: null, // Could be enhanced with contact lookup
        duration: CallDuration ? parseInt(CallDuration) : null,
        status,
        notes: null,
        summary: null,
        twilioCallSid: CallSid,
        direction: Direction,
        recordingUrl: RecordingUrl || null,
        isFromTwilio: true
      };

      await storage.createCall(callData);
      console.log(`Call logged for user ${user.id}: ${CallSid}`);

    } catch (error) {
      console.error('Error processing Twilio webhook:', error);
    }
  }

  /**
   * Find user by matching their Twilio phone number with strict isolation
   */
  private async findUserByTwilioNumber(to: string, from: string, direction: string): Promise<User | null> {
    try {
      // Get all business info records with Twilio settings
      const businessInfos = await storage.getAllBusinessInfoWithTwilio();
      
      for (const info of businessInfos) {
        if (!info.twilioPhoneNumber) continue;
        
        const userNumber = this.normalizePhoneNumber(info.twilioPhoneNumber);
        const callNumber = this.normalizePhoneNumber(direction === 'inbound' ? to : from);
        
        // Exact match ensures no cross-contamination between accounts
        if (userNumber === callNumber) {
          const user = await storage.getUser(info.userId);
          if (user) {
            console.log(`Call routed to user ${user.id} (${user.email}) via Twilio number ${info.twilioPhoneNumber}`);
            return user;
          }
        }
      }
      
      console.log(`No user found for Twilio number: ${direction === 'inbound' ? to : from}`);
      return null;
    } catch (error) {
      console.error('Error finding user by Twilio number:', error);
      return null;
    }
  }

  /**
   * Normalize phone numbers for comparison
   */
  private normalizePhoneNumber(phoneNumber: string): string {
    return phoneNumber.replace(/[^\d]/g, '');
  }

  /**
   * Map Twilio call status to our enum values
   */
  private mapTwilioStatus(twilioStatus: string): 'completed' | 'missed' | 'failed' {
    switch (twilioStatus.toLowerCase()) {
      case 'completed':
        return 'completed';
      case 'busy':
      case 'no-answer':
        return 'missed';
      case 'failed':
      case 'canceled':
        return 'failed';
      default:
        return 'completed';
    }
  }

  /**
   * Set up webhooks for a user's Twilio account
   */
  async setupWebhooksForUser(userId: number, accountSid: string, authToken: string, phoneNumber: string): Promise<boolean> {
    try {
      // Create Twilio client with user's credentials
      const userTwilioClient = twilio(accountSid, authToken);
      
      // The webhook URL that Twilio will call for completed calls
      const webhookUrl = `${process.env.REPLIT_DOMAINS?.split(',')[0] ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : 'http://localhost:5000'}/api/twilio/webhook`;
      
      // Find the phone number resource and update its webhook
      const phoneNumbers = await userTwilioClient.incomingPhoneNumbers.list();
      const targetNumber = phoneNumbers.find(num => num.phoneNumber === phoneNumber);
      
      if (targetNumber) {
        await userTwilioClient.incomingPhoneNumbers(targetNumber.sid)
          .update({
            statusCallback: webhookUrl,
            statusCallbackMethod: 'POST',
            statusCallbackEvent: ['completed']
          });
        
        console.log(`✅ Webhook configured for ${phoneNumber} - calls will sync to Sky IQ`);
        return true;
      } else {
        console.log(`❌ Phone number ${phoneNumber} not found in Twilio account`);
        return false;
      }
      
    } catch (error) {
      console.error('Error setting up Twilio webhooks:', error);
      return false;
    }
  }

  /**
   * Validate that user's Twilio credentials are correct
   */
  async validateUserTwilioCredentials(accountSid: string, authToken: string): Promise<boolean> {
    try {
      const userClient = twilio(accountSid, authToken);
      await userClient.api.accounts(accountSid).fetch();
      return true;
    } catch (error) {
      console.error('Invalid Twilio credentials:', error);
      return false;
    }
  }
}

export const twilioService = new TwilioService();