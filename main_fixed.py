from fastapi import FastAPI, Form, Request
from fastapi.responses import Response, FileResponse
from app.services.ai_service import SarahAI
import os
import json
import datetime
from pathlib import Path
from openai import OpenAI
from app.config import settings
import requests
import asyncio


# Get VoxIntel user ID from environment or default
VOXINTEL_USER_ID = int(os.environ.get("VOXINTEL_USER_ID", "3"))

async def send_call_to_voxintel(call_data):
    """Send completed call data to VoxIntel dashboard with retry logic"""
    voxintel_webhook = "https://f7a3630f-434f-4652-85e2-5109cccab8ef-00-14omzpco0tibm.janeway.replit.dev/api/railway/sarah-calls"
    
    # Extract key information
    lead_info = call_data.get("final_lead_info", {})
    conversation = call_data.get("conversation", [])
    
    # Build transcript
    transcript_parts = []
    for msg in conversation:
        speaker = msg.get("speaker", "Unknown")
        message = msg.get("message", "")
        transcript_parts.append(f"{speaker}: {message}")
    
    full_transcript = "\n".join(transcript_parts)
    
    # Calculate duration from conversation timestamps
    duration = 0
    if len(conversation) >= 2:
        try:
            start_time = datetime.datetime.fromisoformat(conversation[0].get("timestamp", ""))
            end_time = datetime.datetime.fromisoformat(conversation[-1].get("timestamp", ""))
            duration = int((end_time - start_time).total_seconds())
        except:
            duration = len(conversation) * 30  # Estimate 30 seconds per exchange
    
    # Create summary
    name = lead_info.get("name", "Unknown caller")
    business_type = lead_info.get("business_type", "business")
    product_interest = lead_info.get("product_category", "promotional items")
    lead_score = lead_info.get("lead_score", "warm")
    
    summary = f"{lead_score.title()} lead - {name} from {business_type} interested in {product_interest}"
    
    payload = {
        "userId": VOXINTEL_USER_ID,
        "phoneNumber": call_data.get("from_number", "Unknown"),
        "contactName": name,
        "duration": duration,
        "status": "completed" if call_data.get("call_completed", False) else "missed",
        "summary": summary,
        "notes": f"Lead Score: {lead_score} | Business: {business_type} | Interest: {product_interest}",
        "transcript": full_transcript,
        "direction": "inbound",
        "twilioCallSid": call_data.get("call_sid"),
        "recordingUrl": call_data.get("recording_url")
    }
    
    # Retry logic for reliability
    for attempt in range(3):
        try:
            response = requests.post(
                voxintel_webhook,
                headers={"Content-Type": "application/json"},
                json=payload,
                timeout=15
            )
            
            if response.status_code == 200:
                print(f"✅ Call logged in VoxIntel (attempt {attempt + 1}): {call_data.get('from_number')} - {summary}")
                return True
            else:
                print(f"❌ VoxIntel error {response.status_code} (attempt {attempt + 1})")
                
        except Exception as e:
            print(f"❌ VoxIntel connection error (attempt {attempt + 1}): {str(e)}")
            
        if attempt < 2:  # Don't wait after the last attempt
            await asyncio.sleep(2)  # Wait 2 seconds before retry
    
    print(f"❌ Failed to log call to VoxIntel after 3 attempts")
    return False

app = FastAPI()
sarah_ai = SarahAI()

# Initialize OpenAI client
try:
    openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
    print("✅ OpenAI initialized successfully")
except Exception as e:
    openai_client = None
    print(f"❌ OpenAI failed to initialize: {e}")

# Create persistent directories
audio_dir = Path("audio_files")
audio_dir.mkdir(exist_ok=True)

recordings_dir = Path("call_recordings")
recordings_dir.mkdir(exist_ok=True)

@app.get("/")
def root():
    return {
        "message": "Sarah AI - Optimized for efficiency and call completion!", 
        "status": "active",
        "features": ["Direct responses", "Smart call ending", "Fast lead capture", "Persistent storage", "VoxIntel integration"],
        "deployment": "Railway",
        "voxintel_user_id": VOXINTEL_USER_ID,
        "version": "3.2"
    }

@app.get("/audio/{filename}")
def serve_audio(filename: str):
    """Serve generated audio files from persistent storage"""
    audio_path = audio_dir / filename
    print(f"🎵 Serving audio: {audio_path}")
    
    if audio_path.exists():
        print(f"✅ Audio file found: {filename}")
        return FileResponse(audio_path, media_type="audio/mpeg")
    else:
        print(f"❌ Audio file not found: {filename}")
        return {"error": "Audio file not found"}

@app.get("/calls/recordings/{call_sid}")
def get_call_recording(call_sid: str):
    """Get specific call recording and transcript"""
    transcript_file = recordings_dir / f"{call_sid}_transcript.json"
    
    if transcript_file.exists():
        with open(transcript_file, 'r') as f:
            return json.load(f)
    return {"error": "Recording not found"}

@app.get("/calls/all-recordings")
def list_all_recordings():
    """List all call recordings with summary info"""
    if not recordings_dir.exists():
        return {"recordings": [], "total_calls": 0}
    
    recordings = []
    for file in recordings_dir.glob("*_transcript.json"):
        try:
            with open(file, 'r') as f:
                data = json.load(f)
                
            conversation_length = len(data.get("conversation", []))
            lead_info = data.get("final_lead_info", {})
            lead_score = lead_info.get("lead_score", "unknown")
            contact_captured = bool(lead_info.get("name") or lead_info.get("phone"))
            call_completed = data.get("call_completed", False)
            
            recordings.append({
                "call_sid": data.get("call_sid"),
                "from_number": data.get("from_number"),
                "start_time": data.get("start_time"),
                "end_time": data.get("end_time"),
                "conversation_exchanges": conversation_length,
                "lead_score": lead_score,
                "contact_captured": contact_captured,
                "call_completed": call_completed,
                "business_type": lead_info.get("business_type", "unknown"),
                "product_interest": lead_info.get("product_category", "unknown"),
                "recording_url": data.get("recording_url"),
                "summary": f"{lead_score.title()} lead - {lead_info.get('business_type', 'Unknown business')} - {'Complete' if call_completed else 'Incomplete'}"
            })
        except Exception as e:
            print(f"Error reading {file}: {e}")
            continue
    
    recordings.sort(key=lambda x: x.get("start_time", ""), reverse=True)
    
    return {
        "recordings": recordings,
        "total_calls": len(recordings),
        "hot_leads": len([r for r in recordings if r["lead_score"] == "hot"]),
        "completed_calls": len([r for r in recordings if r["call_completed"]]),
        "contact_capture_rate": f"{sum(1 for r in recordings if r['contact_captured'])/len(recordings)*100:.1f}%" if recordings else "0%",
        "completion_rate": f"{sum(1 for r in recordings if r['call_completed'])/len(recordings)*100:.1f}%" if recordings else "0%"
    }

@app.get("/calls/stats")
def get_call_statistics():
    """Get comprehensive call statistics"""
    if not recordings_dir.exists():
        return {"message": "No calls recorded yet"}
    
    stats = {
        "total_calls": 0,
        "completed_calls": 0,
        "lead_scores": {"hot": 0, "warm": 0, "cold": 0},
        "business_types": {},
        "contact_capture_rate": 0,
        "call_completion_rate": 0,
        "average_conversation_length": 0
    }
    
    conversation_lengths = []
    contacts_captured = 0
    calls_completed = 0
    
    for file in recordings_dir.glob("*_transcript.json"):
        try:
            with open(file, 'r') as f:
                data = json.load(f)
            
            stats["total_calls"] += 1
            lead_info = data.get("final_lead_info", {})
            lead_score = lead_info.get("lead_score", "cold")
            stats["lead_scores"][lead_score] = stats["lead_scores"].get(lead_score, 0) + 1
            
            business_type = lead_info.get("business_type", "unknown")
            stats["business_types"][business_type] = stats["business_types"].get(business_type, 0) + 1
            
            if lead_info.get("name") or lead_info.get("phone"):
                contacts_captured += 1
                
            if data.get("call_completed", False):
                calls_completed += 1
            
            conv_length = len(data.get("conversation", []))
            conversation_lengths.append(conv_length)
            
        except Exception as e:
            print(f"Error processing {file}: {e}")
    
    if stats["total_calls"] > 0:
        stats["contact_capture_rate"] = f"{contacts_captured/stats['total_calls']*100:.1f}%"
        stats["call_completion_rate"] = f"{calls_completed/stats['total_calls']*100:.1f}%"
        stats["average_conversation_length"] = f"{sum(conversation_lengths)/len(conversation_lengths):.1f} exchanges"
        stats["completed_calls"] = calls_completed
    
    return stats

@app.post("/webhook/voice")
async def voice_webhook(request: Request):
    """Handle Twilio voice calls with optimized call ending logic"""
    try:
        form_data = await request.form()
        
        CallSid = form_data.get("CallSid", "unknown")
        From = form_data.get("From", "unknown")
        To = form_data.get("To", "unknown")
        CallStatus = form_data.get("CallStatus", "unknown")
        SpeechResult = form_data.get("SpeechResult", None)
        RecordingUrl = form_data.get("RecordingUrl", None)
        
        print(f"📞 Call from {From}, CallSid: {CallSid}")
        
        # Initialize or load call transcript
        transcript_file = recordings_dir / f"{CallSid}_transcript.json"
        
        if transcript_file.exists():
            with open(transcript_file, 'r') as f:
                call_data = json.load(f)
        else:
            call_data = {
                "call_sid": CallSid,
                "from_number": From,
                "to_number": To,
                "start_time": datetime.datetime.now().isoformat(),
                "conversation": [],
                "lead_info": {},
                "recording_url": None,
                "status": "in_progress",
                "call_completed": False,
                "sent_to_voxintel": False
            }
        
        if RecordingUrl:
            call_data["recording_url"] = RecordingUrl
            print(f"🎵 Recording URL captured: {RecordingUrl}")
        
        # Handle conversation
        if not SpeechResult:
            # First interaction - use optimized greeting
            message = "Hi! This is Sarah from TriCreativeGroup. What promotional items can I help you with today?"
            
            call_data["conversation"].append({
                "timestamp": datetime.datetime.now().isoformat(),
                "speaker": "Sarah",
                "message": message,
                "type": "greeting"
            })
            
            print(f"🤖 Sarah greeting (optimized)")
            
        else:
            print(f"🗣️ Customer said: '{SpeechResult}'")
            
            call_data["conversation"].append({
                "timestamp": datetime.datetime.now().isoformat(),
                "speaker": "Customer", 
                "message": SpeechResult,
                "type": "customer_input"
            })
            
            # Get Sarah's AI response with call ending logic
            sarah_response = sarah_ai.get_response(
                SpeechResult, 
                CallSid, 
                {
                    "lead_info": call_data.get("lead_info", {}),
                    "conversation_history": call_data.get("conversation", [])
                }
            )
            
            message = sarah_response["message"]
            call_data["lead_info"].update(sarah_response.get("lead_info", {}))
            
            # Check if call should end
            should_end_call = sarah_response.get("should_end_call", False)
            next_action = sarah_response.get("next_action", "continue")
            
            # OVERRIDE: Force end if we have essentials (failsafe)
            updated_lead_info = call_data["lead_info"]
            has_contact = 'phone' in updated_lead_info and 'name' in updated_lead_info
            has_project = 'business_type' in updated_lead_info or 'product_category' in updated_lead_info
            
            if has_contact and has_project and not should_end_call:
                # Override with professional closing
                business_type = updated_lead_info.get('business_type', 'organization')
                name = updated_lead_info.get('name', 'there')
                message = f"Perfect! I have your information, {name}. Our promotional products specialist will contact you within 24 hours with customized options for your {business_type}. Thank you for choosing TriCreativeGroup!"
                should_end_call = True
                next_action = 'end_call'
                print(f"🔄 OVERRIDE: Forcing call end - we have all essentials!")
            
            call_data["conversation"].append({
                "timestamp": datetime.datetime.now().isoformat(),
                "speaker": "Sarah",
                "message": message,
                "type": "ai_response",
                "lead_info_extracted": sarah_response.get("lead_info", {}),
                "confidence": sarah_response.get("confidence", 0.9),
                "next_action": next_action,
                "should_end_call": should_end_call
            })
            
            print(f"🤖 Sarah responds: '{message}'")
            print(f"📊 Lead info updated: {call_data['lead_info']}")
            print(f"🔚 Should end call: {should_end_call}")
            
            # Mark call as completed if ending and send to VoxIntel ONCE
            if should_end_call or next_action == 'end_call':
                call_data["call_completed"] = True
                call_data["end_time"] = datetime.datetime.now().isoformat()
                call_data["status"] = "completed"
                call_data["final_lead_info"] = call_data["lead_info"]
                print(f"✅ Call marked as completed")
                
                # Send to VoxIntel only if not already sent
                if not call_data.get("sent_to_voxintel", False):
                    call_data["sent_to_voxintel"] = True
                    asyncio.create_task(send_call_to_voxintel(call_data))
        
        # Save transcript immediately
        call_data["final_lead_info"] = call_data["lead_info"]
        call_data["last_updated"] = datetime.datetime.now().isoformat()
        
        with open(transcript_file, 'w') as f:
            json.dump(call_data, f, indent=2)
        
        # Generate premium voice with persistent storage
        audio_filename = None
        if openai_client:
            try:
                print(f"🎤 Generating premium voice...")
                
                response = openai_client.audio.speech.create(
                    model="tts-1",
                    voice="verse",
                    input=message,
                    speed=1.1  # Slightly faster for efficiency
                )
                
                # Save to persistent audio directory
                audio_filename = f"sarah_{CallSid}_{abs(hash(message))}.mp3"
                audio_path = audio_dir / audio_filename
                
                with open(audio_path, 'wb') as f:
                    for chunk in response.iter_bytes():
                        f.write(chunk)
                        
                print(f"✅ Premium voice saved: {audio_filename}")
                
            except Exception as e:
                print(f"❌ Voice generation failed: {e}")
                audio_filename = None
        
        # Auto-detect Railway domain
        railway_domain = os.environ.get("RAILWAY_PUBLIC_URL", 
                          os.environ.get("RAILWAY_STATIC_URL",
                          "localhost:8000")).replace("https://", "").replace("http://", "")
        
        # Create TwiML response with call ending logic
        should_end_call = call_data.get("call_completed", False)
        
        if should_end_call:
            # End the call cleanly
            if audio_filename:
                twiml = f'''<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>https://{railway_domain}/audio/{audio_filename}</Play>
    <Hangup/>
</Response>'''
            else:
                twiml = f'''<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="Polly.Ruth-Neural">{message}</Say>
    <Hangup/>
</Response>'''
        else:
            # Continue conversation
            if audio_filename:
                twiml = f'''<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>https://{railway_domain}/audio/{audio_filename}</Play>
    <Gather input="speech" action="/webhook/voice" speechTimeout="auto" timeout="5" language="en-US">
    </Gather>
    <Say voice="Polly.Ruth-Neural">I didn't catch that. Could you repeat?</Say>
    <Gather input="speech" action="/webhook/voice" speechTimeout="auto" timeout="6" language="en-US">
    </Gather>
    <Say voice="Polly.Ruth-Neural">Thanks for calling TriCreativeGroup. Have a great day!</Say>
    <Hangup/>
</Response>'''
            else:
                # Fallback to Polly if OpenAI fails
                twiml = f'''<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="Polly.Ruth-Neural">{message}</Say>
    <Gather input="speech" action="/webhook/voice" speechTimeout="auto" timeout="5" language="en-US">
    </Gather>
    <Say voice="Polly.Ruth-Neural">Thanks for calling TriCreativeGroup. Have a great day!</Say>
    <Hangup/>
</Response>'''
        
        return Response(content=twiml, media_type="application/xml")
        
    except Exception as e:
        print(f"❌ Webhook error: {e}")
        
        emergency_twiml = '''<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="Polly.Ruth-Neural">Hello! Thanks for calling TriCreativeGroup. Please hold while we connect you.</Say>
    <Hangup/>
</Response>'''
        
        return Response(content=emergency_twiml, media_type="application/xml")

@app.post("/webhook/recording")
async def handle_recording_completion(
    CallSid: str = Form(...),
    RecordingUrl: str = Form(...),
    RecordingDuration: str = Form(None),
    RecordingSid: str = Form(None)
):
    """Handle completed call recordings from Twilio - FIXED ASYNC"""
    print(f"📹 Call recording completed for {CallSid}")
    print(f"🎵 Recording URL: {RecordingUrl}")
    print(f"⏱️ Duration: {RecordingDuration} seconds")
    
    transcript_file = recordings_dir / f"{CallSid}_transcript.json"
    
    if transcript_file.exists():
        with open(transcript_file, 'r') as f:
            call_data = json.load(f)
        
        call_data["recording_url"] = RecordingUrl
        call_data["recording_sid"] = RecordingSid
        call_data["duration_seconds"] = RecordingDuration
        if not call_data.get("end_time"):
            call_data["end_time"] = datetime.datetime.now().isoformat()
        call_data["status"] = "completed"
        call_data["conversation_exchanges"] = len(call_data.get("conversation", []))
        call_data["final_lead_info"] = call_data.get("lead_info", {})
        
        # Only send to VoxIntel if not already sent (prevents duplicates)
        if not call_data.get("sent_to_voxintel", False):
            call_data["sent_to_voxintel"] = True
            await send_call_to_voxintel(call_data)
        
        with open(transcript_file, 'w') as f:
            json.dump(call_data, f, indent=2)
        
        print(f"✅ Final transcript saved for {CallSid}")
        print(f"📊 Final lead score: {call_data.get('final_lead_info', {}).get('lead_score', 'unknown')}")
        print(f"🎯 Call completed: {call_data.get('call_completed', False)}")
        
    return {"status": "success", "message": "Recording processed"}

@app.post("/webhook/recording-status")
def handle_recording_status(
    CallSid: str = Form(...),
    RecordingStatus: str = Form(...),
    ErrorCode: str = Form(None)
):
    """Handle recording status updates"""
    print(f"📊 Recording status for {CallSid}: {RecordingStatus}")
    if ErrorCode:
        print(f"❌ Recording error: {ErrorCode}")
    
    return {"status": "received"}

@app.get("/test/sarah")
def test_sarah_ai():
    """Test Sarah's optimized AI responses"""
    test_queries = [
        "Hi, I need promotional items for my restaurant",
        "We're looking for branded pens and mugs",
        "My name is John and my phone is 555-1234"
    ]
    
    responses = []
    for query in test_queries:
        response = sarah_ai.get_response(query, "test_call", {})
        responses.append({
            "query": query,
            "response": response["message"],
            "lead_info": response.get("lead_info", {}),
            "should_end": response.get("should_end_call", False)
        })
    
    return {
        "test_results": responses,
        "sarah_status": "✅ Working optimally",
        "voxintel_integration": "✅ Active",
        "version": "3.2"
    }

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.datetime.now().isoformat(),
        "services": {
            "sarah_ai": "✅ Active",
            "openai_voice": "✅ Active" if openai_client else "❌ Offline",
            "voxintel_integration": "✅ Active",
            "persistent_storage": "✅ Active"
        },
        "voxintel_user_id": VOXINTEL_USER_ID
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)