import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTenderStore } from '@/stores/tender'

const mockSubcontractor = {
  id: 1,
  name: 'Иван Петров',
  company_name: 'СтройГрупп',
  contact_info: '+7 900 123 45 67',
  specialization: 'Электромонтаж',
  description: 'Электромонтажные работы',
  rating: 8.5,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
}

const mockReview = {
  id: 1,
  subcontractor_id: 1,
  employee_id: 1,
  content: 'Хорошая работа',
  rating: 9,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
}

const mockEvent = {
  id: 1,
  subcontractor_id: 1,
  employee_id: 1,
  type: 'positive' as const,
  description: 'Своевременная сдача',
  event_date: '2025-01-01',
  created_at: '2025-01-01T00:00:00Z',
}

const mockMeeting = {
  id: 1,
  title: 'Совещание',
  date: '2025-01-01',
  subcontractor_id: 1,
  attendees: ['Иван Петров'],
  agenda: 'Обсуждение работ',
  decisions: 'Принять работы',
  notes: null,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
}

const mockComment = {
  id: 1,
  subcontractor_id: 1,
  employee_id: 1,
  content: 'Комментарий',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
}

const mockSummary = {
  subcontractor: mockSubcontractor,
  rating: 8.5,
  reviews: [mockReview],
  events: [mockEvent],
  meetings: [mockMeeting],
  comments: [mockComment],
  surveysCount: 2,
  violationsCount: 0,
}

function mockFetchSuccess(data: unknown): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  )
}

function mockFetchFailure(message: string, status = 500): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  )
}

describe('useTenderStore', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    setActivePinia(createPinia())
  })

  it('initial state — summary is null, loading is false, error is null', () => {
    const store = useTenderStore()
    expect(store.summary).toBeNull()
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
  })

  it('fetchSummary sets loading to true during fetch', async () => {
    mockFetchSuccess(mockSummary)

    const store = useTenderStore()
    const promise = store.fetchSummary(1)

    expect(store.loading).toBe(true)

    await promise
  })

  it('fetchSummary sets summary on success', async () => {
    mockFetchSuccess(mockSummary)

    const store = useTenderStore()
    await store.fetchSummary(1)

    expect(store.summary).toEqual(mockSummary)
  })

  it('fetchSummary sets error on failure', async () => {
    mockFetchFailure('Серверная ошибка', 500)

    const store = useTenderStore()
    await store.fetchSummary(1)

    expect(store.error).toBe('Серверная ошибка')
  })

  it('fetchSummary clears loading after success', async () => {
    mockFetchSuccess(mockSummary)

    const store = useTenderStore()
    await store.fetchSummary(1)

    expect(store.loading).toBe(false)
  })

  it('fetchSummary clears loading after failure', async () => {
    mockFetchFailure('Сетевая ошибка', 503)

    const store = useTenderStore()
    await store.fetchSummary(1)

    expect(store.loading).toBe(false)
  })

  it('fetchSummary stores correct data — subcontractor, rating, reviews, events etc.', async () => {
    mockFetchSuccess(mockSummary)

    const store = useTenderStore()
    await store.fetchSummary(1)

    expect(store.summary).not.toBeNull()
    expect(store.summary!.subcontractor).toEqual(mockSubcontractor)
    expect(store.summary!.rating).toBe(8.5)
    expect(store.summary!.reviews).toEqual([mockReview])
    expect(store.summary!.events).toEqual([mockEvent])
    expect(store.summary!.meetings).toEqual([mockMeeting])
    expect(store.summary!.comments).toEqual([mockComment])
    expect(store.summary!.surveysCount).toBe(2)
    expect(store.summary!.violationsCount).toBe(0)
  })
})
