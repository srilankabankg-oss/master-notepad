const API = 'http://localhost:3355/api'

let cookies = ''

async function login(email = 'pavel@example.com', password = 'admin123') {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const setCookie = r.headers.get('set-cookie')
  if (setCookie) cookies = setCookie
  return { status: r.status, body: await r.json() }
}

function headers() {
  return { Cookie: cookies, 'Content-Type': 'application/json' }
}

describe('Auth', () => {
  test('login returns user', async () => {
    const { status, body } = await login()
    expect(status).toBe(200)
    expect(body.email).toBe('pavel@example.com')
    expect(body.role).toBe('admin')
  })

  test('me returns current user', async () => {
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
})

describe('Subcontractors', () => {
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
      body: JSON.stringify({ name: 'Test Sub', specialization: 'test' }),
    })
    expect(cr.status).toBe(201)
    const c = await cr.json()

    const dr = await fetch(`${API}/subcontractors/${c.id}`, { method: 'DELETE', headers: headers() })
    expect(dr.status).toBe(200)
  })
})

describe('Tasks', () => {
  test('list returns items with TASK format', async () => {
    const r = await fetch(`${API}/tasks`, { headers: headers() })
    expect(r.status).toBe(200)
    const b = await r.json()
    expect(Array.isArray(b)).toBe(true)
    if (b.length > 0) {
      expect(b[0].taskNumber).toMatch(/^TASK-\d{4}-\d{5}$/)
    }
  })

  test('create, update status, delete', async () => {
    const cr = await fetch(`${API}/tasks`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ protocolId: 1, title: 'Test task' }),
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
    expect(dr.status).toBe(200)
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

    await fetch(`${API}/tasks/${c.id}`, { method: 'DELETE', headers: headers() })
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

    await fetch(`${API}/tasks/${c.id}`, { method: 'DELETE', headers: headers() })
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

    await fetch(`${API}/tasks/${c.id}`, { method: 'DELETE', headers: headers() })
  })
})

describe('Meetings v2', () => {
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
    const r = await fetch(`${API}/meetings/1/transition`, {
      method: 'PUT', headers: headers(),
      body: JSON.stringify({ stage: 'conducting' }),
    })
    expect(r.status).toBe(200)
    const b = await r.json()
    expect(b.stage).toBe('conducting')
  })

  test('invalid transition returns 422', async () => {
    const r = await fetch(`${API}/meetings/1/transition`, {
      method: 'PUT', headers: headers(),
      body: JSON.stringify({ stage: 'draft' }),
    })
    expect(r.status).toBe(422)
  })

  test('create and read meeting v2', async () => {
    const cr = await fetch(`${API}/meetings`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({
        title: 'Test meeting', date: '2026-06-01T10:00:00Z', agenda: 'Test',
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

describe('Organizations', () => {
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
})

describe('Cross-Interaction', () => {
  test('full meeting → task → move → resolve flow', async () => {
    // Create meeting
    const mr = await fetch(`${API}/meetings`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ title: 'Cross test', date: '2026-06-01T10:00:00Z', agenda: 'Test' }),
    })
    const m = await mr.json()

    // Create task in meeting
    const tr = await fetch(`${API}/tasks`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ protocolId: m.id, title: 'Cross task', assigneeId: 1 }),
    })
    const t = await tr.json()
    expect(t.taskNumber).toMatch(/^TASK-/)

    // Move task to another meeting
    await fetch(`${API}/tasks/${t.id}/move`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ targetProtocolId: 1 }),
    })

    // Verify links
    const lr = await fetch(`${API}/tasks/${t.id}/links`, { headers: headers() })
    const links = await lr.json()
    expect(links.length).toBe(2)

    // Add attendance to meeting
    await fetch(`${API}/meetings/${m.id}/attendance`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ personType: 'employee', personId: 1, status: 'attended' }),
    })

    // Get attendance
    const ar = await fetch(`${API}/meetings/${m.id}/attendance`, { headers: headers() })
    expect(ar.status).toBe(200)
    const att = await ar.json()
    expect(att.length).toBeGreaterThan(0)

    // Transition through stages
    await fetch(`${API}/meetings/${m.id}/transition`, {
      method: 'PUT', headers: headers(),
      body: JSON.stringify({ stage: 'preparation_clerk' }),
    })
    await fetch(`${API}/meetings/${m.id}/transition`, {
      method: 'PUT', headers: headers(),
      body: JSON.stringify({ stage: 'preparation_controller' }),
    })
    await fetch(`${API}/meetings/${m.id}/transition`, {
      method: 'PUT', headers: headers(),
      body: JSON.stringify({ stage: 'conducting' }),
    })
    await fetch(`${API}/meetings/${m.id}/transition`, {
      method: 'PUT', headers: headers(),
      body: JSON.stringify({ stage: 'approval' }),
    })

    // Approve
    await fetch(`${API}/meetings/${m.id}/approve`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({}),
    })

    // Distribute
    await fetch(`${API}/meetings/${m.id}/transition`, {
      method: 'PUT', headers: headers(),
      body: JSON.stringify({ stage: 'distribution' }),
    })
    const dr = await fetch(`${API}/meetings/${m.id}/distribute`, {
      method: 'POST', headers: headers(),
    })
    expect(dr.status).toBe(200)

    // Create task request
    const reqr = await fetch(`${API}/meetings/task-requests`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ protocolId: m.id, title: 'Request test' }),
    })
    expect(reqr.status).toBe(201)
    const req = await reqr.json()

    // Accept task request → auto-creates task
    const arr = await fetch(`${API}/meetings/task-requests/${req.id}`, {
      method: 'PATCH', headers: headers(),
      body: JSON.stringify({ status: 'accepted' }),
    })
    expect(arr.status).toBe(200)
    const accepted = await arr.json()
    expect(accepted.resultingTaskId).toBeGreaterThan(0)

    // Cleanup
    await fetch(`${API}/meetings/${m.id}`, { method: 'DELETE', headers: headers() })
    await fetch(`${API}/tasks/${t.id}`, { method: 'DELETE', headers: headers() })
  })
})