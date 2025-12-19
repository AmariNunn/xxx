import { Request, Response, NextFunction } from 'express';
import { storage } from '../supabaseStorage.js';

// Extend Express session type
declare module 'express-session' {
  interface SessionData {
    user?: {
      id: string;
      isAdmin: boolean;
    };
    activeAccountId?: string; // For secure server-side account switching (parent/child accounts)
    isAdminImpersonating?: boolean; // Flag to indicate admin is impersonating another user
  }
}

// Middleware to ensure user is authenticated
export function ensureAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ message: 'Unauthorized - Please log in' });
  }
  next();
}

// Middleware to ensure user is an admin
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ message: 'Unauthorized - Please log in' });
  }
  
  if (!req.session.user.isAdmin) {
    return res.status(403).json({ message: 'Forbidden - Admin access required' });
  }
  
  next();
}

// Helper function to get the active user ID (respects account switching)
export function getActiveUserId(req: Request): string | undefined {
  if (!req.session?.user?.id) {
    return undefined;
  }
  
  // If account switching is active, use that ID, otherwise use logged-in user ID
  return req.session.activeAccountId || req.session.user.id;
}

// Helper function to validate if user can switch to target account
export async function canSwitchToAccount(loggedInUserId: string, targetAccountId: string): Promise<boolean> {
  // User can always "switch" to themselves
  if (loggedInUserId === targetAccountId) {
    return true;
  }
  
  // Check if logged-in user is admin (admins can switch to anyone)
  const loggedInUser = await storage.getUser(loggedInUserId);
  if (loggedInUser?.is_admin) {
    return true;
  }
  
  // Check if target account is a child of the logged-in user
  const targetUser = await storage.getUser(targetAccountId);
  if (targetUser?.parent_account_id === loggedInUserId) {
    return true;
  }
  
  return false;
}
