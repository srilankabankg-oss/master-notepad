import { describe, test, expect, beforeAll } from 'vitest'
import { login, headers, API } from './helpers'

describe('Meetings v2', () => {
  beforeAll(() => login())

  test('list returns v2 fields', async () => {
    const r = await fetch(`${API}/meetings`, { headers: headers() })
    expect(r.status).toBe(200)
    const b = await r.json()
    if (b.length > 0) {
      expect(b[0].meetingType).toBeDefined()
      expect(b[0].stage).toBeDefined()
    }
  })

  test('transition validates stages', async () => {
    const cr = await fetch(`${API}/meetings`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ title: 'Transition test', date: '2026-06-01T10:00:00Z', agenda: 'Test' }),
    })
    const c = await cr.json()

    const tr = await fetch(`${API}/meetings/${c.id}/transition`, {
      method: 'PUT', headers: headers(),
      body: JSON.stringify({ stage: 'preparation_clerk' }),
    })
    expect(tr.status).toBe(200)

    const bad = await fetch(`${API}/meetings/${c.id}/transition`, {
      method: 'PUT', headers: headers(),
      body: JSON.stringify({ stage: 'draft' }),
    })
    expect(bad.status).toBe(422)

    await fetch(`${API}/meetings/${c.id}`, { method: 'DELETE', headers: headers() })
  })

  test('create meeting v2 with types', async () => {
    const cr = await fetch(`${API}/meetings`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({
        title: 'Type test', date: '2026-06-01T10:00:00Z', agenda: 'Test',
        meetingType: 'problem', periodicity: 'one_time', groupingMethod: 'by_topic',
      }),
    })
    expect(cr.status).toBe(201)
    const c = await cr.json()
    expect(c.meetingType).toBe('problem')
    expect(c.stage).toBe('draft')
    await fetch(`${API}/meetings/${c.id}`, { method: 'DELETE', headers: headers() })
  })
})