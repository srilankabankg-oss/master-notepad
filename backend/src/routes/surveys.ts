import { Router } from 'express';
import { z } from 'zod';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { validateBody } from '../middleware/validation.js';
import { AppError } from '../middleware/error-handler.js';
import { notifyReindex } from '../ai-reindex.js';

export const surveysRouter = Router();

const defaultQuestions = [
  'Оцените качество работ подрядчика',
  'Оцените соблюдение сроков',
  'Оцените коммуникацию с подрядчиком',
  'Общие впечатления о работе',
  'Рекомендации и пожелания',
];

const createSurveySchema = z.object({
  title: z.string().min(1).max(500),
  subcontractorId: z.number().int().positive(),
  createdBy: z.number().int().positive(),
  questions: z.array(z.string()).default(defaultQuestions),
});

const updateSurveySchema = createSurveySchema.partial();

surveysRouter.get('/', async (req, res, next) => {
  try {
    const subcontractorId = req.query.subcontractorId ? +req.query.subcontractorId : undefined;
    const result = await (subcontractorId
      ? db.select().from(schema.surveys).where(eq(schema.surveys.subcontractorId, subcontractorId))
      : db.select().from(schema.surveys));
    res.json(result);
  } catch (e) { next(e); }
});

surveysRouter.get('/:id', async (req, res, next) => {
  try {
    const [survey] = await db.select().from(schema.surveys).where(eq(schema.surveys.id, +req.params.id)).limit(1);
    if (!survey) throw new AppError(404, 'Survey not found');

    const responses = await db.select().from(schema.surveyResponses)
      .where(eq(schema.surveyResponses.surveyId, +req.params.id));

    res.json({ ...survey, responses });
  } catch (e) { next(e); }
});

surveysRouter.post('/', validateBody(createSurveySchema), async (req, res, next) => {
  try {
    const [survey] = await db.insert(schema.surveys).values(req.body).returning();
    notifyReindex('survey', survey.id);
    res.status(201).json(survey);
  } catch (e) { next(e); }
});

surveysRouter.put('/:id', validateBody(updateSurveySchema), async (req, res, next) => {
  try {
    const [survey] = await db.update(schema.surveys)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(schema.surveys.id, +req.params.id))
      .returning();
    if (!survey) throw new AppError(404, 'Survey not found');
    notifyReindex('survey', survey.id);
    res.json(survey);
  } catch (e) { next(e); }
});

surveysRouter.post('/:id/respond', validateBody(z.object({
  employeeId: z.number().int().positive(),
  answers: z.record(z.string(), z.string()),
})), async (req, res, next) => {
  try {
    const [response] = await db.insert(schema.surveyResponses).values({
      surveyId: +req.params.id,
      employeeId: req.body.employeeId,
      answers: req.body.answers,
    }).returning();
    res.status(201).json(response);
  } catch (e) { next(e); }
});

surveysRouter.get('/:id/responses', async (req, res, next) => {
  try {
    const responses = await db.select().from(schema.surveyResponses)
      .where(eq(schema.surveyResponses.surveyId, +req.params.id));
    res.json(responses);
  } catch (e) { next(e); }
});

surveysRouter.delete('/:id', async (req, res, next) => {
  try {
    const [deleted] = await db.delete(schema.surveys).where(eq(schema.surveys.id, +req.params.id)).returning();
    if (!deleted) throw new AppError(404, 'Survey not found');
    notifyReindex('survey', deleted.id);
    res.json({ message: 'Deleted' });
  } catch (e) { next(e); }
});
