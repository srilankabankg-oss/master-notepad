export const API = 'http://localhost:3355/api'

let cookies = ''
let loginPromise: Promise<{ status: number; body: any }> | null = null

export async function login(email = 'pavel@example.com', password = 'admin123') {
  if (cookies) return { status: 200, body: { email } }
  if (loginPromise) return loginPromise

  loginPromise = (async () => {
    const r = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const setCookie = r.headers.get('set-cookie')
    if (setCookie) cookies = setCookie
    return { status: r.status, body: await r.json() }
  })()

  return loginPromise
}

export function headers() {
  return { Cookie: cookies, 'Content-Type': 'application/json' }
}