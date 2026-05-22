import { Router } from 'express'
import { db, schema } from '../db/index.js'
import { eq } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth.js'
import { AppError } from '../middleware/error-handler.js'
import puppeteer from 'puppeteer'
import XLSX from 'xlsx'
import multer from 'multer'

export const reportsRouter = Router()
reportsRouter.use(requireAuth)

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

async function renderPdf(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] })
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'load' as const })
    return Buffer.from(await page.pdf({ format: 'A4', printBackground: true }))
  } finally { await browser.close() }
}

reportsRouter.get('/tender/:id', async (req, res, next) => {
  try {
    const id = +req.params.id
    const [sub] = await db.select().from(schema.subcontractors).where(eq(schema.subcontractors.id, id)).limit(1)
    if (!sub) throw new AppError(404, 'Subcontractor not found')
    const [reviews, events, meetings] = await Promise.all([
      db.select().from(schema.reviews).where(eq(schema.reviews.subcontractorId, id)),
      db.select().from(schema.contractorEvents).where(eq(schema.contractorEvents.subcontractorId, id)),
      db.select().from(schema.meetingProtocols).where(eq(schema.meetingProtocols.subcontractorId, id)),
    ])
    const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0
    const html = `<html><head><meta charset="utf-8"><style>body{font-family:sans-serif;padding:2rem}h1{color:#1a56db}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px}th{background:#f3f4f6}</style></head><body>
<h1>Тендерная справка: ${sub.name}</h1><p>Специализация: ${sub.specialization||'—'} | Рейтинг: ${avg.toFixed(1)}/10</p>
<h2>Отзывы (${reviews.length})</h2><table><tr><th>Оценка</th><th>Содержание</th></tr>${reviews.map(r=>`<tr><td>${r.rating}/10</td><td>${r.content}</td></tr>`).join('')}</table>
<h2>События (${events.length})</h2><table><tr><th>Тип</th><th>Описание</th></tr>${events.map(e=>`<tr><td>${e.type}</td><td>${e.description}</td></tr>`).join('')}</table>
<h2>Протоколы (${meetings.length})</h2><table><tr><th>Название</th><th>Дата</th></tr>${meetings.map(m=>`<tr><td>${m.title}</td><td>${m.date?.toString().slice(0,10)||'—'}</td></tr>`).join('')}</table>
</body></html>`
    const pdf = await renderPdf(html)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="tender-${id}.pdf"`)
    res.send(pdf)
  } catch (e) { next(e) }
})

reportsRouter.get('/subcontractor/:id', async (req, res, next) => {
  try {
    const id = +req.params.id
    const [sub] = await db.select().from(schema.subcontractors).where(eq(schema.subcontractors.id, id)).limit(1)
    if (!sub) throw new AppError(404, 'Subcontractor not found')
    const [reviews] = await Promise.all([db.select().from(schema.reviews).where(eq(schema.reviews.subcontractorId, id))])
    const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0
    const html = `<html><head><meta charset="utf-8"><style>body{font-family:sans-serif;padding:2rem}h1{color:#1a56db}</style></head><body>
<h1>${sub.name}</h1><p>${sub.companyName||''}</p><p>Рейтинг: <b>${avg.toFixed(1)}/10</b> (${reviews.length} отзывов)</p></body></html>`
    const pdf = await renderPdf(html)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="subcontractor-${id}.pdf"`)
    res.send(pdf)
  } catch (e) { next(e) }
})

reportsRouter.get('/meeting/:id', async (req, res, next) => {
  try {
    const id = +req.params.id
    const [meeting] = await db.select().from(schema.meetingProtocols).where(eq(schema.meetingProtocols.id, id)).limit(1)
    if (!meeting) throw new AppError(404, 'Meeting not found')
    const attendance = await db.select().from(schema.meetingAttendance).where(eq(schema.meetingAttendance.protocolId, id))
    const tasks = await db.select().from(schema.tasks).where(eq(schema.tasks.protocolId, id))
    const html = `<html><head><meta charset="utf-8"><style>body{font-family:sans-serif;padding:2rem}h1{color:#1a56db}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px}th{background:#f3f4f6}</style></head><body>
<h1>${meeting.title}</h1><p>Дата: ${meeting.date?.toString().slice(0,10)||'—'} | Этап: ${meeting.stage||'—'}</p>
<h2>Повестка</h2><p>${meeting.agenda||'—'}</p><h2>Решения</h2><p>${meeting.decisions||'—'}</p>
<h2>Присутствие</h2><table><tr><th>Тип</th><th>Статус</th></tr>${attendance.map(a=>`<tr><td>${a.personType}</td><td>${a.status}</td></tr>`).join('')}</table>
<h2>Задачи</h2><table><tr><th>Номер</th><th>Название</th><th>Статус</th></tr>${tasks.map(t=>`<tr><td>${t.taskNumber}</td><td>${t.title}</td><td>${t.status}</td></tr>`).join('')}</table>
</body></html>`
    const pdf = await renderPdf(html)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="protocol-${id}.pdf"`)
    res.send(pdf)
  } catch (e) { next(e) }
})

reportsRouter.post('/import/subcontractors', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw new AppError(400, 'File required')
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' })
    const data = XLSX.utils.sheet_to_json<Record<string, string>>(wb.Sheets[wb.SheetNames[0]])
    const imported: number[] = []; const errors: string[] = []
    for (const row of data) {
      try {
        const [r] = await db.insert(schema.subcontractors).values({ name: row.name || row['Название'] || '—', specialization: row.specialization || row['Специализация'] }).returning()
        imported.push(r.id)
      } catch (e: unknown) { errors.push(`Row ${imported.length+errors.length+1}: ${e instanceof Error?e.message:'Error'}`) }
    }
    res.json({ imported: imported.length, skipped: 0, errors })
  } catch (e) { next(e) }
})

reportsRouter.post('/import/employees', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw new AppError(400, 'File required')
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' })
    const data = XLSX.utils.sheet_to_json<Record<string, string>>(wb.Sheets[wb.SheetNames[0]])
    const imported: number[] = []; const errors: string[] = []
    for (const row of data) {
      try {
        const [r] = await db.insert(schema.employees).values({ name: row.name || row['ФИО'] || '—', email: row.email || row['Email'] || `import_${Date.now()}@tmp`, position: row.position || row['Должность'] }).returning()
        imported.push(r.id)
      } catch (e: unknown) { errors.push(`Row ${imported.length+errors.length+1}: ${e instanceof Error?e.message:'Error'}`) }
    }
    res.json({ imported: imported.length, skipped: 0, errors })
  } catch (e) { next(e) }
})