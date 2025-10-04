# VoxIntel Platform - Setup Instructions

Your VoxIntel Platform has been successfully migrated to Replit! 🎉

## ✅ What's Been Done

- ✅ Installed all required Node.js packages
- ✅ Set up the development workflow 
- ✅ Cleaned up unnecessary Python and SQL files
- ✅ Updated .gitignore for Node.js project
- ✅ Configured deployment settings for Replit

## 🔑 Required Environment Variables

To run your application, you need to add the following environment variables in the Replit Secrets panel:

### **Required - Supabase Database**
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key

### **Optional - External Integrations**
These are optional but needed for full functionality:

**Email Notifications (MailerSend):**
- `MAILERSEND_API_TOKEN` - Your MailerSend API token
- `MAILERSEND_FROM_EMAIL` - Email address to send notifications from
- `NOTIFICATION_EMAIL` - Email address to receive notifications

**AI Voice Integration (ElevenLabs):**
- `ELEVENLABS_API_KEY` - Your ElevenLabs API key
- `ELEVENLABS_AGENT_ID` - Your ElevenLabs agent ID
- `ELEVENLABS_PHONE_NUMBER_ID` - Your ElevenLabs phone number ID

## 🚀 How to Add Environment Variables

1. Click on the **Secrets** icon (🔐) in the left sidebar
2. Add each environment variable one by one
3. Click "Add Secret" after entering each key-value pair

## 📊 Database Setup

Your application uses Supabase for data storage. You'll need:

1. A Supabase account (free tier works great)
2. Create a new project in Supabase
3. Get your project URL and service role key from Project Settings > API
4. Add them to Replit Secrets

The application will handle table creation automatically when it first runs.

## ▶️ Starting the Application

Once you've added your Supabase credentials:

1. The workflow will automatically restart
2. Visit the Webview to see your application
3. You can register a new account and start using VoxIntel!

## 📱 What This Platform Does

VoxIntel is a Smart Call Intelligence Platform that helps you:
- Track and analyze phone conversations
- Manage AI voice agents for customer calls
- Monitor call analytics and transcripts
- Integrate with Twilio for phone services
- Use AI-powered voice assistants (ElevenLabs)

## 🏗️ Project Structure

```
├── client/          # React frontend
├── server/          # Express backend
├── shared/          # Shared types between frontend and backend
└── attached_assets/ # Static assets
```

## ⚙️ Available Commands

- `npm run dev` - Start development server (already configured in workflow)
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run check` - Type check the code

## 🆘 Need Help?

If you have questions or run into issues, I'm here to help! Just let me know what you need.
