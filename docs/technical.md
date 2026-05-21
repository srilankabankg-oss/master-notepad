# Master Notepad — Техническая документация

## Архитектура

### Стек
| Слой | Технология | Версия |
|------|-----------|--------|
| Бэкенд | Node.js + Express + TypeScript | ESM, strict mode |
| База данных | PostgreSQL + Drizzle ORM | schema-first |
| Фронтенд | Vue 3 + TypeScript + Pinia + Vue Router | Composition API |
| Сборка | Vite + PWA plugin | NetworkFirst caching |
| Монорепа | npm workspaces | backend/ + frontend/ |

### Структура проекта
```
master-notepad/
├── package.json              # Workspace root
├── AGENTS.md                 # Для AI-агентов
├── docs/
│   ├── description.md        # Менеджерская документация
│   ├── technical.md          # Этот файл
│   └── assistant.md          # Концепт Ассистента (AI+RAG)
├── backend/
│   ├── src/
│   │   ├── index.ts          # Точка входа, HTTP сервер
│   │   ├── app.ts            # Express app, middleware, роуты
│   │   ├── db/
│   │   │   ├── index.ts      # Drizzle connection + pg pool
│   │   │   └── schema/       # Таблицы и связи
│   │   ├── routes/           # Обработчики (по одному на сущность)
│   │   └── middleware/       # Валидация (Zod), обработка ошибок
│   └── drizzle.config.ts
├── frontend/
│   ├── src/
│   │   ├── main.ts           # Vue entry
│   │   ├── App.vue           # Layout (sidebar + header + content)
│   │   ├── api/client.ts     # Fetch-обёртка
│   │   ├── router/           # Vue Router
│   │   ├── stores/           # Pinia (по одному на сущность)
│   │   ├── types/api.ts      # TypeScript-типы API
│   │   ├── views/            # Страницы
│   │   └── components/       # Layout-компоненты
│   └── vite.config.ts
```

## База данных

### Схема (PostgreSQL + Drizzle ORM)

| Таблица | Поля | Связи |
|---------|------|-------|
| `employees` | id, name, email, position, created_at, updated_at | hasMany: reviews, comments, checklists, suggestions, surveys, responses |
| `subcontractors` | id, name, company_name, contact_info, specialization, description, created_at, updated_at | hasMany: reviews, comments, meetings, surveys, events |
| `reviews` | id, subcontractor_id, employee_id, content, rating (1-10), created_at, updated_at | belongsTo: subcontractor, employee |
| `comments` | id, subcontractor_id, employee_id, content, created_at, updated_at | belongsTo: subcontractor, employee |
| `checklists` | id, title, type (org/personal), owner_id, items (JSONB), created_at, updated_at | belongsTo: owner (employee), hasMany: suggestions |
| `checklist_suggestions` | id, checklist_id, employee_id, suggestion, status (pending/approved/rejected), created_at, updated_at | belongsTo: checklist, employee |
| `meeting_protocols` | id, title, date, subcontractor_id, attendees (JSONB), agenda, decisions, notes, created_at, updated_at | belongsTo: subcontractor |
| `surveys` | id, title, subcontractor_id, created_by, questions (JSONB), created_at, updated_at | belongsTo: subcontractor, creator; hasMany: responses |
| `survey_responses` | id, survey_id, employee_id, answers (JSONB), created_at | belongsTo: survey, employee |
| `contractor_events` | id, subcontractor_id, employee_id, type (positive/violation/info), description, event_date, created_at | belongsTo: subcontractor, employee |

### Типы событий (contractor_events.type)
- `positive` — положительное событие
- `violation` — нарушение
- `info` — информационное

### Enums
- `checklist_type`: 'organization' | 'personal'
- `suggestion_status`: 'pending' | 'approved' | 'rejected'
- `event_type`: 'positive' | 'violation' | 'info'

## API Endpoints

Все эндпоинты имеют префикс `/api/`.

### Employees
```
GET    /api/employees          # Список
POST   /api/employees          # Создать { name, email, position? }
GET    /api/employees/:id      # По ID
PUT    /api/employees/:id      # Обновить
DELETE /api/employees/:id      # Удалить
```

### Subcontractors
```
GET    /api/subcontractors           # Список
POST   /api/subcontractors           # Создать { name, companyName?, ... }
GET    /api/subcontractors/:id       # По ID (с рейтингом = AVG отзывов)
PUT    /api/subcontractors/:id       # Обновить
DELETE /api/subcontractors/:id       # Удалить
```

### Reviews
```
GET    /api/reviews?subcontractorId=X  # С фильтром
POST   /api/reviews                     # { subcontractorId, employeeId, content, rating }
GET    /api/reviews/:id                 # По ID
PUT    /api/reviews/:id                 # Обновить
DELETE /api/reviews/:id                 # Удалить
```

### Comments
```
GET    /api/comments?subcontractorId=X  # С фильтром
POST   /api/comments                    # { subcontractorId, employeeId, content }
GET    /api/comments/:id                # По ID
PUT    /api/comments/:id                # Обновить
DELETE /api/comments/:id                # Удалить
```

### Checklists
```
GET    /api/checklists?type=X&ownerId=X  # С фильтрами
POST   /api/checklists                    # { title, type?, ownerId?, items? }
GET    /api/checklists/:id                # По ID
PUT    /api/checklists/:id                # Обновить (включая toggle items)
DELETE /api/checklists/:id                # Удалить
```

### Checklist Suggestions
```
GET    /api/suggestions?checklistId=X  # С фильтром
POST   /api/suggestions               # { checklistId, employeeId, suggestion }
GET    /api/suggestions/:id           # По ID
PATCH  /api/suggestions/:id           # { status: 'approved' | 'rejected' }
DELETE /api/suggestions/:id           # Удалить
```

### Meeting Protocols
```
GET    /api/meetings?subcontractorId=X  # С фильтром
POST   /api/meetings                     # { title, date, subcontractorId?, attendees, agenda, decisions?, notes? }
GET    /api/meetings/:id                 # По ID
PUT    /api/meetings/:id                 # Обновить
DELETE /api/meetings/:id                 # Удалить
```

### Surveys
```
GET    /api/surveys                  # Список
POST   /api/surveys                  # { title, subcontractorId, createdBy } (questions = default 5)
GET    /api/surveys/:id              # По ID (с ответами)
DELETE /api/surveys/:id              # Удалить
POST   /api/surveys/:id/respond      # { employeeId, answers }
GET    /api/surveys/:id/responses    # Все ответы
```

### Contractor Events (NEW)
```
GET    /api/events?subcontractorId=X  # С фильтром
POST   /api/events                    # { subcontractorId, employeeId, type, description, eventDate }
GET    /api/events/:id                # По ID
PUT    /api/events/:id                # Обновить
DELETE /api/events/:id                # Удалить
POST   /api/events/:id/suggest        # Предложить событие как пункт чек-листа { checklistId, employeeId }
```

## Фронтенд — Маршруты

| Путь | Компонент | Описание |
|------|-----------|----------|
| `/` | redirect → /subcontractors | |
| `/subcontractors` | SubcontractorsView | Список с рейтингами |
| `/subcontractors/:id` | SubcontractorDetail | Карточка + вкладки |
| `/reviews` | ReviewsView | Все отзывы |
| `/checklists` | ChecklistsView | Чек-листы |
| `/meetings` | MeetingsView | Протоколы |
| `/surveys` | SurveysView | Опросы |
| `/employees` | EmployeesView | Сотрудники |
| `/suggestions` | SuggestionsView | Предложения |
| `/events` | EventsView | Журнал событий |

## Фронтенд — Pinia Stores

| Store | Файл | Методы |
|-------|------|--------|
| useEmployeeStore | stores/employees.ts | fetchAll, fetchById, create, update, remove |
| useSubcontractorStore | stores/subcontractors.ts | fetchAll, fetchById, create, update, remove |
| useReviewStore | stores/reviews.ts | fetchAll, fetchById, create, update, remove |
| useCommentStore | stores/comments.ts | fetchAll, create, update, remove |
| useChecklistStore | stores/checklists.ts | fetchAll, fetchById, create, update, remove |
| useSuggestionStore | stores/suggestions.ts | fetchAll, fetchById, create, update, remove |
| useMeetingStore | stores/meetings.ts | fetchAll, fetchById, create, update, remove |
| useSurveyStore | stores/surveys.ts | fetchAll, fetchById, create, remove, respond, responses |
| useEventStore | stores/events.ts | fetchAll, fetchById, create, update, remove, suggestToChecklist |

## Типы TypeScript (frontend/src/types/api.ts)

```typescript
// Contractor Event
type EventType = 'positive' | 'violation' | 'info'

interface ContractorEvent {
  id: number
  subcontractor_id: number
  employee_id: number
  type: EventType
  description: string
  event_date: string
  created_at: string
}

interface ContractorEventCreate {
  subcontractorId: number
  employeeId: number
  type: EventType
  description: string
  eventDate: string
}

interface EventSuggestPayload {
  checklistId: number
  employeeId: number
}
```

## Обработка ошибок

Бэкенд:
- `AppError(statusCode, message)` — для бизнес-ошибок (404, 409 и т.д.)
- `ZodError` ловится глобальным middleware, возвращает 400 с деталями
- Все остальные ошибки → 500 Internal Server Error

Фронтенд:
- `ApiRequestError` от API-клиента
- `errorMessage(e, fallback)` — утилита для извлечения сообщения из unknown

## Конвенции

### Бэкенд
- ESM модули (`"type": "module"`)
- TypeScript strict mode
- Стрелочные функции в роутах
- Zod-схемы для валидации тела запроса
- `try/catch` + `next(e)` в каждом обработчике
- Без `any`, без `@ts-ignore`
- PORT: 3001 (через `PORT` env)

### Фронтенд
- Composition API: `<script setup lang="ts">`
- Scoped CSS в каждом компоненте
- CSS custom properties для темы и breakpoints
- `container-type: inline-size` + `@container` в views
- `@media` в App.vue / AppSidebar.vue
- Русский язык в UI
- Без внешних CSS-фреймворков
- `errorMessage()` вместо `catch(e: any)`

## Запуск

```bash
# Установка
npm install
cd backend && cp .env.example .env

# База данных (нужен PostgreSQL)
docker run -d --name master-notepad-pg \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=master_notepad -p 5433:5432 postgres:16-alpine

# В .env: DATABASE_URL=postgresql://postgres:postgres@localhost:5433/master_notepad

# Миграции
npm run db:push -w backend

# Разработка
npm run dev   # backend + frontend параллельно

# Билд
npm run build
```
