/**
 * Cloudflare Worker for Two-Way SMS with AI
 * 
 * Features:
 * - Receives incoming SMS from Twilio
 * - Uses Cloudflare Workers AI (Llama) to generate intelligent responses
 * - Can check Cal.com availability and book appointments
 * - Sends SMS replies via Twilio API
 * - Logs all conversations to Supabase database
 * 
 * Required Environment Variables (set in Cloudflare Dashboard):
 * - TWILIO_ACCOUNT_SID: Your Twilio Account SID
 * - TWILIO_AUTH_TOKEN: Your Twilio Auth Token
 * - TWILIO_PHONE_NUMBER: Your Twilio phone number (E.164 format)
 * - SUPABASE_URL: Your Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Your Supabase service role key
 * - CAL_COM_API_KEY: Your Cal.com API key (optional)
 * - CAL_COM_EVENT_TYPE_ID: Your Cal.com event type ID (optional)
 */

export default {
  async fetch(request, env, ctx) {
    // Only accept POST requests
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      // SECURITY: Verify Twilio webhook signature
      const twilioSignature = request.headers.get('X-Twilio-Signature');
      if (!twilioSignature) {
        console.error('❌ Missing Twilio signature - possible spoofed request');
        return new Response('Unauthorized', { status: 401 });
      }

      // Parse form data for signature verification
      const formData = await request.formData();
      const url = request.url;
      
      // Verify the request is actually from Twilio
      const isValid = await verifyTwilioSignature(env, url, formData, twilioSignature);
      if (!isValid) {
        console.error('❌ Invalid Twilio signature - request rejected');
        return new Response('Forbidden', { status: 403 });
      }

      // Extract SMS data
      const from = formData.get('From'); // Customer phone number
      const to = formData.get('To'); // Your Twilio number
      const body = formData.get('Body'); // SMS message text
      const messageSid = formData.get('MessageSid'); // Twilio message ID

      console.log(`📱 Received SMS from ${from}: ${body}`);

      // Find which user owns this Twilio number
      const userId = await getUserIdByPhoneNumber(env, to);
      if (!userId) {
        console.error(`❌ No user found for Twilio number ${to}`);
        return new Response('OK', { status: 200 }); // Return 200 to Twilio anyway
      }

      // Log incoming SMS to database
      await logSmsToDatabase(env, {
        userId,
        phoneNumber: from,
        message: body,
        direction: 'inbound',
        status: 'delivered',
        twilioMessageSid: messageSid,
      });

      // Get conversation context (last 10 messages)
      const conversationHistory = await getConversationHistory(env, userId, from);

      // Get user's business context
      const businessInfo = await getBusinessInfo(env, userId);

      // Generate AI response using Workers AI
      const aiResponse = await generateAIResponse(env, {
        userMessage: body,
        conversationHistory,
        businessInfo,
        customerPhone: from,
      });

      // Send SMS reply via Twilio
      const twilioResponse = await sendSmsViaTwilio(env, {
        to: from,
        from: to,
        body: aiResponse,
      });

      // Log outbound SMS to database
      await logSmsToDatabase(env, {
        userId,
        phoneNumber: from,
        message: aiResponse,
        direction: 'outbound',
        status: twilioResponse.success ? 'sent' : 'failed',
        twilioMessageSid: twilioResponse.sid,
        errorMessage: twilioResponse.error,
      });

      console.log(`✅ SMS sent successfully to ${from}`);
      
      return new Response('OK', { status: 200 });
    } catch (error) {
      console.error('❌ Error processing SMS:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  },
};

/**
 * Find user ID by their Twilio phone number
 */
async function getUserIdByPhoneNumber(env, twilioPhone) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/business_info?twilio_phone_number=eq.${encodeURIComponent(twilioPhone)}&select=user_id`, {
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });

  const data = await response.json();
  return data && data.length > 0 ? data[0].user_id : null;
}

/**
 * Get conversation history for context
 */
async function getConversationHistory(env, userId, phoneNumber) {
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/sms_conversations?user_id=eq.${userId}&phone_number=eq.${encodeURIComponent(phoneNumber)}&order=created_at.desc&limit=10`,
    {
      headers: {
        'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }
  );

  const messages = await response.json();
  return messages.reverse(); // Oldest first
}

/**
 * Get user's business information
 */
async function getBusinessInfo(env, userId) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/business_info?user_id=eq.${userId}&select=*`, {
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });

  const data = await response.json();
  return data && data.length > 0 ? data[0] : {};
}

/**
 * Generate AI response using Cloudflare Workers AI
 */
async function generateAIResponse(env, { userMessage, conversationHistory, businessInfo, customerPhone }) {
  // Build conversation context
  const context = conversationHistory
    .map((msg) => `${msg.direction === 'inbound' ? 'Customer' : 'You'}: ${msg.message}`)
    .join('\n');

  // Build system prompt
  const systemPrompt = `You are an AI assistant for ${businessInfo.business_name || 'a business'}.

Business Information:
${businessInfo.description || 'No description available'}
${businessInfo.business_phone ? `Phone: ${businessInfo.business_phone}` : ''}
${businessInfo.business_email ? `Email: ${businessInfo.business_email}` : ''}
${businessInfo.business_address ? `Address: ${businessInfo.business_address}` : ''}

Your role:
- Answer questions about the business professionally and helpfully
- Be concise (SMS-friendly responses, keep under 160 characters when possible)
- Help customers check appointment availability and book appointments
- Provide helpful information without being pushy

Available Actions:
- If customer asks about availability: Check Cal.com calendar and list available times
- If customer wants to book: Book appointment using their preferred time

Current conversation history:
${context}

Important: Keep responses short and friendly. This is SMS, not a long email.`;

  // Check if message is about appointments
  const isAboutAppointments = /appointment|schedule|book|available|availability|meeting|time|calendar/i.test(userMessage);

  let response = '';

  // If asking about availability, check Cal.com
  if (isAboutAppointments && /available|availability|when|times|calendar/i.test(userMessage)) {
    const availability = await checkCalComAvailability(env, businessInfo);
    if (availability) {
      return availability; // Return availability message directly
    }
  }

  // If trying to book, attempt to book
  if (isAboutAppointments && /book|schedule|appointment|reserve/i.test(userMessage)) {
    const booking = await tryBookAppointment(env, businessInfo, userMessage, customerPhone);
    if (booking) {
      return booking; // Return booking confirmation directly
    }
  }

  // Generate AI response using Workers AI (Llama model)
  const aiRequest = {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
  };

  const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', aiRequest);
  response = aiResponse.response || "I'm here to help! How can I assist you?";

  // Trim response to reasonable SMS length
  if (response.length > 300) {
    response = response.substring(0, 297) + '...';
  }

  return response;
}

/**
 * Check Cal.com availability
 */
async function checkCalComAvailability(env, businessInfo) {
  if (!businessInfo.cal_com_api_key || !businessInfo.cal_com_event_type_id) {
    return null; // Cal.com not configured
  }

  try {
    // Get next 7 days availability
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    const startTime = today.toISOString().split('T')[0];
    const endTime = nextWeek.toISOString().split('T')[0];

    const url = `https://api.cal.com/v1/slots?apiKey=${businessInfo.cal_com_api_key}&eventTypeId=${businessInfo.cal_com_event_type_id}&startTime=${startTime}&endTime=${endTime}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (!data.slots || Object.keys(data.slots).length === 0) {
      return "No availability in the next week. Would you like me to check further out?";
    }

    // Format availability message
    const dates = Object.keys(data.slots).slice(0, 3); // Show first 3 days
    const availability = dates
      .map((date) => {
        const times = data.slots[date].slice(0, 3); // Show first 3 times per day
        const timeStrings = times.map((t) => new Date(t.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));
        return `${new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}: ${timeStrings.join(', ')}`;
      })
      .join('\n');

    return `Available times:\n${availability}\n\nReply with your preferred date/time to book!`;
  } catch (error) {
    console.error('Error checking Cal.com availability:', error);
    return null;
  }
}

/**
 * Try to book appointment from message
 */
async function tryBookAppointment(env, businessInfo, message, customerPhone) {
  if (!businessInfo.cal_com_api_key || !businessInfo.cal_com_event_type_id) {
    return null;
  }

  try {
    // Extract name and email from previous messages or use defaults
    const name = 'SMS Customer'; // You could extract this from conversation history
    const email = `${customerPhone.replace(/[^0-9]/g, '')}@sms-booking.temp`; // Temp email

    // Parse time from message (simplified - you'd want better parsing)
    const timeMatch = message.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)/i);
    if (!timeMatch) {
      return "Please specify a time (e.g., '2pm' or '2:30pm')";
    }

    // For now, return instruction to call or book online
    return `To complete your booking, please call us at ${businessInfo.business_phone || 'our office'} or visit our website. We'll get you scheduled right away!`;

    // TODO: Implement actual booking with proper time parsing
  } catch (error) {
    console.error('Error booking appointment:', error);
    return null;
  }
}

/**
 * Send SMS via Twilio API
 */
async function sendSmsViaTwilio(env, { to, from, body }) {
  const accountSid = env.TWILIO_ACCOUNT_SID;
  const authToken = env.TWILIO_AUTH_TOKEN;
  
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  
  const params = new URLSearchParams();
  params.append('To', to);
  params.append('From', from);
  params.append('Body', body);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    const data = await response.json();
    
    if (response.ok) {
      return { success: true, sid: data.sid };
    } else {
      return { success: false, error: data.message };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Log SMS conversation to Supabase
 */
async function logSmsToDatabase(env, smsData) {
  const payload = {
    user_id: smsData.userId,
    phone_number: smsData.phoneNumber,
    message: smsData.message,
    direction: smsData.direction,
    status: smsData.status,
    twilio_message_sid: smsData.twilioMessageSid || null,
    error_message: smsData.errorMessage || null,
    metadata: smsData.metadata || null,
  };

  try {
    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/sms_conversations`, {
      method: 'POST',
      headers: {
        'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error('Failed to log SMS to database:', await response.text());
    }
  } catch (error) {
    console.error('Error logging SMS to database:', error);
  }
}

/**
 * Verify Twilio webhook signature to prevent spoofing
 * https://www.twilio.com/docs/usage/security#validating-requests
 */
async function verifyTwilioSignature(env, url, formData, twilioSignature) {
  try {
    // Build the signature data string
    // Twilio creates signature by concatenating the full URL + sorted params
    const params = [];
    for (const [key, value] of formData.entries()) {
      params.push([key, value]);
    }
    
    // Sort parameters alphabetically by key
    params.sort((a, b) => a[0].localeCompare(b[0]));
    
    // Build the signature data: URL + concatenated sorted params
    let data = url;
    for (const [key, value] of params) {
      data += key + value;
    }

    // Create HMAC-SHA1 signature using Twilio auth token as the key
    const encoder = new TextEncoder();
    const keyData = encoder.encode(env.TWILIO_AUTH_TOKEN);
    const messageData = encoder.encode(data);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    
    // Convert to base64
    const signatureArray = Array.from(new Uint8Array(signature));
    const signatureBase64 = btoa(String.fromCharCode(...signatureArray));
    
    // Compare signatures
    const isValid = signatureBase64 === twilioSignature;
    
    if (!isValid) {
      console.error('Signature mismatch:');
      console.error('Expected:', signatureBase64);
      console.error('Received:', twilioSignature);
      console.error('URL:', url);
      console.error('Params:', params);
    }
    
    return isValid;
  } catch (error) {
    console.error('Error verifying Twilio signature:', error);
    return false; // Reject on error for security
  }
}
