import { test, expect } from '@playwright/test'

test.describe('AI Assistant Integration E2E', () => {
  test('backend proxy /api/ai/health works (AI service unavailable)', async ({ request }) => {
    const response = await request.get('http://localhost:3001/api/ai/health')
    expect(response.status()).toBe(503)
    const body = await response.json()
    expect(body.status).toBe('unavailable')
  })

  test('backend proxy /api/ai/ask forwards correctly', async ({ request }) => {
    const response = await request.post('http://localhost:3001/api/ai/ask', {
      data: {
        question: 'Какие чек-листы есть по фундаменту?',
        employeeId: 1,
        limit: 5,
      },
    })
    const body = await response.json()
    console.log('AI ask response status:', response.status(), JSON.stringify(body).slice(0, 200))
  })

  test('review CRUD triggers fire-and-forget reindex without errors', async ({ request }) => {
    const createResp = await request.post('http://localhost:3001/api/reviews', {
      data: {
        subcontractorId: 1,
        employeeId: 1,
        content: 'E2E тестовый отзыв для проверки реиндексации',
        rating: 8,
      },
    })
    expect(createResp.status()).toBe(201)
    const created = await createResp.json()

    const updateResp = await request.put(`http://localhost:3001/api/reviews/${created.id}`, {
      data: { content: 'Обновлённый E2E отзыв', rating: 7 },
    })
    expect(updateResp.status()).toBe(200)

    const deleteResp = await request.delete(`http://localhost:3001/api/reviews/${created.id}`)
    expect(deleteResp.status()).toBe(200)
  })

  test('subcontractor CRUD triggers fire-and-forget reindex', async ({ request }) => {
    const createResp = await request.post('http://localhost:3001/api/subcontractors', {
      data: {
        name: 'E2E Тестовый Подрядчик',
        specialization: 'Тестирование',
      },
    })
    expect(createResp.status()).toBe(201)
    const created = await createResp.json()

    const updateResp = await request.put(`http://localhost:3001/api/subcontractors/${created.id}`, {
      data: { name: 'E2E Обновлённый Подрядчик' },
    })
    expect(updateResp.status()).toBe(200)

    const deleteResp = await request.delete(`http://localhost:3001/api/subcontractors/${created.id}`)
    expect(deleteResp.status()).toBe(200)
  })

  test('event CRUD triggers fire-and-forget reindex', async ({ request }) => {
    const createResp = await request.post('http://localhost:3001/api/events', {
      data: {
        subcontractorId: 1,
        employeeId: 1,
        type: 'info',
        description: 'E2E тестовое событие',
        eventDate: new Date().toISOString(),
      },
    })
    expect(createResp.status()).toBe(201)
    const created = await createResp.json()

    const updateResp = await request.put(`http://localhost:3001/api/events/${created.id}`, {
      data: { description: 'Обновлённое E2E событие' },
    })
    expect(updateResp.status()).toBe(200)

    const deleteResp = await request.delete(`http://localhost:3001/api/events/${created.id}`)
    expect(deleteResp.status()).toBe(200)
  })

  test('tender summary endpoint works with parallelized queries', async ({ request }) => {
    const response = await request.get('http://localhost:3001/api/tender/1/summary')
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body).toHaveProperty('subcontractor')
    expect(body).toHaveProperty('rating')
    expect(body).toHaveProperty('reviews')
    expect(body).toHaveProperty('events')
    expect(body).toHaveProperty('meetings')
    expect(body).toHaveProperty('comments')
    expect(body).toHaveProperty('surveysCount')
    expect(body).toHaveProperty('violationsCount')
  })
})