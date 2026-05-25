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

export type MeetingType = 'strategic' | 'coordination' | 'operational' | 'problem'
export type OperationalSubtype = 'subcontractor' | 'designer' | 'supplier' | 'other'
export type MeetingStage = 'draft' | 'preparation_clerk' | 'preparation_controller' | 'conducting' | 'approval' | 'distribution' | 'completed'
export type MeetingPeriodicity = 'one_time' | 'recurring'
export type GroupingMethod = 'by_topic' | 'by_subcontractor'

export interface Meeting {
  id: number
  title: string
  date: string
  subcontractorId: number | null
  attendees: string[]
  agenda: string
  decisions: string | null
  notes: string | null
  stage: MeetingStage
  meetingType: MeetingType
  periodicity: MeetingPeriodicity
  groupingMethod: GroupingMethod
  operationalSubtype: OperationalSubtype | null
  parentProtocolId: number | null
  sequenceNumber: number
  stageData: Record<string, unknown>
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
  // v2 fields
  meetingType?: MeetingType
  periodicity?: MeetingPeriodicity
  groupingMethod?: GroupingMethod
  operationalSubtype?: OperationalSubtype
  parentProtocolId?: number | null
  stage?: MeetingStage
}

export interface MeetingUpdate {
  title?: string
  date?: string
  subcontractorId?: number | null
  attendees?: string[]
  agenda?: string
  decisions?: string
  notes?: string
  meetingType?: MeetingType
  periodicity?: MeetingPeriodicity
  groupingMethod?: GroupingMethod
  operationalSubtype?: OperationalSubtype
  parentProtocolId?: number | null
  stage?: MeetingStage
}

export interface MeetingTransition {
  stage: MeetingStage
}

export interface MeetingAttendance {
  id: number
  meetingId: number
  employeeId: number
  status: AttendanceStatus
  createdAt: string
  updatedAt: string
}

export type AttendanceStatus = 'invited' | 'confirmed' | 'declined' | 'attended' | 'absent'

export interface MeetingAttendanceCreate {
  meetingId: number
  employeeId: number
  status?: AttendanceStatus
}

export interface ProtocolApproval {
  id: number
  meetingId: number
  employeeId: number
  status: ApprovalStatus
  comment: string | null
  createdAt: string
  updatedAt: string
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export interface ProtocolApprovalCreate {
  meetingId: number
  employeeId: number
  status?: ApprovalStatus
  comment?: string
}

export interface Task {
  id: number
  protocolId: number
  protocolTitle: string
  employeeId: number
  employeeName: string
  title: string
  description: string
  status: TaskStatus
  deadline: string | null
  createdAt: string
  updatedAt: string
}

export type TaskStatus = 'created' | 'in_progress' | 'done' | 'archived'

export interface Task {
  id: number
  protocolId: number
  sourceProtocolId: number | null
  taskNumber: string
  assigneeId: number | null
  controllerId: number | null
  title: string
  description: string
  status: TaskStatus
  resolutionText: string | null
  resolvedAt: string | null
  sortOrder: number
  parentTaskId: number | null
  topicTag: string | null
  subcontractorId: number | null
  deadline: string | null
  createdAt: string
  updatedAt: string
}

export interface TaskCreate {
  protocolId: number
  title: string
  description?: string
  assigneeId?: number | null
  controllerId?: number | null
  parentTaskId?: number | null
  topicTag?: string
  subcontractorId?: number | null
  deadline?: string | null
  sortOrder?: number
}

export interface TaskUpdate {
  protocolId?: number
  assigneeId?: number | null
  controllerId?: number | null
  title?: string
  description?: string
  status?: TaskStatus
  resolutionText?: string
  topicTag?: string
  subcontractorId?: number | null
  deadline?: string | null
}

export interface TaskTransition {
  status: TaskStatus
}

export interface Organization {
  id: number
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
}

export interface OrganizationCreate {
  name: string
  description?: string
}

export interface NotificationPreferences {
  id: number
  employeeId: number
  emailEnabled: boolean
  pushEnabled: boolean
  events: string[]
  createdAt: string
  updatedAt: string
}

export interface NotificationPreferencesUpdate {
  emailEnabled?: boolean
  pushEnabled?: boolean
  events?: string[]
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
    entity_type: string
    entity_id: number
    content: string
    score: number
    metadata: Record<string, unknown>
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
