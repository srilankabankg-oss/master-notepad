# Architecture Integration — v1 → v2

> Синтезирующий документ, объединяющий все технические дизайны v2.
> **Базовый документ:** [architecture.md](architecture.md) — существующая архитектура.
> **Feature-документы:** [meeting-protocols-v2.md](meeting-protocols-v2.md), [organizations-rbac.md](organizations-rbac.md), [notifications.md](notifications.md), [ai-analysis.md](ai-analysis.md), [reporting.md](reporting.md), [tasks.md](tasks.md).

---

## 1. What's New — Сводка изменений v1 → v2

| Домен | v1 (MVP) | v2 |
|-------|---------|-----|
| **Протоколы** | Базовая форма: title, date, attendees (JSONB), agenda, decisions, notes | 5 этапов (draft→review→recording→approval→distribution), 4 типа, периодичность, структура, stage_data JSONB |
| **Задачи** | Нет | Полноценная система: уникальная нумерация (TASK-YYYY-NNNNN), жизненный цикл, параллелизация между протоколами, цепочки подзадач, resolution_text |
| **Утверждение** | Нет | protocol_approvals: контролирующие подтверждают, автоутверждение по таймауту |
| **Приглашения и явка** | Нет | meeting_attendance: invite → RSVP → confirm/decline → attended/absent |
| **Рассылка** | Нет | protocol_distributions: email + telegram, retry, трекинг статуса |
| **Организации** | Только subcontractors | organizations + subcontractors.organization_id (FK, nullable) |
| **Сотрудники контрагентов** | Нет | ❌ отдельная таблица не нужна (Oracle). Данные хранятся в `subcontractors` и `meeting_attendance` |
| **RBAC** | 2 роли (admin/employee), enforcement отсутствует | 5 ролей: admin, clerk, controller, employee, contractor. Мидлварь requireRole. Матрица разрешений |
| **Уведомления** | Нет | Email (nodemailer) + Telegram (telegraf): приглашения, рассылка, отказы, дедлайны |
| **AI-анализ** | Только RAG-чат | sentiment analysis, pattern detection, audio→text, LLM-суммаризация |
| **Запросы задач** | Нет | task_requests: сотрудник→контролирующий→approve/reject+уведомление |
| **Отчёты** | GET /api/tender/:id/summary (JSON) | PDF-экспорт (тендерная справка, сводка по подрядчику, протокол) + Excel-импорт |
| **Аудит** | audit_log (create/update/delete) | audit_log расширен новыми entity_type |

### Новые таблицы (8 шт.)

| Таблица | Документ | Назначение |
|---------|----------|-----------|
| `organizations` | organizations-rbac.md | Юрлица: заказчик, подрядчики, проектировщики |
| `task_requests` | meeting-protocols-v2.md | Запросы задач к повестке |
| `protocol_approvals` | meeting-protocols-v2.md | Утверждение протокола контролирующими |
| `protocol_distributions` | meeting-protocols-v2.md | Трекинг рассылки протоколов |
| `meeting_attendance` | meeting-protocols-v2.md | Приглашения и учёт явки |
| `tasks` | tasks.md | Задачи (нумерация, жизненный цикл, параллелизация) |
| `protocol_task_links` | tasks.md | Junction: задача в конкретном протоколе |
| `task_reformulations` | tasks.md | История переформулировок задачи |

### Изменённые таблицы (3 шт.)

| Таблица | Изменение |
|---------|-----------|
| `meeting_protocols` | +8 колонок: stage, meeting_type, periodicity, grouping_method, operational_subtype, parent_protocol_id, sequence_number, stage_data (JSONB); subcontractor_id → nullable; attendees — deprecated |
| `subcontractors` | +organization_id FK → organizations (nullable) |
| `employees` | +CHECK role IN (admin,clerk,controller,employee,contractor), +telegram_chat_id |
| `contractor_events` | 🔜 project_id (зарезервирован под FK → projects, будущая итерация) |

---

## 2. Complete ERD

Все таблицы системы, существующие (v1) и новые (v2), с отношениями.

```
                              ┌──────────────────────┐
                              │     organizations     │
                              │  id, name, inn,       │
                              │  primary_activity,    │
                              │  is_contractor        │
                              └──────┬───────────────┘
                                     │ 1:N
                    ┌──────────────────────────────┐
                    ▼                              │
          ┌─────────────────┐                       │
          │  subcontractors │                       │
          │  (v1, расширена)│                       │
          │  organization_id│                       │
          │    FK nullable  │                       │
          └────────┬────────┘                       │
                   │                                   │
    ┌──────────────┼───────────────┬──────────────┐   │
    ▼              ▼               ▼              ▼   │
┌───────┐  ┌──────────────┐  ┌─────────┐  ┌──────────┐│
│reviews│  │    events    │  │meetings │  │ surveys  ││
│rating │  │  type, desc  │  │  (v2)   │  │questions ││
│ 1-10  │  │  event_date  │  │ 5 stages│  │(JSONB)   ││
│       │  🔜 project_id│  │ 4 types │  └────┬─────┘│
└───┬───┘  │    (NEW v2)  │  └────┬─────┘       │     │
    │      └──────┬───────┘       │             │     │
    │             │               │             │     │
    ▼             ▼               ▼             ▼     │
┌──────────────────────────────────────────────────┐  │
│                  employees                        │  │
│  id, name, email, position, password_hash        │  │
│  role: admin|clerk|controller|employee|contractor │  │
│  telegram_chat_id (NEW v2)                       │  │
└──────┬───────────────────────────────────────────┘  │
       │                                              │
       │ owns/references all above                    │
       │                                              │
       ▼                                              │
┌──────────────────┐                                  │
│   meeting_       │      ┌────────────────┐         │
│   attendance     │      │  task_requests │         │
│  protocol_id FK  │      │  protocol_id FK│         │
│  person_type     │      │  employee_id FK│         │
│  person_id       │      │  status        │         │
│  status, rsvp    │      └────────────────┘         │
└──────────────────┘                                  │
                                                     │
┌──────────────────┐      ┌────────────────┐         │
│    protocol_     │      │   protocol_    │         │
│    approvals     │      │  distributions │         │
│  protocol_id FK  │      │  protocol_id FK│         │
│  employee_id FK  │      │  person_type   │         │
│  status, comment │      │  channel,status│         │
└──────────────────┘      └────────────────┘         │
                                                     │
        ┌────────────────────────────────────────────┘
        │
        ▼
┌──────────────┐     ┌───────────────────┐     ┌───────────────────┐
│    tasks     │     │protocol_task_links │     │task_reformulations│
│  protocol_id │────▶│  task_id FK        │     │  task_id FK       │
│  task_number │     │  protocol_id FK    │     │  previous_title   │
│  title       │     │  role: home|deleg  │     │  new_title        │
│  status      │     │  sort_order        │     │  reason           │
│  resolution  │     │  source_protocol_id│     └───────────────────┘
│  assignee_id │     └───────────────────┘
│  controller  │
│  parent_task │───▶ tasks (self-ref: подзадачи)
│  subcontractor│──▶ subcontractors
│  deadline    │
└──────────────┘

ДОПОЛНИТЕЛЬНЫЕ ТАБЛИЦЫ (существующие v1):
┌──────────┐  ┌──────────┐  ┌──────────────┐  ┌───────────────┐
│ comments │  │checklists│  │checklist_sug │  │survey_respons │
│  (v1)    │  │  (v1)    │  │  gestions    │  │     es (v1)   │
└──────────┘  └──────────┘  └──────────────┘  └───────────────┘

┌──────────┐  ┌──────────┐
│audit_log │  │ session  │
│  (v1)    │  │  (v1)    │
└──────────┘  └──────────┘

AI-МИКРОСЕРВИС (pgvector):
┌──────────────┐  ┌──────────────────┐  ┌───────────────────┐
│  embeddings  │  │ analysis_results │  │  event_patterns   │
│  (v1: RAG)   │  │  (v2: NEW)       │  │  (v2: NEW)        │
│  VECTOR(768) │  │  type,result JSON│  │  cluster_id, emb  │
│  HNSW index  │  │  confidence      │  │  VECTOR(768)      │
└──────────────┘  └──────────────────┘  └───────────────────┘
```

---

## 3. DB Schema Recap

Консолидированный список всех таблиц с количеством колонок и документацией.

| # | Таблица | Колонок | Документ | Статус |
|---|---------|---------|----------|--------|
| 1 | `employees` | 10 | architecture.md | v1 (расширена роль, telegram_chat_id) |
| 2 | `subcontractors` | 8 | architecture.md | v1 (расширена organization_id) |
| 3 | `reviews` | 7 | architecture.md | v1 |
| 4 | `comments` | 6 | architecture.md | v1 |
| 5 | `checklists` | 7 | architecture.md | v1 |
| 6 | `checklist_suggestions` | 7 | architecture.md | v1 |
| 7 | `meeting_protocols` | 18 | meeting-protocols-v2.md | v2 (расширена c 10 до 18) |
| 8 | `surveys` | 7 | architecture.md | v1 |
| 9 | `survey_responses` | 5 | architecture.md | v1 |
| 10 | `contractor_events` | 7 | architecture.md | v1 (🔜 project_id в будущей итерации) |
| 11 | `audit_log` | 7 | architecture.md | v1 |
| 12 | `organizations` | 7 | organizations-rbac.md | **NEW v2** |
| 13 | `task_requests` | 10 | meeting-protocols-v2.md | **NEW v2** |
| 14 | `protocol_approvals` | 6 | meeting-protocols-v2.md | **NEW v2** |
| 15 | `protocol_distributions` | 9 | meeting-protocols-v2.md | **NEW v2** |
| 16 | `meeting_attendance` | 8 | meeting-protocols-v2.md | **NEW v2** |
| 17 | `tasks` | 18 | tasks.md | **NEW v2** |
| 18 | `protocol_task_links` | 8 | tasks.md | **NEW v2** |
| 19 | `task_reformulations` | 7 | tasks.md | **NEW v2** |
| — | `session` | — | connect-pg-simple | v1 (авто) |
| — | `embeddings` | 7 | assistant.md | v1 (pgvector) |
| — | `analysis_results` | 7 | ai-analysis.md | **NEW v2** (pgvector) |
| — | `event_patterns` | 11 | ai-analysis.md | **NEW v2** (pgvector) |

### Все Enums

```ts
// v1 (существующие)
suggestion_status  = 'pending' | 'approved' | 'rejected'
checklist_type     = 'organization' | 'personal'
event_type         = 'positive' | 'violation' | 'info'
audit_action       = 'create' | 'update' | 'delete'

// v2 (новые)
meeting_stage       = 'draft' | 'review' | 'recording' | 'approval' | 'distribution'
meeting_type        = 'strategic' | 'coordination' | 'operational' | 'problem'
meeting_periodicity = 'one_time' | 'periodic'
grouping_method     = 'by_topic' | 'by_contractor'
task_request_status = 'pending' | 'approved' | 'rejected'
approval_status     = 'pending' | 'approved' | 'rejected' | 'auto_approved'
person_type         = 'employee' | 'subcontractor'
attendance_status   = 'invited' | 'confirmed' | 'declined' | 'attended' | 'absent'
distribution_channel= 'email' | 'telegram'
distribution_status = 'pending' | 'sent' | 'failed'
task_status         = 'created' | 'in_progress' | 'done' | 'archived'
task_link_role      = 'home' | 'delegated'
```

---

## 4. Migration Strategy

### 4.1 Порядок миграций

Миграции должны применяться в строгом порядке из-за зависимостей FK:

```
Шаг 1: organizations (независимая)
Шаг 2: subcontractors +organization_id (FK → organizations, nullable)
Шаг 3: employees role CHECK + telegram_chat_id
Шаг 4: meeting_protocols расширение (колонки + enum-ы)
Шаг 5: meeting_attendance (FK → meeting_protocols)
Шаг 6: protocol_approvals (FK → meeting_protocols, employees)
Шаг 7: protocol_distributions (FK → meeting_protocols)
Шаг 8: task_requests (FK → meeting_protocols, employees)
Шаг 9: tasks (FK → meeting_protocols, employees, subcontractors)
Шаг 10: protocol_task_links (FK → tasks, meeting_protocols)
Шаг 11: task_reformulations (FK → tasks, meeting_protocols)
```

### 4.2 Команды Drizzle

```bash
# Генерация миграций из полной схемы
cd backend
npx drizzle-kit generate

# Применение
npx drizzle-kit migrate
```

### 4.3 Rollback

Обратный порядок: удаляем зависимые таблицы перед независимыми.

```bash
# Сгенерировать rollback миграцию
npx drizzle-kit generate --custom

# Или ручной SQL (см. meeting-protocols-v2.md §11.3)
```

### 4.4 Проверки после миграции

- [ ] Все FK ссылки валидны (нет висячих)
- [ ] Старые протоколы имеют `stage = 'distribution'`
- [ ] `subcontractors.organization_id` — NULL для старых записей
- [ ] `employees.role` — только из допустимого CHECK
- [ ] AI-микросервис: embeddings для новых entity_type индексируются
- [ ] API v1 эндпоинты возвращают 200 (обратная совместимость)

---

## 5. Cross-Cutting Concerns

### 5.1 Notifications: Точки интеграции

Уведомления (см. [notifications.md](notifications.md)) встраиваются в существующие CRUD-обработчики как **асинхронные fire-and-forget вызовы**:

| Триггер | Где | Канал | Получатель |
|---------|-----|-------|------------|
| Переход протокола в `draft` + участники | `PUT /api/meetings/:id/transition` | Email | Все `meeting_attendance(status='invited')` |
| Отказ в task_request | `PATCH /api/meetings/task-requests/:id` (rejected) | Email | `task_request.employee_id` |
| Рассылка протокола | `POST /api/meetings/:id/distribute` | Email + Telegram | Все attendance + absent |
| Новая задача | `POST /api/tasks` | Telegram | `task.assignee_id` |
| Дедлайн задачи | Cron-job (ежечасно) | Telegram | `task.assignee_id` + `task.controller_id` |
| Протокол утверждён | Авто-переход в `distribution` | Email | `task_request.employee_id` (автор протокола) |

**Паттерн вызова:**

```ts
// В любом обработчике после успешной операции:
notifyReindex('meeting', meeting.id);  // существующий fire-and-forget
NotificationService.send(payload).catch(err => logger.error('Notification failed', err));
```

### 5.2 Task-Protocol Linking

Связь задач с протоколами через `protocol_task_links` (см. [tasks.md](tasks.md) §7.3):

- `POST /api/tasks` → создаёт задачу + `protocol_task_links(role='home')`
- `POST /api/tasks/:id/move` → создаёт `protocol_task_links(role='delegated', source_protocol_id=X)`
- `PUT /api/tasks/:id` (done + resolution_text) → подтягивает решение в домашний протокол
- `GET /api/meetings/:id/tasks` → JOIN tasks + protocol_task_links для получения всех задач протокола (home + delegated)

### 5.3 Org-Protocol Integration

Точки связи организаций с протоколами:

- `meeting_attendance.person_type = 'subcontractor'` → `person_id` ссылается на `subcontractors.id`
- `protocol_distributions.person_type = 'subcontractor'` — аналогично
- `meeting_protocols.subcontractor_id` → `subcontractors.id` → `subcontractors.organization_id` → `organizations.id`
- `tasks.subcontractor_id` → `subcontractors.id` (группировка по подрядчикам)

**Цепочка получения email для рассылки:**

```
meeting_attendance(person_type='subcontractor', person_id=X)
  → subcontractors(id=X).contact_info → извлечение email
```

### 5.4 RBAC Enforcement Points

Мидлварь `requireRole(...roles)` (см. [organizations-rbac.md](organizations-rbac.md) §4) применяется на следующие эндпоинты:

| Группа эндпоинтов | Требуемая роль |
|-------------------|---------------|
| `/api/employees` (CRUD) | `admin` |
| `/api/organizations` (CRUD) | `admin` |
| `/api/meetings` (create, transition) | `admin`, `clerk` |
| `/api/meetings/:id/approve` | `admin`, `controller` |
| `/api/meetings/:id/distribute` | `admin`, `clerk` |
| `/api/meetings/task-requests` (approve/reject) | `admin`, `controller` |
| `/api/tasks` (create, update, move) | `admin`, `controller` |
| `/api/tasks/:id` (mark done) | `admin`, `employee` (свой) |
| `/api/events` (CRUD) | `admin`, `clerk` |
| `/api/reviews` (CRUD) | Все аутентифицированные |
| `/api/checklists` (CRUD) | Все аутентифицированные |
| `/api/reports/*` | `admin`, `clerk` |
| `/api/import/*` | `admin` |
| `/api/ai/*` | Все аутентифицированные (прокси) |

**Роль `contractor`**: не имеет доступа к системе (только email). Сессии для contractor не создаются.

---

## 6. Updated API Map

Полная карта всех эндпоинтов v2. Существующие v1 эндпоинты отмечены `(v1)`, новые — `(v2)`.

### Auth (v1)
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
```

### Employees (v1)
```
GET    /api/employees
POST   /api/employees
GET    /api/employees/:id
PUT    /api/employees/:id
DELETE /api/employees/:id
```

### Organizations (v2)
```
GET    /api/organizations
POST   /api/organizations
GET    /api/organizations/:id
PUT    /api/organizations/:id
DELETE /api/organizations/:id
```

### Contractor Employees (v2) — ❌ не нужна, см. organizations-rbac.md

```
— данные хранятся в subcontractors (контактные лица) и meeting_attendance (явка)
```

### Subcontractors (v1, расширен)
```
GET    /api/subcontractors
POST   /api/subcontractors            # +organizationId в теле
GET    /api/subcontractors/:id
PUT    /api/subcontractors/:id
DELETE /api/subcontractors/:id
```

### Reviews (v1)
```
GET    /api/reviews?subcontractorId=X
POST   /api/reviews
GET    /api/reviews/:id
PUT    /api/reviews/:id
DELETE /api/reviews/:id
```

### Comments (v1)
```
GET    /api/comments?subcontractorId=X
POST   /api/comments
GET    /api/comments/:id
PUT    /api/comments/:id
DELETE /api/comments/:id
```

### Checklists (v1)
```
GET    /api/checklists?type=X&ownerId=X
POST   /api/checklists
GET    /api/checklists/:id
PUT    /api/checklists/:id
DELETE /api/checklists/:id
```

### Checklist Suggestions (v1)
```
GET    /api/suggestions?checklistId=X
POST   /api/suggestions
GET    /api/suggestions/:id
PATCH  /api/suggestions/:id
DELETE /api/suggestions/:id
```

### Meetings (v2 — расширен)
```
GET    /api/meetings
POST   /api/meetings
GET    /api/meetings/:id
PUT    /api/meetings/:id
DELETE /api/meetings/:id

POST   /api/meetings/:id/transition    # (v2) переход между этапами
GET    /api/meetings/:id/approvals     # (v2) статус утверждений
POST   /api/meetings/:id/approve       # (v2) утвердить протокол
GET    /api/meetings/:id/attendance    # (v2) список явки
POST   /api/meetings/:id/attendance    # (v2) добавить участника
PATCH  /api/meetings/:id/attendance/:attendanceId  # (v2) обновить статус
GET    /api/meetings/:id/rsvp?token=X  # (v2) RSVP для внешних
POST   /api/meetings/:id/distribute    # (v2) рассылка протокола

GET    /api/meetings/series/:seriesId  # (v2) история периодических
POST   /api/meetings/:id/convert-to-recurring  # (v2) разовое→периодическое
```

### Task Requests (v2)
```
GET    /api/meetings/task-requests
POST   /api/meetings/task-requests
PATCH  /api/meetings/task-requests/:id
```

### Tasks (v2)
```
GET    /api/tasks
GET    /api/tasks/:id
POST   /api/tasks
PUT    /api/tasks/:id
DELETE /api/tasks/:id

POST   /api/tasks/:id/move             # (v2) перенести в другой протокол
POST   /api/tasks/:id/return           # (v2) вернуть в домашний
POST   /api/tasks/:id/reorder          # (v2) изменить порядок
GET    /api/tasks/:id/subtasks         # (v2) подзадачи
POST   /api/tasks/:id/subtasks         # (v2) создать подзадачу
GET    /api/tasks/:id/links            # (v2) связанные протоколы
GET    /api/tasks/:id/reformulations   # (v2) история переформулировок
GET    /api/meetings/:id/tasks         # (v2) задачи конкретного протокола
```

### Surveys (v1)
```
GET    /api/surveys
POST   /api/surveys
GET    /api/surveys/:id
DELETE /api/surveys/:id
POST   /api/surveys/:id/respond
GET    /api/surveys/:id/responses
```

### Events (v1, расширен)
```
GET    /api/events?subcontractorId=X
POST   /api/events                      # +projectId в теле
GET    /api/events/:id
PUT    /api/events/:id
DELETE /api/events/:id
POST   /api/events/:id/suggest
```

### Tender (v1)
```
GET    /api/tender/:id/summary
```

### Reports (v2)
```
GET    /api/reports/tender/:id          # (v2) PDF тендерной справки
GET    /api/reports/subcontractor/:id   # (v2) PDF сводки по подрядчику
GET    /api/reports/meeting/:id         # (v2) PDF протокола
```

### Import (v2)
```
POST   /api/import/subcontractors       # (v2) Excel → subcontractors
POST   /api/import/employees            # (v2) Excel → employees
```

### AI (v1 + v2)
```
POST   /api/ai/ask                      # (v1) RAG-чат
POST   /api/ai/reindex/:entity          # (v1) переиндексация
POST   /api/ai/reindex                  # (v1) полная переиндексация
GET    /api/ai/health                   # (v1) health-check
POST   /api/ai/analyze/:entity          # (v2) анализ сущности
POST   /api/ai/transcribe               # (v2) аудио→текст
POST   /api/ai/tasks/:id/suggest-move   # (v2) AI-предложения переноса
GET    /api/ai/tasks/analysis?protocolId=X  # (v2) AI-анализ задач
```

### RBAC (v2)
```
GET    /api/rbac/permissions            # (v2) матрица разрешений
GET    /api/rbac/my-role                # (v2) текущая роль
```

### Audit Log (v1)
```
GET    /api/audit-log?entityType=X&entityId=Y
```

### Health (v1)
```
GET    /api/health
```

**Итого: 87+ эндпоинтов** (против ~45 в v1).

---

## 7. Frontend Routes

### Существующие (v1) — без изменений

| Путь | Компонент |
|------|-----------|
| `/login` | LoginView |
| `/register` | RegisterView |
| `/subcontractors` | SubcontractorsView |
| `/subcontractors/:id` | SubcontractorDetail |
| `/reviews` | ReviewsView |
| `/comments` | CommentsView |
| `/checklists` | ChecklistsView |
| `/surveys` | SurveysView |
| `/tender/:id` | TenderSummaryView |
| `/events` | EventsView |
| `/chat` | ChatView |
| `/audit-log` | AuditLogView |

### Обновлённые (v2)

| Путь | Компонент | Изменения |
|------|-----------|-----------|
| `/meetings` | MeetingsView | Фильтры по type, stage, periodicity; колонка «Этап» |
| `/employees` | EmployeesView | Колонка «Роль» с 5 значениями |
| `/suggestions` | SuggestionsView | Фильтр по статусу + RBAC (v2) |

### Новые (v2)

| Путь | Компонент | Документ |
|------|-----------|----------|
| `/organizations` | OrganizationsView | organizations-rbac.md |
| `/organizations/:id` | OrganizationDetail | organizations-rbac.md |
| `/meetings/new` | MeetingFormView | meeting-protocols-v2.md |
| `/meetings/:id` | MeetingDetailView | meeting-protocols-v2.md |
| `/meetings/:id/tasks` | MeetingTasksView | meeting-protocols-v2.md |
| `/meetings/:id/attendance` | MeetingAttendanceView | meeting-protocols-v2.md |
| `/meetings/:id/approvals` | MeetingApprovalsView | meeting-protocols-v2.md |
| `/meetings/series/:seriesId` | MeetingSeriesView | meeting-protocols-v2.md |
| `/task-requests` | TaskRequestsView | meeting-protocols-v2.md |
| `/tasks` | TasksView | tasks.md |
| `/tasks/:id` | TaskDetailView | tasks.md |
| `/tasks/:id/subtasks` | TaskSubtasksView | tasks.md |

### Маршрутный гард

```ts
// Добавить в router/index.ts:
router.beforeEach((to, from, next) => {
  const auth = useAuthStore()
  if (!auth.user && to.path !== '/login' && to.path !== '/register') {
    return next('/login')
  }
  // RBAC guard (v2):
  if (auth.user && to.meta.roles && !to.meta.roles.includes(auth.user.role)) {
    return next('/')
  }
  next()
})
```

### Новые Pinia Stores (v2)

| Store | Файл |
|-------|------|
| `useOrganizationStore` | `stores/organizations.ts` |
| `useTaskStore` | `stores/tasks.ts` |
| `useTaskRequestStore` | `stores/taskRequests.ts` |
| `useTaskLinkStore` | `stores/taskLinks.ts` |
| `useTaskReformulationStore` | `stores/taskReformulations.ts` |
| `useAttendanceStore` | `stores/attendance.ts` |
| `useApprovalStore` | `stores/approvals.ts` |
| `useReportStore` | `stores/reports.ts` |

---

## 8. AI Assistant Impact

### 8.1 Новые entity_type для RAG

AI-ассистент индексирует новые сущности через `embeddings.entity_type`:

| entity_type (v2) | Документ | Индексируемый контент | Метаданные |
|-------------------|----------|----------------------|-----------|
| `task` | tasks.md | title, description, resolution_text | status, assignee_id, protocol_id, task_number |
| `task_request` | meeting-protocols-v2.md | title, description | status, protocol_id |
| `organization` | organizations-rbac.md | name, primary_activity | inn, is_contractor |
| `contractor_employee` | — | ❌ не используется (subcontractors покрывает) |
| `protocol_approval` | meeting-protocols-v2.md | comment | status, protocol_id |
| `analysis_result` | ai-analysis.md | result JSONB → текст | analysis_type, entity_type, confidence |
| `event_pattern` | ai-analysis.md | pattern_label, clustered events | frequency, subcontractor_ids |

### 8.2 Изменения в ingestion-логике

```python
# assistant/src/rag/ingester.py — добавить новые entity_type:

ENTITY_FETCHERS = {
    # существующие
    'subcontractor': fetch_subcontractors,
    'review': fetch_reviews,
    'event': fetch_events,
    'checklist': fetch_checklists,
    'meeting': fetch_meetings,
    'survey': fetch_surveys,
    'comment': fetch_comments,
    # новые v2
    'task': fetch_tasks,
    'task_request': fetch_task_requests,
    'organization': fetch_organizations,
    // ❌ contractor_employee не индексируется отдельно — subcontractors покрывает
}
```

### 8.3 Новые AI-эндпоинты прокси

Backend проксирует в AI-микросервис (порт 3002):

```
POST /api/ai/analyze/:entity   → POST assistant:3002/api/ai/analyze/{entity}
POST /api/ai/transcribe         → POST assistant:3002/api/ai/transcribe
POST /api/ai/tasks/:id/suggest-move → POST assistant:3002/api/ai/tasks/{id}/suggest-move
GET  /api/ai/tasks/analysis     → GET  assistant:3002/api/ai/tasks/analysis?protocolId=X
```

### 8.4 RAG-промпт (обновлённый)

Системный промпт LLM расширен контекстом новых сущностей:

```
Ты — AI-ассистент Master Notepad. У тебя есть доступ к следующим данным:
- Подрядчики, отзывы, события, чек-листы, протоколы, опросы, комментарии
- Задачи (TASK-YYYY-NNNNN): статус, исполнитель, решение
- Организации: название, ИНН, вид деятельности
- Результаты AI-анализа: тональность отзывов, паттерны нарушений
Отвечай на русском, только на основе предоставленных данных.
```

---

## 9. Conventions (обновлённые)

### Бэкенд

- **ESM модули** (`"type": "module"`), TypeScript strict mode
- **Стрелочные функции** в роутах, `try/catch` + `next(e)` в каждом обработчике
- **Zod-схемы** для валидации тела запроса и query-параметров
- **Без `any`**, без `@ts-ignore`
- PORT: 3001 (через `PORT` env)
- **Мидлварь `requireAuth`** на всех защищённых эндпоинтах
- **Мидлварь `requireRole(...roles)`** на эндпоинтах с ограничением доступа (v2)
- **auditLog()** и **notifyReindex()** — fire-and-forget после каждой операции записи
- **NotificationService.send()** — асинхронный fire-and-forget для уведомлений (v2)
- **Полиморфные связи** (person_type + person_id) — без FK на две таблицы, валидация на уровне приложения
- **Новые роуты:** `routes/organizations.ts`, `routes/tasks.ts`, `routes/reports.ts`, `routes/import.ts`, `routes/notifications.ts`

### Фронтенд

- **Composition API**: `<script setup lang="ts">`
- **Scoped CSS** в каждом компоненте, CSS custom properties
- **`container-type: inline-size`** + `@container` в views
- **Русский язык** в UI
- **Без внешних CSS-фреймворков**
- **`errorMessage()`** вместо `catch(e: any)`
- **RBAC в UI**: кнопки скрываются через `v-if="canEdit(task)"` по роли (v2)
- **Новые сторы** — один файл на сущность
- **Drag-and-drop** для порядка задач — нативный HTML5 DnD API (без библиотек)

### База данных

- **Drizzle ORM** — schema-first, все таблицы в `backend/src/db/schema/index.ts`
- **Именование**: snake_case колонок, camelCase в Drizzle-полях
- **FK с onDelete**: `cascade` для дочерних, `set null` для опциональных, `restrict` для критических
- **JSONB** для гибких структур (stage_data, checklist items, survey questions)
- **timestamp with timezone** для всех новых таблиц
- **Уникальные constraint'ы** через `uniqueIndex()` в Drizzle
- **Частичные индексы** (WHERE clause) для оптимизации запросов по статусу

### Документация

- **Все feature-документы** ссылаются на этот integration-документ
- **Каждый doc содержит:** Overview, DB Schema (Drizzle ORM), API Design, Testing Strategy
- **Перекрёстные ссылки** между документами обязательны (см. зависимости в PLAN.md)

### Тестирование

- **Unit**: state machine переходы, RBAC матрица, генерация номеров задач
- **Integration**: API-эндпоинты с моками БД, мидлварь requireRole
- **E2E (Playwright)**: полные сценарии (создание протокола → утверждение → рассылка; перенос задачи между протоколами)
- **AI-тесты**: моки LLM-ответов, проверка формата suggestions

---

## Связанные документы

| Документ | Описание |
|----------|----------|
| [architecture.md](architecture.md) | Базовая архитектура (v1) |
| [meeting-protocols-v2.md](meeting-protocols-v2.md) | Протоколы v2 (5 этапов, AI-интеграция) |
| [organizations-rbac.md](organizations-rbac.md) | Организации и ролевая модель |
| [notifications.md](notifications.md) | Система уведомлений (email + telegram) |
| [ai-analysis.md](ai-analysis.md) | AI-анализ: sentiment, pattern detection, audio |
| [reporting.md](reporting.md) | Отчёты (PDF) и импорт (Excel) |
| [tasks.md](tasks.md) | Система задач |
| [assistant.md](assistant.md) | AI-ассистент (существующий, расширен) |
| [PLAN.md](PLAN.md) | План технической документации |