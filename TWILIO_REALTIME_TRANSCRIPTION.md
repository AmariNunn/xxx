# Twilio Real-Time Transcription Setup

## Overview
This guide shows how to configure Twilio to stream call audio in real-time for instant transcription using Deepgram.

**Result:** Transcripts appear **instantly** as the conversation happens (not 5-7 minutes later)!

---

## Architecture

```
Caller → Twilio Phone Number → Media Streams (WebSocket) → Your Server
                                                                 ↓
                                                          Deepgram API
                                                                 ↓
                                                      Real-time Transcript
                                                                 ↓
                                                      Database + Socket.IO
                                                                 ↓
                                                        Dashboard Updates
```

---

## Prerequisites

1. ✅ Twilio account with phone number
2. ✅ Deepgram API account and key
3. ✅ Server with WebSocket support (already configured)
4. ✅ Public HTTPS/WSS URL (Render provides this)

---

## Step 1: Get Deepgram API Key

1. Sign up at [Deepgram](https://deepgram.com/)
2. Create a new API key
3. **Store in Supabase business_info table** (admin-controlled):

```sql
UPDATE business_info 
SET deepgram_api_key = 'your_deepgram_api_key_here'
WHERE user_id = 'your_user_id';
```

**Important:** Users cannot edit API keys in the UI - only admins can update via database.

---

## Step 2: Configure Twilio TwiML

### Option A: Using TwiML Bins (Recommended)

1. Go to Twilio Console → TwiML Bins
2. Create new TwiML Bin
3. Add this code:

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
5. Go to your Twilio Phone Number → Configure
6. Set "A Call Comes In" webhook to your TwiML Bin URL

### Option B: Using Your Own Webhook

If you prefer dynamic TwiML generation, create this endpoint:

```javascript
app.post('/twilio/voice', (req, res) => {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>This call may be transcribed for quality assurance.</Say>
  <Connect>
    <Stream url="wss://www.skyiq.app/media-stream">
      <Parameter name="userId" value="${req.body.userId || ''}" />
      <Parameter name="conversationId" value="${req.body.CallSid}" />
    </Stream>
  </Connect>
</Response>`;
  
  res.type('text/xml');
  res.send(twiml);
});
```

Then set your phone number's webhook to: `https://www.skyiq.app/twilio/voice`

---

## Step 3: Configure for Outbound Calls

For outbound calls initiated via ElevenLabs or directly:

### Update TwiML for ElevenLabs Outbound:

1. In ElevenLabs agent settings, set "Post-Dial TwiML"
2. Add:

```xml
<Response>
  <Connect>
    <Stream url="wss://www.skyiq.app/media-stream" />
  </Connect>
</Response>
```

---

## Step 4: Test Real-Time Transcription

### Test Steps:

1. **Make a call** to your Twilio number
2. **Speak clearly** for a few seconds
3. **Check server logs** for:
   ```
   🎙️ Twilio Media Stream connected
   📞 Stream started: { streamSid: '...', callSid: '...' }
   ✅ Deepgram connection established
   📝 interim: Hello
   📝 FINAL: Hello, this is a test call
   ✅ Updated transcript for conv_xxxxx
   ```
4. **Check your dashboard** - transcript should appear in real-time!

---

## How It Works

### 1. Call Initiation
- User initiates call via dashboard
- Call record created in database with `conversation_id`
- Status: `initiated`

### 2. Audio Streaming
- Twilio connects to WebSocket: `wss://www.skyiq.app/media-stream`
- Audio streams as mulaw 8kHz, base64-encoded chunks
- Server forwards to Deepgram API

### 3. Real-Time Transcription
- Deepgram transcribes audio with ~150ms latency
- Sends back:
  - **Interim results** (partial transcript)
  - **Final results** (confirmed transcript)

### 4. Database Updates
- Server accumulates final transcripts
- Updates database: `UPDATE calls SET transcript = '...' WHERE conversation_id = '...'`
- Status changes: `initiated` → `in-progress` → `completed`

### 5. Dashboard Updates
- Socket.IO emits `transcriptUpdate` event
- Dashboard receives real-time transcript
- UI updates instantly without refresh

---

## WebSocket Message Flow

### Twilio → Server:

```json
{
  "event": "start",
  "start": {
    "streamSid": "MZ...",
    "callSid": "CA...",
    "customParameters": {
      "userId": "...",
      "conversationId": "..."
    }
  }
}
```

```json
{
  "event": "media",
  "media": {
    "payload": "base64_audio_data...",
    "timestamp": 123456
  }
}
```

```json
{
  "event": "stop",
  "stop": {
    "callSid": "CA..."
  }
}
```

### Server → Deepgram:

```javascript
// Raw audio buffer (decoded from base64)
deepgramConnection.send(audioBuffer);
```

### Deepgram → Server:

```json
{
  "channel": {
    "alternatives": [{
      "transcript": "Hello, how can I help you today?"
    }]
  },
  "is_final": true
}
```

---

## Troubleshooting

### No Transcripts Appearing

**Check 1: Deepgram API Key**
```sql
SELECT deepgram_api_key FROM business_info WHERE user_id = 'your_user_id';
```
- Should return a valid key starting with your Deepgram project ID

**Check 2: Server Logs**
```bash
# On Render, check logs for:
🎙️ Twilio Media Stream connected
✅ Deepgram connection established
📝 FINAL: [transcript text]
```

**Check 3: TwiML Configuration**
- Verify WebSocket URL is: `wss://www.skyiq.app/media-stream`
- Must use `wss://` (secure WebSocket), not `ws://`
- Must use `<Connect><Stream>` not just `<Stream>`

**Check 4: Firewall/Network**
- Render must allow WebSocket connections
- Check Render logs for connection errors

### Transcripts Delayed or Partial

**Issue:** Only getting partial words
**Solution:** 
- Speak longer sentences (>2 seconds)
- Deepgram batches short utterances

**Issue:** 3-5 second delay
**Solution:**
- This is normal for final transcripts
- Enable `interim_results: true` for faster updates (already enabled)

### WebSocket Keeps Disconnecting

**Check 1: Connection Timeout**
- Twilio streams timeout after 60 seconds of silence
- Normal for completed calls

**Check 2: Deepgram Connection**
- Logs show: `❌ Deepgram error: ...`
- Verify API key is valid
- Check Deepgram account has credits

---

## Cost Estimates

### Per Minute Costs:
- **Twilio Phone Number**: $1/month + $0.0085/min
- **Twilio Media Streams**: Included with voice minutes
- **Deepgram Transcription**: ~$0.0043/min
- **Total**: ~$0.013/min (~$0.78/hour)

### Example Monthly Usage:
- 1000 minutes of calls/month
- Cost: ~$13/month for transcription
- Plus Twilio voice costs

---

## Production Checklist

- [ ] Deepgram API key stored in Supabase business_info (not environment variables)
- [ ] TwiML configured for all phone numbers
- [ ] WebSocket URL uses `wss://` (secure)
- [ ] Test with both inbound and outbound calls
- [ ] Verify transcripts appear in dashboard in real-time
- [ ] Monitor Render logs for errors
- [ ] Check Deepgram usage/credits
- [ ] Set up error alerting for WebSocket failures

---

## Advanced: Speaker Diarization

To distinguish between caller and agent:

### Update TwiML:
```xml
<Stream url="wss://www.skyiq.app/media-stream" track="both_tracks" />
```

### Update Deepgram Config:
```javascript
{
  encoding: 'mulaw',
  sample_rate: 8000,
  channels: 2,  // Now 2 channels for inbound + outbound
  punctuate: true,
  diarize: true,  // Enable speaker diarization
  model: 'nova-2'
}
```

### Handle Speaker Labels:
```javascript
dgConnection.on(LiveTranscriptionEvents.Transcript, (data) => {
  const transcript = data.channel.alternatives[0].transcript;
  const speaker = data.channel.alternatives[0].words[0]?.speaker; // 0 or 1
  
  console.log(`Speaker ${speaker}: ${transcript}`);
});
```

---

## Support

If transcripts still aren't working:
1. Check all steps in this guide
2. Review Render logs for errors
3. Verify Deepgram API key is valid
4. Test with `/webhook/test` endpoint
5. Contact support with:
   - Call SID
   - Timestamp
   - Server logs
   - Browser console errors
