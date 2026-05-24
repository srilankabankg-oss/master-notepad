import { describe, test, expect } from 'vitest'
import { login, headers, API } from './helpers'

describe('Notifications', () => {
  beforeAll(() => login())

  test('get preferences returns defaults', async () => {
    const r = await fetch(`${API}/notifications/preferences`, { headers: headers() })
    expect(r.status).toBe(200)
    const p = await r.json()
    expect(p.emailEnabled).toBeDefined()
  })

  test('update preferences', async () => {
    const r = await fetch(`${API}/notifications/preferences`, {
      method: 'PUT', headers: headers(),
      body: JSON.stringify({ emailEnabled: false }),
    })
    expect(r.status).toBe(200)
    const p = await r.json()
    expect(p.emailEnabled).toBe(false)
  })
})