import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole, INDIVIDUAL_ROLES, ADMIN_ROLES, COMPANY_ROLES } from '../models/User';

const JWT_SECRET = process.env.JWT_SECRET!;

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      role: UserRole;
      bdoId: string | null;
      bdoCompany: string | null;
    };
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

// Requires the user to be a Business CEO (scoped to one company).
export function requireBusinessCeo(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'BUSINESS_CEO') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  next();
}

// Requires the user to be an admin OR a Business CEO (for shared endpoints).
export function requireAdminOrBusinessCeo(req: Request, res: Response, next: NextFunction) {
  if (!req.user || (!ADMIN_ROLES.includes(req.user.role) && req.user.role !== 'BUSINESS_CEO')) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  next();
}

// Returns the BDO profile id a request should be scoped to:
//   - Individual contributors → their own bdoId
//   - Everyone else (admin, CEO, Business CEO) → null (no per-profile restriction)
export function bdoFilter(req: Request): string | null {
  if (req.user && INDIVIDUAL_ROLES.includes(req.user.role)) return req.user.bdoId ?? null;
  return null;
}

// Returns the company key a request should be scoped to:
//   - Business CEO → their company (e.g. "BAPX", "TRADELINE")
//   - Individual contributors → their BDO profile's company (resolved client-side via bdoId)
//   - Group Owner / Admin → null (sees all companies)
export function companyFilter(req: Request): string | null {
  if (!req.user) return null;
  if (COMPANY_ROLES.includes(req.user.role)) return req.user.bdoCompany ?? null;
  return null;
}
