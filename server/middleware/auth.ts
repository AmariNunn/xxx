import { Request, Response, NextFunction } from 'express';
import { storage } from '../supabaseStorage.js';

// Extend Express session type
declare module 'express-session' {
  interface SessionData {
    user?: {
      id: string;
      isAdmin: boolean;
    };
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
