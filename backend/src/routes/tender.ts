import { Router } from 'express';
import { db, schema } from '../db/index.js';
import { eq, count, and } from 'drizzle-orm';
import { AppError } from '../middleware/error-handler.js';
import { calculateWeightedRating } from '../utils/rating.js';
import { requireAuth } from '../middleware/auth.js';

export const tenderRouter = Router();

tenderRouter.use(requireAuth);

tenderRouter.get('/:id/summary', async (req, res, next) => {
  try {
    const id = +req.params.id;

    const [subcontractor] = await db
      .select()
      .from(schema.subcontractors)
      .where(eq(schema.subcontractors.id, id))
      .limit(1);

    if (!subcontractor) throw new AppError(404, 'Subcontractor not found');

    const [
      reviews,
      events,
      meetings,
      comments,
      [{ surveysCount }],
      [{ violationsCount }],
    ] = await Promise.all([
      db.select().from(schema.reviews).where(eq(schema.reviews.subcontractorId, id)),
      db.select().from(schema.contractorEvents).where(eq(schema.contractorEvents.subcontractorId, id)),
      db.select().from(schema.meetingProtocols).where(eq(schema.meetingProtocols.subcontractorId, id)),
      db.select().from(schema.comments).where(eq(schema.comments.subcontractorId, id)),
      db.select({ surveysCount: count() }).from(schema.surveys).where(eq(schema.surveys.subcontractorId, id)),
      db.select({ violationsCount: count() })
        .from(schema.contractorEvents)
        .where(and(
          eq(schema.contractorEvents.subcontractorId, id),
          eq(schema.contractorEvents.type, 'violation'),
        )),
    ]);

    const rating = calculateWeightedRating(
      reviews,
      events.map((e) => e.type),
    );

    res.json({
      subcontractor,
      rating,
      reviews,
      events,
      meetings,
      comments,
      surveysCount,
      violationsCount,
    });
  } catch (e) { next(e); }
});
