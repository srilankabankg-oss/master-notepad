import { Router } from 'express';
import { z } from 'zod';
import { db, schema } from '../db/index.js';
import { eq, and } from 'drizzle-orm';
import { validateBody } from '../middleware/validation.js';
import { AppError } from '../middleware/error-handler.js';

export const checklistsRouter = Router();

const checklistItemSchema = z.object({ text: z.string().min(1), completed: z.boolean().default(false) });

const createChecklistSchema = z.object({
  title: z.string().min(1).max(500),
  type: z.enum(['organization', 'personal']).default('organization'),
  ownerId: z.number().int().positive().nullable().optional(),
  items: z.array(checklistItemSchema).default([]),
});

const updateChecklistSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  items: z.array(checklistItemSchema).optional(),
});

checklistsRouter.get('/', async (req, res, next) => {
  try {
    const type = req.query.type as string | undefined;
    const ownerId = req.query.ownerId ? +req.query.ownerId : undefined;

    const conditions: ReturnType<typeof eq>[] = [];

    if (type === 'organization' || type === 'personal') {
      conditions.push(eq(schema.checklists.type, type));
    }
    if (ownerId) {
      conditions.push(eq(schema.checklists.ownerId, ownerId));
    }

    if (conditions.length > 0) {
      const result = await db.select().from(schema.checklists).where(and(...conditions));
      res.json(result);
      return;
    }

    const result = await db.select().from(schema.checklists);
    res.json(result);
  } catch (e) { next(e); }
});

checklistsRouter.get('/:id', async (req, res, next) => {
  try {
    const result = await db.select().from(schema.checklists).where(eq(schema.checklists.id, +req.params.id)).limit(1);
    if (!result.length) throw new AppError(404, 'Checklist not found');
    res.json(result[0]);
  } catch (e) { next(e); }
});

checklistsRouter.post('/', validateBody(createChecklistSchema), async (req, res, next) => {
  try {
    const [checklist] = await db.insert(schema.checklists).values(req.body).returning();
    res.status(201).json(checklist);
  } catch (e) { next(e); }
});

checklistsRouter.put('/:id', validateBody(updateChecklistSchema), async (req, res, next) => {
  try {
    const [checklist] = await db.update(schema.checklists)
      .set(req.body)
      .where(eq(schema.checklists.id, +req.params.id))
      .returning();
    if (!checklist) throw new AppError(404, 'Checklist not found');
    res.json(checklist);
  } catch (e) { next(e); }
});

checklistsRouter.delete('/:id', async (req, res, next) => {
  try {
    const [deleted] = await db.delete(schema.checklists).where(eq(schema.checklists.id, +req.params.id)).returning();
    if (!deleted) throw new AppError(404, 'Checklist not found');
    res.json({ message: 'Deleted' });
  } catch (e) { next(e); }
});
