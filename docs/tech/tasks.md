# Система задач

## 1. Обзор

Задачи — это связующий элемент между протоколами совещаний. Каждая задача рождается в протоколе (домашнем), может быть перенесена в другой протокол (делегирована), а результат её выполнения (текст решения) подтягивается обратно в исходный протокол.

### Ключевые возможности

| Возможность | Описание |
|-------------|----------|
| Уникальная нумерация | `TASK-YYYY-NNNNN` — сквозной номер в календарном году |
| Параллелизация | Перенос задачи между протоколами разных уровней (ручной + AI-предложения) |
| Цепочки подзадач | Большая задача разбивается на шаги, каждый со своим ответственным |
| Жизненный цикл | `Создана → В работе → Выполнена → Архив` |
| Обратная связь | `resolution_text` и `resolved_at` текутся из целевого протокола в домашний |

### Связь с протоколами

```
Протокол оперативный (площадка)
├── Задача 1: Завершить бетонирование
│   └── [перенесена в] → Протокол координационный (проектная команда)
│         └── [решение] → "Бетонирование завершено 15.05, акт подписан"
│               └── [подтягивается обратно в] → Протокол оперативный
└── Задача 2: Предоставить паспорта на арматуру
      └── остаётся в оперативном протоколе
```

## 2. Data Model

### Поля задачи

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | serial | Уникальный идентификатор |
| `protocol_id` | int | FK на домашний протокол (`meeting_protocols.id`) |
| `source_protocol_id` | int \| null | FK на протокол-источник при переносе (nullable) |
| `task_number` | text | Уникальный номер `TASK-YYYY-NNNNN` |
| `title` | text | Заголовок задачи |
| `description` | text \| null | Подробное описание |
| `assignee_id` | int \| null | FK на `employees.id` — исполнитель |
| `controller_id` | int \| null | FK на `employees.id` — контролирующий |
| `status` | task_status | Жизненный цикл (см. §6) |
| `resolution_text` | text \| null | Текст решения/результата выполнения |
| `resolved_at` | timestamptz \| null | Дата и время выполнения |
| `sort_order` | int | Порядок отображения внутри протокола |
| `parent_task_id` | int \| null | FK на родительскую задачу (для подзадач) |
| `topic_tag` | text \| null | Тег темы (при группировке по темам) |
| `subcontractor_id` | int \| null | FK на `subcontractors.id` — при группировке по подрядчикам |
| `deadline` | timestamptz \| null | Срок выполнения |
| `created_at` | timestamptz | Дата создания |
| `updated_at` | timestamptz | Дата обновления |

### Junction: `protocol_task_links`

Связывает задачу с протоколами, в которых она участвует (один протокол = одна строка):

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | serial | Уникальный идентификатор |
| `task_id` | int | FK на `tasks.id` |
| `protocol_id` | int | FK на `meeting_protocols.id` — протокол, где видна задача |
| `role` | task_link_role | `home` (домашний) или `delegated` (делегированная) |
| `source_protocol_id` | int \| null | При `delegated`: FK на протокол, откуда задача перенесена |
| `sort_order` | int | Порядок отображения задачи в этом конкретном протоколе |
| `created_by` | int | FK на `employees.id` — кто выполнил перенос |
| `created_at` | timestamptz | Дата создания связи |

**Инварианты:**
- Каждая задача имеет ровно одну запись с `role = 'home'` (в домашнем протоколе)
- Задача может иметь 0+ записей с `role = 'delegated'` (перенесена в другие протоколы)
- Уникальный constraint `(task_id, protocol_id)` — задача не может быть дважды в одном протоколе
- `sort_order` в junction позволяет каждой delegated-задаче иметь свой порядок в целевом протоколе

### Цепочки подзадач

Поле `parent_task_id` создаёт древовидную структуру:

```
Задача 1: "Подготовить объект к сдаче"
├── Подзадача 1.1: "Завершить бетонирование" → Выполнена
├── Подзадача 1.2: "Пройти экспертизу" → В работе
└── Подзадача 1.3: "Подписать акты" → Создана
```

Подзадача наследует `protocol_id` и `task_number` префикс от родителя.

## 3. Unique Numbering

### Формат

```
TASK-YYYY-NNNNN
│    │    │
│    │    └── Порядковый номер в году (5 цифр, с ведущими нулями)
│    └── Год (4 цифры)
└── Префикс "TASK"
```

Примеры: `TASK-2025-00001`, `TASK-2025-00042`, `TASK-2026-00001`

### Генерация

Номер генерируется на бэкенде при создании задачи. Алгоритм:

```ts
async function generateTaskNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const count = await db.$with('max_num').as(
    db.select({ max: sql<number>`COALESCE(MAX(CAST(SUBSTRING(task_number FROM 9 FOR 5) AS INTEGER)), 0)` })
      .from(tasks)
      .where(like(tasks.taskNumber, `TASK-${year}-%`))
  )
  const next = (await db.select({ n: count.max }).from(count).then(r => r[0].n)) + 1
  return `TASK-${year}-${String(next).padStart(5, '0')}`
}
```

### Уникальность

Ограничение уникальности на уровне БД: `UNIQUE(task_number)`. При попытке создать задачу с дублирующим номером возвращается 409 Conflict.

## 4. Reformulation Chains

### Уточнение задачи

При изменении контекста формулировка задачи может уточняться от протокола к протоколу. История формулировок хранится в `task_reformulations`:

```ts
export const taskReformulations = pgTable('task_reformulations', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id').references(() => tasks.id, { onDelete: 'cascade' }).notNull(),
  protocolId: integer('protocol_id').references(() => meetingProtocols.id).notNull(),
  previousTitle: text('previous_title').notNull(),
  newTitle: text('new_title').notNull(),
  reformulationReason: text('reformulation_reason'),
  createdBy: integer('created_by').references(() => employees.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### Подзадачи

Большая задача может быть разбита на подзадачи через `parent_task_id`. Подзадача:
- Наследует `protocol_id` от родителя
- Получает номер по шаблону `TASK-YYYY-NNNNN-SS` (суффикс `-SS` — порядковый номер подзадачи)
- Имеет собственный жизненный цикл, независимый от других подзадач и родителя
- При выполнении всех подзадач родительская задача может автоматически переходить в `done`

### API для подзадач

```
GET    /api/tasks/:id/subtasks       # Список подзадач
POST   /api/tasks/:id/subtasks       # Создать подзадачу { title, description?, assigneeId? }
```

## 5. Parallelization

### Перенос задачи между протоколами

Перенос создаёт новую запись в `protocol_task_links` с `role = 'delegated'`:

```
┌─────────────────────────────────────────────────────────┐
│  Протокол оперативный (ID: 5)                            │
│  ├── Задача 1: "Завершить бетонирование" [role=home]    │
│  │     └── delegated → Протокол координационный (ID: 3) │
│  └── Задача 2: "Паспорта на арматуру" [role=home]       │
└─────────────────────────────────────────────────────────┘
```

### AI-предложения для переноса

AI-ассистент анализирует задачи в протоколе и предлагает кандидатов для переноса в другой протокол на основе:
- Семантической близости темы задачи к темам другого протокола
- Участия одного и того же ответственного в нескольких протоколах
- Принадлежности задачи к тому же подрядчику, что и другой протокол

Формат предложения:

```ts
interface TaskMoveSuggestion {
  taskId: number
  taskTitle: string
  suggestedTargetProtocolId: number
  suggestedTargetProtocolTitle: string
  reason: string          // "Задача относится к проектированию, есть протокол проектной команды"
  confidence: number      // 0–1
}
```

### API для переноса

```
POST   /api/tasks/:id/move            # Перенести задачу { targetProtocolId, reason? }
GET    /api/tasks/:id/links           # Список всех протоколов, где участвует задача
POST   /api/tasks/:id/links/:linkId/return  # Вернуть задачу в домашний протокол
```

### Возврат решения в домашний протокол

При отметке задачи как выполненной (`resolution_text` заполнен) в целевом протоколе система автоматически подтягивает `resolution_text` и `resolved_at` в домашний протокол через фоновую задачу. В домашнем протоколе отображается:

```
Задача 1: "Завершить бетонирование"
  Статус: ✅ Выполнена
  Решение: Бетонирование завершено 15.05.2025, акт подписан
  (из Протокол координационный №5 от 16.05.2025)
```

## 6. Lifecycle

```
Создана (created)
    │
    ▼
В работе (in_progress)
    │
    ▼
Выполнена (done)
    │
    ▼
Архив (archived)
```

### Переходы

| Переход | Кто может | Условия |
|---------|-----------|---------|
| `created → in_progress` | Исполнитель или контролирующий | — |
| `in_progress → done` | Исполнитель | Требуется `resolution_text` |
| `done → archived` | Система (автоматически) | Задача отображается в следующем протоколе серии |
| `in_progress → created` | Контролирующий | Сброс на начальное состояние |
| `done → in_progress` | Контролирующий | Возврат на доработку |

### Поля при переходе в `done`

При отметке задачи как выполненной заполняются:
- `status = 'done'`
- `resolution_text` — текст решения/результата (обязателен)
- `resolved_at` — текущее время

### Архивирование

Задача переходит в `archived` автоматически после того, как была показана в следующем протоколе периодического совещания с отметкой «Выполнено». Архивированные задачи не отображаются в активном списке, но доступны через фильтр `status=archived`.

## 7. DB Schema (Drizzle ORM)

Полная Drizzle ORM схема для домена задач. Использует стиль, принятый в проекте.

### 7.1 Enums

```ts
import { pgTable, serial, varchar, text, integer, timestamp, pgEnum, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

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
```

### 7.2 tasks

```ts
export const tasks = pgTable('tasks', {
  id: serial('id').primaryKey(),

  // ── Связи ──
  // Домашний протокол (не удаляется из tasks при удалении протокола — CASCADE только на junction)
  protocolId: integer('protocol_id')
    .references(() => meetingProtocols.id, { onDelete: 'restrict' })
    .notNull(),
  // Протокол-источник при переносе (nullable — заполняется только для delegated)
  sourceProtocolId: integer('source_protocol_id')
    .references(() => meetingProtocols.id, { onDelete: 'set null' }),

  // ── Нумерация ──
  taskNumber: text('task_number').notNull().unique(),  // TASK-YYYY-NNNNN

  // ── Содержание ──
  title: text('title').notNull(),
  description: text('description'),

  // ── Ответственные ──
  assigneeId: integer('assignee_id')
    .references(() => employees.id, { onDelete: 'set null' }),
  controllerId: integer('controller_id')
    .references(() => employees.id, { onDelete: 'set null' }),

  // ── Статус и выполнение ──
  status: taskStatusEnum('status').notNull().default('created'),
  resolutionText: text('resolution_text'),  // Текст решения (обязателен при done)
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),

  // ── Порядок внутри протокола ──
  sortOrder: integer('sort_order').notNull().default(0),

  // ── Иерархия подзадач ──
  parentTaskId: integer('parent_task_id')
    .references((): any => tasks.id, { onDelete: 'set null' }),

  // ── Группировка ──
  topicTag: text('topic_tag'),  // Тег темы (при grouping_method = 'by_topic')
  subcontractorId: integer('subcontractor_id')
    .references(() => subcontractors.id, { onDelete: 'set null' }),  // Связь с подрядчиком (при 'by_contractor')

  // ── Сроки ──
  deadline: timestamp('deadline', { withTimezone: true }),

  // ── Таймстемпы ──
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

### 7.3 protocol_task_links (junction)

Связывает задачу с протоколами. Каждая задача имеет ровно одну запись `role='home'` и 0+ записей `role='delegated'`.

```ts
export const protocolTaskLinks = pgTable('protocol_task_links', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id')
    .references(() => tasks.id, { onDelete: 'cascade' })
    .notNull(),
  protocolId: integer('protocol_id')
    .references(() => meetingProtocols.id, { onDelete: 'cascade' })
    .notNull(),
  // Роль задачи в этом протоколе
  role: taskLinkRoleEnum('role').notNull(),
  // При delegated: из какого протокола задача пришла
  sourceProtocolId: integer('source_protocol_id')
    .references(() => meetingProtocols.id, { onDelete: 'set null' }),
  // Порядок отображения в этом протоколе
  sortOrder: integer('sort_order').notNull().default(0),
  // Кто выполнил перенос
  createdBy: integer('created_by')
    .references(() => employees.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // Одна и та же задача не может быть дважды в одном протоколе
  uniqueTaskProtocol: uniqueIndex('uq_task_protocol')
    .on(table.taskId, table.protocolId),
}));
```

### 7.4 task_reformulations

```ts
export const taskReformulations = pgTable('task_reformulations', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id')
    .references(() => tasks.id, { onDelete: 'cascade' })
    .notNull(),
  protocolId: integer('protocol_id')
    .references(() => meetingProtocols.id, { onDelete: 'cascade' })
    .notNull(),
  previousTitle: text('previous_title').notNull(),
  newTitle: text('new_title').notNull(),
  reformulationReason: text('reformulation_reason'),
  createdBy: integer('created_by')
    .references(() => employees.id, { onDelete: 'set null' })
    .notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
```

### 7.5 Drizzle Relations

```ts
export const tasksRelations = relations(tasks, ({ one, many }) => ({
  // Домашний протокол
  protocol: one(meetingProtocols, {
    fields: [tasks.protocolId],
    references: [meetingProtocols.id],
    relationName: 'taskHomeProtocol',
  }),
  // Протокол-источник (при переносе)
  sourceProtocol: one(meetingProtocols, {
    fields: [tasks.sourceProtocolId],
    references: [meetingProtocols.id],
    relationName: 'taskSourceProtocol',
  }),
  // Ответственные
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
  // Иерархия
  parentTask: one(tasks, {
    fields: [tasks.parentTaskId],
    references: [tasks.id],
    relationName: 'parentChildTasks',
  }),
  childTasks: many(tasks, { relationName: 'parentChildTasks' }),
  // Подрядчик
  subcontractor: one(subcontractors, {
    fields: [tasks.subcontractorId],
    references: [subcontractors.id],
  }),
  // Junction → протоколы
  protocolLinks: many(protocolTaskLinks),
  // История переформулировок
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
```

### 7.6 meetingProtocols — добавление связи с задачами

```ts
// Дополнение к существующим meetingProtocolsRelations:
export const meetingProtocolsRelations = relations(meetingProtocols, ({ one, many }) => ({
  // ... существующие связи
  tasks: many(tasks, { relationName: 'taskHomeProtocol' }),
  sourceForTasks: many(tasks, { relationName: 'taskSourceProtocol' }),
  protocolTaskLinks: many(protocolTaskLinks),
}));
```

### 7.7 Индексы

```sql
-- Поиск задач по протоколу
CREATE INDEX idx_tasks_protocol ON tasks(protocol_id);

-- Поиск задач по исполнителю
CREATE INDEX idx_tasks_assignee ON tasks(assignee_id);

-- Поиск задач по контролирующему
CREATE INDEX idx_tasks_controller ON tasks(controller_id);

-- Фильтрация по статусу
CREATE INDEX idx_tasks_status ON tasks(status);

-- Поиск подзадач
CREATE INDEX idx_tasks_parent ON tasks(parent_task_id);

-- Поиск по номеру задачи (быстрый lookup)
CREATE UNIQUE INDEX idx_tasks_number ON tasks(task_number);

-- Junction: задачи протокола
CREATE INDEX idx_ptl_protocol ON protocol_task_links(protocol_id);

-- Junction: все протоколы задачи
CREATE INDEX idx_ptl_task ON protocol_task_links(task_id);

-- Junction: поиск delegated записей
CREATE INDEX idx_ptl_role ON protocol_task_links(protocol_id, role);

-- Переформулировки по задаче
CREATE INDEX idx_task_reform_task ON task_reformulations(task_id);

-- Переформулировки по протоколу
CREATE INDEX idx_task_reform_protocol ON task_reformulations(protocol_id);
```

### 7.8 ERD-диаграмма

```
                         ┌──────────────────────┐
                         │    meeting_protocols  │
                         └──────────┬───────────┘
                                    │
                    ┌───────────────┼────────────────┐
                    │               │                │
                    ▼               ▼                ▼
          ┌─────────────┐  ┌──────────────────┐  ┌──────────────────┐
          │    tasks     │  │protocol_task_links│  │task_reformulations│
          │              │  │                  │  │                  │
          │ protocol_id  │◄─│ task_id (FK)     │  │ task_id (FK)     │
          │ task_number  │  │ protocol_id (FK) │  │ protocol_id (FK) │
          │ title        │  │ role             │  │ previous_title   │
          │ description  │  │ source_protocol  │  │ new_title        │
          │ assignee_id  │  │ sort_order       │  │ reason           │
          │ controller_id│  │ created_by       │  │ created_by       │
          │ status       │  └──────────────────┘  └──────────────────┘
          │ resolution   │
          │ sort_order   │     tasks ──(parent_task_id)──▶ tasks  [self-ref: подзадачи]
          │ parent_task   │◄───┘
          │ subcontractor │
          │ deadline      │
          └──────────────┘
```

### 7.9 Отличия от PLAN.md

| Аспект | PLAN.md | Реализация | Причина |
|--------|---------|-----------|---------|
| `sort_order` | В junction `protocol_tasks` | **В `tasks`** | Упрощает запросы: `ORDER BY sort_order` без JOIN к junction для домашнего протокола |
| `protocol_id` в tasks | Нет (только junction) | **Есть** | Денормализация для быстрых запросов «задачи протокола» без JOIN |
| Junction имя | `protocol_tasks` | `protocol_task_links` | Избегает путаницы с таблицей `tasks` |
| `role` в junction | `home` / `delegated` | ✅ `home` / `delegated` | Совпадает |
| `source_protocol_id` в junction | Есть | ✅ Есть | Для отслеживания источника delegated-задач |

Компромисс: `sort_order` в `tasks` (не в junction) для производительности — основное использование порядка внутри домашнего протокола. Для delegated-задач свой `sort_order` хранится в `protocol_task_links.sort_order`.

## 8. API Design

### CRUD задач

```
GET    /api/tasks                      # Список (фильтры: protocolId, assigneeId, status, parentTaskId?)
GET    /api/tasks/:id                  # По ID (с историей переформулировок и связями с протоколами)
POST   /api/tasks                      # Создать { protocolId, title, description?, assigneeId?, controllerId?, parentTaskId?, topicTag? }
PUT    /api/tasks/:id                  # Обновить { title?, description?, assigneeId?, controllerId?, status?, resolutionText?, topicTag? }
DELETE /api/tasks/:id                  # Удалить (только если status = 'created')
```

### Перемещение и порядок

```
POST   /api/tasks/:id/move             # Перенести в другой протокол { targetProtocolId, reason? }
POST   /api/tasks/:id/return           # Вернуть в домашний протокол
POST   /api/tasks/:id/reorder          # Изменить порядок { sortOrder }
```

### Подзадачи

```
GET    /api/tasks/:id/subtasks         # Список подзадач
POST   /api/tasks/:id/subtasks         # Создать подзадачу { title, description?, assigneeId? }
```

### История переформулировок

```
GET    /api/tasks/:id/reformulations   # История изменений формулировки
```

### Список задач по протоколу

```
GET    /api/meetings/:id/tasks         # Задачи протокола (включая делегированные)
```

### Zod-схемы

```ts
const createTaskSchema = z.object({
  protocolId: z.number().int().positive(),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  assigneeId: z.number().int().positive().nullable().optional(),
  controllerId: z.number().int().positive().nullable().optional(),
  parentTaskId: z.number().int().positive().nullable().optional(),
  topicTag: z.string().optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  assigneeId: z.number().int().positive().nullable().optional(),
  controllerId: z.number().int().positive().nullable().optional(),
  status: z.enum(['created', 'in_progress', 'done', 'archived']).optional(),
  resolutionText: z.string().optional(),
  topicTag: z.string().optional(),
});

const moveTaskSchema = z.object({
  targetProtocolId: z.number().int().positive(),
  reason: z.string().optional(),
});

const reorderTaskSchema = z.object({
  sortOrder: z.number().int().min(0),
});
```

### Обработка ошибок

| Код | Ситуация |
|-----|---------|
| 400 | Неверный формат `task_number` или статуса |
| 400 | `resolution_text` обязателен при переходе в `done` |
| 404 | Задача / протокол не найден |
| 409 | Дублирующийся `task_number` |
| 409 | Задача уже делегирована в целевой протокол |
| 422 | Нельзя удалить задачу со статусом `in_progress` или `done` |

## 9. AI Integration

### Формат suggestions для переноса

AI-ассистент анализирует задачи в текущем протоколе и возвращает предложения по переносу:

```ts
interface TaskMoveSuggestion {
  taskId: number
  taskTitle: string
  suggestedTargetProtocolId: number
  suggestedTargetProtocolTitle: string
  reason: string
  confidence: number
}
```

### API

```
POST   /api/ai/tasks/:id/suggest-move    # Получить предложения по переносу задачи
POST   /api/ai/tasks/suggest-moves       # Пакетные предложения для всех задач протокола { protocolId }
```

### RAG indexing

Задачи индексируются в pgvector для RAG-поиска AI-ассистента:

| Поле | Использование |
|------|---------------|
| `title` | Векторизуется для семантического поиска |
| `description` | Векторизуется для семантического поиска |
| `resolution_text` | Векторизуется после выполнения для поиска решений |
| `topic_tag` | Используется как метаданный фильтр |

При создании/обновлении/выполнении задачи вызывается `ai-reindex.ts` для обновления embedding.

### AI-анализ задач

```
GET    /api/ai/tasks/analysis?protocolId=X  # Анализ задач протокола: сложность, оценка сроков, риски
```

Результат:

```ts
interface TaskAnalysis {
  protocolId: number
  tasks: Array<{
    taskId: number
    estimatedEffort: 'low' | 'medium' | 'high'
    riskLevel: 'low' | 'medium' | 'high'
    suggestedDeadline?: string
    notes?: string
  }>
  overallRisk: 'low' | 'medium' | 'high'
}
```

## 10. Testing Strategy

### Unit

- Генерация номера: `TASK-YYYY-NNNNN` формат, уникальность, последовательность в году
- Переходы статусов: все допустимые и недопустимые переходы
- Подзадачи: создание с `parent_task_id`, наследование `protocol_id`
- `resolution_text` обязателен при `done`

### Integration

- Полный цикл задачи: `created → in_progress → done → archived`
- Перенос: задача появляется в двух протоколах с разными `role`
- Возврат решения: `resolution_text` подтягивается в домашний протокол
- Подзадачи: создание, получение списка, удаление родителя каскадно удаляет подзадачи
- Нумерация: параллельное создание 10 задач → номера последовательные, нет дубликатов

### E2E

- Создание задачи в протоколе → отображение в списке задач протокола
- Перенос задачи в другой протокол → связь отображается в обоих протоколах
- Отметка выполнения → `resolution_text` подтягивается в домашний протокол
- Создание подзадачи → отображается в иерархии

## 11. Frontend

### 11.1 Общие принципы

Задачи отображаются в трёх контекстах:
1. **Общий список** — все задачи системы с фильтрами
2. **В протоколе** — задачи конкретного протокола с группировкой
3. **Детальная страница** — одна задача со всей связанной информацией

Все компоненты используют `<script setup lang="ts">`, scoped CSS, container queries, русский UI, без CSS-фреймворков.

### 11.2 Дерево компонентов

```
TasksView.vue                        # /tasks — общий список задач
├── FilterBar                         # Панель фильтров (протокол, исполнитель, статус)
├── TasksTable                        # Таблица задач
│   └── TaskRow (v-for)              # Строка задачи
│       ├── TaskNumberBadge           # Номер задачи TASK-YYYY-NNNNN
│       ├── TaskTitle                 # Заголовок
│       ├── TaskStatusBadge           # Бейдж статуса
│       ├── TaskAssignee              # Исполнитель
│       └── TaskProtocolLink          # Ссылка на протокол
└── EmptyState                        # "Нет задач"

TaskDetailView.vue                    # /tasks/:id — детальная страница
├── TaskHeader                        # Заголовок: номер, название, статус, кнопки
├── TaskMeta                          # Мета: исполнитель, контролирующий, дедлайн
├── TaskDescription                   # Описание задачи
├── TaskResolution                    # Блок решения (если выполнена)
├── TaskProtocolsSection              # Связанные протоколы (home + delegated)
│   └── TaskProtocolCard (v-for)     # Карточка протокола с ролью (home/delegated)
├── TaskReformulationsSection         # История переформулировок
│   └── ReformulationItem (v-for)    # Предыдущая → новая формулировка
├── TaskSubtasksSection               # Подзадачи (если есть)
│   └── SubtaskItem (v-for)          # Подзадача со статусом
└── TaskActions                       # Кнопки: редактировать, перенести, отметить выполненной

MeetingTasksView.vue                  # /meetings/:id/tasks — задачи в протоколе
├── MeetingHeader                     # Заголовок протокола + индикатор группировки
├── GroupingToggle                    # Переключатель: по темам / по подрядчикам
├── TaskGroup (v-for по группе)       # Группа задач
│   ├── GroupTitle                    # Название группы (тема или подрядчик)
│   └── TaskCard (v-for)             # Карточка задачи в группе
│       ├── DragHandle                # Ручка для drag-and-drop
│       ├── TaskTitle                 # Заголовок
│       ├── TaskStatusBadge           # Статус
│       └── TaskAssignee              # Исполнитель
├── MoveTaskButton                    # Кнопка "Перенести в другой протокол"
└── EmptyState                        # "Нет задач в этом протоколе"

TaskFormView.vue                      # /meetings/:id/tasks/new — создание задачи
├── FormFields
│   ├── TitleInput                    # Заголовок (обязательно)
│   ├── DescriptionTextarea           # Описание
│   ├── AssigneeSelect                # Исполнитель (из useEmployeeStore)
│   ├── ControllerSelect              # Контролирующий (из useEmployeeStore)
│   ├── TopicTagInput                 # Тег темы (при группировке по темам)
│   └── ParentTaskSelect              # Родительская задача (для подзадачи)
└── FormActions                       # Отмена / Сохранить

TaskSubtasksView.vue                  # /tasks/:id/subtasks — подзадачи
├── ParentTaskCard                    # Карточка родительской задачи
├── SubtasksList                      # Список подзадач
│   └── SubtaskItem (v-for)          # Подзадача с чекбоксом выполнения
└── AddSubtaskButton                  # Кнопка "Добавить подзадачу"
```

### 11.3 TaskListView (TasksView.vue)

Страница общих списка задач. Использует `container-type: inline-size` для адаптации таблицы на узких экранах.

**Структура:**

```vue
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useEmployeeStore } from '@/stores/employees'
import { useMeetingStore } from '@/stores/meetings'
import { useEntityForm } from '@/composables/useEntityForm'
import { useDeleteConfirm } from '@/composables/useDeleteConfirm'
import BaseButton from '@/components/BaseButton.vue'
import Modal from '@/components/Modal.vue'

const taskStore = useTaskStore()
const employeeStore = useEmployeeStore()
const meetingStore = useMeetingStore()

// Фильтры
const filterProtocolId = ref<number | null>(null)
const filterAssigneeId = ref<number | null>(null)
const filterStatus = ref<TaskStatus | 'all'>('all')

const filteredTasks = computed(() => {
  let result = taskStore.items
  if (filterProtocolId.value) result = result.filter(t => t.protocolId === filterProtocolId.value)
  if (filterAssigneeId.value) result = result.filter(t => t.assigneeId === filterAssigneeId.value)
  if (filterStatus.value !== 'all') result = result.filter(t => t.status === filterStatus.value)
  return result.sort((a, b) => a.taskNumber.localeCompare(b.taskNumber))
})

const statusLabel = (status: TaskStatus) => {
  const labels: Record<TaskStatus, string> = {
    created: 'Создана',
    in_progress: 'В работе',
    done: 'Выполнена',
    archived: 'Архив',
  }
  return labels[status]
}

const statusColor = (status: TaskStatus) => {
  const colors: Record<TaskStatus, string> = {
    created: 'var(--color-text-muted)',
    in_progress: 'var(--color-primary)',
    done: 'var(--color-success)',
    archived: 'var(--color-text-meta)',
  }
  return colors[status]
}

onMounted(async () => {
  await Promise.all([taskStore.fetchAll(), employeeStore.fetchAll(), meetingStore.fetchAll()])
})
</script>
```

**Таблица на десктопе, карточки на мобильных (`@container (max-width: 40rem)`):**

```css
.view { max-width: 75rem; container-type: inline-size; }

.filter-bar {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
  flex-wrap: wrap;
}

.filter-select {
  padding: var(--space-2) var(--space-3);
  border: 0.0625rem solid var(--color-border-input);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-base);
  background: var(--color-bg-card);
  min-width: 12.5rem;
}

/* Адаптация таблицы в карточки */
@container (max-width: 40rem) {
  .tasks-table thead { display: none; }
  .tasks-table tbody,
  .tasks-table tr,
  .tasks-table td {
    display: block;
  }
  .tasks-table tr {
    padding: var(--space-3) var(--space-4);
    border-bottom: 0.0625rem solid var(--color-border);
  }
  .tasks-table td {
    padding: var(--space-1) 0;
    border-bottom: none;
    display: flex;
    justify-content: space-between;
  }
  .tasks-table td:first-child {
    font-weight: var(--font-weight-semibold);
    color: var(--color-primary);
  }
  .tasks-table td:not(:first-child)::before {
    content: attr(data-label);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-medium);
    color: var(--color-text-muted);
    text-transform: uppercase;
    margin-right: var(--space-2);
  }
}
```

### 11.4 TaskDetailView (TaskDetailView.vue)

Страница детали задачи. Использует `container-type: inline-size`.

**Структура:**

```vue
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTaskStore } from '@/stores/tasks'
import { useTaskLinkStore } from '@/stores/taskLinks'
import { useTaskReformulationStore } from '@/stores/taskReformulations'
import { useEmployeeStore } from '@/stores/employees'
import { useMeetingStore } from '@/stores/meetings'
import { formatDate } from '@/composables/useDateFormatter'
import BaseButton from '@/components/BaseButton.vue'
import Modal from '@/components/Modal.vue'

const route = useRoute()
const router = useRouter()
const taskId = Number(route.params.id)

const taskStore = useTaskStore()
const linkStore = useTaskLinkStore()
const reformulationStore = useTaskReformulationStore()
const employeeStore = useEmployeeStore()
const meetingStore = useMeetingStore()

const task = ref<Awaited<ReturnType<typeof taskStore.fetchById>> | null>(null)
const links = ref<TaskLink[]>([])
const reformulations = ref<TaskReformulation[]>([])
const loading = ref(true)

const getEmployeeName = computed(() => useEmployeeName(employeeStore.items))
const getProtocolTitle = computed(() => {
  const map = new Map<number, string>()
  meetingStore.items.forEach(m => map.set(m.id, m.title))
  return (id: number) => map.get(id) || `Протокол #${id}`
})

const homeLink = computed(() => links.value.find(l => l.role === 'home'))
const delegatedLinks = computed(() => links.value.filter(l => l.role === 'delegated'))

const showMoveModal = ref(false)
const showDoneModal = ref(false)
const resolutionText = ref('')

async function loadAll() {
  const [t, l, r] = await Promise.all([
    taskStore.fetchById(taskId),
    linkStore.fetchByTask(taskId),
    reformulationStore.fetchByTask(taskId),
  ])
  task.value = t || null
  links.value = l
  reformulations.value = r
}

onMounted(async () => {
  await Promise.all([employeeStore.fetchAll(), meetingStore.fetchAll()])
  await loadAll()
})

async function handleMove(targetProtocolId: number) {
  await taskStore.move(taskId, { targetProtocolId })
  showMoveModal.value = false
  await loadAll()
}

async function handleMarkDone() {
  await taskStore.markDone(taskId, resolutionText.value)
  showDoneModal.value = false
  await loadAll()
}
</script>
```

**Стили:**

```css
.view { max-width: 56.25rem; container-type: inline-size; }

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-4);
}

.task-number {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-muted);
  letter-spacing: 0.05em;
  margin-bottom: var(--space-1);
}

.task-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  margin: 0;
}

.task-meta {
  display: flex;
  gap: var(--space-6);
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-subtle);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-4);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.task-meta-item {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.task-meta-label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.task-section {
  background: var(--color-bg-card);
  border: 0.0625rem solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  margin-bottom: var(--space-4);
}

.task-section-title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--space-3);
}

.protocol-link {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--color-bg-subtle);
  border-radius: var(--radius-sm);
  margin-bottom: var(--space-2);
  font-size: var(--font-size-sm);
}

.protocol-role {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  padding: 0.125rem 0.5rem;
  border-radius: 999px;
}

.protocol-role-home {
  background: var(--color-badge-positive-bg);
  color: var(--color-badge-positive-text);
}

.protocol-role-delegated {
  background: var(--color-badge-info-bg);
  color: var(--color-badge-info-text);
}

.reformulation-item {
  padding: var(--space-3) 0;
  border-bottom: 0.0625rem solid var(--color-border);
}

.reformulation-item:last-child {
  border-bottom: none;
}

.reformulation-change {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
}

.reformulation-arrow {
  color: var(--color-text-muted);
}

.reformulation-reason {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin-top: var(--space-1);
}

@container (max-width: 40rem) {
  .task-meta {
    flex-direction: column;
    gap: var(--space-2);
  }
  .task-header {
    flex-direction: column;
    gap: var(--space-2);
  }
}
```

### 11.5 useTaskStore

Полное хранилище задач с всеми действиями:

```ts
// stores/tasks.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api, errorMessage } from '@/api/client'
import type { ProtocolTask, TaskCreate, TaskUpdate, TaskStatus, TaskMove } from '@/types/api'

export const useTaskStore = defineStore('tasks', () => {
  const items = ref<ProtocolTask[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchAll(params?: {
    protocolId?: number
    assigneeId?: number
    status?: TaskStatus
    parentTaskId?: number
  }) {
    loading.value = true
    error.value = null
    try {
      items.value = await api.tasks.list(params)
    } catch (e: unknown) {
      error.value = errorMessage(e, 'Не удалось загрузить задачи')
    } finally {
      loading.value = false
    }
  }

  async function fetchById(id: number) {
    return api.tasks.get(id)
  }

  async function create(data: TaskCreate) {
    const item = await api.tasks.create(data)
    items.value.push(item)
    return item
  }

  async function update(id: number, data: TaskUpdate) {
    const updated = await api.tasks.update(id, data)
    const idx = items.value.findIndex((t) => t.id === id)
    if (idx !== -1) items.value[idx] = updated
    return updated
  }

  async function remove(id: number) {
    await api.tasks.remove(id)
    items.value = items.value.filter((t) => t.id !== id)
  }

  async function move(id: number, data: TaskMove) {
    const link = await api.tasks.move(id, data)
    // Обновить задачу: добавить targetProtocolId в список связанных
    const task = items.value.find((t) => t.id === id)
    if (task) {
      task.sourceProtocolId = data.targetProtocolId
    }
    return link
  }

  async function returnToHome(id: number) {
    const link = await api.tasks.returnToHome(id)
    const task = items.value.find((t) => t.id === id)
    if (task) {
      task.sourceProtocolId = null
    }
    return link
  }

  async function reorder(id: number, sortOrder: number) {
    const updated = await api.tasks.reorder(id, sortOrder)
    const idx = items.value.findIndex((t) => t.id === id)
    if (idx !== -1) items.value[idx] = updated
    return updated
  }

  async function markDone(id: number, resolutionText: string) {
    const updated = await api.tasks.markDone(id, resolutionText)
    const idx = items.value.findIndex((t) => t.id === id)
    if (idx !== -1) items.value[idx] = updated
    return updated
  }

  async function fetchSubtasks(parentId: number) {
    return api.tasks.subtasks(parentId)
  }

  async function createSubtask(parentId: number, data: Omit<TaskCreate, 'protocolId' | 'parentTaskId'>) {
    const item = await api.tasks.createSubtask(parentId, data)
    items.value.push(item)
    return item
  }

  return {
    items,
    loading,
    error,
    fetchAll,
    fetchById,
    create,
    update,
    remove,
    move,
    returnToHome,
    reorder,
    markDone,
    fetchSubtasks,
    createSubtask,
  }
})
```

### 11.6 Роуты для задач

```ts
// router/index.ts — добавление в существующий массив routes
{
  path: '/tasks',
  name: 'tasks',
  component: () => import('@/views/TasksView.vue'),
},
{
  path: '/tasks/:id',
  name: 'task-detail',
  component: () => import('@/views/TaskDetailView.vue'),
},
{
  path: '/tasks/:id/subtasks',
  name: 'task-subtasks',
  component: () => import('@/views/TaskSubtasksView.vue'),
},
{
  path: '/meetings/:id/tasks',
  name: 'meeting-tasks',
  component: () => import('@/views/MeetingTasksView.vue'),
},
{
  path: '/meetings/:id/tasks/new',
  name: 'meeting-task-new',
  component: () => import('@/views/TaskFormView.vue'),
},
```

### 11.7 UI для параллелизации (drag-and-drop между протоколами)

#### MeetingTasksView — drag-and-drop для изменения порядка

Внутри группы задач (по теме или по подрядчику) реализуется drag-and-drop через нативный HTML5 Drag and Drop API:

```vue
<!-- MeetingTasksView.vue — карточка задачи с drag-handle -->
<div
  class="task-card"
  draggable="true"
  @dragstart="onDragStart(task.id, $event)"
  @dragover.prevent="onDragOver(task.id, $event)"
  @drop="onDrop(task.id, $event)"
  @dragend="onDragEnd"
>
  <span class="drag-handle" aria-label="Перетащить для изменения порядка">⠿</span>
  <span class="task-title">{{ task.title }}</span>
  <span class="task-status-badge" :style="{ background: statusColor(task.status) }">
    {{ statusLabel(task.status) }}
  </span>
</div>
```

```ts
// Логика drag-and-drop в <script setup>
const draggedTaskId = ref<number | null>(null)
const dragOverTaskId = ref<number | null>(null)

function onDragStart(taskId: number, e: DragEvent) {
  draggedTaskId.value = taskId
  e.dataTransfer!.effectAllowed = 'move'
}

function onDragOver(targetId: number, e: DragEvent) {
  e.preventDefault()
  dragOverTaskId.value = targetId
}

async function onDrop(targetId: number, _e: DragEvent) {
  if (draggedTaskId.value === null || draggedTaskId.value === targetId) return
  // Получить текущий порядок и вычислить новый sortOrder
  const groupTasks = groupedTasks.value.flatMap(g => g.tasks)
  const draggedIdx = groupTasks.findIndex(t => t.id === draggedTaskId.value)
  const targetIdx = groupTasks.findIndex(t => t.id === targetId)
  const newOrder = [...groupTasks]
  const [dragged] = newOrder.splice(draggedIdx, 1)
  newOrder.splice(targetIdx, 0, dragged)
  // Отправить новые sortOrder на бэкенд
  await Promise.all(
    newOrder.map((t, i) => taskStore.reorder(t.id, i))
  )
  draggedTaskId.value = null
  dragOverTaskId.value = null
}

function onDragEnd() {
  draggedTaskId.value = null
  dragOverTaskId.value = null
}
```

```css
/* Стили drag-and-drop */
.task-card {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--color-bg-card);
  border: 0.0625rem solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: grab;
  transition: box-shadow 0.15s, border-color 0.15s;
}

.task-card:active {
  cursor: grabbing;
}

.task-card[draggable="true"]:hover {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 0.125rem rgba(26, 86, 219, 0.1);
}

.task-card.drag-over {
  border-color: var(--color-primary);
  border-style: dashed;
}

.drag-handle {
  color: var(--color-text-muted);
  cursor: grab;
  user-select: none;
  font-size: 1rem;
  line-height: 1;
}

.drag-handle:active {
  cursor: grabbing;
}
```

#### Модальное окно переноса задачи между протоколами

```vue
<!-- TaskDetailView.vue — кнопка "Перенести в другой протокол" -->
<BaseButton variant="secondary" @click="showMoveModal = true">
  Перенести в другой протокол
</BaseButton>

<Modal v-model="showMoveModal" title="Перенос задачи в другой протокол">
  <div class="move-task-form">
    <p class="move-task-hint">
      Задача <strong>{{ task?.taskNumber }} {{ task?.title }}</strong> будет добавлена
      в выбранный протокол как делегированная. Решение останется в домашнем протоколе.
    </p>
    <label class="field">
      <span class="field-label">Целевой протокол</span>
      <select v-model="selectedProtocolId" class="input">
        <option v-for="p in availableProtocols" :key="p.id" :value="p.id">
          {{ p.title }} ({{ formatDate(p.date) }})
        </option>
      </select>
    </label>
    <label class="field">
      <span class="field-label">Причина переноса (опционально)</span>
      <textarea v-model="moveReason" class="input textarea" rows="2" />
    </label>
    <div class="form-actions">
      <BaseButton variant="secondary" type="button" @click="showMoveModal = false">Отмена</BaseButton>
      <BaseButton variant="primary" type="button" :disabled="!selectedProtocolId || moveLoading" @click="handleMove(selectedProtocolId!)">
        {{ moveLoading ? 'Перенос...' : 'Перенести' }}
      </BaseButton>
    </div>
  </div>
</Modal>
```

```css
.move-task-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.move-task-hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: 1.6;
}
```

#### Отображение связанных протоколов в TaskDetailView

```
Связанные протоколы
┌──────────────────────────────────────────────────────────┐
│ Оперативное совещание №5 (10.05.2025)  [домашний]        │
│ Координационное совещание №3 (16.05.2025) [делегирована] │
└──────────────────────────────────────────────────────────┘
```

Каждая карточка показывает: название протокола, дата, роль (`home`/`delegated`), ссылку для перехода. При клике на протокол — переход на страницу протокола.

### 11.8 Паттерн группировки задач в MeetingTasksView

Группировка реализуется через `computed`-свойство, которое преобразует плоский массив задач в дерево групп:

```ts
const groupedTasks = computed(() => {
  const protocol = meetingStore.items.find(m => m.id === protocolId)
  if (!protocol) return []

  if (protocol.groupingMethod === 'by_topic') {
    // Группировка по topicTag
    const groups = new Map<string | null, ProtocolTask[]>()
    tasks.value.forEach(task => {
      const tag = task.topicTag || null
      if (!groups.has(tag)) groups.set(tag, [])
      groups.get(tag)!.push(task)
    })
    return Array.from(groups.entries()).map(([tag, tasks]) => ({
      title: tag || 'Без темы',
      tasks: tasks.sort((a, b) => a.sortOrder - b.sortOrder),
    }))
  } else {
    // Группировка по подрядчику
    const groups = new Map<string | null, ProtocolTask[]>()
    tasks.value.forEach(task => {
      const subName = task.subcontractorName || null
      if (!groups.has(subName)) groups.set(subName, [])
      groups.get(subName)!.push(task)
    })
    return Array.from(groups.entries()).map(([name, tasks]) => ({
      title: name || 'Внутренние',
      tasks: tasks.sort((a, b) => a.sortOrder - b.sortOrder),
    }))
  }
})
```

### 11.9 Container queries

`TaskDetailView.vue` и `MeetingTasksView.vue` используют `container-type: inline-size`:
- На узких экранах (`@container (max-width: 40rem)`) связанные протоколы отображаются в столбик
- Карточки задач на мобильных занимают полную ширину контейнера
- Группировка по темам/подрядчикам на мобильных сворачивается в аккордеон (используется `<details>`/`<summary>`)

### 11.10 RBAC в UI

| Роль | Видит | Может |
|------|-------|-------|
| `admin` | Все задачи | Создавать, редактировать, удалять, переносить |
| `clerk` | Задачи в протоколах, где является создателем | Редактировать описание, фиксировать явку |
| `controller` | Задачи, где является контролирующим | Изменять статус, назначать исполнителя, утверждать выполнение |
| `employee` | Только свои задачи и задачи из протоколов, где участник | Изменять статус своих задач, создавать подзадачи |
| `contractor` | Нет доступа | — |

Кнопки с запрещёнными операциями скрыты через `v-if`:

```vue
<BaseButton v-if="canEditTask(task)" @click="openEdit(task)">Изменить</BaseButton>
<BaseButton v-if="canMoveTask(task)" @click="showMoveModal = true">Перенести</BaseButton>
```

```ts
const canEditTask = (task: ProtocolTask) => {
  const role = auth.user?.role
  if (role === 'admin') return true
  if (role === 'clerk' && task.createdBy === auth.user?.id) return true
  if (role === 'controller' && task.controllerId === auth.user?.id) return true
  if (role === 'employee' && task.assigneeId === auth.user?.id) return true
  return false
}
```
