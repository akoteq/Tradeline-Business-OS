declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: 'ADMIN' | 'BDO' | 'CEO';
        bdoId: string | null;
      };
    }
  }
}

export {};
