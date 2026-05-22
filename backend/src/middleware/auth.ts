import type { Request, Response, NextFunction } from 'express';

const LOCALHOST_IPS = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (LOCALHOST_IPS.includes(req.ip || '')) {
    next();
    return;
  }
  if (!req.session?.employeeId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}

export function getEmployeeId(req: Request): number | undefined {
  return req.session?.employeeId || req.body?.employeeId || undefined;
}