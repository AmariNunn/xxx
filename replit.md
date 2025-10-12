# SkyIQ AI Voice Agent Platform

## Overview

This is a multi-tenant AI voice agent platform for SkyIQ, enabling businesses to manage AI-powered phone conversations with integrated scheduling capabilities. The primary user is Sky IQ (info@skyiq.cloud), with infrastructure to support additional clients. Each user has their own ElevenLabs agent, phone number, and Cal.com integration.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The system follows a multi-tenant client-server architecture with:

1. **Frontend**: React-based SPA with shadcn/ui components
2. **Backend**: Express.js server with REST API endpoints
3. **Database**: Supabase (PostgreSQL) for data persistence
4. **Integrations**: ElevenLabs (AI voice), Cal.com (scheduling), Twilio (telephony)

### Multi-Tenant Architecture

Each user has their own credentials stored in the `business_info` table:
- **ElevenLabs**: API key, Agent ID, Phone Number ID
- **Cal.com**: API key, Event Type ID, Timezone
- **Twilio**: Account SID, Auth Token, Phone Number

Both inbound and outbound calls use user-specific credentials, enabling complete isolation between clients.

## Key Components

### Frontend

- **React SPA**: Built with Vite for optimized development
- **UI Framework**: shadcn/ui components with Tailwind CSS
- **Form Management**: React Hook Form with Zod validation
- **State Management**: TanStack Query (React Query) for server state
- **Routing**: Wouter for lightweight client-side routing
- **Pages**: 
  - Dashboard (call overview)
  - Call Dashboard (initiate calls, batch upload)
  - Call Review (detailed call analysis)
  - Business Profile (integration credentials)
  - SkyIQ Agent (agent configuration)

### Backend

- **Express.js Server**: Handles API requests and serves frontend
- **API Routes**: 
  - User authentication and management
  - Call initiation (inbound/outbound)
  - Batch call processing
  - Meeting booking with natural language date parsing (chrono-node)
  - Business info and integration management
- **Storage**: Supabase client for database operations
- **Webhooks**: ElevenLabs conversation status updates

### Database (Supabase)

**Active Tables**:
- `users` - User authentication and account info
- `business_info` - Business config + integration credentials (multi-tenant)
- `calls` - Call records with transcripts, summaries, and metadata
- `batches` - Batch call processing queue
- `batch_calls` - Individual calls within batches
- `prompts` - AI agent system prompts and first messages

**Deprecated Tables** (pending cleanup):
- `eleven_labs_conversations` - No longer used (data now in calls table)
- `leads` - Review before removing (may be redundant with business_info)

### Shared Code

- **Types**: TypeScript interfaces for all data models
- **Validation**: Zod schemas for API request/response validation
- **Schema**: Database type definitions

## Data Flow

### Authentication Flow
1. User registers with business details
2. Backend validates and creates account in Supabase
3. User logs in with email/password
4. Session established with user_id

### Call Flow (Multi-Tenant)
1. User initiates call via dashboard
2. Backend retrieves user's ElevenLabs credentials from business_info
3. Call placed using user-specific agent ID and phone number
4. Conversation data stored in calls table with user_id
5. Webhooks update call status and transcript

### Batch Processing
1. User uploads CSV with contact list
2. Batch record created with user_id
3. Individual batch_calls created for each contact
4. Background processor retrieves user credentials
5. Calls placed sequentially using user-specific settings

### Meeting Booking
1. AI agent extracts meeting intent from conversation
2. Natural language date/time parsed with chrono-node
3. User's Cal.com credentials retrieved
4. Meeting booked via Cal.com API
5. Confirmation sent to customer

## External Dependencies

### Frontend Libraries
- React ecosystem (React, React DOM)
- Tailwind CSS and shadcn/ui components
- React Hook Form with Zod validation
- TanStack Query (React Query v5)
- Lucide React for icons
- Wouter for routing

### Backend Libraries
- Express.js for API server
- @supabase/supabase-js for database
- Zod for validation
- chrono-node for natural language date parsing
- crypto for password hashing

### Integration SDKs
- ElevenLabs API (voice AI)
- Cal.com API (scheduling)
- Twilio (telephony)

### Development Tools
- TypeScript for type safety
- Vite for frontend builds
- tsx for backend development
- Node.js 20

## Environment Variables

Required secrets (stored in Replit Secrets):
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

User-specific credentials (stored in database per user):
- ElevenLabs: API key, Agent ID, Phone Number ID
- Cal.com: API key, Event Type ID, Timezone
- Twilio: Account SID, Auth Token, Phone Number

## Recent Changes (2025-10-12)

### Completed
1. ✅ Migrated to multi-tenant architecture
2. ✅ Added integration credential columns to business_info table
3. ✅ Updated all endpoints to use user-specific credentials
4. ✅ Fixed batch processing to retrieve and use user credentials
5. ✅ Cleaned up unused imports and deprecated types
6. ✅ Created migration and cleanup documentation
7. ✅ Standardized navigation to show "SkyIQ AI Voice Agent"

### Pending
1. ⏳ Remove deprecated tables from Supabase (see CLEANUP_GUIDE.md)
2. ⏳ Test with real user credentials
3. ⏳ Add first user (Sky IQ - info@skyiq.cloud)

## Running the Project

### Development
- Run `npm run dev` to start the application
- Express server runs on port 5000 (frontend + backend)
- Vite provides HMR for frontend changes
- tsx restarts backend on file changes

### Workflow
- "Start application" workflow runs `npm run dev`
- Automatically restarts after code changes
- Server binds to 0.0.0.0:5000 for Replit compatibility

## Project Structure

```
├── client/                    # Frontend React application
│   ├── src/
│   │   ├── components/        # React components + shadcn/ui
│   │   ├── hooks/             # Custom React hooks
│   │   ├── lib/               # Utility functions
│   │   └── pages/             # Page components
│       └── App.tsx            # Main app with routing
├── server/                    # Backend Express application
│   ├── index.ts               # Server entry + ElevenLabs integration
│   ├── routes/                # API route modules
│   ├── supabaseStorage.ts     # Supabase data operations
│   └── vite.ts                # Vite integration
├── shared/                    # Shared code
│   └── types.ts               # Database types and Zod schemas
├── migrations/                # Database migrations
│   ├── add_integration_credentials.sql
│   └── final_cleanup.sql
└── CLEANUP_GUIDE.md           # Database cleanup instructions
```

## Database Cleanup

See `CLEANUP_GUIDE.md` and `MIGRATION_STATUS.md` for details on removing unused tables and columns. The main cleanup tasks:

1. Drop `eleven_labs_conversations` table (deprecated)
2. Review and optionally drop `leads` table
3. Review lead_* columns in business_info

Run `migrations/final_cleanup.sql` in Supabase SQL Editor to apply cleanup.

## Primary User

**Sky IQ**:
- Email: info@skyiq.cloud
- Will have their own ElevenLabs, Cal.com, and Twilio credentials
- All stored in business_info table
- First user in the multi-tenant system

Future clients follow the same pattern with isolated credentials.
