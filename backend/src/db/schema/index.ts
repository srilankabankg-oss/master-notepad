import { pgTable, serial, varchar, text, integer, timestamp, pgEnum, jsonb, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ── Enums ──
export const suggestionStatusEnum = pgEnum('suggestion_status', ['pending', 'approved', 'rejected']);
export const checklistTypeEnum = pgEnum('checklist_type', ['organization', 'personal']);

// ── Employees ──
export const employees = pgTable('employees', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  position: varchar('position', { length: 255 }),
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

// ── Meeting Protocols ──
export const meetingProtocols = pgTable('meeting_protocols', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 500 }).notNull(),
  date: timestamp('date').notNull(),
  subcontractorId: integer('subcontractor_id').references(() => subcontractors.id, { onDelete: 'set null' }),
  attendees: jsonb('attendees').notNull().$type<string[]>().default([]),
  agenda: text('agenda').notNull(),
  decisions: text('decisions'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

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

// ── Survey Responses ──
export const surveyResponses = pgTable('survey_responses', {
  id: serial('id').primaryKey(),
  surveyId: integer('survey_id').references(() => surveys.id, { onDelete: 'cascade' }).notNull(),
  employeeId: integer('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  answers: jsonb('answers').notNull().$type<Record<string, string>>().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── Relations ──
export const employeesRelations = relations(employees, ({ many }) => ({
  reviews: many(reviews),
  comments: many(comments),
  checklists: many(checklists, { relationName: 'ownerChecklists' }),
  suggestions: many(checklistSuggestions),
  surveys: many(surveys, { relationName: 'createdSurveys' }),
  responses: many(surveyResponses),
}));

export const subcontractorsRelations = relations(subcontractors, ({ many }) => ({
  reviews: many(reviews),
  comments: many(comments),
  meetings: many(meetingProtocols),
  surveys: many(surveys),
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

export const meetingProtocolsRelations = relations(meetingProtocols, ({ one }) => ({
  subcontractor: one(subcontractors, { fields: [meetingProtocols.subcontractorId], references: [subcontractors.id] }),
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
