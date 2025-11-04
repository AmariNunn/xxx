# Cloudflare SMS Worker Setup Guide

This guide will help you deploy the two-way SMS system using Cloudflare Workers AI.

## Prerequisites

1. Cloudflare account (free tier works!)
2. Twilio account with a phone number
3. Your SkyIQ platform running on Replit with Supabase database

## Step 1: Create the Supabase SMS Table

Run this SQL in your Supabase SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS sms_conversations (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id),
    phone_number VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    direction VARCHAR(20) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
    twilio_message_sid VARCHAR(255),
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_sms_conversations_user ON sms_conversations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_conversations_phone ON sms_conversations(phone_number, created_at DESC);
```

## Step 2: Deploy Cloudflare Worker

### 2.1 Install Wrangler (Cloudflare CLI)

```bash
npm install -g wrangler
```

### 2.2 Login to Cloudflare

```bash
wrangler login
```

### 2.3 Create Worker Project

```bash
mkdir sms-worker
cd sms-worker
wrangler init
```

### 2.4 Copy the Worker Code

Copy the contents of `cloudflare-sms-worker.js` to your `src/index.js` (or `src/worker.js`) file.

### 2.5 Update wrangler.toml

Edit your `wrangler.toml` file:

```toml
name = "skyiq-sms-worker"
main = "src/index.js"
compatibility_date = "2024-01-01"

# Enable Workers AI
[ai]
binding = "AI"

# Environment variables (set these in Cloudflare Dashboard for security)
# Don't put actual values here - use dashboard or wrangler secret
```

### 2.6 Set Environment Variables

Set these secrets using Wrangler CLI:

```bash
# Twilio credentials
wrangler secret put TWILIO_ACCOUNT_SID
wrangler secret put TWILIO_AUTH_TOKEN
wrangler secret put TWILIO_PHONE_NUMBER

# Supabase credentials
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY

# Cal.com credentials (optional)
wrangler secret put CAL_COM_API_KEY
wrangler secret put CAL_COM_EVENT_TYPE_ID
```

When prompted, paste the actual values:
- **TWILIO_ACCOUNT_SID**: From Twilio Console
- **TWILIO_AUTH_TOKEN**: From Twilio Console  
- **TWILIO_PHONE_NUMBER**: Your Twilio number in E.164 format (e.g., +15551234567)
- **SUPABASE_URL**: Your Supabase project URL (e.g., https://xxxxx.supabase.co)
- **SUPABASE_SERVICE_ROLE_KEY**: From Supabase Settings > API > service_role key
- **CAL_COM_API_KEY**: Your Cal.com API key (if using appointment booking)
- **CAL_COM_EVENT_TYPE_ID**: Your Cal.com event type ID (if using appointment booking)

### 2.7 Deploy the Worker

```bash
wrangler deploy
```

After deployment, you'll get a Worker URL like:
```
https://skyiq-sms-worker.your-subdomain.workers.dev
```

## Step 3: Configure Twilio Webhook

1. Go to your [Twilio Console](https://console.twilio.com/)
2. Navigate to **Phone Numbers** → **Manage** → **Active Numbers**
3. Click on your phone number
4. Scroll to **Messaging Configuration**
5. Under **A MESSAGE COMES IN**, set:
   - **Webhook**: Your Cloudflare Worker URL (from Step 2.7)
   - **HTTP Method**: POST
6. Click **Save**

## Step 4: Test Your SMS System

1. **Send a test SMS** to your Twilio number:
   ```
   Hello! What are your hours?
   ```

2. **Check the logs**:
   ```bash
   wrangler tail
   ```

3. **Verify in Supabase**:
   - Open Supabase Table Editor
   - Check `sms_conversations` table
   - You should see both inbound and outbound messages

## Step 5: View SMS in Dashboard

1. Log in to your SkyIQ platform
2. Click **SMS Conversations** in the sidebar
3. You should see all your SMS conversations organized by phone number

## Troubleshooting

### Worker Not Receiving SMS

1. **Check Twilio webhook URL** is correct
2. **Verify Twilio credentials** in Cloudflare secrets
3. **Check worker logs**: `wrangler tail`
4. **Test webhook manually**:
   ```bash
   curl -X POST https://your-worker.workers.dev \
     -d "From=+15551234567" \
     -d "To=+15559876543" \
     -d "Body=Test message" \
     -d "MessageSid=SM123456"
   ```

### Database Not Logging Messages

1. **Verify Supabase URL and key** are correct
2. **Check table exists** in Supabase
3. **Check user has Twilio number** in `business_info` table:
   ```sql
   SELECT user_id, twilio_phone_number 
   FROM business_info 
   WHERE twilio_phone_number IS NOT NULL;
   ```

### AI Responses Not Working

1. **Verify Workers AI is enabled** in your Cloudflare account
2. **Check model name** is correct: `@cf/meta/llama-3.1-8b-instruct`
3. **Review logs** for AI errors: `wrangler tail`

### SMS Not Sending

1. **Check Twilio balance**
2. **Verify phone number format** (E.164: +1XXXXXXXXXX)
3. **Check Twilio API credentials**
4. **Review worker logs** for Twilio API errors

## Features

### Current Features
- ✅ Receive incoming SMS
- ✅ AI-powered responses using Cloudflare Workers AI (Llama 3.1)
- ✅ Cal.com availability checking
- ✅ Conversation history context
- ✅ Log all messages to Supabase
- ✅ View SMS in dashboard

### Coming Soon
- 🔄 Full Cal.com appointment booking
- 🔄 Better time parsing for appointment requests
- 🔄 Customer name/email extraction from conversation
- 🔄 Multi-language support
- 🔄 Custom AI prompts per user

## Cost Estimate

All these services have generous free tiers:

- **Cloudflare Workers**: 100,000 requests/day free
- **Cloudflare Workers AI**: 10,000 AI requests/day free
- **Twilio SMS**: ~$0.0075 per SMS (outbound)
- **Supabase**: 500MB database free

For typical usage (100 SMS/day):
- Cloudflare: **FREE**
- Twilio: ~$0.75/day = ~$22.50/month
- Supabase: **FREE**

## Support

If you run into issues:

1. Check worker logs: `wrangler tail`
2. Check Supabase logs in your dashboard
3. Review Twilio webhook debugger
4. Open an issue on GitHub (if applicable)

## Security Notes

- ✅ **Twilio Webhook Signature Verification**: All incoming webhooks are verified using HMAC-SHA1 signatures to prevent spoofing
- Never commit secrets to Git
- Use `wrangler secret` for all sensitive data
- Supabase service role key has admin access - keep it secure
- The worker automatically rejects requests without valid Twilio signatures (401/403 responses)

## Next Steps

1. Customize AI prompts in the worker code
2. Add more Cal.com integration features
3. Set up SMS notification alerts
4. Build custom reporting dashboards
5. Add automated follow-ups

Happy texting! 📱✨
