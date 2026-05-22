import { Router } from 'express';
import { z } from 'zod';
import { db, schema } from '../db/index.js';
import { eq, and, or, like, sql, type SQL } from 'drizzle-orm';
import { validateBody } from '../middleware/validation.js';
import { AppError } from '../middleware/error-handler.js';
import { notifyReindex } from '../ai-reindex.js';
import { requireAuth, getEmployeeId } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { auditLog } from '../middleware/audit.js';

export const organizationsRouter = Router();

organizationsRouter.use(requireAuth);

const createOrganizationSchema = z.object({
  name: z.string().min(1).max(500),
  inn: z
    .string()
    .regex(/^\d{10}(\d{2})?$/, 'Invalid INN format')
    .optional(),
  primaryActivity: z.string().optional(),
  isContractor: z.boolean().default(false),
});

const updateOrganizationSchema = createOrganizationSchema.partial();

organizationsRouter.get('/', async (req, res, next) => {
  try {
    const isContractor = req.query.isContractor === 'true' ? true : undefined;
    const search = req.query.search as string | undefined;

    const conditions: SQL[] = [];

    if (isContractor !== undefined) {
      conditions.push(eq(schema.organizations.isContractor, isContractor));
    }

    if (search) {
      conditions.push(
        or(
          like(schema.organizations.name, `%${search}%`),
          like(schema.organizations.inn, `%${search}%`),
        )!,
      );
    }

    const result = await (conditions.length > 0
      ? db.select().from(schema.organizations).where(and(...conditions))
      : db.select().from(schema.organizations));

    res.json(result);
  } catch (e) {
    next(e);
  }
});

organizationsRouter.get('/:id', async (req, res, next) => {
  try {
    const [org] = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, +req.params.id))
      .limit(1);

    if (!org) throw new AppError(404, 'Organization not found');

    const subs = await db
      .select()
      .from(schema.subcontractors)
      .where(eq(schema.subcontractors.organizationId, org.id));

    res.json({ ...org, subcontractors: subs });
  } catch (e) {
    next(e);
  }
});

organizationsRouter.post(
  '/',
  requireRole('admin'),
  validateBody(createOrganizationSchema),
  async (req, res, next) => {
    try {
      if (req.body.inn) {
        const [existing] = await db
          .select()
          .from(schema.organizations)
          .where(eq(schema.organizations.inn, req.body.inn))
          .limit(1);

        if (existing) {
          throw new AppError(409, 'Organization with this INN already exists');
        }
      }

      const [org] = await db
        .insert(schema.organizations)
        .values(req.body)
        .returning();

      notifyReindex('organization', org.id);
      await auditLog({
        entityType: 'organization',
        entityId: org.id,
        employeeId: getEmployeeId(req)!,
        action: 'create',
        changes: { ...req.body },
      });

      res.status(201).json(org);
    } catch (e) {
      if (e && typeof e === 'object' && 'code' in e && e.code === '23505') {
        next(new AppError(409, 'Organization with this INN already exists'));
      } else {
        next(e instanceof Error ? e : new Error(String(e)));
      }
    }
  },
);

organizationsRouter.put(
  '/:id',
  requireRole('admin'),
  validateBody(updateOrganizationSchema),
  async (req, res, next) => {
    try {
      if (req.body.inn) {
        const [existing] = await db
          .select()
          .from(schema.organizations)
          .where(
            and(
              eq(schema.organizations.inn, req.body.inn),
              sql`${schema.organizations.id} != ${+req.params.id}`,
            ),
          )
          .limit(1);

        if (existing) {
          throw new AppError(409, 'Organization with this INN already exists');
        }
      }

      const [org] = await db
        .update(schema.organizations)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(schema.organizations.id, +req.params.id))
        .returning();

      if (!org) throw new AppError(404, 'Organization not found');

      notifyReindex('organization', org.id);
      await auditLog({
        entityType: 'organization',
        entityId: org.id,
        employeeId: getEmployeeId(req)!,
        action: 'update',
        changes: { ...req.body },
      });

      res.json(org);
    } catch (e) {
      if (e && typeof e === 'object' && 'code' in e && e.code === '23505') {
        next(new AppError(409, 'Organization with this INN already exists'));
      } else {
        next(e instanceof Error ? e : new Error(String(e)));
      }
    }
  },
);

organizationsRouter.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const [linkedSubs] = await db
      .select()
      .from(schema.subcontractors)
      .where(eq(schema.subcontractors.organizationId, +req.params.id))
      .limit(1);

    if (linkedSubs) {
      throw new AppError(
        409,
        'Cannot delete organization with linked subcontractors',
      );
    }

    const [deleted] = await db
      .delete(schema.organizations)
      .where(eq(schema.organizations.id, +req.params.id))
      .returning();

    if (!deleted) throw new AppError(404, 'Organization not found');

    notifyReindex('organization', deleted.id);
    await auditLog({
      entityType: 'organization',
      entityId: deleted.id,
      employeeId: getEmployeeId(req)!,
      action: 'delete',
    });

    res.json({ message: 'Deleted' });
  } catch (e) {
    next(e);
  }
});