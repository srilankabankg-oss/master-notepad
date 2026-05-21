import { Router } from 'express';
import { z } from 'zod';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { validateBody } from '../middleware/validation.js';
import { AppError } from '../middleware/error-handler.js';
import { notifyReindex } from '../ai-reindex.js';
import { requireAuth, getEmployeeId } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';

export const meetingsRouter = Router();

meetingsRouter.use(requireAuth);

const createMeetingSchema = z.object({
  title: z.string().min(1).max(500),
  date: z.string().datetime(),
  subcontractorId: z.number().int().positive().nullable().optional(),
  attendees: z.array(z.string()).default([]),
  agenda: z.string().min(1),
  decisions: z.string().optional(),
  notes: z.string().optional(),
});

const updateMeetingSchema = createMeetingSchema.partial();

meetingsRouter.get('/', async (req, res, next) => {
  try {
    const subcontractorId = req.query.subcontractorId ? +req.query.subcontractorId : undefined;
    const result = await (subcontractorId
      ? db.select().from(schema.meetingProtocols).where(eq(schema.meetingProtocols.subcontractorId, subcontractorId))
      : db.select().from(schema.meetingProtocols));
    res.json(result);
  } catch (e) { next(e); }
});

meetingsRouter.get('/:id', async (req, res, next) => {
  try {
    const result = await db.select().from(schema.meetingProtocols).where(eq(schema.meetingProtocols.id, +req.params.id)).limit(1);
    if (!result.length) throw new AppError(404, 'Meeting protocol not found');
    res.json(result[0]);
  } catch (e) { next(e); }
});

meetingsRouter.post('/', validateBody(createMeetingSchema), async (req, res, next) => {
  try {
    const [meeting] = await db.insert(schema.meetingProtocols).values({
      ...req.body,
      date: new Date(req.body.date),
    }).returning();
    notifyReindex('meeting', meeting.id);
    await auditLog({ entityType: 'meeting', entityId: meeting.id, employeeId: getEmployeeId(req)!, action: 'create', changes: { ...req.body } });
    res.status(201).json(meeting);
  } catch (e) { next(e); }
});

meetingsRouter.put('/:id', validateBody(updateMeetingSchema), async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (data.date) data.date = new Date(data.date);
    const [meeting] = await db.update(schema.meetingProtocols)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.meetingProtocols.id, +req.params.id))
      .returning();
    if (!meeting) throw new AppError(404, 'Meeting protocol not found');
    notifyReindex('meeting', meeting.id);
    await auditLog({ entityType: 'meeting', entityId: meeting.id, employeeId: getEmployeeId(req)!, action: 'update', changes: { ...req.body } });
    res.json(meeting);
  } catch (e) { next(e); }
});

meetingsRouter.delete('/:id', async (req, res, next) => {
  try {
    const [deleted] = await db.delete(schema.meetingProtocols).where(eq(schema.meetingProtocols.id, +req.params.id)).returning();
    if (!deleted) throw new AppError(404, 'Meeting protocol not found');
    notifyReindex('meeting', deleted.id);
    await auditLog({ entityType: 'meeting', entityId: deleted.id, employeeId: getEmployeeId(req)!, action: 'delete' });
    res.json({ message: 'Deleted' });
  } catch (e) { next(e); }
});
