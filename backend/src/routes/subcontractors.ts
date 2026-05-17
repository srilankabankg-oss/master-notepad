import { Router } from 'express';
import { z } from 'zod';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { validateBody } from '../middleware/validation.js';
import { AppError } from '../middleware/error-handler.js';
import { calculateWeightedRating } from '../utils/rating.js';

export const subcontractorsRouter = Router();

const createSubcontractorSchema = z.object({
  name: z.string().min(1).max(255),
  companyName: z.string().max(255).optional(),
  contactInfo: z.string().optional(),
  specialization: z.string().max(500).optional(),
  description: z.string().optional(),
});

const updateSubcontractorSchema = createSubcontractorSchema.partial();

subcontractorsRouter.get('/', async (_req, res, next) => {
  try {
    const subcontractors = await db.select().from(schema.subcontractors);
    const results = await Promise.all(
      subcontractors.map(async (sub) => {
        const [reviews, events] = await Promise.all([
          db.select({ rating: schema.reviews.rating }).from(schema.reviews).where(eq(schema.reviews.subcontractorId, sub.id)),
          db.select({ type: schema.contractorEvents.type }).from(schema.contractorEvents).where(eq(schema.contractorEvents.subcontractorId, sub.id)),
        ]);
        const rating = calculateWeightedRating(reviews, events.map((e) => e.type));
        return { ...sub, rating };
      })
    );
    res.json(results);
  } catch (e) { next(e); }
});

subcontractorsRouter.get('/:id', async (req, res, next) => {
  try {
    const result = await db.select().from(schema.subcontractors).where(eq(schema.subcontractors.id, +req.params.id)).limit(1);
    if (!result.length) throw new AppError(404, 'Subcontractor not found');

    const [reviews, events] = await Promise.all([
      db.select({ rating: schema.reviews.rating }).from(schema.reviews).where(eq(schema.reviews.subcontractorId, +req.params.id)),
      db.select({ type: schema.contractorEvents.type }).from(schema.contractorEvents).where(eq(schema.contractorEvents.subcontractorId, +req.params.id)),
    ]);
    const rating = calculateWeightedRating(reviews, events.map((e) => e.type));

    res.json({ ...result[0], rating });
  } catch (e) { next(e); }
});

subcontractorsRouter.post('/', validateBody(createSubcontractorSchema), async (req, res, next) => {
  try {
    const [sub] = await db.insert(schema.subcontractors).values(req.body).returning();
    res.status(201).json(sub);
  } catch (e) { next(e); }
});

subcontractorsRouter.put('/:id', validateBody(updateSubcontractorSchema), async (req, res, next) => {
  try {
    const [sub] = await db.update(schema.subcontractors)
      .set(req.body)
      .where(eq(schema.subcontractors.id, +req.params.id))
      .returning();
    if (!sub) throw new AppError(404, 'Subcontractor not found');
    res.json(sub);
  } catch (e) { next(e); }
});

subcontractorsRouter.delete('/:id', async (req, res, next) => {
  try {
    const [deleted] = await db.delete(schema.subcontractors).where(eq(schema.subcontractors.id, +req.params.id)).returning();
    if (!deleted) throw new AppError(404, 'Subcontractor not found');
    res.json({ message: 'Deleted' });
  } catch (e) { next(e); }
});
