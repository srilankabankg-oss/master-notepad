import { Router } from 'express';
import { z } from 'zod';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { validateBody } from '../middleware/validation.js';
import { AppError } from '../middleware/error-handler.js';

export const suggestionsRouter = Router();

const createSuggestionSchema = z.object({
  checklistId: z.number().int().positive(),
  employeeId: z.number().int().positive(),
  suggestion: z.string().min(1),
});

const updateSuggestionSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']),
});

suggestionsRouter.get('/', async (req, res, next) => {
  try {
    const checklistId = req.query.checklistId ? +req.query.checklistId : undefined;
    const result = await (checklistId
      ? db.select().from(schema.checklistSuggestions).where(eq(schema.checklistSuggestions.checklistId, checklistId))
      : db.select().from(schema.checklistSuggestions));
    res.json(result);
  } catch (e) { next(e); }
});

suggestionsRouter.post('/', validateBody(createSuggestionSchema), async (req, res, next) => {
  try {
    const [suggestion] = await db.insert(schema.checklistSuggestions).values(req.body).returning();
    res.status(201).json(suggestion);
  } catch (e) { next(e); }
});

suggestionsRouter.get('/:id', async (req, res, next) => {
  try {
    const result = await db.select().from(schema.checklistSuggestions).where(eq(schema.checklistSuggestions.id, +req.params.id)).limit(1);
    if (!result.length) throw new AppError(404, 'Suggestion not found');
    res.json(result[0]);
  } catch (e) { next(e); }
});

suggestionsRouter.patch('/:id', validateBody(updateSuggestionSchema), async (req, res, next) => {
  try {
    const [suggestion] = await db.update(schema.checklistSuggestions)
      .set(req.body)
      .where(eq(schema.checklistSuggestions.id, +req.params.id))
      .returning();
    if (!suggestion) throw new AppError(404, 'Suggestion not found');
    res.json(suggestion);
  } catch (e) { next(e); }
});

suggestionsRouter.delete('/:id', async (req, res, next) => {
  try {
    const [deleted] = await db.delete(schema.checklistSuggestions).where(eq(schema.checklistSuggestions.id, +req.params.id)).returning();
    if (!deleted) throw new AppError(404, 'Suggestion not found');
    res.json({ message: 'Deleted' });
  } catch (e) { next(e); }
});
