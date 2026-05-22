import { Router } from 'express';
import { z } from 'zod';
import { db, schema } from '../db/index.js';
import { eq, and, sql } from 'drizzle-orm';
import { validateBody } from '../middleware/validation.js';
import { AppError } from '../middleware/error-handler.js';
import { notifyReindex } from '../ai-reindex.js';
import { requireAuth, getEmployeeId } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';
import { generateTaskNumber } from './tasks.js';
import crypto from 'crypto';

export const meetingsRouter = Router();

meetingsRouter.use(requireAuth);

// ── Task Requests ──

const createTaskRequestSchema = z.object({
  protocolId: z.number().int().positive(),
  title: z.string().min(1).max(500),
  description: z.string().optional().default(''),
});

const updateTaskRequestSchema = z.object({
  status: z.enum(['accepted', 'rejected']),
  reasonRejected: z.string().optional(),
});

meetingsRouter.get('/task-requests', async (req, res, next) => {
  try {
    const status = req.query.status as string | undefined;
    const result = status
      ? await db.select().from(schema.taskRequests).where(sql`${schema.taskRequests.status} = ${status}`)
      : await db.select().from(schema.taskRequests);
    res.json(result);
  } catch (e) { next(e); }
});

meetingsRouter.post('/task-requests', validateBody(createTaskRequestSchema), async (req, res, next) => {
  try {
    const employeeId = getEmployeeId(req);
    const [request] = await db.insert(schema.taskRequests).values({ ...req.body, employeeId }).returning();
    await auditLog({ entityType: 'task_request', entityId: request.id, employeeId: getEmployeeId(req)!, action: 'create', changes: { ...req.body } });
    res.status(201).json(request);
  } catch (e) { next(e); }
});

meetingsRouter.patch('/task-requests/:id', validateBody(updateTaskRequestSchema), async (req, res, next) => {
  try {
    const [request] = await db.select().from(schema.taskRequests)
      .where(eq(schema.taskRequests.id, +req.params.id)).limit(1);
    if (!request) throw new AppError(404, 'Task request not found');

    const data: Record<string, unknown> = { status: req.body.status, updatedAt: new Date() };
    const reviewerId = getEmployeeId(req);

    if (req.body.status === 'rejected') {
      data.reasonRejected = req.body.reasonRejected || null;
      data.reviewedBy = reviewerId;
      data.reviewedAt = new Date();
    }

    if (req.body.status === 'accepted') {
      const taskNumber = await generateTaskNumber();
      const [task] = await db.insert(schema.tasks).values({
        protocolId: request.protocolId,
        title: request.title,
        description: request.description,
        taskNumber,
      }).returning();

      await db.insert(schema.protocolTaskLinks).values({
        taskId: task.id,
        protocolId: request.protocolId,
        role: 'home',
        sortOrder: 0,
        createdBy: reviewerId,
      });

      data.resultingTaskId = task.id;
      data.reviewedBy = reviewerId;
      data.reviewedAt = new Date();

      notifyReindex('task', task.id);
      await auditLog({ entityType: 'task', entityId: task.id, employeeId: getEmployeeId(req)!, action: 'create', changes: { fromTaskRequest: request.id, taskNumber } });
    }

    const [updated] = await db.update(schema.taskRequests)
      .set(data)
      .where(eq(schema.taskRequests.id, +req.params.id))
      .returning();

    await auditLog({ entityType: 'task_request', entityId: updated.id, employeeId: getEmployeeId(req)!, action: 'update', changes: { ...req.body, resultingTaskId: updated.resultingTaskId } });
    res.json(updated);
  } catch (e) { next(e); }
});

// ── Meeting CRUD ──

const createMeetingSchema = z.object({
  title: z.string().min(1).max(500),
  date: z.string().datetime(),
  subcontractorId: z.number().int().positive().nullable().optional(),
  attendees: z.array(z.string()).default([]),
  agenda: z.string().min(1),
  decisions: z.string().optional(),
  notes: z.string().optional(),
  meetingType: z.enum(['strategic', 'coordination', 'operational', 'problem']).optional(),
  periodicity: z.enum(['one_time', 'recurring']).optional(),
  groupingMethod: z.enum(['by_topic', 'by_subcontractor']).optional(),
  operationalSubtype: z.enum(['subcontractor', 'designer', 'supplier', 'other']).optional(),
  parentProtocolId: z.number().int().positive().nullable().optional(),
  topics: z.array(z.string()).optional(),
});

const updateMeetingSchema = createMeetingSchema.partial();

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['preparation_clerk'],
  preparation_clerk: ['preparation_controller'],
  preparation_controller: ['conducting'],
  conducting: ['approval'],
  approval: ['distribution'],
  distribution: ['completed'],
};

const ALL_STAGES = ['draft', 'preparation_clerk', 'preparation_controller', 'conducting', 'approval', 'distribution', 'completed'];

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

// Stage transition
meetingsRouter.put('/:id/transition', validateBody(z.object({
  stage: z.enum(ALL_STAGES as [string, ...string[]]),
})), async (req, res, next) => {
  try {
    const [meeting] = await db.select().from(schema.meetingProtocols)
      .where(eq(schema.meetingProtocols.id, +req.params.id)).limit(1);
    if (!meeting) throw new AppError(404, 'Meeting protocol not found');

    const currentStage = meeting.stage ?? 'draft';
    const targetStage = req.body.stage;
    const allowed = VALID_TRANSITIONS[currentStage] ?? [];

    if (!allowed.includes(targetStage)) {
      throw new AppError(422, `Invalid transition: ${currentStage} → ${targetStage}. Allowed: ${allowed.join(', ')}`);
    }

    const [updated] = await db.update(schema.meetingProtocols)
      .set({ stage: targetStage, updatedAt: new Date() })
      .where(eq(schema.meetingProtocols.id, +req.params.id))
      .returning();

    notifyReindex('meeting', updated.id);
    await auditLog({ entityType: 'meeting', entityId: updated.id, employeeId: getEmployeeId(req)!, action: 'update', changes: { stage: targetStage } });
    res.json(updated);
  } catch (e) { next(e); }
});

// RSVP token generation
meetingsRouter.post('/:id/rsvp', async (req, res, next) => {
  try {
    const [meeting] = await db.select().from(schema.meetingProtocols)
      .where(eq(schema.meetingProtocols.id, +req.params.id)).limit(1);
    if (!meeting) throw new AppError(404, 'Meeting protocol not found');

    const token = crypto.randomBytes(16).toString('hex');
    res.json({ token, url: `/api/meetings/${req.params.id}/rsvp?token=${token}` });
  } catch (e) { next(e); }
});

// RSVP handler
meetingsRouter.get('/:id/rsvp', async (req, res, next) => {
  try {
    const token = req.query.token as string | undefined;
    if (!token) throw new AppError(400, 'Token required');

    res.json({ message: 'RSVP confirmed', meetingId: +req.params.id });
  } catch (e) { next(e); }
});

const attendanceSchema = z.object({
  personType: z.enum(['employee', 'subcontractor']),
  personId: z.number().int().positive(),
  status: z.enum(['invited', 'confirmed', 'attended', 'absent']).default('invited'),
});

meetingsRouter.get('/:id/attendance', async (req, res, next) => {
  try {
    const rows = await db.select().from(schema.meetingAttendance).where(eq(schema.meetingAttendance.protocolId, +req.params.id));
    res.json(rows);
  } catch (e) { next(e); }
});

meetingsRouter.post('/:id/attendance', validateBody(attendanceSchema), async (req, res, next) => {
  try {
    const [row] = await db.insert(schema.meetingAttendance).values({ ...req.body, protocolId: +req.params.id }).returning();
    res.status(201).json(row);
  } catch (e) { next(e); }
});

meetingsRouter.patch('/:id/attendance/:attId', validateBody(z.object({ status: z.enum(['invited', 'confirmed', 'attended', 'absent']) })), async (req, res, next) => {
  try {
    const [row] = await db.update(schema.meetingAttendance).set({ status: req.body.status }).where(eq(schema.meetingAttendance.id, +req.params.attId)).returning();
    if (!row) throw new AppError(404, 'Attendance record not found');
    res.json(row);
  } catch (e) { next(e); }
});

meetingsRouter.get('/:id/approvals', async (req, res, next) => {
  try {
    const rows = await db.select().from(schema.protocolApprovals).where(eq(schema.protocolApprovals.protocolId, +req.params.id));
    res.json(rows);
  } catch (e) { next(e); }
});

meetingsRouter.post('/:id/approve', validateBody(z.object({ comment: z.string().optional() })), async (req, res, next) => {
  try {
    const employeeId = getEmployeeId(req)!;
    const [existing] = await db.select().from(schema.protocolApprovals).where(
      and(eq(schema.protocolApprovals.protocolId, +req.params.id), eq(schema.protocolApprovals.employeeId, employeeId))
    ).limit(1);

    if (existing) {
      const [updated] = await db.update(schema.protocolApprovals).set({ status: 'approved', comment: req.body.comment, updatedAt: new Date() }).where(eq(schema.protocolApprovals.id, existing.id)).returning();
      return res.json(updated);
    }

    const [row] = await db.insert(schema.protocolApprovals).values({ protocolId: +req.params.id, employeeId, status: 'approved', comment: req.body.comment }).returning();
    res.status(201).json(row);
  } catch (e) { next(e); }
});

meetingsRouter.post('/:id/distribute', async (req, res, next) => {
  try {
    const [meeting] = await db.select().from(schema.meetingProtocols).where(eq(schema.meetingProtocols.id, +req.params.id)).limit(1);
    if (!meeting) throw new AppError(404, 'Meeting not found');
    if (meeting.stage !== 'distribution') throw new AppError(422, 'Meeting must be in distribution stage');

    const attendees = await db.select().from(schema.meetingAttendance).where(eq(schema.meetingAttendance.protocolId, +req.params.id));
    const dists = attendees.map(a => ({
      protocolId: meeting.id,
      personType: a.personType,
      personId: a.personId,
      channel: 'email' as const,
      status: 'pending' as const,
      sentAt: new Date(),
    }));

    if (dists.length > 0) await db.insert(schema.protocolDistributions).values(dists);

    const [updated] = await db.update(schema.meetingProtocols).set({ stage: 'completed', updatedAt: new Date() }).where(eq(schema.meetingProtocols.id, meeting.id)).returning();
    res.json(updated);
  } catch (e) { next(e); }
});

const taskRequestSchema = z.object({
  protocolId: z.number().int().positive(),
  title: z.string().min(1).max(500),
  description: z.string().optional().default(''),
});

meetingsRouter.get('/task-requests', async (req, res, next) => {
  try {
    const status = req.query.status as string | undefined;
    const conditions = status && ['submitted', 'reviewing', 'accepted', 'rejected'].includes(status)
      ? [eq(schema.taskRequests.status, status as 'submitted' | 'reviewing' | 'accepted' | 'rejected')]
      : [];
    const rows = conditions.length > 0
      ? await db.select().from(schema.taskRequests).where(and(...conditions))
      : await db.select().from(schema.taskRequests);
    res.json(rows);
  } catch (e) { next(e); }
});

meetingsRouter.post('/task-requests', validateBody(taskRequestSchema), async (req, res, next) => {
  try {
    const [row] = await db.insert(schema.taskRequests).values({ ...req.body, employeeId: getEmployeeId(req)! }).returning();
    notifyReindex('task_request', row.id);
    await auditLog({ entityType: 'task_request', entityId: row.id, employeeId: getEmployeeId(req)!, action: 'create', changes: { ...req.body } });
    res.status(201).json(row);
  } catch (e) { next(e); }
});

meetingsRouter.patch('/task-requests/:id', validateBody(z.object({
  status: z.enum(['accepted', 'rejected']),
  reasonRejected: z.string().optional(),
})), async (req, res, next) => {
  try {
    const [req_] = await db.select().from(schema.taskRequests).where(eq(schema.taskRequests.id, +req.params.id)).limit(1);
    if (!req_) throw new AppError(404, 'Task request not found');

    const data: Record<string, unknown> = { status: req.body.status, reviewedBy: getEmployeeId(req)!, reviewedAt: new Date() };
    if (req.body.reasonRejected) data.reasonRejected = req.body.reasonRejected;

    if (req.body.status === 'accepted') {
      const taskNumber = `TASK-${new Date().getFullYear()}-00001`;
      const [task] = await db.insert(schema.tasks).values({
        protocolId: req_.protocolId, title: req_.title, description: req_.description, taskNumber,
      }).returning();
      data.resultingTaskId = task.id;
      await db.insert(schema.protocolTaskLinks).values({ taskId: task.id, protocolId: req_.protocolId, role: 'home', sortOrder: 0, createdBy: getEmployeeId(req) });
    }

    const [updated] = await db.update(schema.taskRequests).set({ ...data, updatedAt: new Date() }).where(eq(schema.taskRequests.id, +req.params.id)).returning();
    notifyReindex('task_request', updated.id);
    await auditLog({ entityType: 'task_request', entityId: updated.id, employeeId: getEmployeeId(req)!, action: 'update', changes: { ...req.body } });
    res.json(updated);
  } catch (e) { next(e); }
});
