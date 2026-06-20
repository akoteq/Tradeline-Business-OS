export interface AuthUser {
  id: string;
  email: string;
  role: 'CEO' | 'BDO';
  bdoId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
