export interface Employee {
  id: number
  name: string
  email: string
  position: string | null
  created_at: string
  updated_at: string
}

export interface EmployeeCreate {
  name: string
  email: string
  position?: string
}

export interface Subcontractor {
  id: number
  name: string
  company_name: string | null
  contact_info: string | null
  specialization: string | null
  description: string | null
  rating?: number
  created_at: string
  updated_at: string
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
  subcontractor_id: number
  employee_id: number
  content: string
  rating: number
  created_at: string
  updated_at: string
}

export interface ReviewCreate {
  subcontractorId: number
  employeeId: number
  content: string
  rating: number
}

export interface Comment {
  id: number
  subcontractor_id: number
  employee_id: number
  content: string
  created_at: string
  updated_at: string
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
  owner_id: number | null
  items: ChecklistItem[]
  created_at: string
  updated_at: string
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
  checklist_id: number
  employee_id: number
  suggestion: string
  status: SuggestionStatus
  created_at: string
  updated_at: string
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
  subcontractor_id: number | null
  attendees: string[]
  agenda: string
  decisions: string | null
  notes: string | null
  created_at: string
  updated_at: string
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
  subcontractor_id: number
  created_by: number
  questions: string[]
  created_at: string
  updated_at: string
}

export interface SurveyCreate {
  title: string
  subcontractorId: number
  createdBy: number
  questions?: string[]
}

export interface SurveyResponse {
  id: number
  survey_id: number
  employee_id: number
  answers: Record<string, string>
  created_at: string
}

export interface SurveyResponseCreate {
  employeeId: number
  answers: Record<string, string>
}

export type EventType = 'positive' | 'violation' | 'info'

export interface ContractorEvent {
  id: number
  subcontractor_id: number
  employee_id: number
  type: EventType
  description: string
  event_date: string
  created_at: string
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
