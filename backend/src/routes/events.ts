import { Router } from 'express';
import { z } from 'zod';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { validateBody } from '../middleware/validation.js';
import { AppError } from '../middleware/error-handler.js';
import { notifyReindex } from '../ai-reindex.js';
import { requireAuth, getEmployeeId } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';

export const eventsRouter = Router();

eventsRouter.use(requireAuth);

const createEventSchema = z.object({
  subcontractorId: z.number().int().positive(),
  type: z.enum(['positive', 'violation', 'info']),
  description: z.string().min(1),
  eventDate: z.string().datetime(),
});

const updateEventSchema = z.object({
  subcontractorId: z.number().int().positive().optional(),
  type: z.enum(['positive', 'violation', 'info']).optional(),
  description: z.string().min(1).optional(),
  eventDate: z.string().datetime().optional(),
});

const suggestSchema = z.object({
  checklistId: z.number().int().positive(),
});

eventsRouter.get('/', async (req, res, next) => {
  try {
    const subcontractorId = req.query.subcontractorId ? +req.query.subcontractorId : undefined;
    const result = await (subcontractorId
      ? db.select().from(schema.contractorEvents).where(eq(schema.contractorEvents.subcontractorId, subcontractorId))
      : db.select().from(schema.contractorEvents));
    res.json(result);
  } catch (e) { next(e); }
});

eventsRouter.get('/:id', async (req, res, next) => {
  try {
    const result = await db.select().from(schema.contractorEvents).where(eq(schema.contractorEvents.id, +req.params.id)).limit(1);
    if (!result.length) throw new AppError(404, 'Event not found');
    res.json(result[0]);
  } catch (e) { next(e); }
});

eventsRouter.post('/', validateBody(createEventSchema), async (req, res, next) => {
  try {
    const employeeId = getEmployeeId(req)!;
    const [event] = await db.insert(schema.contractorEvents).values({
      ...req.body,
      employeeId,
      eventDate: new Date(req.body.eventDate),
    }).returning();
    notifyReindex('event', event.id);
    await auditLog({ entityType: 'event', entityId: event.id, employeeId: getEmployeeId(req)!, action: 'create', changes: { ...req.body } });
    res.status(201).json(event);
  } catch (e) { next(e); }
});

eventsRouter.put('/:id', validateBody(updateEventSchema), async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (data.eventDate) data.eventDate = new Date(data.eventDate);
    const [event] = await db.update(schema.contractorEvents)
      .set(data)
      .where(eq(schema.contractorEvents.id, +req.params.id))
      .returning();
    if (!event) throw new AppError(404, 'Event not found');
    notifyReindex('event', event.id);
    await auditLog({ entityType: 'event', entityId: event.id, employeeId: getEmployeeId(req)!, action: 'update', changes: { ...req.body } });
    res.json(event);
  } catch (e) { next(e); }
});

eventsRouter.delete('/:id', async (req, res, next) => {
  try {
    const [deleted] = await db.delete(schema.contractorEvents).where(eq(schema.contractorEvents.id, +req.params.id)).returning();
    if (!deleted) throw new AppError(404, 'Event not found');
    notifyReindex('event', deleted.id);
    await auditLog({ entityType: 'event', entityId: deleted.id, employeeId: getEmployeeId(req)!, action: 'delete' });
    res.json({ message: 'Deleted' });
  } catch (e) { next(e); }
});

eventsRouter.post('/:id/suggest', validateBody(suggestSchema), async (req, res, next) => {
  try {
    const eventResult = await db.select().from(schema.contractorEvents).where(eq(schema.contractorEvents.id, +req.params.id)).limit(1);
    if (!eventResult.length) throw new AppError(404, 'Event not found');

    const [suggestion] = await db.insert(schema.checklistSuggestions).values({
      checklistId: req.body.checklistId,
      employeeId: getEmployeeId(req)!,
      suggestion: eventResult[0].description,
    }).returning();
    await auditLog({ entityType: 'suggestion', entityId: suggestion.id, employeeId: getEmployeeId(req)!, action: 'create', changes: { checklistId: req.body.checklistId, fromEventId: +req.params.id } });
    res.status(201).json(suggestion);
  } catch (e) { next(e); }
});
