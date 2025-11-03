# SkyIQ Platform (formerly VoxIntel)

## Overview

This project is a web application for SkyIQ - a Smart Call Intelligence Platform that helps businesses track and analyze phone conversations using AI voice agents. The platform allows users to register, login, and manage their AI call assistant with integrations for ElevenLabs (voice AI), Twilio (telephony), and Cal.com (appointment booking). It's built with a modern technology stack featuring a React frontend and an Express backend with Supabase database integration.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes (November 2025)

### ElevenLabs Batch Calling API Migration (November 3, 2025)
- **Single Batch Submission:** Refactored bulk calling to use ElevenLabs batch calling API (`/v1/convai/batch-calling/submit`)
  - Changed from individual sequential calls to one batch API call per campaign
  - ElevenLabs now handles scheduling - when you set a scheduled time, they dispatch at that exact time
  - Fixed phone number field: Changed from `phone_number` to `to_number` (batch API requirement)
  - All CSV columns (First Name, City, Loan Amount, etc.) passed as `dynamic_variables` to ElevenLabs
  - Stores `elevenlabs_batch_id` in database for tracking batches submitted to ElevenLabs
  - Proper error handling: Failed submissions mark batch as "failed" with error message
  - Status tracking: "scheduled" for future batches, "in_progress" for immediate batches
  - Improved reliability: ElevenLabs manages the entire batch lifecycle on their infrastructure

### Batch Calling Unlimited Concurrent Calls (November 3, 2025)
- **Removed Call Limiting:** Removed the 2-concurrent-call limit from batch calling system
  - All batch calls now dispatch immediately without waiting for slots
  - Removed semaphore-style call slot acquisition/release mechanism
  - Simplified batch call processing for better performance

### Render Deployment Fix (October 28, 2025)
- **ESM Import Resolution:** Fixed module resolution errors for Render deployment
  - Root cause: twilioService.ts was importing from wrong path `'./storage'` instead of `'./supabaseStorage'`
  - Added `.js` extensions to all relative imports in server files for proper ESM resolution
  - Fixed files: server/index.ts, server/routes.ts, server/twilioService.ts, server/adminRoutes.ts, server/vite.ts, server/routes/business.ts, server/supabaseStorage.ts
  - Updated both static imports (`import X from './file'`) and dynamic imports (`await import('./file')`)
  - Required for esbuild bundler to properly resolve modules during production build

### Bulk Caller UX Enhancements (October 28, 2025)
- **CSV Variables Documentation:** Added clear explanation that each CSV column header becomes a dynamic variable
  - Shows concrete examples: "First Name" column → `{{First Name}}` variable in AI prompt
  - Displays mapping for multiple variable types (City, Loan Amount, etc.)
  - Updated example CSV to use realistic column names (First Name, City, Loan Amount)
- **Batch History Simplification:** Streamlined batch history table for cleaner UX
  - Removed "Progress", "Result", and "Status" columns to reduce visual clutter
  - Calls column now shows total scheduled calls from CSV (not dispatched count)
  - Moved "View Calls" button to card header (top right) instead of per-row buttons
  - Table now displays: Campaign Name, Calls (scheduled from CSV), Created date, and Delete action
  - Cleaner, more focused interface makes it easier to scan batch campaign history
  - Updated card description to reflect simplified view

### Navigation Improvements (October 28, 2025)
- Added "Bulk Caller" navigation link to sidebar across all pages
- Added "Back to Dashboard" button on bulk caller page for easy navigation
- Consistent navigation experience with PhoneOutgoing icon for bulk caller feature
- Navigation links now appear on: Dashboard, Call Dashboard, Call Review, SkyIQ Agent, Business Profile pages

### Bulk Caller UI Redesign (October 25, 2025)
- Completely redesigned bulk caller component with modern, on-brand UI
- Added gradient header with brand colors (primary blue)
- Created side-by-side layout for CSV upload vs manual entry options
- Added comprehensive format examples and instructions inline
- Included "Pro tip" alert explaining dynamic variables personalization
- Visual improvements: icons, cards, better spacing, clear sections
- Enhanced user guidance with code examples for CSV format and manual entry formats

### Dynamic Variables Support (October 25, 2025)
- Implemented support for custom dynamic variables in batch calls
- Fixed phone number parsing to correctly identify phones even when names contain digits
- Backend now properly formats custom fields as `conversation_initiation_client_data.dynamic_variables` for ElevenLabs API
- Manual entry supports: `+1234567890, John Doe` or `John Doe, +1234567890`
- CSV upload supports any custom columns (name, city, company, etc.) - all become dynamic variables
- Users can reference variables in AI agent prompts using `{{name}}`, `{{city}}`, etc.

### Webhook Body Parser Fix (October 22, 2025)
- Fixed HTTP 400 errors from Twilio webhooks caused by empty request bodies
- Root cause: Twilio sends `application/x-www-form-urlencoded` data, but Express only had `express.json()` configured
- Solution: Added `express.urlencoded({ extended: true })` middleware to parse URL-encoded bodies
- Enhanced webhook logging to show content-type, user-agent, and body keys for better debugging
- Both Twilio (form-encoded) and ElevenLabs (JSON) webhooks now work correctly

### Cal.com Integration (November 3, 2025)
- **Direct Cal.com API Integration:** Cal.com tool configuration now pushed directly to ElevenLabs
  - ElevenLabs calls Cal.com API directly without backend webhooks
  - Cal.com API key and Event Type ID stored in Supabase, sent to ElevenLabs as constant values
  - Simpler architecture: no webhook endpoints needed for booking
  - Tool automatically configured in ElevenLabs when user enables Cal.com in Business Profile
  - Single `book_appointment` tool replaces previous multi-step webhook approach
  - Users can configure Cal.com settings in the Business Profile UI
  - Backend automatically creates/updates the tool in ElevenLabs agent via API
- **Two-Step Tool Creation Process (November 3, 2025):**
  - Step 1: POST to `/v1/convai/tools` to create standalone Cal.com booking tool
  - Step 2: PATCH agent's `tool_ids` array to attach the created tool
  - Fixed schema format mismatch between GET (array-based) and POST (object-based) endpoints
  - Tool config uses `default` field for constant values (apiKey, eventTypeId, timeZone, language)
  - Preserves existing agent tools while adding new Cal.com tool

### Security Design
- All integrations use per-user API credentials stored in Supabase
- NO environment variable fallbacks - fully multi-tenant architecture
- **Cal.com Direct Integration:** Cal.com API keys are sent to ElevenLabs as constant values in tool configuration
  - Trade-off: Simplicity vs. keeping secrets only in backend
  - ElevenLabs stores the API key for direct Cal.com API calls
  - Alternative webhook-based approach would keep keys only in backend but requires more infrastructure
- Webhook endpoints verify unique per-user tokens before processing requests
- Prevents unauthorized access even with knowledge of user IDs

## System Architecture

The system follows a client-server architecture with clear separation between:

1. **Frontend**: React-based SPA with modern UI components from shadcn/ui
2. **Backend**: Express.js server with REST API endpoints
3. **Database**: PostgreSQL with Drizzle ORM for schema management
4. **Authentication**: Custom authentication system with session management

The application is structured with shared code between client and server for consistent data validation and typing, following a monorepo structure.

## Key Components

### Frontend

- **React SPA**: Built with Vite for optimized development and production builds
- **UI Framework**: Uses shadcn/ui components library with Tailwind CSS for styling
- **Form Management**: React Hook Form with Zod validation
- **State Management**: React Query for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Theming**: Supports light and dark modes via next-themes

### Backend

- **Express.js Server**: Handles API requests and serves the frontend application
- **API Routes**: RESTful endpoints for authentication and user management
- **Middleware**: JSON body parsing, error handling, and logging
- **Storage**: Database abstraction layer with memory implementation for development

### Database

- **ORM**: Drizzle ORM for type-safe database operations
- **Schema**: PostgreSQL tables for users with appropriate relations
- **Migrations**: Support for database migrations using drizzle-kit

### Shared

- **Schema Definitions**: Shared between client and server for consistent data validation
- **Type Definitions**: TypeScript types used across the application
- **Validation**: Zod schemas for form validation and API request/response validation

## Data Flow

1. **Authentication Flow**:
   - User registers via the signup form with business details and service plan selection
   - Backend validates user input and creates a new user account
   - User logs in with email and password
   - Backend validates credentials and establishes a session

2. **API Communication**:
   - Client sends requests to the server via fetch API with JSON payloads
   - Server processes requests, performs validation, and responds with JSON data
   - React Query manages client-side caching and state updates

3. **Form Submission**:
   - Forms are validated client-side using Zod schemas
   - On submission, data is sent to the server via API endpoints
   - Server validates data and responds with success or error messages
   - Client displays appropriate feedback to the user

## External Dependencies

### Frontend Libraries
- React ecosystem (React, React DOM)
- Tailwind CSS and shadcn/ui components
- React Hook Form with Zod validation
- React Query for data fetching
- Lucide React for icons
- Wouter for routing

### Backend Libraries
- Express.js for API server
- Drizzle ORM for database operations
- Zod for validation
- Crypto for password hashing

### Development Tools
- TypeScript for type safety
- Vite for frontend builds
- ESBuild for backend builds
- Drizzle Kit for database migrations

## Deployment Strategy

The application is configured to run on Replit with the following setup:

1. **Development Mode**:
   - Run `npm run dev` to start both frontend and backend in development mode
   - Frontend runs with Vite's hot module replacement
   - Backend restarts on file changes via tsx

2. **Production Build**:
   - Frontend is built with Vite to static assets
   - Backend is bundled with ESBuild
   - Combined build is served from a single Express server

3. **Database**:
   - In development, uses a PostgreSQL instance provided by Replit
   - Application is ready to connect to cloud databases like Neon Database (serverless Postgres)

4. **Running on Replit**:
   - Configuration in .replit file sets up the correct environment
   - Node.js 20 and PostgreSQL 16 are configured as requirements
   - Automatic deployment is set up on Replit

## Project Structure

```
├── client/                  # Frontend React application
│   ├── src/
│   │   ├── components/      # React components including shadcn/ui
│   │   ├── hooks/           # Custom React hooks
│   │   ├── lib/             # Utility functions
│   │   └── pages/           # Page components
├── server/                  # Backend Express application
│   ├── index.ts             # Server entry point
│   ├── routes.ts            # API route definitions
│   ├── storage.ts           # Data storage abstraction
│   └── vite.ts              # Vite integration for development
├── shared/                  # Shared code between client and server
│   └── schema.ts            # Database schema and validation
```