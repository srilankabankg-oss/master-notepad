import { Router } from 'express';
import { z } from 'zod';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { validateBody } from '../middleware/validation.js';
import { AppError } from '../middleware/error-handler.js';
import { notifyReindex } from '../ai-reindex.js';
import { requireAuth, getEmployeeId } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';

export const commentsRouter = Router();

commentsRouter.use(requireAuth);

const createCommentSchema = z.object({
  subcontractorId: z.number().int().positive(),
  content: z.string().min(1),
});

const updateCommentSchema = z.object({
  content: z.string().min(1),
});

commentsRouter.get('/', async (req, res, next) => {
  try {
    const subcontractorId = req.query.subcontractorId ? +req.query.subcontractorId : undefined;
    const result = await (subcontractorId
      ? db.select().from(schema.comments).where(eq(schema.comments.subcontractorId, subcontractorId))
      : db.select().from(schema.comments));
    res.json(result);
  } catch (e) { next(e); }
});

commentsRouter.get('/:id', async (req, res, next) => {
  try {
    const result = await db.select().from(schema.comments).where(eq(schema.comments.id, +req.params.id)).limit(1);
    if (!result.length) throw new AppError(404, 'Comment not found');
    res.json(result[0]);
  } catch (e) { next(e); }
});

commentsRouter.post('/', validateBody(createCommentSchema), async (req, res, next) => {
  try {
    const employeeId = getEmployeeId(req);
    const [comment] = await db.insert(schema.comments).values({ ...req.body, employeeId }).returning();
    notifyReindex('comment', comment.id);
    await auditLog({ entityType: 'comment', entityId: comment.id, employeeId: getEmployeeId(req)!, action: 'create', changes: { ...req.body } });
    res.status(201).json(comment);
  } catch (e) { next(e); }
});

commentsRouter.put('/:id', validateBody(updateCommentSchema), async (req, res, next) => {
  try {
    const [comment] = await db.update(schema.comments)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(schema.comments.id, +req.params.id))
      .returning();
    if (!comment) throw new AppError(404, 'Comment not found');
    notifyReindex('comment', comment.id);
    await auditLog({ entityType: 'comment', entityId: comment.id, employeeId: getEmployeeId(req)!, action: 'update', changes: { ...req.body } });
    res.json(comment);
  } catch (e) { next(e); }
});

commentsRouter.delete('/:id', async (req, res, next) => {
  try {
    const [deleted] = await db.delete(schema.comments).where(eq(schema.comments.id, +req.params.id)).returning();
    if (!deleted) throw new AppError(404, 'Comment not found');
    notifyReindex('comment', deleted.id);
    await auditLog({ entityType: 'comment', entityId: deleted.id, employeeId: getEmployeeId(req)!, action: 'delete' });
    res.json({ message: 'Deleted' });
  } catch (e) { next(e); }
});
