# ElevenLabs Webhook Configuration Guide

## Overview
This document explains how to configure ElevenLabs webhooks to receive real-time call transcripts and summaries in your SkyIQ application.

## Webhook Endpoint
Your webhook URL is: **`https://www.skyiq.app/webhook`**

## Configuration Steps

### 1. Log into ElevenLabs Dashboard
1. Go to [https://elevenlabs.io](https://elevenlabs.io)
2. Navigate to your Conversational AI agents
3. Select the agent you're using for calls

### 2. Configure Webhook Settings
1. Find the **Webhook** or **Integrations** section in your agent settings
2. Add webhook URL: `https://www.skyiq.app/webhook`
3. Select webhook events to subscribe to:
   - ✅ **`post_call_transcription`** (REQUIRED - delivers transcript and summary)
   - ✅ **`call_ended`** (OPTIONAL - signals call completion)
   - ✅ **`agent.transcription`** (OPTIONAL - real-time transcript updates)

### 3. Webhook Events

#### post_call_transcription
This is the MOST IMPORTANT event. It delivers:
- Full call transcript
- AI-generated summary
- Call duration
- Conversation ID

**Example payload:**
```json
{
  "type": "post_call_transcription",
  "data": {
    "conversation_id": "conv_xxxxx",
    "transcript": "Full conversation text...",
    "summary": "AI generated summary of the call...",
    "metadata": {
      "call_duration_secs": 120
    }
  }
}
```

#### call_ended
Signals when a call has ended:
```json
{
  "type": "call_ended",
  "data": {
    "conversation_id": "conv_xxxxx",
    "duration": 120
  }
}
```

## Troubleshooting

### Webhooks Not Being Received

1. **Check webhook URL is correct**: `https://www.skyiq.app/webhook`
2. **Verify ElevenLabs agent configuration** includes webhook URL
3. **Check server logs** on Render dashboard for webhook delivery attempts
4. **Test webhook endpoint** with curl:
   ```bash
   curl -X POST https://www.skyiq.app/webhook \
     -H "Content-Type: application/json" \
     -d '{"type":"test","data":{"message":"test"}}'
   ```

### Transcripts Not Appearing

1. **Verify webhook is configured** in ElevenLabs dashboard
2. **Check that `post_call_transcription` event** is enabled
3. **Review server logs** for webhook processing errors
4. **Verify conversation_id** matches between call initiation and webhook

### Common Issues

**Issue: "Invalid API Key" when making calls**
- Solution: Update ElevenLabs API key in Supabase `business_info` table for your user

**Issue: Calls succeed but no transcript**
- Solution: Enable `post_call_transcription` webhook in ElevenLabs agent settings

**Issue: Socket.IO disconnections**
- Solution: Frontend now has auto-reconnect. Refresh browser if issues persist.

## Database Schema

Transcripts and summaries are stored in the `calls` table:

```sql
CREATE TABLE calls (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) REFERENCES users(id),
  conversation_id VARCHAR(255),
  transcript TEXT,           -- Full call transcript
  summary TEXT,             -- AI-generated summary
  duration INTEGER,         -- Call duration in seconds
  status VARCHAR(50),
  call_type VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Testing Webhook Delivery

After making a call:

1. **Check Render logs** (6-7 minutes after call completes):
   ```
   🤖 Detected ElevenLabs webhook
   📞 Processing post-call transcription: conv_xxxxx
   ```

2. **Check browser console** for Socket.IO events:
   ```
   ✅ Received callCompleted event
   📝 Received transcriptUpdate event
   ```

3. **Verify database** has transcript:
   ```sql
   SELECT id, conversation_id, transcript, summary 
   FROM calls 
   WHERE conversation_id = 'conv_xxxxx';
   ```

## Support

If webhooks still aren't working:
1. Check ElevenLabs documentation for latest webhook format
2. Verify your agent is using the correct phone number ID
3. Contact ElevenLabs support to verify webhook delivery
4. Check Render logs for any error messages
