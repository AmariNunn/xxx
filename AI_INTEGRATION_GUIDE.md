# AI Voice Agent Integration Guide

## Overview

Your VoxIntel platform now supports dynamic AI personalization where clients upload content that directly affects your external AI voice agent's responses. Here's how to integrate your AI with the uploaded client content.

## API Endpoints for Your External AI

### 1. Get User ID from Phone Number

**Endpoint:** `GET /api/phone/find-user/{phoneNumber}`

Use this to identify which user is calling before generating their personalized prompt.

```javascript
// When your AI receives an incoming call
const phoneNumber = "+1234567890"; // The caller's number
const response = await fetch(`https://your-replit-domain.replit.app/api/phone/find-user/${phoneNumber}`);
const userData = await response.json();

if (userData.success) {
    const userId = userData.userId;
    // Now get personalized prompt for this user
}
```

**Response:**
```json
{
  "success": true,
  "userId": 123,
  "businessName": "ABC Company",
  "phoneNumber": "+1234567890"
}
```

### 2. Get Full AI Prompt (Recommended)

**Endpoint:** `GET /api/ai/prompt/{userId}`

This returns a complete, personalized prompt including business context, call history, and uploaded content.

```javascript
// Get comprehensive AI prompt for the user
const userId = 123;
const response = await fetch(`https://your-replit-domain.replit.app/api/ai/prompt/${userId}`);
const promptData = await response.json();

// Use the full prompt to initialize your AI
const aiPrompt = promptData.promptData.fullPrompt;
initializeAI(aiPrompt);
```

**Response:**
```json
{
  "success": true,
  "userId": 123,
  "promptData": {
    "businessContext": "Business Name: ABC Company\nBusiness Description: Software consulting...",
    "callHistory": "Recent Call History (5 calls): Call 1 (01/02/2025): John Smith...",
    "clientPersonalization": "Client has provided 3 document(s) for reference - use this content...",
    "responseGuidelines": "Always be professional, helpful, and courteous...",
    "fullPrompt": "# AI VOICE AGENT PROMPT\n\n## BUSINESS CONTEXT\n..."
  }
}
```

### 3. Simple Prompt (Quick Option)

**Endpoint:** `GET /api/ai/simple-prompt/{userId}`

For quick implementations, this returns a basic personalized prompt.

```javascript
const response = await fetch(`https://your-replit-domain.replit.app/api/ai/simple-prompt/${userId}`);
const { prompt } = await response.json();
```

### 4. Record Call Outcomes

**Endpoint:** `POST /api/ai/call-outcome/{userId}`

Use this to improve future AI prompts based on call success.

```javascript
// After each call, report the outcome
await fetch(`https://your-replit-domain.replit.app/api/ai/call-outcome/${userId}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    successful: true,
    customerSatisfaction: 9,
    notes: "Customer was very pleased with the detailed product information"
  })
});
```

## Complete Integration Example

Here's how to integrate this with your AI voice agent:

```javascript
class VoiceAgentIntegration {
  constructor(baseUrl) {
    this.baseUrl = baseUrl; // Your Replit app URL
  }

  async handleIncomingCall(phoneNumber) {
    try {
      // 1. Find user by phone number
      const userResponse = await fetch(`${this.baseUrl}/api/phone/find-user/${phoneNumber}`);
      const userData = await userResponse.json();
      
      if (!userData.success) {
        // Use default prompt if user not found
        return this.useDefaultPrompt();
      }

      const userId = userData.userId;

      // 2. Get personalized AI prompt
      const promptResponse = await fetch(`${this.baseUrl}/api/ai/prompt/${userId}`);
      const promptData = await promptResponse.json();

      // 3. Initialize AI with personalized prompt
      const personalizedPrompt = promptData.promptData.fullPrompt;
      return this.initializeAI(personalizedPrompt);

    } catch (error) {
      console.error('Error getting personalized prompt:', error);
      return this.useDefaultPrompt();
    }
  }

  async recordCallOutcome(userId, outcome) {
    try {
      await fetch(`${this.baseUrl}/api/ai/call-outcome/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(outcome)
      });
    } catch (error) {
      console.error('Error recording call outcome:', error);
    }
  }

  initializeAI(prompt) {
    // Your AI initialization logic here
    // The prompt now includes uploaded client content
    console.log('AI initialized with personalized prompt:', prompt);
  }

  useDefaultPrompt() {
    // Fallback when user not found
    return this.initializeAI("You are a professional AI voice agent. Be helpful and courteous.");
  }
}

// Usage
const aiIntegration = new VoiceAgentIntegration('https://your-replit-domain.replit.app');
await aiIntegration.handleIncomingCall('+1234567890');
```

## What Clients Can Upload

Your clients can now upload:
- **PDF documents** (manuals, guides, policies)
- **Word documents** (.doc, .docx)
- **Text files** (pricing lists, FAQ, scripts)
- **CSV files** (data tables, contact lists)

Each uploaded file can include a description that helps the AI understand the content's purpose.

## How Content Affects AI Responses

The AI prompt now includes:

1. **Business Context** - Company name, description, contact info
2. **Call History** - Recent conversation patterns and outcomes  
3. **Uploaded Content** - Summaries of client documents with usage instructions
4. **Personalization** - Industry-specific language and tone adjustments
5. **Response Guidelines** - Professional standards and call procedures

## Client Interface

Clients access the content upload feature at `/content-upload` in your web app. They can:
- Upload business documents
- Add descriptions for each file
- View all uploaded content
- Delete outdated files
- See confirmation that content is active for their AI agent

## Testing Your Integration

1. **Create a test account** in your VoxIntel platform
2. **Upload sample content** (pricing sheet, company policy, etc.)
3. **Call the API endpoints** with the test user's phone number
4. **Verify the prompt includes the uploaded content**
5. **Test call outcome recording**

## Error Handling

Your AI should gracefully handle:
- User not found (use default prompt)
- API timeouts (cache last successful prompt)
- Invalid responses (fallback to simple prompt)

The system is designed to enhance your AI when working, but never break it when there are issues.

## Security

- All API endpoints are rate-limited
- Content is user-isolated (users only see their own files)
- Phone number mapping is secure and validated
- File uploads are processed and stored safely

Your external AI voice agent now has dynamic, personalized context for every conversation based on what each client has uploaded to their profile.