# Twilio Post-Call Transcription Setup

## Overview
Configure Twilio to automatically transcribe calls and send transcripts to your SkyIQ application via webhook.

**Benefits:**
- ✅ **Faster than ElevenLabs** (~2-3 minutes vs 5-7 minutes)
- ✅ **No external API keys needed** (uses your Twilio account)
- ✅ **Simple setup** (just TwiML configuration)
- ✅ **Reliable** (built into Twilio)

---

## How It Works

1. **Call happens** → Twilio records audio
2. **Call ends** → Twilio transcribes the recording
3. **Transcription ready** → Twilio sends webhook to your server (~2-3 min)
4. **Server updates database** → Transcript saved
5. **Dashboard updates** → User sees transcript via Socket.IO

---

## Setup Steps

### Step 1: Configure TwiML for Recording + Transcription

You need to update your Twilio phone number's TwiML to enable recording with transcription.

#### Option A: Using TwiML Bins (Recommended)

1. Go to **Twilio Console** → **TwiML Bins**
2. Create new TwiML Bin named "SkyIQ Transcription"
3. Add this code:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>This call may be recorded for quality assurance.</Say>
  <Record 
    action="https://www.skyiq.app/webhook"
    transcribe="true"
    transcribeCallback="https://www.skyiq.app/webhook/transcription"
    maxLength="300"
    playBeep="true"
  />
</Response>
```

4. Save the TwiML Bin
5. Go to **Phone Numbers** → Your Number → Configure
6. Set "A Call Comes In" to your TwiML Bin
7. Click **Save**

#### Option B: For ElevenLabs Outbound Calls

If you're using ElevenLabs for AI agent calls, add this to your agent's TwiML:

```xml
<Response>
  <Connect>
    <Stream url="wss://elevenlabs-stream-url" />
  </Connect>
  <Record 
    transcribe="true"
    transcribeCallback="https://www.skyiq.app/webhook/transcription"
    maxLength="300"
  />
</Response>
```

---

### Step 2: Verify Webhook Endpoint

Your server already has the transcription webhook endpoint:
- **URL**: `https://www.skyiq.app/webhook/transcription`
- **Method**: POST
- **Handles**: Twilio transcription callbacks

No code changes needed!

---

### Step 3: Test the Setup

1. **Make a test call** to your Twilio number
2. **Speak for a few seconds**
3. **Hang up**
4. **Wait 2-3 minutes** for transcription
5. **Check your dashboard** - transcript should appear!

---

## Expected Webhook Flow

### When Transcription is Ready:

Twilio sends POST to `https://www.skyiq.app/webhook/transcription`:

```json
{
  "CallSid": "CA1234567890abcdef",
  "TranscriptionSid": "TR1234567890abcdef",
  "TranscriptionText": "Hello, this is a test call...",
  "TranscriptionStatus": "completed",
  "TranscriptionUrl": "https://api.twilio.com/...",
  "From": "+15551234567",
  "To": "+15559876543"
}
```

### Server Response:
1. Finds call by `CallSid`
2. Updates `transcript` field in database
3. Sets `status` to `completed`
4. Broadcasts to user's Socket.IO room
5. Dashboard updates automatically

---

## Checking Server Logs

### Successful Transcription Logs:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 TWILIO TRANSCRIPTION WEBHOOK RECEIVED
📞 CallSid: CA1234567890abcdef
📄 TranscriptionSid: TR1234567890abcdef
✅ Status: completed
📋 Transcript length: 245
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Transcript saved for call CA1234567890abcdef
```

### On Dashboard (Browser Console):
```
✅ Connected to Socket.IO server
🔐 Joined room: user:96fc4999-cc43-4dde-abe0-21048b922981
📝 Received transcriptUpdate event
✅ Received callCompleted event
```

---

## Troubleshooting

### Issue: No Transcripts Appearing

**Check 1: TwiML Configuration**
- Verify `transcribe="true"` is set in `<Record>` tag
- Verify `transcribeCallback` URL is correct: `https://www.skyiq.app/webhook/transcription`
- Make sure TwiML Bin is assigned to your phone number

**Check 2: Server Logs**
```bash
# On Render dashboard, look for:
📝 TWILIO TRANSCRIPTION WEBHOOK RECEIVED
✅ Transcript saved for call...
```

**Check 3: Call Status**
```sql
SELECT id, twilio_call_sid, transcript, status 
FROM calls 
WHERE twilio_call_sid = 'CA1234567890abcdef';
```
- Should show `status: 'completed'` and populated `transcript` field

**Check 4: Webhook Delivery**
- Go to Twilio Console → Monitor → Logs → Webhooks
- Look for POST requests to `/webhook/transcription`
- Check for any errors

### Issue: Transcript Delayed

**Normal behavior:**
- Transcription takes **2-3 minutes** after call ends
- Depends on call length (longer calls = longer transcription time)
- Maximum transcription length: 300 seconds (5 minutes)

**If taking longer than 5 minutes:**
- Check Twilio webhook logs for delivery failures
- Verify server is responding with HTTP 200
- Check Render logs for processing errors

### Issue: Partial Transcripts

**Cause**: Recording stopped early or maxLength exceeded

**Solution**:
- Increase `maxLength` in TwiML (max: 14400 = 4 hours)
- Check call didn't disconnect prematurely
- Verify recording actually completed

---

## Cost Estimates

### Twilio Pricing:
- **Recording**: $0.0025/min
- **Transcription**: $0.05/min
- **Total**: ~$0.0525/min (~$3.15/hour)

### Example Monthly Costs:
- **500 minutes**: ~$26.25
- **1000 minutes**: ~$52.50
- **2000 minutes**: ~$105

**Note**: This is MORE expensive than Deepgram (~$0.0043/min) but simpler to set up.

---

## Production Checklist

- [ ] TwiML updated with `<Record transcribe="true">`
- [ ] Transcription webhook URL configured: `https://www.skyiq.app/webhook/transcription`
- [ ] Test call made and transcript received
- [ ] Server logs show successful webhook processing
- [ ] Dashboard displays transcript correctly
- [ ] Socket.IO real-time updates working
- [ ] Database has populated `transcript` field

---

## Alternative: Recording without Transcription

If you want recordings but handle transcription yourself:

```xml
<Record 
  action="https://www.skyiq.app/webhook"
  transcribe="false"
  recordingStatusCallback="https://www.skyiq.app/webhook/recording"
  maxLength="300"
/>
```

Then use a service like:
- OpenAI Whisper
- AssemblyAI
- Google Speech-to-Text

To transcribe the recording URL yourself (more control, potentially cheaper).

---

## Support

### Common Issues:
1. **No webhook received** → Check TwiML configuration
2. **Transcript empty** → Verify recording worked
3. **Delayed transcripts** → Normal, wait 2-3 min
4. **Dashboard not updating** → Check Socket.IO connection

### Documentation:
- Twilio Recording: https://www.twilio.com/docs/voice/twiml/record
- Twilio Transcription: https://www.twilio.com/docs/voice/twiml/record#transcription

---

**Ready to deploy!** Just configure the TwiML and you'll have transcripts appearing 2-3 minutes after each call ends.
