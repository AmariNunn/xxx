import express, { Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import type { User } from "../shared/types";

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Middleware to check if user is admin
async function requireAdmin(req: Request, res: Response, next: Function) {
  try {
    const adminId = req.headers['x-admin-id'] as string;
    
    if (!adminId) {
      return res.status(401).json({ message: "Admin authentication required" });
    }

    const { data: admin, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', adminId)
      .eq('is_admin', true)
      .single();

    if (error || !admin) {
      return res.status(403).json({ message: "Admin access denied" });
    }

    // Attach admin info to request
    req.admin = admin;
    next();
  } catch (error) {
    console.error("Admin auth error:", error);
    res.status(500).json({ message: "Admin authentication failed" });
  }
}

// Log admin action
async function logAdminAction(
  adminId: string,
  adminEmail: string,
  action: string,
  targetUserId?: string,
  targetUserEmail?: string,
  details?: string,
  ipAddress?: string
) {
  try {
    await supabase.from('admin_audit_log').insert({
      admin_id: adminId,
      admin_email: adminEmail,
      action,
      target_user_id: targetUserId,
      target_user_email: targetUserEmail,
      details,
      ip_address: ipAddress
    });
  } catch (error) {
    console.error("Failed to log admin action:", error);
  }
}

// Check if user is admin
router.get("/api/admin/check/:userId", async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    
    const { data: user, error } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ isAdmin: false });
    }

    res.json({ isAdmin: user.is_admin || false });
  } catch (error) {
    console.error("Error checking admin status:", error);
    res.status(500).json({ isAdmin: false });
  }
});

// Get all users (admin only)
router.get("/api/admin/users", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, business_name, phone_number, service_plan, verified, created_at, is_admin')
      .order('created_at', { ascending: false });

    if (error) throw error;

    await logAdminAction(
      req.admin.id,
      req.admin.email,
      'VIEW_ALL_USERS',
      undefined,
      undefined,
      `Viewed ${users?.length || 0} users`,
      req.ip
    );

    res.json({ users });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

// Get user details (admin only)
router.get("/api/admin/users/:userId", requireAdmin, async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, business_name, phone_number, website, service_plan, verified, created_at, is_admin')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ message: "User not found" });
    }

    await logAdminAction(
      req.admin.id,
      req.admin.email,
      'VIEW_USER_DETAILS',
      user.id,
      user.email,
      `Viewed user details`,
      req.ip
    );

    res.json({ user });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Failed to fetch user details" });
  }
});

// Start impersonation (admin only)
router.post("/api/admin/impersonate", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "User ID required" });
    }

    const { data: targetUser, error } = await supabase
      .from('users')
      .select('id, email, business_name, phone_number, website, service_plan, verified, created_at')
      .eq('id', userId)
      .single();

    if (error || !targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    await logAdminAction(
      req.admin.id,
      req.admin.email,
      'START_IMPERSONATION',
      targetUser.id,
      targetUser.email,
      `Admin impersonating user`,
      req.ip
    );

    res.json({ 
      message: "Impersonation started",
      user: targetUser,
      adminId: req.admin.id,
      adminEmail: req.admin.email
    });
  } catch (error) {
    console.error("Error starting impersonation:", error);
    res.status(500).json({ message: "Failed to start impersonation" });
  }
});

// End impersonation (admin only)
router.post("/api/admin/end-impersonation", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { targetUserId, targetUserEmail } = req.body;

    await logAdminAction(
      req.admin.id,
      req.admin.email,
      'END_IMPERSONATION',
      targetUserId,
      targetUserEmail,
      `Admin ended impersonation`,
      req.ip
    );

    res.json({ 
      message: "Impersonation ended",
      adminUser: {
        id: req.admin.id,
        email: req.admin.email,
        business_name: req.admin.business_name
      }
    });
  } catch (error) {
    console.error("Error ending impersonation:", error);
    res.status(500).json({ message: "Failed to end impersonation" });
  }
});

// Get audit logs (admin only)
router.get("/api/admin/audit-logs", requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const { data: logs, error } = await supabase
      .from('admin_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    await logAdminAction(
      req.admin.id,
      req.admin.email,
      'VIEW_AUDIT_LOGS',
      undefined,
      undefined,
      `Viewed audit logs (limit: ${limit}, offset: ${offset})`,
      req.ip
    );

    res.json({ logs });
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    res.status(500).json({ message: "Failed to fetch audit logs" });
  }
});

export default router;

// Extend Express Request type to include admin
declare global {
  namespace Express {
    interface Request {
      admin?: any;
    }
  }
}
