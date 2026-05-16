import { Router } from 'express';
import { z } from 'zod';
import { db, schema } from '../db/index.js';
import { eq, and } from 'drizzle-orm';
import { validateBody } from '../middleware/validation.js';
import { AppError } from '../middleware/error-handler.js';

export const reviewsRouter = Router();

const createReviewSchema = z.object({
  subcontractorId: z.number().int().positive(),
  employeeId: z.number().int().positive(),
  content: z.string().min(1),
  rating: z.number().int().min(1).max(10),
});

const updateReviewSchema = z.object({
  content: z.string().min(1).optional(),
  rating: z.number().int().min(1).max(10).optional(),
});

reviewsRouter.get('/', async (req, res, next) => {
  try {
    const subcontractorId = req.query.subcontractorId ? +req.query.subcontractorId : undefined;
    const result = await (subcontractorId
      ? db.select().from(schema.reviews).where(eq(schema.reviews.subcontractorId, subcontractorId))
      : db.select().from(schema.reviews));
    res.json(result);
  } catch (e) { next(e); }
});

reviewsRouter.get('/:id', async (req, res, next) => {
  try {
    const result = await db.select().from(schema.reviews).where(eq(schema.reviews.id, +req.params.id)).limit(1);
    if (!result.length) throw new AppError(404, 'Review not found');
    res.json(result[0]);
  } catch (e) { next(e); }
});

reviewsRouter.post('/', validateBody(createReviewSchema), async (req, res, next) => {
  try {
    const [review] = await db.insert(schema.reviews).values(req.body).returning();
    res.status(201).json(review);
  } catch (e) { next(e); }
});

reviewsRouter.put('/:id', validateBody(updateReviewSchema), async (req, res, next) => {
  try {
    const [review] = await db.update(schema.reviews)
      .set(req.body)
      .where(eq(schema.reviews.id, +req.params.id))
      .returning();
    if (!review) throw new AppError(404, 'Review not found');
    res.json(review);
  } catch (e) { next(e); }
});

reviewsRouter.delete('/:id', async (req, res, next) => {
  try {
    const [deleted] = await db.delete(schema.reviews).where(eq(schema.reviews.id, +req.params.id)).returning();
    if (!deleted) throw new AppError(404, 'Review not found');
    res.json({ message: 'Deleted' });
  } catch (e) { next(e); }
});
