import { Request } from 'express';

export function qs(req: Request, key: string): string | undefined {
  const v = req.query[key];
  if (v === undefined || v === null || v === '') return undefined;
  return String(v);
}

export function param(req: Request, key: string): string {
  return String(req.params[key] ?? '');
}
