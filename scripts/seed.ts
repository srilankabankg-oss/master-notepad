import { readFileSync } from 'fs'
import { resolve } from 'path'
import pg from 'pg'
import bcrypt from 'bcryptjs'

const { Pool } = pg

interface SeedData {
  employees: any[]; subcontractors: any[]; organizations: any[];
  reviews: any[]; comments: any[]; events: any[]; meetings: any[];
  surveys: any[]; checklists: any[];
}

async function main() {
  const pool = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5433/master_notepad' })
  const db = pool

  const raw = readFileSync(resolve(import.meta.dirname || __dirname, 'seed-data/data.json'), 'utf-8')
  const data: SeedData = JSON.parse(raw)

  console.log('🧹 Очистка базы...')
  await db.query('TRUNCATE audit_log, survey_responses, surveys, protocol_distributions, protocol_approvals, task_reformulations, protocol_task_links, tasks, meeting_attendance, task_requests, checklist_suggestions, checklists, contractor_events, comments, reviews, meeting_protocols, subcontractors, organizations, employees RESTART IDENTITY CASCADE')

  console.log('👥 Сотрудники...')
  const empIds: number[] = []
  for (const e of data.employees) {
    const hash = await bcrypt.hash(e.password, 10)
    const r = await db.query(
      `INSERT INTO employees (name, email, position, role, password_hash) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [e.name, e.email, e.position, e.role, hash]
    )
    empIds.push(r.rows[0].id)
  }

  console.log('🏢 Организации...')
  const orgIds: number[] = []
  for (const o of data.organizations) {
    const r = await db.query(
      `INSERT INTO organizations (name, inn, activity_type, is_contractor) VALUES ($1,$2,$3,$4) ON CONFLICT (inn) DO UPDATE SET name=$1 RETURNING id`,
      [o.name, o.inn, o.activityType, o.isContractor]
    )
    orgIds.push(r.rows[0].id)
  }

  console.log('🔧 Подрядчики...')
  const subIds: number[] = []
  for (let i = 0; i < data.subcontractors.length; i++) {
    const s = data.subcontractors[i]
    const orgId = i < orgIds.length ? orgIds[i] : null
    const r = await db.query(
      `INSERT INTO subcontractors (name, company_name, contact_info, specialization, description, organization_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [s.name, s.companyName, s.contactInfo, s.specialization, s.description, orgId]
    )
    subIds.push(r.rows[0].id)
  }

  console.log('⭐ Отзывы...')
  for (const rv of data.reviews) {
    await db.query(
      `INSERT INTO reviews (subcontractor_id, employee_id, content, rating) VALUES ($1,$2,$3,$4)`,
      [subIds[rv.subcontractorIdx], empIds[rv.employeeIdx], rv.content, rv.rating]
    )
  }

  console.log('💬 Комментарии...')
  for (const c of data.comments) {
    await db.query(
      `INSERT INTO comments (subcontractor_id, employee_id, content) VALUES ($1,$2,$3)`,
      [subIds[c.subcontractorIdx], empIds[c.employeeIdx], c.content]
    )
  }

  console.log('📋 События...')
  for (const ev of data.events) {
    await db.query(
      `INSERT INTO contractor_events (subcontractor_id, employee_id, type, description, event_date) VALUES ($1,$2,$3,$4,$5)`,
      [subIds[ev.subcontractorIdx], empIds[ev.employeeIdx], ev.type, ev.description, ev.eventDate]
    )
  }

  console.log('📝 Протоколы...')
  const meetIds: number[] = []
  for (const m of data.meetings) {
    const r = await db.query(
      `INSERT INTO meeting_protocols (title, date, subcontractor_id, agenda, decisions, meeting_type, periodicity, grouping_method, stage) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [m.title, m.date, m.subcontractorIdx !== null ? subIds[m.subcontractorIdx] : null,
       m.agenda, m.decisions || '',
       m.meetingType || 'operational', m.periodicity || 'one_time', m.groupingMethod || 'by_subcontractor', 'distribution']
    )
    meetIds.push(r.rows[0].id)

    // Insert attendance
    for (const att of m.attendees) {
      const emp = data.employees.find(e => e.name === att)
      if (emp) {
        const idx = data.employees.indexOf(emp)
        await db.query(
          `INSERT INTO meeting_attendance (protocol_id, person_type, person_id, status) VALUES ($1,'employee',$2,'attended')`,
          [r.rows[0].id, empIds[idx]]
        )
      }
    }
  }

  console.log('📊 Опросы...')
  for (const sv of data.surveys) {
    const r = await db.query(
      `INSERT INTO surveys (title, subcontractor_id, created_by, questions) VALUES ($1,$2,$3,$4) RETURNING id`,
      [sv.title, subIds[sv.subcontractorIdx], empIds[sv.createdBy], JSON.stringify(sv.questions)]
    )
    for (const resp of sv.responses) {
      await db.query(
        `INSERT INTO survey_responses (survey_id, employee_id, answers) VALUES ($1,$2,$3)`,
        [r.rows[0].id, empIds[resp.employeeIdx], JSON.stringify(resp.answers)]
      )
    }
  }

  console.log('✅ Чек-листы...')
  for (const cl of data.checklists) {
    await db.query(
      `INSERT INTO checklists (title, type, owner_id, items) VALUES ($1,$2,$3,$4)`,
      [cl.title, cl.type, empIds[cl.ownerIdx], JSON.stringify(cl.items)]
    )
  }

  // Create some tasks
  console.log('📌 Задачи...')
  for (let i = 1; i <= 5; i++) {
    const tn = `TASK-2025-${String(i).padStart(5, '0')}`
    const r = await db.query(
      `INSERT INTO tasks (protocol_id, task_number, title, description, assignee_id, controller_id, status, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [meetIds[0], tn, `Задача ${i}: Проверить отчёты`, `Описание задачи ${i}`, empIds[i % empIds.length], empIds[2], 'in_progress', i]
    )
    await db.query(
      `INSERT INTO protocol_task_links (task_id, protocol_id, role, sort_order) VALUES ($1,$2,'home',$3)`,
      [r.rows[0].id, meetIds[0], i]
    )
  }

  console.log('\n✅ База заполнена!')
  console.log(`   Сотрудников: ${empIds.length}`)
  console.log(`   Организаций: ${orgIds.length}`)
  console.log(`   Подрядчиков: ${subIds.length}`)
  console.log(`   Протоколов: ${meetIds.length}`)
  console.log(`   Задач: 5`)

  await pool.end()
}

main().catch(e => { console.error(e); process.exit(1) })