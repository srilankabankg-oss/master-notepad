export interface Employee {
  id: number
  name: string
  email: string
  position: string | null
  createdAt: string
  updatedAt: string
}

export interface EmployeeCreate {
  name: string
  email: string
  position?: string
}

export interface Subcontractor {
  id: number
  name: string
  companyName: string | null
  contactInfo: string | null
  specialization: string | null
  description: string | null
  rating?: number
  createdAt: string
  updatedAt: string
}

export interface SubcontractorCreate {
  name: string
  companyName?: string
  contactInfo?: string
  specialization?: string
  description?: string
}

export interface Review {
  id: number
  subcontractorId: number
  employeeId: number
  content: string
  rating: number
  createdAt: string
  updatedAt: string
}

export interface ReviewCreate {
  subcontractorId: number
  employeeId: number
  content: string
  rating: number
}

export interface Comment {
  id: number
  subcontractorId: number
  employeeId: number
  content: string
  createdAt: string
  updatedAt: string
}

export interface CommentCreate {
  subcontractorId: number
  employeeId: number
  content: string
}

export interface CommentUpdate {
  content: string
}

export type ChecklistType = 'organization' | 'personal'

export interface ChecklistItem {
  text: string
  completed: boolean
}

export interface Checklist {
  id: number
  title: string
  type: ChecklistType
  ownerId: number | null
  items: ChecklistItem[]
  createdAt: string
  updatedAt: string
}

export interface ChecklistCreate {
  title: string
  type?: ChecklistType
  ownerId?: number | null
  items?: ChecklistItem[]
}

export interface ChecklistUpdate {
  title?: string
  items?: ChecklistItem[]
}

export type SuggestionStatus = 'pending' | 'approved' | 'rejected'

export interface Suggestion {
  id: number
  checklistId: number
  employeeId: number
  suggestion: string
  status: SuggestionStatus
  createdAt: string
  updatedAt: string
}

export interface SuggestionCreate {
  checklistId: number
  employeeId: number
  suggestion: string
}

export interface SuggestionUpdate {
  status: SuggestionStatus
}

export interface Meeting {
  id: number
  title: string
  date: string
  subcontractorId: number | null
  attendees: string[]
  agenda: string
  decisions: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface MeetingCreate {
  title: string
  date: string
  subcontractorId?: number | null
  attendees?: string[]
  agenda: string
  decisions?: string
  notes?: string
}

export interface Survey {
  id: number
  title: string
  subcontractorId: number
  createdBy: number
  questions: string[]
  createdAt: string
  updatedAt: string
}

export interface SurveyCreate {
  title: string
  subcontractorId: number
  createdBy: number
  questions?: string[]
}

export interface SurveyResponse {
  id: number
  surveyId: number
  employeeId: number
  answers: Record<string, string>
  createdAt: string
}

export interface SurveyResponseCreate {
  employeeId: number
  answers: Record<string, string>
}

export type EventType = 'positive' | 'violation' | 'info'

export interface ContractorEvent {
  id: number
  subcontractorId: number
  employeeId: number
  type: EventType
  description: string
  eventDate: string
  createdAt: string
}

export interface ContractorEventCreate {
  subcontractorId: number
  employeeId: number
  type: EventType
  description: string
  eventDate: string
}

export interface ApiError {
  error: string
  details?: string[]
}

export interface TenderSummary {
  subcontractor: Subcontractor
  rating: number
  reviews: Review[]
  events: ContractorEvent[]
  meetings: Meeting[]
  comments: Comment[]
  surveysCount: number
  violationsCount: number
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  name: string
  email: string
  password: string
  position?: string
}

export interface AuthEmployee {
  id: number
  name: string
  email: string
  position: string | null
  role: string
}

export interface AskRequest {
  question: string
  limit?: number
}

export interface AskResponse {
  answer: string
  sources: Array<{
    entityType: string
    entityId: number
    title: string
    excerpt: string
  }>
  confidence: number
}

export interface AuditLogEntry {
  id: number
  entityType: string
  entityId: number
  action: string
  employeeId: number | null
  employeeName: string | null
  changes: Record<string, unknown>
  createdAt: string
}
