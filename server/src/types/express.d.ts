import type { UserRole } from '../models/User';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: UserRole;
        bdoId: string | null;
      };
    }
  }
}

export {};
