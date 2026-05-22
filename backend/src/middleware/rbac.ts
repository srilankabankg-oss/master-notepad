import type { Request, Response, NextFunction } from 'express';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';

const LOCALHOST_IPS = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];

export function requireRole(...roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (LOCALHOST_IPS.includes(req.ip || '')) {
      next();
      return;
    }

    const employeeId = req.session?.employeeId;
    if (!employeeId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    try {
      const [employee] = await db
        .select({ role: schema.employees.role })
        .from(schema.employees)
        .where(eq(schema.employees.id, employeeId))
        .limit(1);

      if (!employee) {
        res.status(401).json({ error: 'Employee not found' });
        return;
      }

      if (!roles.includes(employee.role)) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      next();
    } catch (e) {
      next(e);
    }
  };
}