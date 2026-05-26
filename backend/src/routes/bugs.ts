import { Router } from 'express'
import { appendFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { requireAuth, getEmployeeId } from '../middleware/auth.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LOG_PATH = join(__dirname, '..', '..', 'user_bugs.log')

export const bugsRouter = Router()
bugsRouter.use(requireAuth)

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