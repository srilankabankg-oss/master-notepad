import { Router } from 'express';
import { z } from 'zod';
import { db, schema } from '../db/index.js';
import { eq, and, like, sql, asc, desc, type SQL } from 'drizzle-orm';
import { validateBody } from '../middleware/validation.js';
import { AppError } from '../middleware/error-handler.js';
import { notifyReindex } from '../ai-reindex.js';
import { requireAuth, getEmployeeId } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';

export const tasksRouter = Router();
export const meetingTasksRouter = Router();

tasksRouter.use(requireAuth);
meetingTasksRouter.use(requireAuth);

export async function generateTaskNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const [result] = await db
    .select({
      max: sql<number>`COALESCE(MAX(CAST(SUBSTRING(task_number FROM 11 FOR 5) AS INTEGER)), 0)`,
    })
    .from(schema.tasks)
    .where(like(schema.tasks.taskNumber, `TASK-${year}-%`));
  const next = (result.max || 0) + 1;
  return `TASK-${year}-${String(next).padStart(5, '0')}`;
}

const createTaskSchema = z.object({
  protocolId: z.number().int().positive(),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  assigneeId: z.number().int().positive().nullable().optional(),
  controllerId: z.number().int().positive().nullable().optional(),
  parentTaskId: z.number().int().positive().nullable().optional(),
  topicTag: z.string().optional(),
  subcontractorId: z.number().int().positive().nullable().optional(),
  deadline: z.string().datetime().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  assigneeId: z.number().int().positive().nullable().optional(),
  controllerId: z.number().int().positive().nullable().optional(),
  status: z.enum(['created', 'in_progress', 'done', 'archived']).optional(),
  resolutionText: z.string().optional(),
  topicTag: z.string().optional(),
  subcontractorId: z.number().int().positive().nullable().optional(),
  deadline: z.string().datetime().nullable().optional(),
});

const moveTaskSchema = z.object({
  targetProtocolId: z.number().int().positive(),
  reason: z.string().optional(),
});

const reorderTaskSchema = z.object({
  sortOrder: z.number().int().min(0),
});

const createSubtaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  assigneeId: z.number().int().positive().nullable().optional(),
});

tasksRouter.get('/', async (req, res, next) => {
  try {
    const protocolId = req.query.protocolId ? +req.query.protocolId : undefined;
    const assigneeId = req.query.assigneeId ? +req.query.assigneeId : undefined;
    const controllerId = req.query.controllerId ? +req.query.controllerId : undefined;
    const status = req.query.status as string | undefined;

    const conditions: SQL[] = [];

    if (protocolId) conditions.push(eq(schema.tasks.protocolId, protocolId));
    if (assigneeId) conditions.push(eq(schema.tasks.assigneeId, assigneeId));
    if (controllerId) conditions.push(eq(schema.tasks.controllerId, controllerId));
    if (status && ['created', 'in_progress', 'done', 'archived'].includes(status)) {
      conditions.push(
        eq(schema.tasks.status, status as 'created' | 'in_progress' | 'done' | 'archived'),
      );
    }

    const result = await (conditions.length > 0
      ? db.select().from(schema.tasks).where(and(...conditions))
          .orderBy(asc(schema.tasks.sortOrder), asc(schema.tasks.id))
      : db.select().from(schema.tasks)
          .orderBy(asc(schema.tasks.sortOrder), asc(schema.tasks.id)));

    res.json(result);
  } catch (e) { next(e); }
});

tasksRouter.get('/:id', async (req, res, next) => {
  try {
    const [task] = await db.select().from(schema.tasks)
      .where(eq(schema.tasks.id, +req.params.id)).limit(1);

    if (!task) throw new AppError(404, 'Task not found');

    const [links, subtasks, reformulations] = await Promise.all([
      db.select().from(schema.protocolTaskLinks)
        .where(eq(schema.protocolTaskLinks.taskId, task.id)),
      db.select().from(schema.tasks)
        .where(eq(schema.tasks.parentTaskId, task.id))
        .orderBy(asc(schema.tasks.sortOrder), asc(schema.tasks.id)),
      db.select().from(schema.taskReformulations)
        .where(eq(schema.taskReformulations.taskId, task.id))
        .orderBy(desc(schema.taskReformulations.createdAt)),
    ]);

    res.json({ ...task, links, subtasks, reformulations });
  } catch (e) { next(e); }
});

tasksRouter.post('/', validateBody(createTaskSchema), async (req, res, next) => {
  try {
    const taskNumber = await generateTaskNumber();

    const [task] = await db.insert(schema.tasks).values({
      ...req.body,
      taskNumber,
      deadline: req.body.deadline ? new Date(req.body.deadline) : undefined,
    }).returning();

    await db.insert(schema.protocolTaskLinks).values({
      taskId: task.id,
      protocolId: req.body.protocolId,
      role: 'home',
      sortOrder: task.sortOrder,
      createdBy: getEmployeeId(req),
    });

    notifyReindex('task', task.id);
    await auditLog({
      entityType: 'task',
      entityId: task.id,
      employeeId: getEmployeeId(req)!,
      action: 'create',
      changes: { ...req.body, taskNumber },
    });

    res.status(201).json(task);
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && e.code === '23505') {
      next(new AppError(409, 'Task number already exists'));
    } else {
      next(e instanceof Error ? e : new Error(String(e)));
    }
  }
});

tasksRouter.put('/:id', validateBody(updateTaskSchema), async (req, res, next) => {
  try {
    if (req.body.status === 'done' && !req.body.resolutionText) {
      throw new AppError(400, 'resolution_text is required when status is done');
    }

    const data: Record<string, unknown> = { ...req.body };
    if (req.body.status === 'done' && req.body.resolutionText) {
      data.resolvedAt = new Date();
    }
    if (data.deadline && typeof data.deadline === 'string') {
      data.deadline = new Date(data.deadline);
    }

    const [task] = await db.update(schema.tasks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.tasks.id, +req.params.id))
      .returning();

    if (!task) throw new AppError(404, 'Task not found');

    notifyReindex('task', task.id);
    await auditLog({
      entityType: 'task',
      entityId: task.id,
      employeeId: getEmployeeId(req)!,
      action: 'update',
      changes: { ...req.body },
    });

    res.json(task);
  } catch (e) {
    if (e instanceof AppError) { next(e); }
    else { next(e instanceof Error ? e : new Error(String(e))); }
  }
});

tasksRouter.delete('/:id', async (req, res, next) => {
  try {
    const [existing] = await db.select({ status: schema.tasks.status })
      .from(schema.tasks)
      .where(eq(schema.tasks.id, +req.params.id))
      .limit(1);

    if (!existing) throw new AppError(404, 'Task not found');
    if (existing.status !== 'created') {
      throw new AppError(422, 'Only tasks with status "created" can be deleted');
    }

    const [deleted] = await db.delete(schema.tasks)
      .where(eq(schema.tasks.id, +req.params.id))
      .returning();

    if (!deleted) throw new AppError(404, 'Task not found');

    notifyReindex('task', deleted.id);
    await auditLog({
      entityType: 'task',
      entityId: deleted.id,
      employeeId: getEmployeeId(req)!,
      action: 'delete',
    });

    res.json({ message: 'Deleted' });
  } catch (e) {
    if (e instanceof AppError) { next(e); }
    else { next(e instanceof Error ? e : new Error(String(e))); }
  }
});

tasksRouter.post('/:id/move', validateBody(moveTaskSchema), async (req, res, next) => {
  try {
    const { targetProtocolId } = req.body;
    const taskId = +req.params.id;

    const [task] = await db.select().from(schema.tasks)
      .where(eq(schema.tasks.id, taskId)).limit(1);
    if (!task) throw new AppError(404, 'Task not found');

    const [targetProtocol] = await db.select().from(schema.meetingProtocols)
      .where(eq(schema.meetingProtocols.id, targetProtocolId)).limit(1);
    if (!targetProtocol) throw new AppError(404, 'Target protocol not found');

    const [existingLink] = await db.select().from(schema.protocolTaskLinks)
      .where(and(
        eq(schema.protocolTaskLinks.taskId, taskId),
        eq(schema.protocolTaskLinks.protocolId, targetProtocolId),
      )).limit(1);

    if (existingLink) {
      throw new AppError(409, 'Task already delegated to this protocol');
    }

    await db.insert(schema.protocolTaskLinks).values({
      taskId,
      protocolId: targetProtocolId,
      role: 'delegated',
      sourceProtocolId: task.protocolId,
      sortOrder: 0,
      createdBy: getEmployeeId(req),
    });

    const [updated] = await db.update(schema.tasks)
      .set({ sourceProtocolId: task.protocolId, updatedAt: new Date() })
      .where(eq(schema.tasks.id, taskId))
      .returning();

    notifyReindex('task', taskId);
    await auditLog({
      entityType: 'task',
      entityId: taskId,
      employeeId: getEmployeeId(req)!,
      action: 'update',
      changes: { action: 'move', targetProtocolId, reason: req.body.reason },
    });

    res.json(updated);
  } catch (e) { next(e); }
});

tasksRouter.post('/:id/return', async (req, res, next) => {
  try {
    const taskId = +req.params.id;
    const [task] = await db.select().from(schema.tasks)
      .where(eq(schema.tasks.id, taskId)).limit(1);
    if (!task) throw new AppError(404, 'Task not found');

    await db.delete(schema.protocolTaskLinks)
      .where(and(
        eq(schema.protocolTaskLinks.taskId, taskId),
        eq(schema.protocolTaskLinks.role, 'delegated'),
      ));

    const [updated] = await db.update(schema.tasks)
      .set({ sourceProtocolId: null, updatedAt: new Date() })
      .where(eq(schema.tasks.id, taskId)).returning();

    notifyReindex('task', taskId);
    await auditLog({
      entityType: 'task', entityId: taskId,
      employeeId: getEmployeeId(req)!, action: 'update',
      changes: { action: 'return_to_home' },
    });

    res.json(updated);
  } catch (e) { next(e); }
});

tasksRouter.post('/:id/reorder', validateBody(reorderTaskSchema), async (req, res, next) => {
  try {
    const [task] = await db.update(schema.tasks)
      .set({ sortOrder: req.body.sortOrder, updatedAt: new Date() })
      .where(eq(schema.tasks.id, +req.params.id)).returning();

    if (!task) throw new AppError(404, 'Task not found');

    await auditLog({
      entityType: 'task', entityId: task.id,
      employeeId: getEmployeeId(req)!, action: 'update',
      changes: { action: 'reorder', sortOrder: req.body.sortOrder },
    });

    res.json(task);
  } catch (e) { next(e); }
});

tasksRouter.get('/:id/subtasks', async (req, res, next) => {
  try {
    const subtasks = await db.select().from(schema.tasks)
      .where(eq(schema.tasks.parentTaskId, +req.params.id))
      .orderBy(asc(schema.tasks.sortOrder), asc(schema.tasks.id));
    res.json(subtasks);
  } catch (e) { next(e); }
});

tasksRouter.post('/:id/subtasks', validateBody(createSubtaskSchema), async (req, res, next) => {
  try {
    const parentId = +req.params.id;
    const [parent] = await db.select().from(schema.tasks)
      .where(eq(schema.tasks.id, parentId)).limit(1);
    if (!parent) throw new AppError(404, 'Parent task not found');

    const taskNumber = await generateTaskNumber();
    const [subtask] = await db.insert(schema.tasks)
      .values({ ...req.body, protocolId: parent.protocolId, parentTaskId: parentId, taskNumber })
      .returning();

    await db.insert(schema.protocolTaskLinks).values({
      taskId: subtask.id, protocolId: parent.protocolId,
      role: 'home', sortOrder: subtask.sortOrder, createdBy: getEmployeeId(req),
    });

    notifyReindex('task', subtask.id);
    await auditLog({
      entityType: 'task', entityId: subtask.id,
      employeeId: getEmployeeId(req)!, action: 'create',
      changes: { ...req.body, parentTaskId: parentId, taskNumber },
    });

    res.status(201).json(subtask);
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && e.code === '23505') {
      next(new AppError(409, 'Task number already exists'));
    } else { next(e instanceof Error ? e : new Error(String(e))); }
  }
});

tasksRouter.get('/:id/links', async (req, res, next) => {
  try {
    const links = await db.select().from(schema.protocolTaskLinks)
      .where(eq(schema.protocolTaskLinks.taskId, +req.params.id))
      .orderBy(asc(schema.protocolTaskLinks.createdAt));
    res.json(links);
  } catch (e) { next(e); }
});

tasksRouter.get('/:id/reformulations', async (req, res, next) => {
  try {
    const reformulations = await db.select().from(schema.taskReformulations)
      .where(eq(schema.taskReformulations.taskId, +req.params.id))
      .orderBy(desc(schema.taskReformulations.createdAt));
    res.json(reformulations);
  } catch (e) { next(e); }
});

meetingTasksRouter.get('/:id/tasks', async (req, res, next) => {
  try {
    const meetingId = +req.params.id;
    const tasks = await db.select().from(schema.tasks)
      .where(eq(schema.tasks.protocolId, meetingId))
      .orderBy(asc(schema.tasks.sortOrder), asc(schema.tasks.id));
    res.json(tasks);
  } catch (e) { next(e); }
});