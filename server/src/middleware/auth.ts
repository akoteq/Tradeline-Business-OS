import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

type UserRole = 'ADMIN' | 'BDO' | 'CEO';

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
  if (req.user?.role !== 'ADMIN' && req.user?.role !== 'CEO') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  next();
}

export function bdoFilter(req: Request): string | null {
  if (req.user?.role === 'BDO') return req.user.bdoId ?? null;
  return null;
}
