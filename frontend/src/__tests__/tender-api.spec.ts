import { describe, it, expect, beforeEach, vi } from 'vitest'
import { api } from '../api/client'

const mockTenderSummary = {
  subcontractor: {
    id: 1,
    name: 'Иван Иванов',
    company_name: 'ООО СтройГрупп',
    specialization: 'Электромонтажные работы',
    contact_info: '+7 (900) 123-45-67',
    description: 'Электромонтажные работы',
    rating: 8.5,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-06-01T12:00:00Z',
  },
  rating: 8.5,
  reviews: [
    {
      id: 1,
      subcontractor_id: 1,
      employee_id: 1,
      content: 'Отличная работа',
      rating: 9,
      created_at: '2024-05-01T10:00:00Z',
      updated_at: '2024-05-01T10:00:00Z',
    },
  ],
  events: [
    {
      id: 1,
      subcontractor_id: 1,
      employee_id: 1,
      type: 'positive',
      description: 'Своевременная сдача',
      event_date: '2024-05-15',
      created_at: '2024-05-15T10:00:00Z',
    },
  ],
  meetings: [
    {
      id: 1,
      title: 'Совещание',
      date: '2024-05-20T10:00:00Z',
      subcontractor_id: 1,
      attendees: ['Иван Иванов'],
      agenda: 'Обсуждение работ',
      decisions: 'Принять работы',
      notes: null,
      created_at: '2024-05-20T10:00:00Z',
      updated_at: '2024-05-20T10:00:00Z',
    },
  ],
  comments: [
    {
      id: 1,
      subcontractor_id: 1,
      employee_id: 1,
      content: 'Комментарий',
      created_at: '2024-05-25T10:00:00Z',
      updated_at: '2024-05-25T10:00:00Z',
    },
  ],
  surveysCount: 3,
  violationsCount: 1,
}

describe('api.tender.summary()', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.restoreAllMocks()
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockTenderSummary), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
  })

  it('api.tender namespace exists and has summary method', () => {
    expect(api.tender).toBeDefined()
    expect(typeof api.tender.summary).toBe('function')
  })

  it('returns correct shape with all 8 fields', async () => {
    const result = await api.tender.summary(1)
    expect(result).toHaveProperty('subcontractor')
    expect(result).toHaveProperty('rating')
    expect(result).toHaveProperty('reviews')
    expect(result).toHaveProperty('events')
    expect(result).toHaveProperty('meetings')
    expect(result).toHaveProperty('comments')
    expect(result).toHaveProperty('surveysCount')
    expect(result).toHaveProperty('violationsCount')
  })

  it('subcontractor is an object with expected fields', async () => {
    const result = await api.tender.summary(1)
    expect(typeof result.subcontractor).toBe('object')
    expect(result.subcontractor).toHaveProperty('id')
    expect(result.subcontractor).toHaveProperty('name')
    expect(result.subcontractor).toHaveProperty('company_name')
  })

  it('rating is a number', async () => {
    const result = await api.tender.summary(1)
    expect(typeof result.rating).toBe('number')
    expect(result.rating).toBe(8.5)
  })

  it('reviews is an array', async () => {
    const result = await api.tender.summary(1)
    expect(Array.isArray(result.reviews)).toBe(true)
  })

  it('events is an array', async () => {
    const result = await api.tender.summary(1)
    expect(Array.isArray(result.events)).toBe(true)
  })

  it('meetings is an array', async () => {
    const result = await api.tender.summary(1)
    expect(Array.isArray(result.meetings)).toBe(true)
  })

  it('comments is an array', async () => {
    const result = await api.tender.summary(1)
    expect(Array.isArray(result.comments)).toBe(true)
  })

  it('surveysCount is a number', async () => {
    const result = await api.tender.summary(1)
    expect(typeof result.surveysCount).toBe('number')
  })

  it('violationsCount is a number', async () => {
    const result = await api.tender.summary(1)
    expect(typeof result.violationsCount).toBe('number')
  })

  it('calls correct URL /api/tender/1/summary', async () => {
    await api.tender.summary(1)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/tender/1/summary',
      expect.objectContaining({
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      })
    )
  })
})
