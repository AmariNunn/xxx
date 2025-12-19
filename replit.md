# SkyIQ Platform

## Overview

SkyIQ is a Smart Call Intelligence Platform designed to help businesses track and analyze phone conversations using AI voice agents. The platform enables users to register, log in, and manage their AI call assistants, integrating with ElevenLabs for AI voice, Twilio for telephony, and Cal.com for appointment booking. The project aims to provide a comprehensive solution for AI-powered call management and analysis, with a focus on enhancing business communication and operational efficiency.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The system employs a client-server architecture, separating the React-based frontend from the Express.js backend. It leverages Supabase for its PostgreSQL database and Drizzle ORM for type-safe database interactions.

### UI/UX Decisions
- **Frontend Framework**: React with Vite.
- **UI Components**: shadcn/ui with Tailwind CSS for a modern, on-brand aesthetic.
- **Theming**: Supports light and dark modes.
- **Bulk Caller UI**: Redesigned with a gradient header, side-by-side layout for CSV upload/manual entry, clear instructions, and "Pro tip" alerts for dynamic variables.
- **Batch History**: Simplified table view focusing on Campaign Name, Scheduled Calls, Created date, and Delete action for cleaner UX.

### Technical Implementations
- **Authentication**: Pure session-based authentication with HttpOnly secure cookies. The frontend uses `/api/auth/currentUser` endpoint to fetch the authenticated user from the session (no localStorage dependencies). Requires SESSION_SECRET environment variable (application fails fast if missing). Authentication middleware (`ensureAuthenticated`, `requireAdmin`) protects all admin and child account routes. The `useAuth` hook provides `user`, `userId`, `isAuthenticated`, `login`, and `logout` functions throughout the app. All user identification comes from authenticated session data stored server-side. **Production Deployment**: Session configuration includes `trust proxy: 1` for reverse proxy compatibility (Render, etc.) and `sameSite: 'none'` in production for cross-origin cookie support. **Field Mapping**: All auth endpoints (`/api/auth/currentUser`, `/api/auth/user/:id`, `/api/auth/user/:userId`, `/api/auth/login`, `/api/auth/register`) consistently map database snake_case fields to frontend camelCase: `is_admin → isAdmin`, `can_create_child_accounts → canCreateChildAccounts`, `parent_account_id → parentAccountId`.
- **Authorization**: Role-based access control with `is_admin` flag for platform administrators. Child account creation controlled by per-user `can_create_child_accounts` permission flag, managed exclusively through admin panel. All permission updates verified server-side before execution.
- **State Management**: React Query for server-side state in the frontend.
- **Routing**: Wouter for lightweight client-side routing.
- **Form Management**: React Hook Form with Zod for validation.
- **Shared Code**: Monorepo structure with shared Zod schemas and TypeScript types for consistent data validation across client and server.
- **Batch Calling**: Uses ElevenLabs batch calling API for submitting bulk calls, allowing ElevenLabs to manage scheduling and dispatch. Dynamic variables from CSVs or manual entries are passed to ElevenLabs prompts.
- **Automatic Date/Time Awareness**: All ElevenLabs agents automatically include `{{system__time}}` variable in their prompts, ensuring agents always know the current date and time. Hidden professional guidelines instruct agents to collect customer timezones for scheduling and time-sensitive conversations.
- **Dynamic Variable Automation**: ElevenLabs initiation webhook (`/api/elevenlabs/initiation-webhook`) automatically populates dynamic variables for every call by looking up customer data from batch campaigns and call records. Variables flow seamlessly into agent prompts without manual configuration.
- **User Resolution Priority**: All ElevenLabs webhooks (initiation and post-call) prioritize `agent_id` lookup first for accurate multi-tenant routing. Fallback chain: agent_id → phone_number_id → Twilio number matching → default user.
- **Call History Display**: Dashboard displays up to 1000 calls from the past 24 hours for optimal performance while maintaining visibility into recent activity.
- **Webhook Security**: Optional per-user webhook tokens stored in `business_info.webhook_token` for production security. Webhook validates tokens when set, allows requests when not set (for ease of initial setup).
- **Two-Way SMS System**: Implemented using Cloudflare Workers AI (Llama 3.1) for intelligent responses, Twilio for SMS, and Supabase for logging. Includes HMAC-SHA1 signature verification for security.
- **Cal.com Integration**: Direct API integration with Cal.com for appointment scheduling, configuring two tools (`check_availability`, `book_appointment`) directly within ElevenLabs agents. **Dynamic Schema Detection**: Automatically fetches event type requirements from Cal.com API v1 and builds ElevenLabs tool schemas dynamically based on bookingFields configuration. Supports all Cal.com field types (name, email, phone, text, textarea, number, select, radio, checkbox, address) with safe fallbacks for unknown types. Uses actual field names from Cal.com (e.g., "attendeePhoneNumber") to ensure proper mapping. **Automatic Prompt Updates**: When Cal.com is enabled, booking instructions are automatically injected into the agent prompt with conversation examples and required field guidance. When disabled, all booking instructions are exhaustively removed. Handles backward compatibility with legacy prompt formats and removes any number of duplicate sections.
- **Parent/Child Account System**: Organizations can create unlimited child accounts (sub-accounts) with independent business profiles, integrations, and AI agents. **Account Isolation**: Each child account has its own `business_info` entry with separate API credentials for ElevenLabs, Twilio, and Cal.com. **Secure Account Switching**: Parent accounts and admins can switch between accounts via POST /api/accounts/switch with server-side session-based authorization. The system validates parent/child relationships and admin permissions before allowing switches. All switch attempts are logged for security audit. Users can reset to their own account via POST /api/accounts/reset. **Admin Impersonation**: Admins can impersonate any user account via the same switch endpoint. Session tracks `isAdminImpersonating` flag to display ImpersonationBanner UI. Banner shows impersonated user email and "Exit" button to return to admin account. **Implementation**: Uses `parent_account_id` foreign key in users table. Session stores `activeAccountId` for switched accounts and `isAdminImpersonating` flag. `getActiveUserId()` middleware helper respects account switching by returning `req.session.activeAccountId || req.session.user.id`. All protected endpoints (calls, business info, etc.) use `getActiveUserId()` for complete tenant isolation. Authorization validates switches via `canSwitchToAccount()` which checks admin status or parent/child relationship. `/api/auth/currentUser` returns impersonation state and impersonated account info when active.
- **Webhook Handling**: Express.js configured to parse `application/x-www-form-urlencoded` and `application/json` for Twilio and ElevenLabs webhooks.
- **Deployment**: Configured for Replit, with Node.js 20 and PostgreSQL 16, supporting both development (HMR) and production (bundled builds) environments.

### Feature Specifications
- **User Management**: Registration, login, and profile management.
- **Child Account Management**: Parent accounts can create unlimited child accounts with separate business profiles. Each child account operates independently with its own integrations, agents, and call history. Account switcher in navigation allows seamless switching between parent and child accounts.
- **AI Call Assistant Management**: Configuration and deployment of AI voice agents with automatic date/time awareness and timezone collection.
- **Bulk Calling**: Submit campaigns with dynamic variables, track batch status, and view simplified history. Dynamic variables automatically populate via initiation webhook.
- **Two-Way SMS**: Send and receive intelligent SMS messages, view conversation threads, and track delivery status.
- **Appointment Booking**: AI agents can check availability and book appointments via Cal.com.
- **Context-Aware AI**: All agents automatically know the current date via `{{system__time}}`, collect customer timezones, and receive customer-specific data via dynamic variables for personalized conversations.
- **PDF Report Generation**: Dual PDF system with server-side generation using pdfkit. **General Report**: Fast download with call statistics, priority callbacks, and full transcripts (no AI processing). **AI-Enhanced Report**: Includes all chat analysis insights plus transcripts. Transcripts pulled directly from Supabase for security (not sent to AI). No hard limits on transcript count - all calls included.

### System Design Choices
- **Multi-tenant Architecture**: Integrations use per-user API credentials stored in Supabase; no environment variable fallbacks for sensitive data.
- **Security**: Twilio webhook signature verification; unique per-user tokens for other webhooks.
- **Scalability**: Leveraging ElevenLabs for batch call scheduling and Cloudflare Workers AI for SMS processing offloads significant load from the main application.

## External Dependencies

- **AI Voice**: ElevenLabs (for AI voice agents and batch calling API).
- **Telephony**: Twilio (for phone calls and two-way SMS messaging).
- **Appointment Scheduling**: Cal.com (for booking appointments).
- **Database**: Supabase (PostgreSQL).
- **AI Inference**: Cloudflare Workers AI (specifically Llama 3.1 for SMS processing).
- **Frontend Libraries**: React, React DOM, shadcn/ui, Tailwind CSS, React Hook Form, Zod, React Query, Lucide React, Wouter.
- **Backend Libraries**: Express.js, Drizzle ORM, Zod, Crypto.
- **Development Tools**: TypeScript, Vite, ESBuild, Drizzle Kit, tsx.