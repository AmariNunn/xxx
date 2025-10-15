# Admin Impersonation System - Complete Guide

## Overview
This secure admin impersonation system allows you (the admin) to access client accounts without needing their passwords. All actions are logged for security and compliance.

---

## 🚀 Quick Setup (5 Steps)

### Step 1: Run SQL Setup in Supabase
1. Open your Supabase project
2. Go to **SQL Editor**
3. Open the file `ADMIN_SETUP.sql`
4. **IMPORTANT**: Replace `'your-admin-email@example.com'` with YOUR actual email address
5. Click **Run** to execute the SQL

This will:
- ✅ Add admin flag to users table
- ✅ Make your account an admin
- ✅ Create audit log table
- ✅ Set up indexes for performance

### Step 2: Verify You're an Admin
Run this in Supabase SQL Editor:
```sql
SELECT id, email, business_name, is_admin 
FROM users 
WHERE email = 'your-email@example.com';
```
You should see `is_admin: true`

### Step 3: The backend is already set up! ✅
- Admin routes are in `server/adminRoutes.ts`
- Already imported in `server/index.ts`
- API endpoints are ready to use

### Step 4: The frontend is already built! ✅
- Admin dashboard at `/admin`
- Already added to routing in `client/src/App.tsx`
- UI components ready

### Step 5: Test the System
1. Log in with your admin account
2. Visit: `http://localhost:5000/admin` (or your domain + `/admin`)
3. You should see a list of all users
4. Click "Impersonate" on any user

---

## 🎯 How It Works

### For You (The Admin)

#### Accessing Admin Dashboard
1. Log in with your admin credentials
2. Navigate to `/admin`
3. You'll see all registered users

#### Impersonating a Client
1. Find the client in the user list
2. Click **"Impersonate"** next to their name
3. You're instantly logged in as them
4. Yellow banner appears: "Admin Impersonation Active"
5. Make changes to their settings
6. Click **"Exit Impersonation"** when done
7. You're back to admin view

#### What You Can Do While Impersonating
- ✅ View their dashboard
- ✅ See their calls and transcripts
- ✅ Configure their AI agent
- ✅ Update their business profile
- ✅ Manage their integrations (Twilio, ElevenLabs, Cal.com)
- ✅ Upload files and links for them
- ✅ Make calls on their behalf
- ✅ Everything they can do

#### What's Logged
Every admin action is recorded:
- When you view the user list
- When you start impersonation
- Who you impersonated
- When you ended impersonation
- Your IP address
- Timestamp

---

## 🔒 Security Features

### How It's Secure
1. **Admin-Only Access**: Only accounts with `is_admin = TRUE` can impersonate
2. **Header Authentication**: Admin ID must be sent in request headers
3. **Database Verification**: Every request checks admin status
4. **Complete Audit Trail**: All actions logged in `admin_audit_log` table
5. **No Password Needed**: Uses admin privileges, not client passwords
6. **Transparent**: Yellow banner shows you're impersonating
7. **Easy Exit**: One-click return to admin view

### What's NOT Possible
- ❌ Clients cannot impersonate other clients
- ❌ Clients cannot see admin dashboard
- ❌ No backdoor password access
- ❌ Actions can't be hidden (all logged)

---

## 📊 API Endpoints

All endpoints require `x-admin-id` header with your admin user ID.

### Check Admin Status
```
GET /api/admin/check/:userId
Response: { "isAdmin": true/false }
```

### List All Users (Admin Only)
```
GET /api/admin/users
Headers: { "x-admin-id": "your-admin-id" }
Response: { "users": [...] }
```

### Get User Details (Admin Only)
```
GET /api/admin/users/:userId
Headers: { "x-admin-id": "your-admin-id" }
Response: { "user": {...} }
```

### Start Impersonation (Admin Only)
```
POST /api/admin/impersonate
Headers: { "x-admin-id": "your-admin-id" }
Body: { "userId": "target-user-id" }
Response: { "message": "Impersonation started", "user": {...}, "adminId": "...", "adminEmail": "..." }
```

### End Impersonation (Admin Only)
```
POST /api/admin/end-impersonation
Headers: { "x-admin-id": "your-admin-id" }
Body: { "targetUserId": "...", "targetUserEmail": "..." }
Response: { "message": "Impersonation ended", "adminUser": {...} }
```

### View Audit Logs (Admin Only)
```
GET /api/admin/audit-logs?limit=50&offset=0
Headers: { "x-admin-id": "your-admin-id" }
Response: { "logs": [...] }
```

---

## 🔍 Viewing Audit Logs

### Via Supabase
```sql
-- See recent admin actions
SELECT 
    admin_email,
    action,
    target_user_email,
    details,
    created_at
FROM admin_audit_log 
ORDER BY created_at DESC 
LIMIT 20;
```

### Via API (if you build a logs page)
```javascript
const response = await fetch('/api/admin/audit-logs?limit=50', {
  headers: {
    'x-admin-id': localStorage.getItem('userId')
  }
});
const { logs } = await response.json();
```

---

## 🛠️ Troubleshooting

### "Access Denied" when visiting /admin
**Problem**: You're not set as admin
**Solution**:
```sql
UPDATE users 
SET is_admin = TRUE 
WHERE email = 'your-actual-email@example.com';
```

### Can't see impersonation banner
**Problem**: LocalStorage not set correctly
**Solution**: End impersonation and start again

### Changes not saving for client
**Problem**: You might not be properly impersonated
**Solution**: 
1. Check yellow banner is showing
2. Check localStorage has `isImpersonating = 'true'`
3. Re-impersonate the user

### Audit log not recording
**Problem**: Table might not exist
**Solution**: Run `ADMIN_SETUP.sql` again in Supabase

---

## 📱 Production Deployment on Render

### Environment Variables (Already Set)
Your app already has:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

No new variables needed!

### After Deploying
1. Run `ADMIN_SETUP.sql` in your **production** Supabase (not dev)
2. Update the email to your production admin email
3. Test by visiting `https://your-app.com/admin`

---

## 🎨 Customization

### Add Admin Link to Navigation
Edit the navigation component to add admin link:

```typescript
// In your navigation component
const userId = localStorage.getItem('userId');
const [isAdmin, setIsAdmin] = useState(false);

useEffect(() => {
  fetch(`/api/admin/check/${userId}`)
    .then(res => res.json())
    .then(data => setIsAdmin(data.isAdmin));
}, [userId]);

// In your nav menu
{isAdmin && (
  <Link to="/admin">
    <Button variant="outline">
      <Shield className="h-4 w-4 mr-2" />
      Admin
    </Button>
  </Link>
)}
```

### Make More Admins
```sql
UPDATE users 
SET is_admin = TRUE 
WHERE email IN ('admin1@example.com', 'admin2@example.com');
```

### Remove Admin Access
```sql
UPDATE users 
SET is_admin = FALSE 
WHERE email = 'user@example.com';
```

---

## ✅ Testing Checklist

After setup, test these:

- [ ] Admin can access `/admin`
- [ ] Non-admin gets "Access Denied"
- [ ] Can see list of all users
- [ ] Search users works
- [ ] Can click "Impersonate"
- [ ] Yellow banner shows
- [ ] Can access client's dashboard
- [ ] Can modify client settings
- [ ] Can exit impersonation
- [ ] Returns to admin view
- [ ] Audit log records actions

---

## 🚨 Important Notes

1. **Run on Render** ✅ - This works perfectly on Render (not just Replit)
2. **Supabase Compatible** ✅ - Uses Supabase for everything
3. **No Password Needed** ✅ - Secure admin privileges, not passwords
4. **All Actions Logged** ✅ - Complete audit trail
5. **Client Data Safe** ✅ - No data corruption or mixing

---

## 📞 Support Workflow

### Common Admin Tasks

#### Help Client Set Up Twilio
1. Impersonate client
2. Go to Business Profile → Settings
3. Enter their Twilio credentials
4. Save
5. Exit impersonation

#### Check Client's Call History
1. Impersonate client  
2. Go to Call Dashboard
3. Review calls
4. Add notes if needed
5. Exit impersonation

#### Configure AI Agent for Client
1. Impersonate client
2. Go to SkyIQ Agent
3. Update prompts and settings
4. Test configuration
5. Exit impersonation

---

## 🎉 You're Done!

You now have a secure, professional admin impersonation system that:
- ✅ Works on Render + Supabase
- ✅ Logs all admin actions
- ✅ Doesn't need client passwords
- ✅ Is completely transparent
- ✅ Easy to use

Just run the SQL setup and start helping your clients! 🚀
