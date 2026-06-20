import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return next();

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      id: string; email: string; role: string; bdoId?: string; name?: string;
    };
    req.user = {
      id: payload.id,
      email: payload.email,
      role: payload.role === 'BDO' ? 'BDO' : 'CEO',
      bdoId: payload.bdoId,
    };
  } catch {
    // Invalid or expired token — leave req.user undefined
  }

  next();
}

export function requireCEO(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (req.user.role !== 'CEO') return res.status(403).json({ error: 'CEO access required' });
  next();
}
