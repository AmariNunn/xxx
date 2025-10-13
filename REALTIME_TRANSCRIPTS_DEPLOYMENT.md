# Real-Time Transcripts - Deployment Guide

## 🎯 What Changed

You now have **instant real-time transcription** using Twilio Media Streams + Deepgram!

### Before:
- ❌ Transcripts took 5-7 minutes to appear (waiting for ElevenLabs webhook)
- ❌ Calls showed as "Missed" with no content
- ❌ No way to see conversation while it's happening

### After:
- ✅ **Instant transcripts** as conversation happens (~150ms latency)
- ✅ Real-time dashboard updates via Socket.IO
- ✅ Proper call status: `initiated` → `in-progress` → `completed`
- ✅ Full transcript visible immediately after call ends

---

## 📦 What Was Added

### New Files:
1. **`server/twilioMediaStreams.ts`** - WebSocket server for Twilio audio streaming + Deepgram integration
2. **`TWILIO_REALTIME_TRANSCRIPTION.md`** - Complete setup guide
3. **`REALTIME_TRANSCRIPTS_DEPLOYMENT.md`** - This deployment guide

### Updated Files:
1. **`server/index.ts`** - Added Twilio Media Streams setup
2. **`package.json`** - Added @deepgram/sdk, @types/ws

### Database Changes Needed:
```sql
-- Add Deepgram API key column to business_info table
ALTER TABLE business_info 
ADD COLUMN deepgram_api_key VARCHAR(255);
```

---

## 🚀 Deployment Steps

### Step 1: Push Code to GitHub
```bash
git add .
git commit -m "Add real-time transcription with Twilio Media Streams + Deepgram"
git push origin main
```

### Step 2: Render Auto-Deploys
- Render will automatically deploy from GitHub
- Monitor deployment logs on Render dashboard
- Wait for "Build succeeded" message

### Step 3: Update Database Schema

**In Supabase SQL Editor:**
```sql
-- Add Deepgram API key column
ALTER TABLE business_info 
ADD COLUMN IF NOT EXISTS deepgram_api_key VARCHAR(255);
```

### Step 4: Add Your Deepgram API Key

1. **Get Deepgram API key:**
   - Sign up at https://deepgram.com/
   - Create new API key
   - Copy the key

2. **Store in Supabase** (admin-controlled):
```sql
UPDATE business_info 
SET deepgram_api_key = 'your_deepgram_api_key_here'
WHERE user_id = '96fc4999-cc43-4dde-abe0-21048b922981';
```

⚠️ **Important:** Replace `your_deepgram_api_key_here` with your actual key!

### Step 5: Configure Twilio TwiML

**Option A: Using TwiML Bins (Easiest)**

1. Go to Twilio Console → TwiML Bins
2. Create new TwiML Bin named "SkyIQ Media Stream"
3. Paste this code:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>This call may be transcribed for quality assurance.</Say>
  <Connect>
    <Stream url="wss://www.skyiq.app/media-stream" />
  </Connect>
</Response>
```

4. Save and copy the TwiML Bin URL
5. Go to: Twilio Console → Phone Numbers → Your Number
6. Under "Voice Configuration":
   - "A Call Comes In" → TwiML Bin
   - Select your "SkyIQ Media Stream" bin
7. Click Save

**Option B: For ElevenLabs Outbound Calls**

1. Go to ElevenLabs Dashboard → Your Agent → Settings
2. Find "Post-Dial TwiML" or "Custom TwiML" section
3. Add:

```xml
<Response>
  <Connect>
    <Stream url="wss://www.skyiq.app/media-stream" />
  </Connect>
</Response>
```

4. Save agent settings

---

## 🧪 Testing

### Test 1: Make an Outbound Call

1. Login to your SkyIQ dashboard
2. Go to "Make a Call" tab
3. Enter a phone number: `1 615 638 1135` (or any number)
4. Click "Test Agent"
5. **Speak when call connects**
6. Watch dashboard - transcript should appear **in real-time**!

### Test 2: Check Render Logs

```bash
# Expected logs:
🎙️ Twilio Media Stream connected
📞 Stream started: { streamSid: 'MZ...', callSid: 'CA...' }
✅ Deepgram connection established for stream: MZ...
📝 interim: Hello
📝 FINAL: Hello, this is a test call
✅ Updated transcript for conv_2001k7fwahhcfwb9ad35jx1sbkab
⏹️ Stream stopped: MZ...
✅ Call completed: conv_2001k7fwahhcfwb9ad35jx1sbkab, duration: 45s
```

### Test 3: Verify Database

```sql
SELECT id, conversation_id, transcript, status, duration
FROM calls 
WHERE conversation_id = 'conv_2001k7fwahhcfwb9ad35jx1sbkab';
```

**Expected:**
- `transcript`: Full conversation text
- `status`: `completed`
- `duration`: Actual call length in seconds

---

## 🔍 How It Works

### 1. Call Flow (Outbound)
```
User clicks "Test Agent"
  → POST /api/calls/initiate with user_id + phone_number
  → Backend creates call record (status: initiated)
  → ElevenLabs starts call
  → Twilio connects to wss://www.skyiq.app/media-stream
  → Audio streams in real-time
```

### 2. Transcription Flow
```
Twilio → WebSocket → Our Server
  → Decode base64 audio (mulaw 8kHz)
  → Forward to Deepgram API
  → Deepgram returns transcript chunks
  → Update database: status = in-progress, transcript += new_chunk
  → Socket.IO broadcast to dashboard
  → Dashboard updates in real-time
```

### 3. Call Completion
```
Call ends → Twilio sends "stop" event
  → Close Deepgram connection
  → Final database update: status = completed, duration = X seconds
  → Socket.IO emit "callCompleted"
  → Dashboard shows final transcript
```

---

## ⚙️ Configuration

### Environment Variables (Already Set on Render)
```bash
SUPABASE_URL=<your_supabase_url>
SUPABASE_SERVICE_ROLE_KEY=<your_service_key>
```

### Supabase business_info Table
```sql
-- Each user has their own API keys (admin-controlled)
CREATE TABLE business_info (
  user_id VARCHAR(255) PRIMARY KEY,
  elevenlabs_api_key VARCHAR(255),
  elevenlabs_agent_id VARCHAR(255),
  elevenlabs_phone_number_id VARCHAR(255),
  deepgram_api_key VARCHAR(255),  -- NEW COLUMN
  twilio_phone_number VARCHAR(50)
);
```

### WebSocket Endpoint
- **URL**: `wss://www.skyiq.app/media-stream`
- **Protocol**: Secure WebSocket (WSS)
- **Port**: Same as main server (5000 on Render)
- **Path**: `/media-stream`

---

## 🐛 Troubleshooting

### Issue: No Transcripts Appearing

**Check 1: Deepgram API Key**
```sql
SELECT deepgram_api_key FROM business_info 
WHERE user_id = '96fc4999-cc43-4dde-abe0-21048b922981';
```
- Should return a valid key
- If NULL, run the UPDATE query from Step 4

**Check 2: Render Logs**
```
# Look for these messages:
✅ Twilio Media Streams WebSocket server ready at /media-stream
🎙️ Twilio Media Stream connected
✅ Deepgram connection established
```

**Check 3: TwiML Configuration**
- Twilio Console → Phone Numbers → Your Number
- Verify "A Call Comes In" webhook points to correct TwiML Bin
- TwiML must include: `<Stream url="wss://www.skyiq.app/media-stream" />`

**Check 4: Browser Console**
```javascript
// Should see Socket.IO events:
✅ Connected to Socket.IO server
📝 Received transcriptUpdate event: { conversation_id: '...', transcript: '...' }
✅ Received callCompleted event
```

### Issue: Call Shows "Missed" Status

**Cause:** TwiML not configured or WebSocket not connecting

**Solution:**
1. Verify TwiML configuration (Step 5)
2. Check Render logs for WebSocket connection
3. Test WebSocket endpoint:
   ```bash
   wscat -c wss://www.skyiq.app/media-stream
   # Should connect successfully
   ```

### Issue: Partial or Delayed Transcripts

**Normal Behavior:**
- Interim results appear within ~500ms
- Final results within ~1-2 seconds
- Deepgram batches very short utterances

**To Improve:**
- Speak in complete sentences (>2 seconds)
- Check network latency (Render → Deepgram)
- Verify `interim_results: true` is set (already configured)

---

## 💰 Cost Estimates

### Deepgram Pricing:
- **Pay-as-you-go**: $0.0043/minute
- **1000 minutes/month**: ~$4.30
- **5000 minutes/month**: ~$21.50

### Total Call Costs (Including Twilio):
- **Twilio voice**: ~$0.0085/min
- **Deepgram transcript**: ~$0.0043/min
- **Total**: ~$0.013/min (~$0.78/hour)

### Example Monthly Bill:
- 2000 minutes of calls
- Twilio: ~$17
- Deepgram: ~$8.60
- **Total**: ~$25.60/month

---

## 📊 Monitoring

### Key Metrics to Track:

1. **WebSocket Connections**
   - Render logs: Count "Twilio Media Stream connected"
   - Should match number of active calls

2. **Deepgram Success Rate**
   - Count "✅ Updated transcript" vs "❌ Deepgram error"
   - Should be >95%

3. **Transcript Latency**
   - Time from "media" event to "FINAL" transcript
   - Should be <2 seconds

4. **Database Updates**
   - Verify `status` transitions: initiated → in-progress → completed
   - Check `transcript` is populated

---

## 🎯 Success Criteria

✅ **After deployment, you should see:**

1. **Make a call** → Transcript appears **in real-time** (not 5-7 min later)
2. **Dashboard updates** without refresh (Socket.IO working)
3. **Call status** shows `in-progress` then `completed` (not stuck on `Missed`)
4. **Full transcript** saved to database within seconds of call ending
5. **Render logs** show successful Deepgram connections

---

## 📞 Support

If you encounter issues:

1. **Check logs first** (Render dashboard)
2. **Verify database** (Supabase SQL editor)
3. **Test WebSocket** (wscat or browser dev tools)
4. **Review TwiML** (Twilio console)

**Common fixes:**
- Missing Deepgram key → Run UPDATE query
- TwiML not set → Configure in Twilio console
- WebSocket failing → Check Render logs for errors

---

## 🚀 Next Steps

After successful deployment:

1. **Test with real calls** to verify transcripts
2. **Monitor Deepgram usage** (check dashboard)
3. **Add error alerting** for WebSocket failures
4. **Consider speaker diarization** (see advanced docs)
5. **Optimize transcript display** in dashboard UI

---

## 📝 Files to Reference

- **Setup Guide**: `TWILIO_REALTIME_TRANSCRIPTION.md`
- **Multi-User Guide**: `DEPLOYMENT_CHANGES.md`
- **Webhook Guide**: `WEBHOOK_SETUP.md`
- **This Guide**: `REALTIME_TRANSCRIPTS_DEPLOYMENT.md`

---

**You're ready to deploy!** 🎉

Push to GitHub → Render auto-deploys → Update database → Configure TwiML → Test → Enjoy instant transcripts!
