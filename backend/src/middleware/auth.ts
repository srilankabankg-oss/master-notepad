import type { Request, Response, NextFunction } from 'express';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.employeeId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}

export function getEmployeeId(req: Request): number | undefined {
  return req.session?.employeeId || req.body?.employeeId || undefined;
}