import { Router } from 'express';
import { z } from 'zod';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { validateBody } from '../middleware/validation.js';
import { AppError } from '../middleware/error-handler.js';
import { requireAuth, getEmployeeId } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';

export const employeesRouter = Router();

employeesRouter.use(requireAuth);

const createEmployeeSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  position: z.string().max(255).optional(),
});

const updateEmployeeSchema = createEmployeeSchema.partial();


employeesRouter.get('/', async (_req, res, next) => {
  try {
    const result = await db.select().from(schema.employees);
    res.json(result);
  } catch (e) { next(e); }
});


employeesRouter.get('/:id', async (req, res, next) => {
  try {
    const result = await db.select().from(schema.employees).where(eq(schema.employees.id, +req.params.id)).limit(1);
    if (!result.length) throw new AppError(404, 'Employee not found');
    res.json(result[0]);
  } catch (e) { next(e); }
});


employeesRouter.post('/', validateBody(createEmployeeSchema), async (req, res, next) => {
  try {
    const [employee] = await db.insert(schema.employees).values(req.body).returning();
    await auditLog({ entityType: 'employee', entityId: employee.id, employeeId: getEmployeeId(req)!, action: 'create', changes: { ...req.body } });
    res.status(201).json(employee);
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && e.code === '23505') next(new AppError(409, 'Email already exists'));
    else next(e instanceof Error ? e : new Error(String(e)));
  }
});


employeesRouter.put('/:id', validateBody(updateEmployeeSchema), async (req, res, next) => {
  try {
    const [employee] = await db.update(schema.employees)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(schema.employees.id, +req.params.id))
      .returning();
if (!employee) throw new AppError(404, 'Employee not found');
    await auditLog({ entityType: 'employee', entityId: employee.id, employeeId: getEmployeeId(req)!, action: 'update', changes: { ...req.body } });
    res.json(employee);
  } catch (e) { next(e); }
});

employeesRouter.delete('/:id', async (req, res, next) => {
  try {
    const [deleted] = await db.delete(schema.employees).where(eq(schema.employees.id, +req.params.id)).returning();
    if (!deleted) throw new AppError(404, 'Employee not found');
    await auditLog({ entityType: 'employee', entityId: deleted.id, employeeId: getEmployeeId(req)!, action: 'delete' });
    res.json({ message: 'Deleted' });
  } catch (e) { next(e); }
});
