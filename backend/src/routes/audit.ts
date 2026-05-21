import { Router } from 'express';
import { z } from 'zod';
import { db, schema } from '../db/index.js';
import { eq, desc, and } from 'drizzle-orm';
import { validateQuery } from '../middleware/validation.js';

export const auditLogRouter = Router();

auditLogRouter.get('/', validateQuery(z.object({
  entityType: z.string().optional(),
  entityId: z.coerce.number().int().positive().optional(),
})), async (req, res, next) => {
  try {
    const { entityType, entityId } = req.query as { entityType?: string; entityId?: number };

    const conditions: ReturnType<typeof eq>[] = [];
    if (entityType) conditions.push(eq(schema.auditLog.entityType, entityType));
    if (entityId) conditions.push(eq(schema.auditLog.entityId, entityId));

    const entries = await db
      .select({
        id: schema.auditLog.id,
        entityType: schema.auditLog.entityType,
        entityId: schema.auditLog.entityId,
        action: schema.auditLog.action,
        employeeId: schema.auditLog.employeeId,
        changes: schema.auditLog.changes,
        createdAt: schema.auditLog.createdAt,
        employeeName: schema.employees.name,
      })
      .from(schema.auditLog)
      .leftJoin(schema.employees, eq(schema.auditLog.employeeId, schema.employees.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(schema.auditLog.createdAt))
      .limit(100);

    res.json(entries);
  } catch (e) { next(e); }
});