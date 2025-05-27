# VoxIntel Platform

## Overview

This project is a web application for VoxIntel - a Smart Call Intelligence Platform that helps businesses track and analyze phone conversations. The platform allows users to register, login, and manage their AI call assistant preferences. It's built with a modern technology stack featuring a React frontend and an Express backend with database integration.

## User Preferences

Preferred communication style: Simple, everyday language.

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