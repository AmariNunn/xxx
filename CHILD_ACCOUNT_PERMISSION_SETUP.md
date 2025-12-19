# Child Account Permission System - Setup & Usage Guide

## Overview

The child account permission system allows administrators to control which users can create and manage child accounts. This feature enables organizations to create multiple sub-accounts with independent integrations, agents, and call history.

## Prerequisites (REQUIRED)

### 1. Environment Variables

**Set the SESSION_SECRET environment variable:**

In Replit Secrets (or your .env file), add:
```
SESSION_SECRET=your-random-secret-key-here-minimum-32-characters
```

⚠️ **IMPORTANT**: Generate a strong random secret. The application will fail to start without this.

Example generation:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Database Setup (REQUIRED)

**Run the SQL migration in your Supabase dashboard:**

1. Open your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `ADD_CHILD_ACCOUNT_PERMISSION.sql`
4. Execute the SQL to add the `can_create_child_accounts` column

The SQL migration adds:
```sql
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS can_create_child_accounts BOOLEAN DEFAULT false;
```

## Admin Usage

### Granting Permission to Create Child Accounts

1. Log in as an admin user
2. Navigate to **Admin Panel** in the sidebar
3. Find the user you want to grant permission to
4. In the **Permissions** column, toggle the **Child Accounts** switch ON
5. The user will now see the "Accounts" menu item and can create child accounts

### Revoking Permission

1. In the Admin Panel, find the user
2. Toggle the **Child Accounts** switch OFF
3. The user will no longer be able to create child accounts (existing ones remain accessible)

## User Usage

### Creating Child Accounts (Requires Permission)

1. Ensure you have the **can_create_child_accounts** permission (granted by admin)
2. Click **Accounts** in the sidebar navigation
3. Click **Add Account** button
4. Fill in the child account details:
   - Business Name (e.g., "Acme Corp - Sales Team")
   - Email (unique email for the child account)
   - Password (minimum 6 characters)
5. Click **Create Account**

### Managing Child Accounts

- View all your child accounts in the Accounts page
- Each child account has:
  - Independent business profile
  - Separate integration credentials (ElevenLabs, Twilio, Cal.com)
  - Independent AI agents and call history
  - Complete data isolation

### Account Switching

(Note: Account switching feature needs to be re-enabled - see Technical Notes below)

## Technical Architecture

### Backend Authorization

- **Permission Validation**: All child account creation requests verify the parent has `can_create_child_accounts` permission
- **Admin-Only Updates**: Only admin users can toggle child account permissions via the Admin Panel
- **Data Isolation**: Each child account operates independently with its own database records

### Frontend Components

1. **Admin Panel** (`/admin`):
   - Displays all users with permission toggle switches
   - Only accessible to admin users

2. **Accounts Page** (`/accounts`):
   - Only visible to users with `can_create_child_accounts` permission
   - Displays child account creation form and list

3. **Navigation**:
   - "Accounts" menu item only appears if user has permission

## Security Considerations

⚠️ **IMPORTANT SECURITY NOTICE**:

The current implementation follows the existing codebase authentication pattern, which uses query parameters for admin verification. This has limitations:

- Admin routes authenticate via `adminUserId` query parameter
- This follows existing patterns in `/api/admin/users` and other admin endpoints
- For production use, we recommend implementing proper session-based authentication

### Recommended Security Improvements

1. Implement session-based authentication with secure HTTP-only cookies
2. Add authentication middleware to all `/api/admin/*` routes
3. Validate permissions server-side using authenticated session data
4. Remove reliance on client-provided `adminUserId` parameters

## API Endpoints

### Get All Users (Admin Only)
```
GET /api/admin/users?adminUserId={adminId}
```

### Update User Permissions (Admin Only)
```
PATCH /api/admin/users/:userId/permissions?adminUserId={adminId}
Body: { can_create_child_accounts: boolean }
```

### Create Child Account
```
POST /api/accounts/child
Body: { parentId: string, businessName: string, email: string, password: string }
```
- Validates parent has `can_create_child_accounts` permission
- Returns 403 if permission not granted

### Get Child Accounts
```
GET /api/accounts/child/:parentId
```

## Troubleshooting

### "Missing required fields" error when creating child account

- Ensure all fields are filled: Business Name, Email, Password
- Verify the SQL migration has been run (check Supabase table schema)

### "Parent account does not have permission" error

- Contact your administrator to enable child account permissions
- Admin must toggle the permission switch in the Admin Panel

### "Accounts" menu item not visible

- Check that you have been granted `can_create_child_accounts` permission
- Refresh the page after permission is granted

### Database column doesn't exist

- Run the SQL migration in `ADD_CHILD_ACCOUNT_PERMISSION.sql`
- Verify the column exists: `SELECT can_create_child_accounts FROM users LIMIT 1;`

## Technical Notes

### Incomplete Features

1. **Account Switching**: The account switcher dropdown in navigation is currently disabled due to authentication safety concerns. This needs to be re-enabled with proper session-based authentication.

2. **useAuth Hook**: The `getActiveUserId()` logic for account switching was disabled to prevent blank dashboard bugs. This should be re-implemented after proper authentication is added.

### Future Enhancements

- Implement proper session-based authentication
- Re-enable account switching with security improvements
- Add account switcher dropdown in navigation
- Add ability to delete child accounts
- Add usage quotas per child account
- Add parent account visibility into child account activity

## Support

For issues or questions:
1. Check this documentation first
2. Verify SQL migration has been run
3. Check browser console for error messages
4. Review server logs for backend errors
5. Contact system administrator for permission-related issues
