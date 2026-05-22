import { Router } from 'express'
import { z } from 'zod'
import { db, schema } from '../db/index.js'
import { eq } from 'drizzle-orm'
import { validateBody } from '../middleware/validation.js'
import { requireAuth, getEmployeeId } from '../middleware/auth.js'

export const notificationsRouter = Router()
notificationsRouter.use(requireAuth)

const prefsSchema = z.object({
  emailEnabled: z.boolean().optional(),
  telegramEnabled: z.boolean().optional(),
  notifyDeadlines: z.boolean().optional(),
  notifyProtocolDistribution: z.boolean().optional(),
  notifyTaskRequestResults: z.boolean().optional(),
})

notificationsRouter.get('/preferences', async (req, res, next) => {
  try {
    const employeeId = getEmployeeId(req)!
    const [prefs] = await db.select().from(schema.userNotificationPreferences)
      .where(eq(schema.userNotificationPreferences.employeeId, employeeId)).limit(1)

    if (!prefs) {
      const [created] = await db.insert(schema.userNotificationPreferences).values({
        employeeId, emailEnabled: true, telegramEnabled: false,
        notifyDeadlines: true, notifyProtocolDistribution: true, notifyTaskRequestResults: true,
      }).returning()
      return res.json(created)
    }
    res.json(prefs)
  } catch (e) { next(e) }
})

notificationsRouter.put('/preferences', validateBody(prefsSchema), async (req, res, next) => {
  try {
    const employeeId = getEmployeeId(req)!
    const [existing] = await db.select().from(schema.userNotificationPreferences)
      .where(eq(schema.userNotificationPreferences.employeeId, employeeId)).limit(1)

    if (existing) {
      const [updated] = await db.update(schema.userNotificationPreferences)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(schema.userNotificationPreferences.id, existing.id)).returning()
      return res.json(updated)
    }

    const [created] = await db.insert(schema.userNotificationPreferences).values({
      employeeId, ...req.body,
    }).returning()
    res.status(201).json(created)
  } catch (e) { next(e) }
})