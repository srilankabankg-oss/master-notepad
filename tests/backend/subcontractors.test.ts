import { describe, test, expect } from 'vitest'
import { login, headers, API } from './helpers'

describe('Subcontractors', () => {
  beforeAll(() => login())

  test('list returns items', async () => {
    const r = await fetch(`${API}/subcontractors`, { headers: headers() })
    expect(r.status).toBe(200)
    const b = await r.json()
    expect(Array.isArray(b)).toBe(true)
    expect(b.length).toBeGreaterThan(0)
  })

  test('get by id returns detail', async () => {
    const r = await fetch(`${API}/subcontractors/1`, { headers: headers() })
    expect(r.status).toBe(200)
    const b = await r.json()
    expect(b.name).toBeDefined()
  })

  test('create and delete', async () => {
    const cr = await fetch(`${API}/subcontractors`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ name: 'Test Sub Co', specialization: 'test' }),
    })
    expect(cr.status).toBe(201)
    const c = await cr.json()
    const dr = await fetch(`${API}/subcontractors/${c.id}`, { method: 'DELETE', headers: headers() })
    expect(dr.status).toBe(200)
  })
})