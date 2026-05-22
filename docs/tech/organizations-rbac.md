# Организации и ролевая модель (RBAC) — Технический дизайн

> Продуктовое описание: [docs/product/overview.md §10, §11](../product/overview.md#10-участники-и-организации)

## 1. Обзор

Расширение системы поддержкой организаций-участников (не только подрядчиков) и ролевой модели доступа (RBAC) с 5 ролями. В текущей версии (MVP) роли `admin` и `employee` определены в базе, но enforcement доступа не реализован — все пользователи имеют доступ ко всем функциям. Данный документ описывает целевое состояние с полным RBAC.

**Ключевое архитектурное решение (Oracle):** отдельная таблица `contractor_employees` **не нужна**. Внешние представители контрагентов не имеют доступа к системе, их данные хранятся денормализованно в контексте использования (явка на совещаниях — в `meeting_attendance`, контактные лица подрядчика — в `subcontractors`).

### Роли

| Роль | Код | Описание |
|------|-----|----------|
| Администратор | `admin` | Полный доступ ко всем функциям системы |
| Делопроизводитель | `clerk` | Создание и ведение протоколов, рассылка, фиксация явки |
| Контролирующий | `controller` | Формирование структуры протокола, создание задач, утверждение протокола |
| Сотрудник Заказчика | `employee` | Просмотр протоколов и задач, создание запросов задач |
| Подрядчик | `contractor` | **Нет доступа к системе.** Коммуникация только через email |

## 2. Организации

Организации — это все юридические лица, участвующие в процессе: заказчик, подрядчики, проектировщики, поставщики.

### Поля

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | serial | Уникальный идентификатор |
| `name` | text | Наименование организации |
| `inn` | varchar(12) | ИНН (уникальный) |
| `primaryActivity` | text | Основной вид деятельности |
| `isContractor` | boolean | Является ли подрядчиком (для фильтрации) |
| `createdAt` | timestamptz | Дата создания |
| `updatedAt` | timestamptz | Дата обновления |

### Связи

- `organizations` → `subcontractors` (1:N, `subcontractors.organization_id` FK, nullable для обратной совместимости)
- `organizations` → `contracts` (1:N, будущее)

### API

```
GET    /api/organizations              # Список (фильтр: isContractor, search по name/inn)
POST   /api/organizations              # Создать { name, inn, primaryActivity?, isContractor? }
GET    /api/organizations/:id          # По ID (с подрядчиками)
PUT    /api/organizations/:id          # Обновить
DELETE /api/organizations/:id          # Удалить (если нет связанных подрядчиков)
```

## 3. Сотрудники контрагентов

Представители внешних организаций (подрядчиков, проектировщиков, поставщиков). Отдельная таблица **не создаётся** — подрядчики уже имеют запись в `subcontractors`, сотрудники заказчика — в `employees`. Внешние представители хранятся в контексте использования:

1. **В явке на совещаниях**: `meeting_attendance` (см. meeting-protocols-v2.md) содержит денормализованные поля `personName`, `personPosition`, `personEmail` для представителей контрагентов.
2. **Контактные лица подрядчика**: поле `contactInfo` (text) в таблице `subcontractors` — свободный текст с контактами (ФИО, телефон, email контактного лица).

Коммуникация с контрагентами — только через email, без доступа к системе.

## 4. RBAC Roles

### Хранение роли

Роль хранится в `employees.role` (`varchar(50)`). Значения: `admin`, `clerk`, `controller`, `employee`, `contractor`.

### Матрица разрешений

| Операция | admin | clerk | controller | employee | contractor |
|----------|-------|-------|------------|----------|------------|
| Управление сотрудниками | ✅ | ❌ | ❌ | ❌ | ❌ |
| Управление организациями | ✅ | ❌ | ❌ | ❌ | ❌ |
| Создание/редактирование протоколов | ✅ | ✅ | ❌ | ❌ | ❌ |
| Утверждение протоколов | ✅ | ❌ | ✅ | ❌ | ❌ |
| Создание задач | ✅ | ❌ | ✅ | ❌ | ❌ |
| Просмотр протоколов | ✅ | ✅ | ✅ | ✅ | ❌ |
| Запрос задач к повестке | ✅ | ❌ | ❌ | ✅ | ❌ |
| Управление подрядчиками | ✅ | ✅ | ❌ | ❌ | ❌ |
| Отзывы, комментарии, события | ✅ | ✅ | ✅ | ✅ | ❌ |
| Доступ к системе | ✅ | ✅ | ✅ | ✅ | ❌ |

### Middleware `requireRole`

Плоский список разрешённых ролей — без иерархии:

```ts
// backend/src/middleware/rbac.ts
import type { Request, Response, NextFunction } from 'express';
import { AppError } from './error-handler.js';

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    // Dev bypass: localhost проходит без сессии
    const LOCALHOST_IPS = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
    if (LOCALHOST_IPS.includes(req.ip || '')) {
      next();
      return;
    }

    if (!req.session?.employeeId) {
      next(new AppError(401, 'Authentication required'));
      return;
    }

    if (roles.length > 0 && req.session?.employeeRole && !roles.includes(req.session.employeeRole)) {
      next(new AppError(403, 'Insufficient permissions'));
      return;
    }

    next();
  };
}
```

Использование в роутах:

```ts
router.post('/meetings', requireRole('admin', 'clerk'), validateBody(createMeetingSchema), createMeeting);
router.put('/meetings/:id/approve', requireRole('admin', 'controller'), approveProtocol);
router.get('/employees', requireRole('admin'), listEmployees);
```

## 5. Схема базы данных (Drizzle ORM)

Полная Drizzle ORM схема для доменов «организации» и «ролевая модель». Использует стиль, принятый в проекте (`backend/src/db/schema/index.ts`).

### 5.1 Новая таблица `organizations`

```ts
import { pgTable, serial, varchar, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const organizations = pgTable('organizations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  inn: varchar('inn', { length: 12 }).unique(),
  primaryActivity: text('primary_activity'),
  isContractor: boolean('is_contractor').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

### 5.2 Модификация `subcontractors` — добавление `organization_id`

```ts
// В существующую таблицу subcontractors добавляется:
organizationId: integer('organization_id')
  .references(() => organizations.id, { onDelete: 'set null' }),
```

### 5.3 Модификация `employees` — расширение `role`

```ts
// Поле role уже существует (varchar(50), default 'employee').
// Добавляются новые значения через CHECK constraint на уровне миграции.
// В Drizzle-схеме роль остаётся varchar — валидация на уровне middleware.
export const employees = pgTable('employees', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  position: varchar('position', { length: 255 }),
  passwordHash: varchar('password_hash', { length: 255 }),
  role: varchar('role', { length: 50 }).notNull().default('employee'),
  // admin | clerk | controller | employee | contractor
  // NOTE: 'contractor' — только для классификации, НЕ даёт доступ к API
  // (подрядчики не входят в систему, коммуникация через email)
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### 5.4 Drizzle Relations

```ts
// ── organizations relations ──
export const organizationsRelations = relations(organizations, ({ many }) => ({
  subcontractors: many(subcontractors),
}));

// ── subcontractors relations (ОБНОВЛЕНИЕ существующей) ──
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
}));
```

### 5.5 ERD-диаграмма

```
┌─────────────────┐
│  organizations  │
│                 │
│  id (PK)        │
│  name           │
│  inn (UNIQUE)   │
│  primaryActivity│
│  isContractor   │
└────────┬────────┘
         │ 1:N
         ▼
┌─────────────────┐
│ subcontractors   │
│                 │
│  id (PK)        │
│  name           │
│  companyName    │
│  contactInfo    │←── контактные лица (текстовое поле)
│  specialization │
│  organization_id│─── FK → organizations.id (nullable)
│       (NEW v2)  │
└─────────────────┘

┌─────────────────┐
│   employees     │
│                 │
│  id (PK)        │
│  name           │
│  email (UNIQUE) │
│  role           │─── 'admin' | 'clerk' | 'controller' | 'employee' | 'contractor'
│  passwordHash   │
└─────────────────┘
```

### 5.6 Миграция `employees.role` — CHECK constraint

```sql
ALTER TABLE employees
  ADD CONSTRAINT employees_role_check
  CHECK (role IN ('admin', 'clerk', 'controller', 'employee', 'contractor'));
```

### 5.7 Миграция `subcontractors.organization_id`

```sql
ALTER TABLE subcontractors
  ADD COLUMN organization_id INTEGER
  REFERENCES organizations(id) ON DELETE SET NULL;
```

### 5.8 Полный список изменений схемы

| Таблица | Изменение | Тип |
|---------|-----------|-----|
| `organizations` | **Новая таблица** | CREATE |
| `subcontractors` | `+ organization_id INTEGER FK → organizations` (nullable) | ALTER |
| `employees` | `+ CHECK role IN (...)` | ALTER |

## 6. API Design

Все эндпоинты с префиксом `/api/`. Следуют конвенциям: Zod validation, AppError, try/catch + next(e).

### Organizations

```
GET    /api/organizations
       Access: admin, clerk, controller, employee
       Query: ?isContractor=true&search=строй
       Response 200: Organization[]

POST   /api/organizations
       Access: admin
       Body: { name, inn, primaryActivity?, isContractor? }
       Validation: Zod schema (см. ниже)
       Response 201: Organization
       Error 409: "Organization with this INN already exists"

GET    /api/organizations/:id
       Access: admin, clerk, controller, employee
       Response 200: Organization
       Error 404: "Organization not found"

PUT    /api/organizations/:id
       Access: admin
       Body: partial<CreateSchema>
       Response 200: Organization

DELETE /api/organizations/:id
       Access: admin
       Response 200: { message: "Deleted" }
       Error 409: "Cannot delete organization with linked subcontractors"
```

### Employees — управление ролью

```
PUT    /api/employees/:id/role
       Access: admin
       Body: { role: 'admin' | 'clerk' | 'controller' | 'employee' }
       Validation: Zod enum
       Response 200: Employee
       Error 403: "Only admin can change roles"
       Side effects: auditLog('update', changes: { role }),
                     обновление сессионной роли если сотрудник меняет сам себе
```

### RBAC info

```
GET    /api/rbac/permissions
       Response 200: { role: string, permissions: Record<string, boolean> }

GET    /api/rbac/my-role
       Response 200: { role: string }
```

### Zod-схемы

```ts
import { z } from 'zod';

const createOrganizationSchema = z.object({
  name: z.string().min(1).max(500),
  inn: z.string().regex(/^\d{10}(\d{2})?$/, 'Invalid INN format'),
  primaryActivity: z.string().optional(),
  isContractor: z.boolean().default(false),
});

const updateOrganizationSchema = createOrganizationSchema.partial();

const updateRoleSchema = z.object({
  role: z.enum(['admin', 'clerk', 'controller', 'employee']),
});
```

### Обработка ошибок

```ts
organizationsRouter.post('/', requireRole('admin'), validateBody(createOrganizationSchema), async (req, res, next) => {
  try {
    const existing = await db.select().from(schema.organizations)
      .where(eq(schema.organizations.inn, req.body.inn))
      .limit(1);
    if (existing.length > 0) {
      throw new AppError(409, 'Organization with this INN already exists');
    }
    const [org] = await db.insert(schema.organizations).values(req.body).returning();
    await auditLog({ entityType: 'organization', entityId: org.id, employeeId: getEmployeeId(req), action: 'create', changes: { ...req.body } });
    res.status(201).json(org);
  } catch (e) { next(e); }
});
```

| Код | Ситуация |
|-----|---------|
| 400 | Zod validation error |
| 401 | Не аутентифицирован (нет сессии) |
| 403 | Недостаточно прав |
| 404 | Сущность не найдена |
| 409 | Дубликат ИНН / невозможно удалить (связанные подрядчики) |

## 7. Testing Strategy

### Unit

- `requireRole` middleware: доступ для разрешённых ролей, 401 без сессии, 403 для остальных
- `getEmployeeId`: только из сессии, без body fallback
- Матрица разрешений: каждая роль × операция → ожидаемый результат

### Integration

- Создание организации → отображение в списке
- Дубликат ИНН → 409
- `requireRole('admin')` на эндпоинте → 403 для `employee`
- `requireRole('admin', 'clerk')` на эндпоинте → `clerk` проходит, `employee` — 403
- Назначение роли: `PUT /api/employees/:id/role` от admin → 200, от clerk → 403

### Автоматизированная проверка матрицы

```ts
describe('RBAC Permission Matrix', () => {
  const roles = ['admin', 'clerk', 'controller', 'employee'] as const;

  const matrix: Record<string, Record<string, number>> = {
    'POST /api/organizations':       { admin: 201, clerk: 403, controller: 403, employee: 403 },
    'GET /api/organizations':        { admin: 200, clerk: 200, controller: 200, employee: 200 },
    'PUT /api/employees/:id/role':   { admin: 200, clerk: 403, controller: 403, employee: 403 },
    'POST /api/meetings':            { admin: 201, clerk: 201, controller: 403, employee: 403 },
  };

  for (const [endpoint, expected] of Object.entries(matrix)) {
    for (const role of roles) {
      it(`${role} → ${endpoint} → ${expected[role]}`, async () => { /* ... */ });
    }
  }
});
```

## Frontend

### Новые Views

| Путь | Компонент | Описание |
|------|-----------|----------|
| `/organizations` | `OrganizationsView.vue` | Список организаций с фильтром "только подрядчики" |
| `/organizations/:id` | `OrganizationDetail.vue` | Карточка организации: данные + список связанных подрядчиков |

### Новые Stores

| Store | Файл | Методы |
|-------|------|--------|
| `useOrganizationStore` | `stores/organizations.ts` | `fetchAll`, `fetchById`, `create`, `update`, `remove` |

### Новые роуты

```ts
{ path: '/organizations',       name: 'organizations',       component: () => import('@/views/OrganizationsView.vue') },
{ path: '/organizations/:id',   name: 'organization-detail', component: () => import('@/views/OrganizationDetail.vue') },
```

### Обновления существующих Views

- **SubcontractorsView.vue**: в форме создания/редактирования подрядчика добавить селект `organizationId` (загрузка из `useOrganizationStore`)
- **MeetingsView.vue**: в attendees добавить ручной ввод ФИО/email представителей контрагентов (денормализованно, через `meeting_attendance`)
- **AppSidebar.vue**: добавить пункт "Организации" → `/organizations`

### Новые типы (`types/api.ts`)

```ts
interface Organization {
  id: number;
  name: string;
  inn: string | null;
  primaryActivity: string | null;
  isContractor: boolean;
  createdAt: string;
  updatedAt: string;
}

interface OrganizationCreate {
  name: string;
  inn?: string;
  primaryActivity?: string;
  isContractor?: boolean;
}
```

### Обновления API-клиента (`api/client.ts`)

```ts
organizations: {
  list: (params?: { isContractor?: boolean; search?: string }) =>
    request<Organization[]>(`/organizations${qs(params || {})}`),
  get: (id: number) => request<Organization>(`/organizations/${id}`),
  create: (data: OrganizationCreate) =>
    request<Organization>('/organizations', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<OrganizationCreate>) =>
    request<Organization>(`/organizations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) =>
    request<void>(`/organizations/${id}`, { method: 'DELETE' }),
},
```

### Flow данных

```
OrganizationsView
  → useOrganizationStore.fetchAll()
    → api.organizations.list()
      → GET /api/organizations

OrganizationDetail
  → useOrganizationStore.fetchById(id)
  → отображение связанных subcontractors через GET /api/subcontractors?organizationId=X

SubcontractorsView (обновление)
  → useOrganizationStore.fetchAll() для селекта организаций
  → при создании подрядчика: organizationId передаётся в SubcontractorCreate
```

### RBAC в UI (целевое состояние)

- Пункты меню скрываются/блокируются в зависимости от роли пользователя
- Кнопки с запрещёнными операциями скрыты или disabled
- При попытке доступа к запрещённому маршруту — редирект на `/` с сообщением
- Роль пользователя доступна через `useAuthStore().user.role`