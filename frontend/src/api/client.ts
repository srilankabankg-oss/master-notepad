import type {
  Employee, EmployeeCreate,
  Subcontractor, SubcontractorCreate,
  Review, ReviewCreate,
  Comment, CommentCreate, CommentUpdate,
  Checklist, ChecklistCreate, ChecklistUpdate,
  Suggestion, SuggestionCreate, SuggestionUpdate,
  Meeting, MeetingCreate,
  Survey, SurveyCreate,
  SurveyResponse, SurveyResponseCreate,
} from '@/types/api'

const BASE_URL = '/api'

class ApiRequestError extends Error {
  status: number
  details?: string[]

  constructor(message: string, status: number, details?: string[]) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.details = details
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })

  if (!response.ok) {
    let errorMessage = `Ошибка ${response.status}`
    let details: string[] | undefined

    try {
      const body = await response.json()
      errorMessage = body.error || errorMessage
      details = body.details
    } catch {}

    throw new ApiRequestError(errorMessage, response.status, details)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json()
}

function qs(params: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, val] of Object.entries(params)) {
    if (val !== null && val !== undefined && val !== '') {
      search.set(key, String(val))
    }
  }
  return search.size ? `?${search.toString()}` : ''
}

export const api = {
  employees: {
    list: () => request<Employee[]>('/employees'),
    get: (id: number) => request<Employee>(`/employees/${id}`),
    create: (data: EmployeeCreate) =>
      request<Employee>('/employees', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<EmployeeCreate>) =>
      request<Employee>(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<void>(`/employees/${id}`, { method: 'DELETE' }),
  },

  subcontractors: {
    list: () => request<Subcontractor[]>('/subcontractors'),
    get: (id: number | string) => request<Subcontractor>(`/subcontractors/${id}`),
    create: (data: SubcontractorCreate) =>
      request<Subcontractor>('/subcontractors', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<SubcontractorCreate>) =>
      request<Subcontractor>(`/subcontractors/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<void>(`/subcontractors/${id}`, { method: 'DELETE' }),
  },

  reviews: {
    list: (subcontractorId?: number) =>
      request<Review[]>(`/reviews${qs({ subcontractorId })}`),
    get: (id: number) => request<Review>(`/reviews/${id}`),
    create: (data: ReviewCreate) =>
      request<Review>('/reviews', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<ReviewCreate>) =>
      request<Review>(`/reviews/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<void>(`/reviews/${id}`, { method: 'DELETE' }),
  },

  comments: {
    list: (subcontractorId?: number) =>
      request<Comment[]>(`/comments${qs({ subcontractorId })}`),
    get: (id: number) => request<Comment>(`/comments/${id}`),
    create: (data: CommentCreate) =>
      request<Comment>('/comments', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: CommentUpdate) =>
      request<Comment>(`/comments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<void>(`/comments/${id}`, { method: 'DELETE' }),
  },

  checklists: {
    list: (type?: Checklist['type'], ownerId?: number) =>
      request<Checklist[]>(`/checklists${qs({ type, ownerId })}`),
    get: (id: number) => request<Checklist>(`/checklists/${id}`),
    create: (data: ChecklistCreate) =>
      request<Checklist>('/checklists', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: ChecklistUpdate) =>
      request<Checklist>(`/checklists/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<void>(`/checklists/${id}`, { method: 'DELETE' }),
  },

  suggestions: {
    list: (checklistId?: number) =>
      request<Suggestion[]>(`/suggestions${qs({ checklistId })}`),
    get: (id: number) => request<Suggestion>(`/suggestions/${id}`),
    create: (data: SuggestionCreate) =>
      request<Suggestion>('/suggestions', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: SuggestionUpdate) =>
      request<Suggestion>(`/suggestions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<void>(`/suggestions/${id}`, { method: 'DELETE' }),
  },

  meetings: {
    list: (subcontractorId?: number) =>
      request<Meeting[]>(`/meetings${qs({ subcontractorId })}`),
    get: (id: number) => request<Meeting>(`/meetings/${id}`),
    create: (data: MeetingCreate) =>
      request<Meeting>('/meetings', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<MeetingCreate>) =>
      request<Meeting>(`/meetings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<void>(`/meetings/${id}`, { method: 'DELETE' }),
  },

  surveys: {
    list: () => request<Survey[]>('/surveys'),
    get: (id: number) => request<Survey>(`/surveys/${id}`),
    create: (data: SurveyCreate) =>
      request<Survey>('/surveys', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<void>(`/surveys/${id}`, { method: 'DELETE' }),
    respond: (id: number, data: SurveyResponseCreate) =>
      request<SurveyResponse>(`/surveys/${id}/respond`, { method: 'POST', body: JSON.stringify(data) }),
    responses: (id: number) =>
      request<SurveyResponse[]>(`/surveys/${id}/responses`),
  },
}

export function errorMessage(e: unknown, fallback = 'Ошибка'): string {
  return e instanceof Error ? e.message : fallback
}

export { ApiRequestError }
