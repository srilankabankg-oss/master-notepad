# Архитектура

## Стек

| Слой | Технология | Версия |
|------|-----------|--------|
| Бэкенд | Node.js + Express + TypeScript | ESM, strict mode |
| База данных | PostgreSQL + Drizzle ORM | schema-first |
| Фронтенд | Vue 3 + TypeScript + Pinia + Vue Router | Composition API |
| Сборка | Vite + PWA plugin | NetworkFirst caching |
| Монорепа | npm workspaces | backend/ + frontend/ |

## Структура проекта

```
master-notepad/
├── package.json              # Workspace root
├── AGENTS.md                 # Для AI-агентов
├── docs/
│   ├── product/
│   │   ├── overview.md         # Описание системы (функции, сценарии)
│   │   └── assistant.md        # AI Ассистент — продуктовое описание
│   ├── tech/
│   │   ├── architecture.md     # Архитектура (этот файл)
│   │   ├── development.md      # Запуск, разработка, миграции
│   │   ├── deployment.md       # Продакшен-деплой
│   │   └── assistant.md        # AI Ассистент — технический дизайн
├── backend/
│   ├── src/
│   │   ├── index.ts          # Точка входа, HTTP сервер
│   │   ├── app.ts            # Express app, middleware, роуты
│   │   ├── db/
│   │   │   ├── index.ts      # Drizzle connection + pg pool
│   │   │   └── schema/       # Таблицы и связи
│   │   ├── routes/           # Обработчики (по одному на сущность)
│   │   ├── middleware/       # Валидация (Zod), requireAuth, аудит
│   │   └── ai-reindex.ts     # Фоновое уведомление AI-сервиса
│   └── drizzle.config.ts
├── frontend/
│   ├── src/
│   │   ├── main.ts           # Vue entry
│   │   ├── App.vue           # Layout (sidebar + header + content)
│   │   ├── api/
│   │   │   ├── client.ts     # Fetch-обёртка с credentials: 'include'
│   │   │   └── types.ts      # TypeScript-типы API
│   │   ├── router/           # Vue Router
│   │   ├── stores/           # Pinia (по одному на сущность)
│   │   ├── views/            # Страницы
│   │   └── components/       # Layout-компоненты
│   └── vite.config.ts
```

## База данных

### Схема (PostgreSQL + Drizzle ORM)

| Таблица | Поля | Связи |
|---------|------|-------|
| `employees` | id, name, email, position, passwordHash, role ('admin'/'employee'), created_at, updated_at | hasMany: reviews, comments, checklists, suggestions, surveys, responses, audit_log |
| `subcontractors` | id, name, company_name, contact_info, specialization, description, created_at, updated_at | hasMany: reviews, comments, meetings, surveys, events |
| `reviews` | id, subcontractor_id, employee_id, content, rating (1-10), created_at, updated_at | belongsTo: subcontractor, employee |
| `comments` | id, subcontractor_id, employee_id, content, created_at, updated_at | belongsTo: subcontractor, employee |
| `checklists` | id, title, type (org/personal), owner_id, items (JSONB), created_at, updated_at | belongsTo: owner (employee), hasMany: suggestions |
| `checklist_suggestions` | id, checklist_id, employee_id, suggestion, status (pending/approved/rejected), created_at, updated_at | belongsTo: checklist, employee |
| `meeting_protocols` | id, title, date, subcontractor_id, attendees (JSONB), agenda, decisions, notes, created_at, updated_at | belongsTo: subcontractor |
| `surveys` | id, title, subcontractor_id, created_by, questions (JSONB), created_at, updated_at | belongsTo: subcontractor, creator; hasMany: responses |
| `survey_responses` | id, survey_id, employee_id, answers (JSONB), created_at | belongsTo: survey, employee |
| `contractor_events` | id, subcontractor_id, employee_id, type (positive/violation/info), description, event_date, created_at | belongsTo: subcontractor, employee; 🔜 project_id (INTEGER) — зарезервирован под FK → projects |
| `audit_log` | id, entity_type, entity_id, employee_id, action (create/update/delete), changes (JSONB), created_at | belongsTo: employee |

### Типы событий (contractor_events.type)
- `positive` — положительное событие
- `violation` — нарушение
- `info` — информационное

### Enums
- `checklist_type`: 'organization' | 'personal'
- `suggestion_status`: 'pending' | 'approved' | 'rejected'
- `event_type`: 'positive' | 'violation' | 'info'
- `audit_action`: 'create' | 'update' | 'delete'

## Аутентификация

Сессионная аутентификация на основе `express-session` с хранилищем в PostgreSQL (`connect-pg-simple`), хэширование паролей через `bcrypt`.

### Настройка сессий (backend/src/app.ts)

```ts
const PgSessionStore = createPgStore(session);
app.use(
  session({
    store: new PgSessionStore({
      pool,
      tableName: 'session',
      createTableIfMissing: true,
    }),
    secret: env.SESSION_SECRET,   // минимум 32 символа, обязательный env
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 дней
    },
  }),
);
```

### Роли

Две роли хранятся в поле `employees.role` (`varchar(50)`, значение по умолчанию `'employee'`):

| Роль | Описание |
|------|---------|
| `admin` | Полный доступ к управлению сотрудниками и данным |
| `employee` | Стандартный доступ к операциям с подрядчиками |

### Middleware requireAuth (backend/src/middleware/auth.ts)

```ts
const LOCALHOST_IPS = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];

export function requireAuth(req, res, next): void {
  if (LOCALHOST_IPS.includes(req.ip || '')) { next(); return; }  // обход в разработке
  if (!req.session?.employeeId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}
```

В режиме разработки запросы с localhost проходят без сессии. В продакшене все защищённые эндпоинты требуют действующей сессии.

### Хэширование паролей

```ts
// Регистрация
const SALT_ROUNDS = 10;
const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

// Вход
const valid = await bcrypt.compare(password, employee.passwordHash);
```

### Эндпоинты аутентификации

| Метод | Путь | Описание |
|-------|------|---------|
| `POST` | `/api/auth/register` | Создать сотрудника (name, email, password, position?), установить сессию |
| `POST` | `/api/auth/login` | Войти по email + паролю, установить `session.employeeId` |
| `POST` | `/api/auth/logout` | Удалить сессию, очистить куку `connect.sid` |
| `GET` | `/api/auth/me` | Вернуть текущего пользователя из сессии |

### Инжекция `employeeId`

Для всех защищённых эндпоинтов (кроме `/api/auth/*`) `employeeId` текущего пользователя извлекается из сессии middleware `requireAuth` и добавляется в `req.body` или передаётся в обработчик. Это позволяет не передавать `employeeId` в теле запроса от фронтенда — бэкенд берёт его из сессии автоматически. На фронтенде типы `Create` не содержат `employeeId` (например, `ReviewCreate` имеет `subcontractorId`, `content`, `rating` — без `employeeId`).

## API Endpoints

Все эндпоинты имеют префикс `/api/`.

### Auth
```
POST   /api/auth/register       # { name, email, password, position? }
POST   /api/auth/login           # { email, password }
POST   /api/auth/logout          # Удалить сессию
GET    /api/auth/me              # Текущий пользователь
```

### Employees
```
GET    /api/employees            # Список
POST   /api/employees            # Создать { name, email, position? }
GET    /api/employees/:id        # По ID
PUT    /api/employees/:id        # Обновить
DELETE /api/employees/:id        # Удалить
```

### Subcontractors
```
GET    /api/subcontractors               # Список
POST   /api/subcontractors               # Создать { name, companyName?, ... }
GET    /api/subcontractors/:id           # По ID (с рейтингом = AVG отзывов)
PUT    /api/subcontractors/:id           # Обновить
DELETE /api/subcontractors/:id           # Удалить
```

### Reviews
```
GET    /api/reviews?subcontractorId=X     # С фильтром
POST   /api/reviews                       # { subcontractorId, employeeId, content, rating }
GET    /api/reviews/:id                   # По ID
PUT    /api/reviews/:id                   # Обновить
DELETE /api/reviews/:id                   # Удалить
```

### Comments
```
GET    /api/comments?subcontractorId=X    # С фильтром
POST   /api/comments                      # { subcontractorId, employeeId, content }
GET    /api/comments/:id                  # По ID
PUT    /api/comments/:id                  # Обновить
DELETE /api/comments/:id                  # Удалить
```

### Checklists
```
GET    /api/checklists?type=X&ownerId=X   # С фильтрами
POST   /api/checklists                    # { title, type?, ownerId?, items? }
GET    /api/checklists/:id                # По ID
PUT    /api/checklists/:id                # Обновить (включая toggle items)
DELETE /api/checklists/:id                # Удалить
```

### Checklist Suggestions
```
GET    /api/suggestions?checklistId=X     # С фильтром
POST   /api/suggestions                   # { checklistId, employeeId, suggestion }
GET    /api/suggestions/:id               # По ID
PATCH  /api/suggestions/:id               # { status: 'approved' | 'rejected' }
DELETE /api/suggestions/:id               # Удалить
```

### Meeting Protocols
```
GET    /api/meetings?subcontractorId=X    # С фильтром
POST   /api/meetings                      # { title, date, subcontractorId?, attendees, agenda, decisions?, notes? }
GET    /api/meetings/:id                  # По ID
PUT    /api/meetings/:id                  # Обновить
DELETE /api/meetings/:id                  # Удалить
```

### Surveys
```
GET    /api/surveys                       # Список
POST   /api/surveys                       # { title, subcontractorId, createdBy } (questions = default 5)
GET    /api/surveys/:id                   # По ID (с ответами)
DELETE /api/surveys/:id                   # Удалить
POST   /api/surveys/:id/respond           # { employeeId, answers }
GET    /api/surveys/:id/responses          # Все ответы
```

### Contractor Events
```
GET    /api/events?subcontractorId=X       # С фильтром
POST   /api/events                         # { subcontractorId, employeeId, type, description, eventDate }
GET    /api/events/:id                     # По ID
PUT    /api/events/:id                     # Обновить
DELETE /api/events/:id                     # Удалить
POST   /api/events/:id/suggest             # Предложить событие как пункт чек-листа { checklistId, employeeId }
```

### Tender
```
GET    /api/tender/:id/summary             # Сводка по подрядчику для тендера (рейтинг, отзывы, события, протоколы, комментарии, опросы, нарушения)
```

### AI Proxy
```
POST   /api/ai/ask                         # Проксировать вопрос в AI-сервис (инжектирует employeeId из сессии)
POST   /api/ai/reindex/:entity             # Переиндексировать одну сущность в AI-хранилище
POST   /api/ai/reindex                     # Полная переиндексация
GET    /api/ai/health                      # Проверка доступности AI-сервиса
```

### Audit Log
```
GET    /api/audit-log?entityType=X&entityId=Y  # Журнал изменений (фильтр по типу и/или ID сущности, до 100 записей)
```

### Health
```
GET    /api/health                         # Проверка работоспособности бэкенда
```

## Фронтенд — Маршруты

| Путь | Компонент | Описание |
|------|-----------|----------|
| `/` | redirect → /subcontractors | |
| `/login` | LoginView | Форма входа по email + паролю |
| `/register` | RegisterView | Форма регистрации |
| `/subcontractors` | SubcontractorsView | Список с рейтингами |
| `/subcontractors/:id` | SubcontractorDetail | Карточка + вкладки |
| `/reviews` | ReviewsView | Все отзывы |
| `/checklists` | ChecklistsView | Чек-листы |
| `/meetings` | MeetingsView | Протоколы |
| `/surveys` | SurveysView | Опросы |
| `/tender/:id` | TenderSummaryView | Сводка по подрядчику для тендера |
| `/employees` | EmployeesView | Сотрудники |
| `/suggestions` | SuggestionsView | Предложения |
| `/events` | EventsView | Журнал событий |
| `/chat` | ChatView | Чат с AI-ассистентом |
| `/audit-log` | AuditLogView | Журнал аудита изменений |

Гард маршрутов: неаутентифицированные пользователи перенаправляются на `/login`, аутентифицированные — с `/login` и `/register` на `/subcontractors`.

## Фронтенд — Pinia Stores

| Store | Файл | Методы |
|-------|------|--------|
| `useAuthStore` | `stores/auth.ts` | login, register, logout, fetchMe |
| `useEmployeeStore` | `stores/employees.ts` | fetchAll, fetchById, create, update, remove |
| `useSubcontractorStore` | `stores/subcontractors.ts` | fetchAll, fetchById, create, update, remove |
| `useReviewStore` | `stores/reviews.ts` | fetchAll, fetchById, create, update, remove |
| `useCommentStore` | `stores/comments.ts` | fetchAll, create, update, remove |
| `useChecklistStore` | `stores/checklists.ts` | fetchAll, fetchById, create, update, remove |
| `useSuggestionStore` | `stores/suggestions.ts` | fetchAll, fetchById, create, update, remove |
| `useMeetingStore` | `stores/meetings.ts` | fetchAll, fetchById, create, update, remove |
| `useSurveyStore` | `stores/surveys.ts` | fetchAll, fetchById, create, update, remove, respond, responses |
| `useEventStore` | `stores/events.ts` | fetchAll, fetchById, create, update, remove, suggestToChecklist |
| `useTenderStore` | `stores/tender.ts` | fetchSummary |
| `useAuditStore` | `stores/audit.ts` | fetchList |

## Типы TypeScript (frontend/src/types/api.ts)

```typescript
// === Auth ===
interface AuthEmployee { id: number; name: string; email: string; position: string | null; role: string }
interface LoginRequest { email: string; password: string }
interface RegisterRequest { name: string; email: string; password: string; position?: string }

// === Employees ===
interface Employee { id: number; name: string; email: string; position: string | null; createdAt: string; updatedAt: string }
interface EmployeeCreate { name: string; email: string; position?: string }

// === Subcontractors ===
interface Subcontractor { id: number; name: string; companyName: string; contactInfo: string; specialization: string; description: string; rating?: number; createdAt: string; updatedAt: string }
interface SubcontractorCreate { name: string; companyName?: string; contactInfo?: string; specialization?: string; description?: string }

// === Reviews ===
interface Review { id: number; subcontractorId: number; employeeId: number; content: string; rating: number; createdAt: string; updatedAt: string }
interface ReviewCreate { subcontractorId: number; content: string; rating: number }

// === Comments ===
interface Comment { id: number; subcontractorId: number; employeeId: number; content: string; createdAt: string; updatedAt: string }
interface CommentCreate { subcontractorId: number; content: string }
interface CommentUpdate { content: string }

// === Checklists ===
type ChecklistType = 'organization' | 'personal'
interface ChecklistItem { text: string; completed: boolean }
interface Checklist { id: number; title: string; type: ChecklistType; ownerId: number; items: ChecklistItem[]; createdAt: string; updatedAt: string }
interface ChecklistCreate { title: string; type?: ChecklistType; ownerId?: number; items?: ChecklistItem[] }
interface ChecklistUpdate { title?: string; items?: ChecklistItem[] }

// === Suggestions ===
type SuggestionStatus = 'pending' | 'approved' | 'rejected'
interface Suggestion { id: number; checklistId: number; employeeId: number; suggestion: string; status: SuggestionStatus; createdAt: string; updatedAt: string }
interface SuggestionCreate { checklistId: number; suggestion: string }
interface SuggestionUpdate { status: SuggestionStatus }

// === Meetings ===
interface Meeting { id: number; title: string; date: string; subcontractorId: number | null; attendees: string[]; agenda: string; decisions?: string; notes?: string; createdAt: string; updatedAt: string }
interface MeetingCreate { title: string; date: string; subcontractorId?: number; attendees?: string[]; agenda: string; decisions?: string; notes?: string }

// === Surveys ===
interface Survey { id: number; title: string; subcontractorId: number; createdBy: number; questions: string[]; createdAt: string; updatedAt: string }
interface SurveyCreate { title: string; subcontractorId: number; questions?: string[] }
interface SurveyResponse { id: number; surveyId: number; employeeId: number; answers: Record<string, string>; createdAt: string }
interface SurveyResponseCreate { answers: Record<string, string> }

// === Events ===
type EventType = 'positive' | 'violation' | 'info'
interface ContractorEvent { id: number; subcontractorId: number; employeeId: number; type: EventType; description: string; eventDate: string; createdAt: string }
interface ContractorEventCreate { subcontractorId: number; type: EventType; description: string; eventDate: string }
interface EventSuggestPayload { checklistId: number; employeeId: number }

// === Tender ===
interface TenderSummary { subcontractor: Subcontractor; rating: number; reviews: Review[]; events: ContractorEvent[]; meetings: Meeting[]; comments: Comment[]; surveysCount: number; violationsCount: number }

// === AI ===
interface AskRequest { question: string; limit?: number }
interface AskResponse { answer: string; sources: Array<{ entityType: string; entityId: number; title: string; excerpt: string }>; confidence: number }

// === Audit Log ===
interface AuditLogEntry { id: number; entityType: string; entityId: number; action: string; employeeId: number | null; employeeName: string | null; changes: Record<string, unknown>; createdAt: string }
```

Клиент API (`frontend/src/api/client.ts`) использует `credentials: 'include'` для передачи куки сессии во всех запросах.

## Обработка ошибок

### Бэкенд
- `AppError(statusCode, message)` — для бизнес-ошибок (404, 409 и т.д.)
- `ZodError` ловится глобальным middleware, возвращает 400 с деталями валидации
- Все остальные ошибки → 500 Internal Server Error
- Каждый обработчик обёрнут в `try/catch` + `next(e)`

### Фронтенд
- `ApiRequestError` от API-клиента при не-OK статусе
- `errorMessage(e, fallback)` — утилита для извлечения сообщения из `unknown`
- Сторы хранят `error` в состоянии, компоненты отображают через `errorMessage()`

## Конвенции

### Бэкенд
- ESM модули (`"type": "module"`)
- TypeScript strict mode
- Стрелочные функции в роутах
- Zod-схемы для валидации тела запроса и query-параметров
- `try/catch` + `next(e)` в каждом обработчике
- Без `any`, без `@ts-ignore`
- PORT: 3001 (через `PORT` env)
- Все защищённые роуты используют `requireAuth` из `middleware/auth.ts`
- Каждая операция записи вызывает `auditLog()` и `notifyReindex()` (fire-and-forget)

### Фронтенд
- Composition API: `<script setup lang="ts">`
- Scoped CSS в каждом компоненте
- CSS custom properties для темы и breakpoints
- `container-type: inline-size` + `@container` в views
- `@media` в App.vue / AppSidebar.vue
- Русский язык в UI
- Без внешних CSS-фреймворков
- `errorMessage()` вместо `catch(e: any)`

## Связанные документы

- [Запуск и разработка](tech/development.md) — установка, база данных, миграции, команды разработки
- [Деплой](tech/deployment.md) — продакшен-развёртывание
- [Ассистент](assistant.md) — концепция AI-агента с RAG
