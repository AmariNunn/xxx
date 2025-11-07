# ElevenLabs Initiation Webhook Setup Guide

## Overview

The ElevenLabs Initiation Webhook automatically provides dynamic variables to every call without manual configuration. When ElevenLabs makes a call, it first hits this webhook to retrieve customer data, which is then available as dynamic variables in the AI agent's prompt.

## Features

- **Automatic Variable Population**: Customer data automatically flows into every call
- **Secure Authentication**: Optional webhook token per user for production security
- **Multi-Source Data Lookup**: Retrieves data from batch campaigns and call records
- **Phone Number Matching**: Handles multiple phone number formats automatically

## Database Setup

### Step 1: Add webhook_token Column

Run this SQL in your Supabase dashboard:

```sql
-- Add webhook token column for authentication
ALTER TABLE business_info ADD COLUMN IF NOT EXISTS webhook_token TEXT;

-- Optional: Generate random tokens for existing users
UPDATE business_info 
SET webhook_token = encode(gen_random_bytes(32), 'hex') 
WHERE webhook_token IS NULL;
```

### Step 2: Verify the Column Exists

```sql
-- Check if column was added successfully
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'business_info' AND column_name = 'webhook_token';
```

## ElevenLabs Configuration

### Step 1: Get Your Webhook URL

Your webhook URL is:
```
https://your-replit-domain.replit.dev/api/elevenlabs/initiation-webhook
```

### Step 2: Configure in ElevenLabs Dashboard

1. Go to your ElevenLabs agent settings
2. Navigate to the "Webhooks" section
3. Find "Initiation Webhook"
4. Enter your webhook URL
5. (Optional) Add authentication token in the format:
   ```
   https://your-domain.replit.dev/api/elevenlabs/initiation-webhook?token=YOUR_WEBHOOK_TOKEN
   ```

### Step 3: Test the Webhook

ElevenLabs provides a "Test Webhook" button in their dashboard. Use it to verify:
- ✅ Returns 200 OK status
- ✅ Returns valid JSON with dynamic variables
- ✅ Authentication works (if token configured)

## How It Works

### 1. ElevenLabs Sends Request

When initiating a call, ElevenLabs sends a POST request with:

```json
{
  "agent_id": "your-agent-id",
  "phone_number_id": "your-phone-number-id",
  "customer_phone_number": "+16155788171"
}
```

### 2. Webhook Looks Up User & Data

The webhook:
1. Finds the user who owns the agent/phone number
2. Validates webhook token (if configured)
3. Searches for customer data by phone number in:
   - `batch_call_recipients` (bulk campaign data)
   - `calls` table (previous call records)

### 3. Returns Dynamic Variables

Returns customer data in ElevenLabs format:

```json
{
  "custom_llm_extra_body": {
    "First Name": "Amari",
    "Last Name": "Dunn",
    "Birth Date": "6/2/1985",
    "Age_Years": "40",
    "City": "Nashville",
    "State": "TN",
    "Loan Amount": "346055",
    "Lender": "ROCKET MORTGAGE LLC"
  }
}
```

### 4. Variables Available in Prompts

These variables are now available in your agent prompt:

```
You are calling {{First Name}} {{Last Name}} who lives in {{City}}, {{State}}.
They have a loan amount of ${{Loan Amount}} from {{Lender}}.
```

## Security

### Development Mode (No Token)

If `webhook_token` is not set in the database:
- Webhook accepts all requests
- Easy for initial setup and testing
- **Not recommended for production**

### Production Mode (With Token)

If `webhook_token` is set in the database:
- Webhook validates the token on every request
- Returns 401 if token missing
- Returns 403 if token invalid
- **Required for production use**

### Setting Tokens for Users

#### Option 1: Generate Random Token (Recommended)

```sql
UPDATE business_info 
SET webhook_token = encode(gen_random_bytes(32), 'hex')
WHERE user_id = 'user-id-here';
```

#### Option 2: Set Custom Token

```sql
UPDATE business_info 
SET webhook_token = 'your-custom-secret-token'
WHERE user_id = 'user-id-here';
```

#### Option 3: Retrieve Existing Token

```sql
SELECT webhook_token 
FROM business_info 
WHERE user_id = 'user-id-here';
```

## Phone Number Matching

The webhook automatically handles multiple phone number formats:

- **E.164 format**: `+16155788171`
- **US format**: `6155788171`
- **Formatted**: `(615) 578-8171`
- **Last 10 digits**: `5788171` → `+15788171`

This ensures maximum compatibility with different phone number formats in your data.

## Testing

### Test Without Authentication

```bash
curl -X POST https://your-domain.replit.dev/api/elevenlabs/initiation-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "your-agent-id",
    "customer_phone_number": "+16155788171"
  }'
```

Expected response:
```json
{
  "custom_llm_extra_body": {
    "First Name": "John",
    "Last Name": "Doe",
    ...
  }
}
```

### Test With Authentication

```bash
curl -X POST https://your-domain.replit.dev/api/elevenlabs/initiation-webhook?token=YOUR_TOKEN \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "your-agent-id",
    "customer_phone_number": "+16155788171"
  }'
```

### Test Invalid Token

```bash
curl -X POST https://your-domain.replit.dev/api/elevenlabs/initiation-webhook?token=WRONG_TOKEN \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "your-agent-id",
    "customer_phone_number": "+16155788171"
  }'
```

Expected response:
```json
{
  "error": "Invalid webhook token"
}
```
Status: 403 Forbidden

## Troubleshooting

### Webhook Returns Empty Variables

**Problem**: ElevenLabs receives `{}` instead of customer data

**Solutions**:
1. Verify phone number exists in `batch_call_recipients` or `calls` table
2. Check phone number format matches (see Phone Number Matching section)
3. Confirm customer_phone_number is provided in the request

### Authentication Fails

**Problem**: Receiving 401 or 403 errors

**Solutions**:
1. Verify webhook_token is set in business_info table
2. Confirm token in URL matches database value exactly
3. Check for extra spaces or encoding issues in token

### User Not Found

**Problem**: "User not found" error

**Solutions**:
1. Verify agent_id or phone_number_id is correct
2. Confirm agent/phone number is saved in business_info table
3. Check that ElevenLabs is sending the correct identifiers

## Best Practices

### 1. Always Use Tokens in Production
```sql
-- Enable tokens for all production users
UPDATE business_info 
SET webhook_token = encode(gen_random_bytes(32), 'hex')
WHERE webhook_token IS NULL;
```

### 2. Rotate Tokens Regularly
```sql
-- Rotate token for a user
UPDATE business_info 
SET webhook_token = encode(gen_random_bytes(32), 'hex')
WHERE user_id = 'user-id-here';
```

### 3. Monitor Webhook Logs

Check server logs for webhook activity:
```bash
# Look for webhook requests
grep "Initiation webhook" /tmp/logs/*.log

# Check for authentication failures
grep "Invalid webhook token" /tmp/logs/*.log
```

### 4. Test Before Production

Always test the webhook with ElevenLabs' test feature before making production calls.

## Integration with Date/Time Awareness

This webhook works seamlessly with the automatic date/time awareness feature:

1. **System Time**: `{{system__time}}` is automatically available in every prompt
2. **Timezone Collection**: Agents are instructed to collect customer timezone
3. **Dynamic Variables**: Customer data flows in via this webhook

All three features work together to create context-aware, personalized AI agents.

## Support

If you encounter issues:
1. Check server logs for detailed error messages
2. Verify database schema matches requirements
3. Test webhook with curl commands above
4. Confirm ElevenLabs configuration is correct

## Summary

✅ **Automatic**: Variables populate without manual configuration  
✅ **Secure**: Optional token authentication for production  
✅ **Flexible**: Handles multiple phone number formats  
✅ **Scalable**: Works for bulk campaigns and individual calls  
✅ **Integrated**: Works with date/time awareness features
