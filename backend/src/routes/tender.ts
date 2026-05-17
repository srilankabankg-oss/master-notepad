import { Router } from 'express';
import { db, schema } from '../db/index.js';
import { eq, count, and } from 'drizzle-orm';
import { AppError } from '../middleware/error-handler.js';

export const tenderRouter = Router();

tenderRouter.get('/:id/summary', async (req, res, next) => {
  try {
    const id = +req.params.id;

    const [subcontractor] = await db
      .select()
      .from(schema.subcontractors)
      .where(eq(schema.subcontractors.id, id))
      .limit(1);

    if (!subcontractor) throw new AppError(404, 'Subcontractor not found');

    const reviews = await db
      .select()
      .from(schema.reviews)
      .where(eq(schema.reviews.subcontractorId, id));

    const events = await db
      .select()
      .from(schema.contractorEvents)
      .where(eq(schema.contractorEvents.subcontractorId, id));

    const meetings = await db
      .select()
      .from(schema.meetingProtocols)
      .where(eq(schema.meetingProtocols.subcontractorId, id));

    const comments = await db
      .select()
      .from(schema.comments)
      .where(eq(schema.comments.subcontractorId, id));

    const [{ surveysCount }] = await db
      .select({ surveysCount: count() })
      .from(schema.surveys)
      .where(eq(schema.surveys.subcontractorId, id));

    const [{ violationsCount }] = await db
      .select({ violationsCount: count() })
      .from(schema.contractorEvents)
      .where(and(
        eq(schema.contractorEvents.subcontractorId, id),
        eq(schema.contractorEvents.type, 'violation'),
      ));

    res.json({
      subcontractor,
      rating: reviews.length
        ? +((reviews as any[]).reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
        : 0,
      reviews,
      events,
      meetings,
      comments,
      surveysCount,
      violationsCount,
    });
  } catch (e) { next(e); }
});
