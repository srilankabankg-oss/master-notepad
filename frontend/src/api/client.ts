import type {
  Employee, EmployeeCreate,
  Subcontractor, SubcontractorCreate,
  Review, ReviewCreate,
  Comment, CommentCreate, CommentUpdate,
  Checklist, ChecklistCreate, ChecklistUpdate,
  Suggestion, SuggestionCreate, SuggestionUpdate,
  Meeting, MeetingCreate, MeetingUpdate, MeetingTransition,
  MeetingAttendance, MeetingAttendanceCreate, AttendanceStatus,
  ProtocolApproval, ProtocolApprovalCreate, ApprovalStatus,
  Task, TaskCreate, TaskUpdate, TaskTransition, TaskStatus,
  Organization, OrganizationCreate,
  NotificationPreferences, NotificationPreferencesUpdate,
  Survey, SurveyCreate,
  SurveyResponse, SurveyResponseCreate,
  ContractorEvent, ContractorEventCreate, TenderSummary,
  LoginRequest, RegisterRequest, AuthEmployee,
  AskRequest, AskResponse,
  AuditLogEntry,
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
    credentials: 'include',
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
    update: (id: number, data: MeetingUpdate) =>
      request<Meeting>(`/meetings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<void>(`/meetings/${id}`, { method: 'DELETE' }),
    transition: (id: number, data: MeetingTransition) =>
      request<Meeting>(`/meetings/${id}/transition`, { method: 'POST', body: JSON.stringify(data) }),
    attendance: {
      list: (meetingId: number) =>
        request<MeetingAttendance[]>(`/meetings/${meetingId}/attendance`),
      create: (meetingId: number, data: MeetingAttendanceCreate) =>
        request<MeetingAttendance>(`/meetings/${meetingId}/attendance`, { method: 'POST', body: JSON.stringify(data) }),
      update: (meetingId: number, attendanceId: number, data: Partial<MeetingAttendanceCreate>) =>
        request<MeetingAttendance>(`/meetings/${meetingId}/attendance/${attendanceId}`, { method: 'PUT', body: JSON.stringify(data) }),
      delete: (meetingId: number, attendanceId: number) =>
        request<void>(`/meetings/${meetingId}/attendance/${attendanceId}`, { method: 'DELETE' }),
    },
    approvals: {
      list: (meetingId: number) =>
        request<ProtocolApproval[]>(`/meetings/${meetingId}/approvals`),
      create: (meetingId: number, data: ProtocolApprovalCreate) =>
        request<ProtocolApproval>(`/meetings/${meetingId}/approvals`, { method: 'POST', body: JSON.stringify(data) }),
      update: (meetingId: number, approvalId: number, data: Partial<ProtocolApprovalCreate>) =>
        request<ProtocolApproval>(`/meetings/${meetingId}/approvals/${approvalId}`, { method: 'PUT', body: JSON.stringify(data) }),
      delete: (meetingId: number, approvalId: number) =>
        request<void>(`/meetings/${meetingId}/approvals/${approvalId}`, { method: 'DELETE' }),
    },
    taskRequests: {
      list: (protocolId: number) =>
        request<Task[]>(`/meetings/${protocolId}/task-requests`),
      get: (protocolId: number, taskId: number) =>
        request<Task>(`/meetings/${protocolId}/task-requests/${taskId}`),
      create: (protocolId: number, data: TaskCreate) =>
        request<Task>(`/meetings/${protocolId}/task-requests`, { method: 'POST', body: JSON.stringify(data) }),
      update: (protocolId: number, taskId: number, data: TaskUpdate) =>
        request<Task>(`/meetings/${protocolId}/task-requests/${taskId}`, { method: 'PUT', body: JSON.stringify(data) }),
      delete: (protocolId: number, taskId: number) =>
        request<void>(`/meetings/${protocolId}/task-requests/${taskId}`, { method: 'DELETE' }),
    },
  },

  events: {
    list: (subcontractorId?: number) =>
      request<ContractorEvent[]>(`/events${qs({ subcontractorId })}`),
    get: (id: number) => request<ContractorEvent>(`/events/${id}`),
    create: (data: ContractorEventCreate) =>
      request<ContractorEvent>('/events', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<ContractorEventCreate>) =>
      request<ContractorEvent>(`/events/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<void>(`/events/${id}`, { method: 'DELETE' }),
    suggest: (id: number, checklistId: number, employeeId: number) =>
      request<Suggestion>(`/events/${id}/suggest`, { method: 'POST', body: JSON.stringify({ checklistId, employeeId }) }),
  },

  surveys: {
    list: () => request<Survey[]>('/surveys'),
    get: (id: number) => request<Survey>(`/surveys/${id}`),
    create: (data: SurveyCreate) =>
      request<Survey>('/surveys', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<SurveyCreate>) =>
      request<Survey>(`/surveys/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<void>(`/surveys/${id}`, { method: 'DELETE' }),
    respond: (id: number, data: SurveyResponseCreate) =>
      request<SurveyResponse>(`/surveys/${id}/respond`, { method: 'POST', body: JSON.stringify(data) }),
    responses: (id: number) =>
      request<SurveyResponse[]>(`/surveys/${id}/responses`),
  },

  tender: {
    summary: (id: number) => request<TenderSummary>(`/tender/${id}/summary`),
  },

  tasks: {
    list: (params?: { status?: TaskStatus; protocolId?: number; assigneeId?: number; search?: string }) =>
      request<Task[]>(`/tasks${params ? `?${new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)] as [string, string])).toString()}` : ''}`),
    get: (id: number) => request<Task>(`/tasks/${id}`),
    create: (data: TaskCreate) =>
      request<Task>('/tasks', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: TaskUpdate) =>
      request<Task>(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<void>(`/tasks/${id}`, { method: 'DELETE' }),
    transition: (id: number, data: TaskTransition) =>
      request<Task>(`/tasks/${id}/transition`, { method: 'POST', body: JSON.stringify(data) }),
    markDone: (id: number) =>
      request<Task>(`/tasks/${id}/done`, { method: 'POST' }),
    reorder: (tasks: { id: number; order: number }[]) =>
      request<{ message: string }>('/tasks/reorder', { method: 'POST', body: JSON.stringify({ tasks }) }),
  },

  organizations: {
    list: () => request<Organization[]>('/organizations'),
    get: (id: number) => request<Organization>(`/organizations/${id}`),
    create: (data: OrganizationCreate) =>
      request<Organization>('/organizations', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<OrganizationCreate>) =>
      request<Organization>(`/organizations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<void>(`/organizations/${id}`, { method: 'DELETE' }),
  },

  notifications: {
    preferences: () =>
      request<NotificationPreferences>('/notifications/preferences'),
    updatePreferences: (data: NotificationPreferencesUpdate) =>
      request<NotificationPreferences>('/notifications/preferences', { method: 'PUT', body: JSON.stringify(data) }),
  },

  auth: {
    login: (data: LoginRequest) =>
      request<AuthEmployee>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
    register: (data: RegisterRequest) =>
      request<AuthEmployee>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    logout: () => request<void>('/auth/logout', { method: 'POST' }),
    me: () => request<AuthEmployee>('/auth/me'),
  },

ai: {
    ask: (data: { question: string }) =>
      request<AskResponse>('/ai/ask', { method: 'POST', body: JSON.stringify(data) }),
  },

  bugs: {
    report: (data: { page: string; description: string }) =>
      request<{ ok: boolean }>('/bugs', { method: 'POST', body: JSON.stringify(data) }),
  },

  audit: {
    list: (entityType?: string, entityId?: number) =>
      request<AuditLogEntry[]>(`/audit-log${qs({ entityType, entityId })}`),
  },
}

export function errorMessage(e: unknown, fallback = 'Ошибка'): string {
  return e instanceof Error ? e.message : fallback
}

export { ApiRequestError }
