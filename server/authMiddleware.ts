import { Request, Response, NextFunction } from "express";
import { verifyToken } from "./jwtUtils";

/**
 * Middleware to require a valid JWT
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  // Attach decoded token (user info) to request
  (req as any).user = decoded;

  next();
}

/**
 * Middleware to require admin role
 * Includes authentication + role check
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  if (decoded.role !== "admin") {
    return res
      .status(403)
      .json({ message: "Forbidden: admin access required" });
  }

  (req as any).user = decoded;

  next();
}
