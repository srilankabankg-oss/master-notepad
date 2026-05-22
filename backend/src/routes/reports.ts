import { Router } from 'express'
import { z } from 'zod'
import { db, schema } from '../db/index.js'
import { eq } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth.js'
import { AppError } from '../middleware/error-handler.js'

export const reportsRouter = Router()
reportsRouter.use(requireAuth)

reportsRouter.get('/tender/:id', async (req, res, next) => {
  try {
    const id = +req.params.id
    const [sub] = await db.select().from(schema.subcontractors).where(eq(schema.subcontractors.id, id)).limit(1)
    if (!sub) throw new AppError(404, 'Subcontractor not found')

    const [reviews, events, meetings, comments, surveys] = await Promise.all([
      db.select().from(schema.reviews).where(eq(schema.reviews.subcontractorId, id)),
      db.select().from(schema.contractorEvents).where(eq(schema.contractorEvents.subcontractorId, id)),
      db.select().from(schema.meetingProtocols).where(eq(schema.meetingProtocols.subcontractorId, id)),
      db.select().from(schema.comments).where(eq(schema.comments.subcontractorId, id)),
      db.select().from(schema.surveys).where(eq(schema.surveys.subcontractorId, id)),
    ])

    res.json({ subcontractor: sub, reviews, events, meetings, comments, surveys })
  } catch (e) { next(e) }
})

reportsRouter.get('/subcontractor/:id', async (req, res, next) => {
  try {
    const id = +req.params.id
    const [sub] = await db.select().from(schema.subcontractors).where(eq(schema.subcontractors.id, id)).limit(1)
    if (!sub) throw new AppError(404, 'Subcontractor not found')

    const [reviews, events, meetings] = await Promise.all([
      db.select().from(schema.reviews).where(eq(schema.reviews.subcontractorId, id)),
      db.select().from(schema.contractorEvents).where(eq(schema.contractorEvents.subcontractorId, id)),
      db.select().from(schema.meetingProtocols).where(eq(schema.meetingProtocols.subcontractorId, id)),
    ])

    const avgRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : null

    res.json({ subcontractor: sub, avgRating, reviewCount: reviews.length, eventCount: events.length, meetingCount: meetings.length })
  } catch (e) { next(e) }
})

reportsRouter.get('/meeting/:id', async (req, res, next) => {
  try {
    const id = +req.params.id
    const [meeting] = await db.select().from(schema.meetingProtocols).where(eq(schema.meetingProtocols.id, id)).limit(1)
    if (!meeting) throw new AppError(404, 'Meeting not found')

    const attendance = await db.select().from(schema.meetingAttendance).where(eq(schema.meetingAttendance.protocolId, id))
    const tasks = await db.select().from(schema.tasks).where(eq(schema.tasks.protocolId, id))

    res.json({ meeting, attendance, tasks })
  } catch (e) { next(e) }
})

const V = z.object({ file: z.any() })

reportsRouter.post('/import/subcontractors', async (req, res, next) => {
  try {
    res.json({ imported: 0, skipped: 0, errors: ['Excel import requires xlsx library'] })
  } catch (e) { next(e) }
})

reportsRouter.post('/import/employees', async (req, res, next) => {
  try {
    res.json({ imported: 0, skipped: 0, errors: ['Excel import requires xlsx library'] })
  } catch (e) { next(e) }
})