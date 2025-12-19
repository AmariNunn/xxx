# SkyIQ Dashboard - Test Login Credentials

## Test Account
- **Email:** test@example.com
- **Password:** 123
- **User ID:** 5a83d39f-83e5-436f-82a0-42357e11eade

## What This Account Has
- 5 test calls from ElevenLabs webhooks (IDs 191-195)
- All calls have transcripts and AI-generated summaries
- Calls are saved in the Supabase database

## How to Access the Dashboard
1. Navigate to `/login` or the homepage
2. Enter the credentials above
3. Click "Sign In"
4. You'll be redirected to `/dashboard` where you can see all calls

## API Verification
The API endpoint `/api/calls/user/5a83d39f-83e5-436f-82a0-42357e11eade` returns:
- 5 calls with complete data
- Response size: 9764 bytes
- Includes transcripts, summaries, timestamps, and call metadata

## Database Information
- **Database Type:** Supabase (PostgreSQL)
- **Connection:** Uses SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables
- **Tables:** users, business_info, calls, prompts, batches, batch_calls, eleven_labs_conversations

## Other Test Accounts
Additional users exist in the database:
- test@skyiq.com (ID: 522850df-f8f2-4207-97ae-00a90acde873)
- audamaur@gmail.com (ID: c1bea432-e2f8-4863-ad44-c99ed85bcaeb)
- jadryantej@gmail.com (ID: 460462c4-a6eb-4634-b15b-19f3da03c5cc)
- testadmin@example.com (ID: 16f70fb1-d1a7-4646-ac13-d4edef31b146)
