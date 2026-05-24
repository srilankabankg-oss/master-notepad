import { describe, test, expect } from 'vitest'
import { login, headers, API } from './helpers'

describe('Auth', () => {
  test('login returns user', async () => {
    const { status, body } = await login()
    expect(status).toBe(200)
    expect(body.email).toBe('pavel@example.com')
    expect(body.role).toBe('admin')
  })

  test('me returns current user', async () => {
    await login()
    const r = await fetch(`${API}/auth/me`, { headers: headers() })
    expect(r.status).toBe(200)
    const b = await r.json()
    expect(b.email).toBe('pavel@example.com')
  })

  test('invalid login returns 401', async () => {
    const r = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@no.com', password: 'wrong' }),
    })
    expect(r.status).toBe(401)
  })

  test('unauthenticated returns 401', async () => {
    const r = await fetch(`${API}/auth/me`, { headers: { 'Content-Type': 'application/json' } })
    expect(r.status).toBe(401)
  })
})