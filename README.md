# Sky IQ - AI Voice Solutions Platform

A comprehensive Smart Call Intelligence Platform that helps businesses track and analyze phone conversations with intelligent call analytics.

## 🚀 Long-term Stability Configuration

This application has been configured for **6-month continuous uptime** with the following stability features:

### 📊 Automated Monitoring
- **Health checks every 5 minutes** via automated system
- **Database connectivity verification** 
- **Memory and disk usage monitoring**
- **Automatic application restart** if health checks fail

### 🔧 Maintenance Automation
- **Daily automated restarts** at 3 AM to prevent memory leaks
- **Log rotation** with 30-day retention
- **Automatic cleanup** of old files and temporary data
- **Regular backup creation** with timestamped snapshots

### 🛡️ Error Recovery
- **Automatic process restart** on crashes
- **Port conflict resolution** 
- **Database connection retry** logic
- **Email service failover** handling

## 🏗️ Architecture

### Frontend (React + TypeScript)
- Modern React SPA with Vite
- shadcn/ui components with Tailwind CSS
- React Hook Form with Zod validation
- TanStack Query for server state management
- Wouter for lightweight routing

### Backend (Express + Node.js)
- RESTful API with Express.js
- PostgreSQL database with Drizzle ORM
- Custom authentication with session management
- Email service integration (MailerSend)
- Health monitoring endpoints

### Database
- PostgreSQL with connection pooling
- Drizzle ORM for type-safe operations
- Automatic schema migrations
- Connection retry mechanisms

## 📋 Features

### Authentication System
- **User registration** with email verification
- **Secure login** with password strength validation
- **Password reset** functionality
- **Email verification** with secure tokens

### Dashboard & Analytics
- **Call tracking** and analytics
- **Business profile** management
- **Lead management** system
- **Call recording** integration
- **Tutorial system** with embedded video

### Email Integration
- **MailerSend API** integration
- **Automated email notifications**
- **Email verification** system
- **Password reset** emails

## 🔧 Deployment & Maintenance

### Production Setup
```bash
# Full production deployment
./deploy.sh

# Manual maintenance
./maintenance.sh

# Health check
node healthcheck.js
```

### Health Monitoring
- **Endpoint**: `GET /api/health`
- **Response**: JSON with application status, uptime, and database connectivity
- **Monitoring**: Automated checks every 5 minutes

### Log Management
- **Location**: `./logs/` directory
- **Rotation**: Automatic with 30-day retention
- **Types**: Application logs, health checks, maintenance logs

### Backup System
- **Automated backups** before deployments
- **Timestamped snapshots** in `./backups/` directory
- **Includes**: Source code, configuration, and logs

## 🎯 Stability Features

### Process Management
- **Automatic restart** on failure
- **Memory leak prevention** with daily restarts
- **Port conflict resolution**
- **Graceful shutdown** handling

### Database Reliability
- **Connection pooling** for optimal performance
- **Automatic retry** on connection failures
- **Health check** integration
- **Schema validation** and migrations

### Email Service Reliability
- **API token validation**
- **Retry logic** for failed sends
- **Error logging** and monitoring
- **Backup delivery** methods

## 🔐 Security

### Authentication
- **Secure password hashing** with bcrypt
- **Session management** with secure cookies
- **Email verification** required
- **Password strength** validation

### Data Protection
- **Environment variables** for sensitive data
- **Database connection** security
- **API token** protection
- **Session security** configuration

## 📱 User Interface

### Responsive Design
- **Mobile-first** approach
- **Dark/light mode** support
- **Professional UI** components
- **Accessibility** features

### Pages
- **Landing page** for new users
- **Authentication** (login/signup)
- **Dashboard** for logged-in users
- **Business profile** management
- **Call analytics** and review
- **Tutorial system** (accessible at `/tutorial`)

## 🛠️ Development

### Local Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### Database Operations
```bash
# Push schema changes
npm run db:push

# Run type checking
npm run check
```

## 📊 Monitoring & Logs

### Application Logs
- **Request logging** with response times
- **Error tracking** and debugging
- **Performance monitoring**
- **Database query** logging

### Health Metrics
- **System uptime** tracking
- **Memory usage** monitoring
- **Database connectivity**
- **API response times**

### Automated Alerts
- **Failed health checks** trigger restarts
- **High memory usage** warnings
- **Database connection** issues
- **Email service** failures

## 🎓 Tutorial System

Access the interactive tutorial at `/tutorial` to learn:
- Dashboard navigation
- Business profile setup
- Call analytics features
- Lead management
- System configuration

## 🔗 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/user/:id` - Get user profile
- `POST /api/auth/forgot-password` - Password reset request
- `POST /api/auth/reset-password` - Password reset confirmation

### Health & Monitoring
- `GET /api/health` - Application health check
- `POST /api/test-email` - Email service testing

### Business Management
- `GET /api/business/:userId` - Get business profile
- `POST /api/business/:userId` - Update business profile
- `POST /api/business/:userId/links` - Add business links
- `POST /api/business/:userId/files` - Upload business files

### Call Management
- `GET /api/calls/user/:userId` - Get user calls
- `POST /api/calls` - Create new call record
- `DELETE /api/calls/:id` - Delete call record

## 📈 Performance

### Optimization Features
- **Vite** for fast development builds
- **ESBuild** for production bundles
- **Code splitting** for efficient loading
- **Asset optimization** and compression

### Caching Strategy
- **React Query** for client-side caching
- **Database connection** pooling
- **Static asset** caching
- **API response** optimization

## 🎯 6-Month Stability Guarantee

This application has been specifically configured for long-term stability with:

1. **Automated monitoring** every 5 minutes
2. **Daily maintenance** and restarts
3. **Comprehensive error recovery**
4. **Performance optimization**
5. **Resource management**
6. **Backup and recovery** systems

Your Sky IQ platform is now ready for continuous operation over the next 6 months with minimal intervention required.

---

**Sky IQ Platform** - Smart Call Intelligence for Modern Businesses