import { describe, test, expect, beforeAll } from 'vitest'
import { login, headers, API } from './helpers'

describe('Cross-Interaction', () => {
  beforeAll(() => login())

  test('full meeting → task → move → resolve flow', async () => {
    // Create meeting
    const mr = await fetch(`${API}/meetings`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ title: 'Cross test', date: '2026-06-01T10:00:00Z', agenda: 'Test' }),
    })
    expect(mr.status).toBe(201)
    const m = await mr.json()

    // Create task in meeting
    const tr = await fetch(`${API}/tasks`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ protocolId: m.id, title: 'Cross task', assigneeId: 1 }),
    })
    expect(tr.status).toBe(201)
    const t = await tr.json()

    // Move task to another meeting
    const mover = await fetch(`${API}/tasks/${t.id}/move`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ targetProtocolId: 1 }),
    })
    expect(mover.status).toBe(200)

    // Add attendance
    const ar = await fetch(`${API}/meetings/${m.id}/attendance`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ personType: 'employee', personId: 1 }),
    })
    expect(ar.status).toBe(201)

    // Transition through stages
    const stages = ['preparation_clerk', 'preparation_controller', 'conducting', 'approval', 'distribution']
    for (const s of stages) {
      const r = await fetch(`${API}/meetings/${m.id}/transition`, {
        method: 'PUT', headers: headers(),
        body: JSON.stringify({ stage: s }),
      })
      expect(r.status).toBe(200)
    }

    // Approve
    const apr = await fetch(`${API}/meetings/${m.id}/approve`, {
      method: 'POST', headers: headers(), body: JSON.stringify({}),
    })
    expect(apr.status).toBe(201)

    // Distribute
    const dr = await fetch(`${API}/meetings/${m.id}/distribute`, {
      method: 'POST', headers: headers(),
    })
    expect(dr.status).toBe(200)

    // Task request → accept → auto-create task
    const reqr = await fetch(`${API}/meetings/task-requests`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ protocolId: m.id, title: 'Request test' }),
    })
    expect(reqr.status).toBe(201)
    const req = await reqr.json()

    const accr = await fetch(`${API}/meetings/task-requests/${req.id}`, {
      method: 'PATCH', headers: headers(),
      body: JSON.stringify({ status: 'accepted' }),
    })
    expect(accr.status).toBe(200)
    const accepted = await accr.json()
    expect(accepted.resultingTaskId).toBeGreaterThan(0)
  })
})