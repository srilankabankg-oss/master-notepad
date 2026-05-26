import { Router } from 'express'
import { appendFileSync } from 'fs'
import { join } from 'path'
import { requireAuth, getEmployeeId } from '../middleware/auth.js'

export const bugsRouter = Router()
bugsRouter.use(requireAuth)

const LOG_PATH = join(process.cwd(), 'user_bugs.log')

bugsRouter.post('/', (req, res) => {
  const { page, description } = req.body
  const entry = {
    timestamp: new Date().toISOString(),
    employeeId: getEmployeeId(req),
    page: page || 'unknown',
    description: (description || '').slice(0, 2000),
  }
  appendFileSync(LOG_PATH, JSON.stringify(entry) + '\n')
  res.json({ ok: true })
})