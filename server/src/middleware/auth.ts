import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole, INDIVIDUAL_ROLES, ADMIN_ROLES } from '../models/User';

const JWT_SECRET = process.env.JWT_SECRET!;

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET) as { userId: string; role: UserRole; bdoId: string | null };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !ADMIN_ROLES.includes(req.user.role)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  next();
}

// Returns the staff-profile id a request should be scoped to, or null for
// executives/admins who see everything. Individual contributors (BDO, Junior
// BDO, Intern, and — until team scoping lands in v2 — Senior BDO) see only their own.
export function bdoFilter(req: Request): string | null {
  if (req.user && INDIVIDUAL_ROLES.includes(req.user.role)) return req.user.bdoId ?? null;
  return null;
}
