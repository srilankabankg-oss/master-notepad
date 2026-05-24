import { describe, test, expect, beforeAll } from 'vitest'
import { login, headers, API } from './helpers'

describe('Tasks', () => {
  beforeAll(() => login())

  test('list returns items with TASK format', async () => {
    const r = await fetch(`${API}/tasks`, { headers: headers() })
    expect(r.status).toBe(200)
    const b = await r.json()
    expect(Array.isArray(b)).toBe(true)
    if (b.length > 0) expect(b[0].taskNumber).toMatch(/^TASK-\d{4}-\d{5}$/)
  })

  test('create, update, delete lifecycle', async () => {
    const cr = await fetch(`${API}/tasks`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ protocolId: 1, title: 'Lifecycle test' }),
    })
    expect(cr.status).toBe(201)
    const c = await cr.json()
    expect(c.taskNumber).toMatch(/^TASK-\d{4}-\d{5}$/)

    const ur = await fetch(`${API}/tasks/${c.id}`, {
      method: 'PUT', headers: headers(),
      body: JSON.stringify({ status: 'in_progress' }),
    })
    expect(ur.status).toBe(200)

    const dr = await fetch(`${API}/tasks/${c.id}`, { method: 'DELETE', headers: headers() })
    expect(dr.status).toBe(422)
  })

  test('done requires resolutionText', async () => {
    const cr = await fetch(`${API}/tasks`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ protocolId: 1, title: 'Resolution test' }),
    })
    const c = await cr.json()
    const r = await fetch(`${API}/tasks/${c.id}`, {
      method: 'PUT', headers: headers(),
      body: JSON.stringify({ status: 'done' }),
    })
    expect(r.status).toBe(400)
  })

  test('move task cross-protocol', async () => {
    const cr = await fetch(`${API}/tasks`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ protocolId: 1, title: 'Move test' }),
    })
    const c = await cr.json()
    const mr = await fetch(`${API}/tasks/${c.id}/move`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ targetProtocolId: 2 }),
    })
    expect(mr.status).toBe(200)
    const lr = await fetch(`${API}/tasks/${c.id}/links`, { headers: headers() })
    const links = await lr.json()
    expect(links.some((l: any) => l.role === 'delegated')).toBe(true)
  })

  test('subtask inherits protocol', async () => {
    const cr = await fetch(`${API}/tasks`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ protocolId: 1, title: 'Parent' }),
    })
    const c = await cr.json()
    const sr = await fetch(`${API}/tasks/${c.id}/subtasks`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ title: 'Child' }),
    })
    expect(sr.status).toBe(201)
    const s = await sr.json()
    expect(s.parentTaskId).toBe(c.id)
  })
})