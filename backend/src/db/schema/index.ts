import { pgTable, serial, varchar, text, integer, timestamp, pgEnum, jsonb, boolean, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ── Enums ──
export const suggestionStatusEnum = pgEnum('suggestion_status', ['pending', 'approved', 'rejected']);
export const checklistTypeEnum = pgEnum('checklist_type', ['organization', 'personal']);
export const eventTypeEnum = pgEnum('event_type', ['positive', 'violation', 'info']);
export const auditActionEnum = pgEnum('audit_action', ['create', 'update', 'delete']);

// ── Meeting v2 Enums ──
export const meetingStageEnum = pgEnum('meeting_stage', [
  'draft',                   // Этап 1: Подготовка делопроизводителем
  'preparation_clerk',       // Этап 1 alt
  'preparation_controller',  // Этап 2: Подготовка контролирующими
  'conducting',              // Этап 3: Ведение протокола
  'approval',                // Этап 4: Утверждение
  'distribution',            // Этап 5: Рассылка
  'completed',               // Завершён
]);

export const meetingTypeEnum = pgEnum('meeting_type', [
  'strategic',      // Стратегическое
  'coordination',   // Координационное
  'operational',    // Оперативное
  'problem',        // Проблемное
]);

export const meetingPeriodicityEnum = pgEnum('meeting_periodicity', [
  'one_time',    // Разовое
  'recurring',   // Периодическое
]);

export const groupingMethodEnum = pgEnum('grouping_method', [
  'by_topic',         // Группировка задач по темам
  'by_subcontractor', // Группировка задач по подрядчикам
]);

export const operationalSubtypeEnum = pgEnum('operational_subtype', [
  'contractor',  // С подрядчиками
  'designer',    // С проектировщиками
  'supplier',    // С поставщиками
]);

export const taskRequestStatusEnum = pgEnum('task_request_status', [
  'submitted',   // Отправлен
  'reviewing',   // На рассмотрении
  'accepted',    // Принят
  'rejected',    // Отклонён
]);

export const approvalStatusEnum = pgEnum('approval_status', [
  'pending',         // Ожидает утверждения
  'approved',        // Утверждено
  'rejected',        // Отклонено (возврат на доработку)
  'auto_approved',   // Автоутверждено по таймауту
]);

export const personTypeEnum = pgEnum('person_type', [
  'employee',       // Сотрудник организации
  'subcontractor',  // Представитель контрагента
]);

export const attendanceStatusEnum = pgEnum('attendance_status', [
  'invited',     // Приглашён (Stage 1)
  'confirmed',   // Подтвердил участие
  'declined',    // Отказался
  'attended',    // Присутствовал (зафиксировано на Stage 3)
  'absent',      // Отсутствовал (зафиксировано на Stage 3)
]);

export const distributionChannelEnum = pgEnum('distribution_channel', [
  'email',
  'telegram',
]);

export const distributionStatusEnum = pgEnum('distribution_status', [
  'pending',   // Ожидает отправки
  'sent',      // Отправлено успешно
  'failed',    // Ошибка отправки
]);

// ── Tasks Enums ──
export const taskStatusEnum = pgEnum('task_status', [
  'created',      // Создана
  'in_progress',  // В работе
  'done',         // Выполнена
  'archived',     // Архив
]);

export const taskLinkRoleEnum = pgEnum('task_link_role', [
  'home',       // Домашний протокол (где задача создана)
  'delegated',  // Делегирована в другой протокол
]);

// ── Organizations ──
export const organizations = pgTable('organizations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  inn: varchar('inn', { length: 12 }).unique(),
  activityType: text('activity_type'),
  isContractor: boolean('is_contractor').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ── Employees ──
export const employees = pgTable('employees', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  position: varchar('position', { length: 255 }),
  passwordHash: varchar('password_hash', { length: 255 }),
  role: varchar('role', { length: 50 }).notNull().default('employee'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ── Subcontractors ──
export const subcontractors = pgTable('subcontractors', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  companyName: varchar('company_name', { length: 255 }),
  contactInfo: text('contact_info'),
  specialization: varchar('specialization', { length: 500 }),
  description: text('description'),
  organizationId: integer('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ── Reviews ──
export const reviews = pgTable('reviews', {
  id: serial('id').primaryKey(),
  subcontractorId: integer('subcontractor_id').references(() => subcontractors.id, { onDelete: 'cascade' }).notNull(),
  employeeId: integer('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  content: text('content').notNull(),
  rating: integer('rating').notNull(), // 1-10
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ── Comments (дополнительная информация о подрядчике) ──
export const comments = pgTable('comments', {
  id: serial('id').primaryKey(),
  subcontractorId: integer('subcontractor_id').references(() => subcontractors.id, { onDelete: 'cascade' }).notNull(),
  employeeId: integer('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ── Checklists ──
export const checklists = pgTable('checklists', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 500 }).notNull(),
  type: checklistTypeEnum('type').notNull().default('organization'),
  ownerId: integer('owner_id').references(() => employees.id, { onDelete: 'cascade' }),
  items: jsonb('items').notNull().$type<{ text: string; completed: boolean }[]>().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ── Checklist Suggestions (предложения улучшений) ──
export const checklistSuggestions = pgTable('checklist_suggestions', {
  id: serial('id').primaryKey(),
  checklistId: integer('checklist_id').references(() => checklists.id, { onDelete: 'cascade' }).notNull(),
  employeeId: integer('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  suggestion: text('suggestion').notNull(),
  status: suggestionStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ── Meeting Protocols v2 ──
export const meetingProtocols = pgTable('meeting_protocols', {
  id: serial('id').primaryKey(),

  // ── Основные поля (из v1) ──
  title: varchar('title', { length: 500 }).notNull(),
  date: timestamp('date').notNull(),
  agenda: text('agenda').notNull(),
  decisions: text('decisions'),
  notes: text('notes'),

  // ── Новые поля v2 ──
  stage: meetingStageEnum('stage').notNull().default('draft'),
  meetingType: meetingTypeEnum('meeting_type').notNull().default('operational'),
  periodicity: meetingPeriodicityEnum('periodicity').notNull().default('one_time'),
  groupingMethod: groupingMethodEnum('grouping_method').notNull().default('by_topic'),
  operationalSubtype: operationalSubtypeEnum('operational_subtype'),

  // ── Связи ──
  subcontractorId: integer('subcontractor_id').references(() => subcontractors.id, { onDelete: 'set null' }),
  // Для периодических: ссылка на родительский протокол (первый в серии)
  parentProtocolId: integer('parent_protocol_id').references((): any => meetingProtocols.id, { onDelete: 'set null' }),
  // Порядковый номер в цепочке периодических совещаний
  sequenceNumber: integer('sequence_number').default(1),

  // ── Данные этапов (JSONB) ──
  stageData: jsonb('stage_data').$type<Record<string, unknown>>().default({}),

  // ── Таймстемпы ──
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ── Task Requests ──
export const taskRequests = pgTable('task_requests', {
  id: serial('id').primaryKey(),
  protocolId: integer('protocol_id').references(() => meetingProtocols.id, { onDelete: 'cascade' }).notNull(),
  employeeId: integer('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description').notNull().default(''),
  status: taskRequestStatusEnum('status').notNull().default('submitted'),
  reasonRejected: text('reason_rejected'),
  reviewedBy: integer('reviewed_by').references(() => employees.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at'),
  resultingTaskId: integer('resulting_task_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ── Protocol Approvals ──
export const protocolApprovals = pgTable('protocol_approvals', {
  id: serial('id').primaryKey(),
  protocolId: integer('protocol_id').references(() => meetingProtocols.id, { onDelete: 'cascade' }).notNull(),
  employeeId: integer('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  status: approvalStatusEnum('status').notNull().default('pending'),
  comment: text('comment'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  uniqueProtocolEmployee: uniqueIndex('uq_protocol_approval')
    .on(table.protocolId, table.employeeId),
}));

// ── Protocol Distributions ──
export const protocolDistributions = pgTable('protocol_distributions', {
  id: serial('id').primaryKey(),
  protocolId: integer('protocol_id').references(() => meetingProtocols.id, { onDelete: 'cascade' }).notNull(),
  personType: personTypeEnum('person_type').notNull(),
  personId: integer('person_id').notNull(),
  email: varchar('email', { length: 255 }),
  telegramChatId: varchar('telegram_chat_id', { length: 100 }),
  channel: distributionChannelEnum('channel').notNull().default('email'),
  status: distributionStatusEnum('status').notNull().default('pending'),
  sentAt: timestamp('sent_at'),
  errorMessage: text('error_message'),
  retryCount: integer('retry_count').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── Meeting Attendance ──
export const meetingAttendance = pgTable('meeting_attendance', {
  id: serial('id').primaryKey(),
  protocolId: integer('protocol_id').references(() => meetingProtocols.id, { onDelete: 'cascade' }).notNull(),
  personType: personTypeEnum('person_type').notNull(),
  personId: integer('person_id').notNull(),
  status: attendanceStatusEnum('status').notNull().default('invited'),
  rsvpToken: varchar('rsvp_token', { length: 64 }).unique(),
  invitedAt: timestamp('invited_at'),
  rsvpAt: timestamp('rsvp_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  uniqueProtocolPerson: uniqueIndex('uq_protocol_person')
    .on(table.protocolId, table.personType, table.personId),
}));

// ── Surveys ──
export const surveys = pgTable('surveys', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 500 }).notNull(),
  subcontractorId: integer('subcontractor_id').references(() => subcontractors.id, { onDelete: 'cascade' }).notNull(),
  createdBy: integer('created_by').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  questions: jsonb('questions').notNull().$type<string[]>().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ── Contractor Events ──
export const contractorEvents = pgTable('contractor_events', {
  id: serial('id').primaryKey(),
  subcontractorId: integer('subcontractor_id').references(() => subcontractors.id, { onDelete: 'cascade' }).notNull(),
  employeeId: integer('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  type: eventTypeEnum('type').notNull(),
  description: text('description').notNull(),
  eventDate: timestamp('event_date').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── Survey Responses ──
export const surveyResponses = pgTable('survey_responses', {
  id: serial('id').primaryKey(),
  surveyId: integer('survey_id').references(() => surveys.id, { onDelete: 'cascade' }).notNull(),
  employeeId: integer('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  answers: jsonb('answers').notNull().$type<Record<string, string>>().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── Tasks ──
export const tasks = pgTable('tasks', {
  id: serial('id').primaryKey(),

  // ── Связи ──
  protocolId: integer('protocol_id').references(() => meetingProtocols.id, { onDelete: 'restrict' }).notNull(),
  sourceProtocolId: integer('source_protocol_id').references(() => meetingProtocols.id, { onDelete: 'set null' }),

  // ── Нумерация ──
  taskNumber: text('task_number').notNull().unique(),

  // ── Содержание ──
  title: text('title').notNull(),
  description: text('description'),

  // ── Ответственные ──
  assigneeId: integer('assignee_id').references(() => employees.id, { onDelete: 'set null' }),
  controllerId: integer('controller_id').references(() => employees.id, { onDelete: 'set null' }),

  // ── Статус и выполнение ──
  status: taskStatusEnum('status').notNull().default('created'),
  resolutionText: text('resolution_text'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),

  // ── Порядок внутри протокола ──
  sortOrder: integer('sort_order').notNull().default(0),

  // ── Иерархия подзадач ──
  parentTaskId: integer('parent_task_id').references((): any => tasks.id, { onDelete: 'set null' }),

  // ── Группировка ──
  topicTag: text('topic_tag'),
  subcontractorId: integer('subcontractor_id').references(() => subcontractors.id, { onDelete: 'set null' }),

  // ── Сроки ──
  deadline: timestamp('deadline', { withTimezone: true }),

  // ── Таймстемпы ──
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ── Protocol Task Links (junction) ──
export const protocolTaskLinks = pgTable('protocol_task_links', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id').references(() => tasks.id, { onDelete: 'cascade' }).notNull(),
  protocolId: integer('protocol_id').references(() => meetingProtocols.id, { onDelete: 'cascade' }).notNull(),
  role: taskLinkRoleEnum('role').notNull(),
  sourceProtocolId: integer('source_protocol_id').references(() => meetingProtocols.id, { onDelete: 'set null' }),
  sortOrder: integer('sort_order').notNull().default(0),
  createdBy: integer('created_by').references(() => employees.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueTaskProtocol: uniqueIndex('uq_task_protocol')
    .on(table.taskId, table.protocolId),
}));

// ── Task Reformulations ──
export const taskReformulations = pgTable('task_reformulations', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id').references(() => tasks.id, { onDelete: 'cascade' }).notNull(),
  protocolId: integer('protocol_id').references(() => meetingProtocols.id, { onDelete: 'cascade' }).notNull(),
  previousTitle: text('previous_title').notNull(),
  newTitle: text('new_title').notNull(),
  reformulationReason: text('reformulation_reason'),
  createdBy: integer('created_by').references(() => employees.id, { onDelete: 'set null' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ── Audit Log ──
export const userNotificationPreferences = pgTable('user_notification_preferences', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull().unique(),
  emailEnabled: boolean('email_enabled').default(true).notNull(),
  telegramEnabled: boolean('telegram_enabled').default(false).notNull(),
  telegramChatId: varchar('telegram_chat_id', { length: 100 }),
  notifyDeadlines: boolean('notify_deadlines').default(true).notNull(),
  notifyProtocolDistribution: boolean('notify_protocol_distribution').default(true).notNull(),
  notifyTaskRequestResults: boolean('notify_task_request_results').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const auditLog = pgTable('audit_log', {
  id: serial('id').primaryKey(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: integer('entity_id').notNull(),
  employeeId: integer('employee_id').references(() => employees.id, { onDelete: 'set null' }),
  action: auditActionEnum('action').notNull(),
  changes: jsonb('changes').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ── External tables (not managed by Drizzle, but declared to prevent drops) ──
export const session = pgTable('session', {
  sid: varchar('sid').primaryKey().notNull(),
  sess: jsonb('sess').notNull(),
  expire: timestamp('expire', { precision: 6 }),
});

export const embeddings = pgTable('embeddings', {
  id: serial('id').primaryKey(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: integer('entity_id').notNull(),
  chunkIndex: integer('chunk_index').default(0),
  content: text('content').notNull(),
  embedding: varchar('embedding'), // pgvector column, opaque to Drizzle
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ── Relations ──
export const employeesRelations = relations(employees, ({ many }) => ({
  reviews: many(reviews),
  comments: many(comments),
  checklists: many(checklists, { relationName: 'ownerChecklists' }),
  suggestions: many(checklistSuggestions),
  surveys: many(surveys, { relationName: 'createdSurveys' }),
  responses: many(surveyResponses),
  events: many(contractorEvents),
  auditLogs: many(auditLog),
  taskRequests: many(taskRequests),
  protocolApprovals: many(protocolApprovals),
  assignedTasks: many(tasks, { relationName: 'taskAssignee' }),
  controlledTasks: many(tasks, { relationName: 'taskController' }),
  reviewedTaskRequests: many(taskRequests, { relationName: 'taskRequestReviewer' }),
  taskLinkCreations: many(protocolTaskLinks, { relationName: 'taskLinkCreator' }),
}));

export const subcontractorsRelations = relations(subcontractors, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [subcontractors.organizationId],
    references: [organizations.id],
  }),
  reviews: many(reviews),
  comments: many(comments),
  meetings: many(meetingProtocols),
  surveys: many(surveys),
  events: many(contractorEvents),
  tasks: many(tasks),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  subcontractors: many(subcontractors),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  subcontractor: one(subcontractors, { fields: [reviews.subcontractorId], references: [subcontractors.id] }),
  employee: one(employees, { fields: [reviews.employeeId], references: [employees.id] }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  subcontractor: one(subcontractors, { fields: [comments.subcontractorId], references: [subcontractors.id] }),
  employee: one(employees, { fields: [comments.employeeId], references: [employees.id] }),
}));

export const checklistsRelations = relations(checklists, ({ one, many }) => ({
  owner: one(employees, { fields: [checklists.ownerId], references: [employees.id] }),
  suggestions: many(checklistSuggestions),
}));

export const checklistSuggestionsRelations = relations(checklistSuggestions, ({ one }) => ({
  checklist: one(checklists, { fields: [checklistSuggestions.checklistId], references: [checklists.id] }),
  employee: one(employees, { fields: [checklistSuggestions.employeeId], references: [employees.id] }),
}));

export const meetingProtocolsRelations = relations(meetingProtocols, ({ one, many }) => ({
  subcontractor: one(subcontractors, { fields: [meetingProtocols.subcontractorId], references: [subcontractors.id] }),
  parentProtocol: one(meetingProtocols, {
    fields: [meetingProtocols.parentProtocolId],
    references: [meetingProtocols.id],
    relationName: 'parentChildProtocols',
  }),
  childProtocols: many(meetingProtocols, { relationName: 'parentChildProtocols' }),
  taskRequests: many(taskRequests),
  approvals: many(protocolApprovals),
  distributions: many(protocolDistributions),
  attendance: many(meetingAttendance),
  tasks: many(tasks, { relationName: 'taskHomeProtocol' }),
  sourceForTasks: many(tasks, { relationName: 'taskSourceProtocol' }),
  protocolTaskLinks: many(protocolTaskLinks),
}));

export const taskRequestsRelations = relations(taskRequests, ({ one }) => ({
  protocol: one(meetingProtocols, {
    fields: [taskRequests.protocolId],
    references: [meetingProtocols.id],
  }),
  employee: one(employees, {
    fields: [taskRequests.employeeId],
    references: [employees.id],
  }),
  reviewer: one(employees, {
    fields: [taskRequests.reviewedBy],
    references: [employees.id],
    relationName: 'taskRequestReviewer',
  }),
}));

export const protocolApprovalsRelations = relations(protocolApprovals, ({ one }) => ({
  protocol: one(meetingProtocols, {
    fields: [protocolApprovals.protocolId],
    references: [meetingProtocols.id],
  }),
  employee: one(employees, {
    fields: [protocolApprovals.employeeId],
    references: [employees.id],
  }),
}));

export const protocolDistributionsRelations = relations(protocolDistributions, ({ one }) => ({
  protocol: one(meetingProtocols, {
    fields: [protocolDistributions.protocolId],
    references: [meetingProtocols.id],
  }),
}));

export const meetingAttendanceRelations = relations(meetingAttendance, ({ one }) => ({
  protocol: one(meetingProtocols, {
    fields: [meetingAttendance.protocolId],
    references: [meetingProtocols.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  protocol: one(meetingProtocols, {
    fields: [tasks.protocolId],
    references: [meetingProtocols.id],
    relationName: 'taskHomeProtocol',
  }),
  sourceProtocol: one(meetingProtocols, {
    fields: [tasks.sourceProtocolId],
    references: [meetingProtocols.id],
    relationName: 'taskSourceProtocol',
  }),
  assignee: one(employees, {
    fields: [tasks.assigneeId],
    references: [employees.id],
    relationName: 'taskAssignee',
  }),
  controller: one(employees, {
    fields: [tasks.controllerId],
    references: [employees.id],
    relationName: 'taskController',
  }),
  parentTask: one(tasks, {
    fields: [tasks.parentTaskId],
    references: [tasks.id],
    relationName: 'parentChildTasks',
  }),
  childTasks: many(tasks, { relationName: 'parentChildTasks' }),
  subcontractor: one(subcontractors, {
    fields: [tasks.subcontractorId],
    references: [subcontractors.id],
  }),
  protocolLinks: many(protocolTaskLinks),
  reformulations: many(taskReformulations),
}));

export const protocolTaskLinksRelations = relations(protocolTaskLinks, ({ one }) => ({
  task: one(tasks, {
    fields: [protocolTaskLinks.taskId],
    references: [tasks.id],
  }),
  protocol: one(meetingProtocols, {
    fields: [protocolTaskLinks.protocolId],
    references: [meetingProtocols.id],
  }),
  sourceProtocol: one(meetingProtocols, {
    fields: [protocolTaskLinks.sourceProtocolId],
    references: [meetingProtocols.id],
    relationName: 'linkSourceProtocol',
  }),
  creator: one(employees, {
    fields: [protocolTaskLinks.createdBy],
    references: [employees.id],
    relationName: 'taskLinkCreator',
  }),
}));

export const taskReformulationsRelations = relations(taskReformulations, ({ one }) => ({
  task: one(tasks, {
    fields: [taskReformulations.taskId],
    references: [tasks.id],
  }),
  protocol: one(meetingProtocols, {
    fields: [taskReformulations.protocolId],
    references: [meetingProtocols.id],
  }),
  creator: one(employees, {
    fields: [taskReformulations.createdBy],
    references: [employees.id],
  }),
}));

export const surveysRelations = relations(surveys, ({ one, many }) => ({
  subcontractor: one(subcontractors, { fields: [surveys.subcontractorId], references: [subcontractors.id] }),
  creator: one(employees, { fields: [surveys.createdBy], references: [employees.id] }),
  responses: many(surveyResponses),
}));

export const surveyResponsesRelations = relations(surveyResponses, ({ one }) => ({
  survey: one(surveys, { fields: [surveyResponses.surveyId], references: [surveys.id] }),
  employee: one(employees, { fields: [surveyResponses.employeeId], references: [employees.id] }),
}));

export const contractorEventsRelations = relations(contractorEvents, ({ one }) => ({
  subcontractor: one(subcontractors, { fields: [contractorEvents.subcontractorId], references: [subcontractors.id] }),
  employee: one(employees, { fields: [contractorEvents.employeeId], references: [employees.id] }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  employee: one(employees, { fields: [auditLog.employeeId], references: [employees.id] }),
}));
