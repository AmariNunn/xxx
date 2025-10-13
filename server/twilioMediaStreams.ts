import { WebSocket, WebSocketServer } from 'ws';
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Server as SocketIOServer } from 'socket.io';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createSupabaseClient(supabaseUrl, supabaseServiceKey);

interface CallSession {
  callSid: string;
  streamSid: string;
  userId: string;
  conversationId: string;
  deepgramConnection: any;
  transcript: string[];
  startTime: number;
}

const activeSessions = new Map<string, CallSession>();

export function setupTwilioMediaStreams(server: any, io: SocketIOServer) {
  const wss = new WebSocketServer({ 
    server,
    path: '/media-stream'
  });

  wss.on('connection', async (ws: WebSocket) => {
    console.log('🎙️ Twilio Media Stream connected');
    
    let currentStreamSid: string | null = null;

    ws.on('message', async (message: string) => {
      try {
        const msg = JSON.parse(message);

        switch (msg.event) {
          case 'start':
            currentStreamSid = msg.start.streamSid;
            await handleStreamStart(ws, msg, io);
            break;

          case 'media':
            // Look up session from Map to avoid race condition
            if (currentStreamSid) {
              const session = activeSessions.get(currentStreamSid);
              if (session && session.deepgramConnection) {
                // Forward audio to Deepgram
                const audioBuffer = Buffer.from(msg.media.payload, 'base64');
                session.deepgramConnection.send(audioBuffer);
              }
            }
            break;

          case 'stop':
            if (currentStreamSid) {
              const session = activeSessions.get(currentStreamSid);
              if (session) {
                await handleStreamStop(session, io);
                activeSessions.delete(currentStreamSid);
              }
            }
            break;
        }
      } catch (error) {
        console.error('❌ Error processing Twilio message:', error);
      }
    });

    ws.on('close', async () => {
      console.log('📴 Twilio Media Stream disconnected');
      // Handle unexpected close - persist transcript if available
      if (currentStreamSid) {
        const session = activeSessions.get(currentStreamSid);
        if (session) {
          console.warn('⚠️ Unexpected close - saving transcript');
          await handleStreamStop(session, io);
          activeSessions.delete(currentStreamSid);
        }
      }
    });

    ws.on('error', (error) => {
      console.error('❌ Twilio WebSocket error:', error);
    });
  });

  console.log('✅ Twilio Media Streams WebSocket server ready at /media-stream');
}

async function handleStreamStart(ws: WebSocket, msg: any, io: SocketIOServer) {
  const { streamSid, callSid, customParameters } = msg.start;
  
  console.log('📞 Stream started:', { streamSid, callSid });

  // Get user_id from custom parameters or look up by call
  let userId = customParameters?.userId || null;
  let conversationId = customParameters?.conversationId || callSid;

  // Create placeholder session IMMEDIATELY to prevent race condition
  const placeholderSession: CallSession = {
    callSid,
    streamSid,
    userId: userId || '',
    conversationId,
    deepgramConnection: null,
    transcript: [],
    startTime: Date.now(),
  };
  
  activeSessions.set(streamSid, placeholderSession);

  // If no userId in custom parameters, try to find the call in database
  if (!userId) {
    const { data: callData } = await supabase
      .from('calls')
      .select('user_id, conversation_id')
      .or(`twilio_call_sid.eq.${callSid},conversation_id.eq.${callSid}`)
      .single();
    
    userId = callData?.user_id || null;
    conversationId = callData?.conversation_id || callSid;
    
    // Update session with found user_id
    if (userId && activeSessions.has(streamSid)) {
      placeholderSession.userId = userId;
      placeholderSession.conversationId = conversationId;
    }
  }

  if (!userId) {
    console.warn('⚠️ No user_id found for stream, using conversation_id to look up later');
  }

  // Get Deepgram API key from business_info
  let deepgramApiKey = process.env.DEEPGRAM_API_KEY || '';
  
  if (userId) {
    const { data: businessInfo } = await supabase
      .from('business_info')
      .select('deepgram_api_key')
      .eq('user_id', userId)
      .single();
    
    if (businessInfo?.deepgram_api_key) {
      deepgramApiKey = businessInfo.deepgram_api_key;
    }
  }

  if (!deepgramApiKey) {
    console.error('❌ No Deepgram API key found');
    activeSessions.delete(streamSid);
    return;
  }

  // Initialize Deepgram connection
  const deepgram = createClient(deepgramApiKey);
  const dgConnection = deepgram.listen.live({
    encoding: 'mulaw',
    sample_rate: 8000,
    channels: 1,
    punctuate: true,
    interim_results: true,
    model: 'nova-2',
    smart_format: true,
  });

  // Update session with Deepgram connection
  const session = activeSessions.get(streamSid);
  if (session) {
    session.deepgramConnection = dgConnection;
  }

  // Handle Deepgram transcript events
  dgConnection.on(LiveTranscriptionEvents.Transcript, async (data: any) => {
    const transcript = data.channel?.alternatives?.[0]?.transcript;
    
    if (transcript && transcript.trim()) {
      const isFinal = data.is_final;
      
      console.log(`📝 ${isFinal ? 'FINAL' : 'interim'}:`, transcript);

      if (isFinal) {
        // Get current session from Map to avoid closure issues
        const currentSession = activeSessions.get(streamSid);
        if (!currentSession) {
          console.error(`❌ Session not found for ${streamSid}`);
          return;
        }

        // Add to session transcript
        currentSession.transcript.push(transcript);

        // Update database with accumulated transcript
        const fullTranscript = currentSession.transcript.join(' ');
        
        await supabase
          .from('calls')
          .update({ 
            transcript: fullTranscript,
            status: 'in-progress'
          })
          .eq('conversation_id', currentSession.conversationId);

        // Broadcast to user-specific room only (not all clients)
        if (currentSession.userId) {
          io.to(`user:${currentSession.userId}`).emit('transcriptUpdate', {
            conversation_id: currentSession.conversationId,
            transcript: fullTranscript,
            latest_chunk: transcript,
          });
        }

        console.log(`✅ Updated transcript for ${currentSession.conversationId}`);
      }
    }
  });

  dgConnection.on(LiveTranscriptionEvents.Error, (error: any) => {
    console.error('❌ Deepgram error:', error);
  });

  dgConnection.on(LiveTranscriptionEvents.Close, () => {
    console.log('🔌 Deepgram connection closed');
  });

  console.log('✅ Deepgram connection established for stream:', streamSid);
}

async function handleStreamStop(session: CallSession, io: SocketIOServer) {
  console.log('⏹️ Stream stopped:', session.streamSid);

  // Finish Deepgram connection
  if (session.deepgramConnection) {
    session.deepgramConnection.finish();
  }

  // Calculate duration
  const duration = Math.floor((Date.now() - session.startTime) / 1000);

  // Final update to database
  const fullTranscript = session.transcript.join(' ');
  
  await supabase
    .from('calls')
    .update({ 
      transcript: fullTranscript,
      duration: duration,
      status: 'completed'
    })
    .eq('conversation_id', session.conversationId);

  // Broadcast completion to user-specific room only
  if (session.userId) {
    io.to(`user:${session.userId}`).emit('callCompleted', {
      conversation_id: session.conversationId,
      transcript: fullTranscript,
      duration: duration,
    });
  }

  console.log(`✅ Call completed: ${session.conversationId}, duration: ${duration}s`);
}
