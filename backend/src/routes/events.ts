import { Router } from 'express';
import { z } from 'zod';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { validateBody } from '../middleware/validation.js';
import { AppError } from '../middleware/error-handler.js';

export const eventsRouter = Router();

const createEventSchema = z.object({
  subcontractorId: z.number().int().positive(),
  employeeId: z.number().int().positive(),
  type: z.enum(['positive', 'violation', 'info']),
  description: z.string().min(1),
  eventDate: z.string().datetime(),
});

const updateEventSchema = z.object({
  subcontractorId: z.number().int().positive().optional(),
  employeeId: z.number().int().positive().optional(),
  type: z.enum(['positive', 'violation', 'info']).optional(),
  description: z.string().min(1).optional(),
  eventDate: z.string().datetime().optional(),
});

const suggestSchema = z.object({
  checklistId: z.number().int().positive(),
  employeeId: z.number().int().positive(),
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
    const [event] = await db.insert(schema.contractorEvents).values({
      ...req.body,
      eventDate: new Date(req.body.eventDate),
    }).returning();
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
    res.json(event);
  } catch (e) { next(e); }
});

eventsRouter.delete('/:id', async (req, res, next) => {
  try {
    const [deleted] = await db.delete(schema.contractorEvents).where(eq(schema.contractorEvents.id, +req.params.id)).returning();
    if (!deleted) throw new AppError(404, 'Event not found');
    res.json({ message: 'Deleted' });
  } catch (e) { next(e); }
});

eventsRouter.post('/:id/suggest', validateBody(suggestSchema), async (req, res, next) => {
  try {
    const eventResult = await db.select().from(schema.contractorEvents).where(eq(schema.contractorEvents.id, +req.params.id)).limit(1);
    if (!eventResult.length) throw new AppError(404, 'Event not found');

    const [suggestion] = await db.insert(schema.checklistSuggestions).values({
      checklistId: req.body.checklistId,
      employeeId: req.body.employeeId,
      suggestion: eventResult[0].description,
    }).returning();
    res.status(201).json(suggestion);
  } catch (e) { next(e); }
});
