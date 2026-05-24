import { describe, test, expect, beforeAll } from 'vitest'
import { login, headers, API } from './helpers'

describe('Organizations', () => {
  beforeAll(() => login())

  test('list returns items with INN', async () => {
    const r = await fetch(`${API}/organizations`, { headers: headers() })
    expect(r.status).toBe(200)
    const b = await r.json()
    expect(Array.isArray(b)).toBe(true)
    if (b.length > 0) expect(b[0].inn).toBeDefined()
  })

  test('duplicate INN returns 409', async () => {
    const r = await fetch(`${API}/organizations`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ name: 'Dup', inn: '7712345678', activityType: 'test' }),
    })
    expect(r.status).toBe(409)
  })

  test('create organization', async () => {
    const uniqueInn = `99${Date.now().toString().slice(-10)}`
    const r = await fetch(`${API}/organizations`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ name: 'New Org', inn: uniqueInn, activityType: 'test' }),
    })
    expect(r.status).toBe(201)
    const org = await r.json()
    expect(org.inn).toBe(uniqueInn)
  })
})