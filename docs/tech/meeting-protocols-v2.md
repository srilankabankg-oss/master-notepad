# Протоколы совещаний v2 — Технический дизайн

> Продуктовое описание: [docs/product/overview.md §5](../product/overview.md#5-протоколы-совещаний)

## 1. Overview

Протоколы v2 расширяют базовую форму протокола v1 (`meeting_protocols`) добавлением жизненного цикла из 5 этапов, 4 типов совещаний, периодичности, задач и AI-интеграции. Основные изменения относительно v1:

| Аспект | v1 (текущая) | v2 |
|--------|-------------|-----|
| Модель | Одна запись в `meeting_protocols` | `meeting_protocols` + `protocol_approvals` + `protocol_distributions` + `meeting_attendance` + `tasks` + `protocol_tasks` |
| Этапы | Нет | 5 этапов жизненного цикла |
| Типы | Нет | 4 типа: стратегическое, координационное, оперативное, проблемное |
| Периодичность | Нет | Разовое / периодическое со сквозной нумерацией |
| Задачи | Нет | Полноценные задачи с нумерацией, цепочками и параллелизацией |
| Явка | Нет | Приглашения + учёт явки через `meeting_attendance` |
| Утверждение | Нет | Поэтапное утверждение ответственными |
| AI | Нет | Заметки→задачи, стенограмма→протокол |

**Владельцы секций:** architect-1 (2,7,11), backend-dev (1,3,4,5,6,8,10), ml-engineer (9), frontend-dev (frontend parts of 8).

## 2. State Machine

### 2.1 Пять этапов жизненного цикла

Протокол проходит через 5 последовательных этапов. Каждый этап имеет свою роль-исполнителя и набор допустимых действий.

```
┌─────────┐    ┌─────────┐    ┌───────────┐    ┌──────────┐    ┌──────────────┐
│  STAGE1 │───▶│  STAGE2 │───▶│  STAGE3   │───▶│  STAGE4  │───▶│   STAGE5     │
│  Draft  │◀───│ Review  │◀───│ Recording │◀───│ Approval │    │ Distribution │
└─────────┘    └─────────┘    └───────────┘    └──────────┘    └──────────────┘
     │              │               │                │                  │
     ▼              ▼               ▼                ▼                  ▼
   Отмена       Возврат на     Возврат на       Автоутверждение    Терминальное
                доработку      доработку         по таймауту        состояние
```

| Этап | Enum | Исполнитель | Действия |
|------|------|-------------|----------|
| **1. Подготовка** | `draft` | Делопроизводитель | Создать повестку, дату/время/место, список участников; отправить приглашения |
| **2. Подготовка контролирующими** | `review` | Контролирующие | Сформировать структуру протокола; создать задачи и подзадачи; назначить ответственных и сроки; отметить выполнение задач из предыдущего протокола |
| **3. Ведение** | `recording` | Делопроизводитель | Фиксировать решения и договорённости; делать заметки; AI предлагает задачи из заметок; зафиксировать явку |
| **4. Утверждение** | `approval` | Контролирующие | Редактировать свои разделы; подтвердить часть протокола; автоподтверждение по таймауту |
| **5. Рассылка** | `distribution` | Делопроизводитель | Отправить протокол участникам + отсутствовавшим; подрядчикам — только email |

### 2.2 Допустимые переходы

Переход между этапами выполняется через выделенный эндпоинт `PUT /api/meetings/:id/transition`.

| Из | В | Кто выполняет | Условие |
|----|---|---------------|---------|
| `draft` | `review` | Делопроизводитель | Повестка и список участников заполнены |
| `review` | `draft` | Контролирующий | Требуется доработка повестки |
| `review` | `recording` | Делопроизводитель | Структура и задачи сформированы |
| `recording` | `review` | Контролирующий | Требуется корректировка структуры |
| `recording` | `approval` | Делопроизводитель | Протокол заполнен, явка зафиксирована |
| `approval` | `recording` | Контролирующий | Требуются правки по итогам утверждения |
| `approval` | `distribution` | Система / Делопроизводитель | Все подтвердили **ИЛИ** истёк таймаут |

**Запрещённые переходы:**
- Нельзя перепрыгивать через этапы (`draft` → `recording`, `review` → `approval`)
- Нельзя откатываться больше чем на один этап назад
- После `distribution` протокол терминален — изменения невозможны

### 2.3 Механизм автоутверждения (таймаут)

После перехода в `approval` система отслеживает подтверждения всех контролирующих:

```
approval_deadline = transition_to_approval_time + approval_timeout_hours
```

**Параметры:**
- `approval_timeout_hours` — настраиваемый параметр, по умолчанию 24 часа
- Хранится в `meeting_protocols.stage_data.approval_deadline`
- Проверка при каждом запросе и фоновым cron-джобом

**Логика:**
1. При переходе в `approval` создаются записи `protocol_approvals` для каждого контролирующего (роль `controller`)
2. Каждый контролирующий подтверждает свою часть (`status = 'approved'`)
3. Когда ВСЕ подтвердили → автоматический переход в `distribution`
4. Если `NOW() > approval_deadline` и есть неподтверждённые → автоутверждение:
   - Неподтверждённые записи получают `status = 'auto_approved'` с пометкой в `comment`
   - Протокол переходит в `distribution`

### 2.4 Invitations & Attendance

#### Модель `meeting_attendance`

Отдельная таблица для учёта приглашений и явки на всех этапах:

| Поле | Тип | Описание |
|------|-----|----------|
| `protocol_id` | FK → meeting_protocols.id | Протокол |
| `person_type` | enum: `employee` / `subcontractor` | Тип участника |
| `person_id` | integer | ID сотрудника или представителя контрагента (polymorphic) |
| `status` | enum: `invited` / `confirmed` / `declined` / `attended` / `absent` | Текущий статус |
| `rsvp_token` | varchar(64), unique | Одноразовый токен для RSVP внешних участников |
| `invited_at` | timestamp | Когда отправлено приглашение |
| `rsvp_at` | timestamp | Когда получен ответ |

#### Жизненный цикл приглашения

```
Stage 1 (Draft):
  ┌─────────────────────────────────────────────┐
  │ Делопроизводитель добавляет участников       │
  │ → INSERT meeting_attendance(status='invited')│
  │ → отправка email-приглашения                 │
  └─────────────────────────────────────────────┘
                       │
                       ▼
  ┌─────────────────────────────────────────────┐
  │ Участник получает email со ссылкой RSVP      │
  │ → GET /api/meetings/:id/rsvp?token=X        │
  │ → status → 'confirmed' | 'declined'         │
  └─────────────────────────────────────────────┘

Stage 3 (Recording):
  ┌─────────────────────────────────────────────┐
  │ Делопроизводитель фиксирует явку             │
  │ → confirmed → 'attended'                    │
  │ → invited/declined → 'absent'               │
  └─────────────────────────────────────────────┘
```

#### RSVP-токен

Для внешних участников (подрядчиков без доступа к системе) генерируется одноразовый RSVP-токен:

```ts
// Хранится в meeting_attendance.rsvp_token
const token = crypto.randomBytes(32).toString('hex');
// Ссылка в email: https://app.example.com/rsvp?token=<token>
```

#### Инварианты
- `person_type = 'employee'` → `person_id` ссылается на `employees.id`
- `person_type = 'subcontractor'` → `person_id` ссылается на `subcontractors.id`
- Уникальный constraint `(protocol_id, person_type, person_id)` — один участник не может быть добавлен дважды для одного протокола

---

## 3. Meeting Types

Четыре уровня совещаний, определяющие контекст использования протокола.

### 3.1 Типы и их назначение

| Тип | Значение | Контекст | Участники | Пример |
|-----|---------|----------|-----------|--------|
| `strategic` | Стратегическое | Совещание руководства. Не привязано к конкретному проекту, касается работы подразделений в целом | Руководство, начальники отделов | Планирование квартальных KPI |
| `coordination` | Координационное | Внутреннее совещание команды проекта | Сотрудники заказчика (проектная команда) | Еженедельная планёрка проекта |
| `operational` | Оперативное | Совещание с контрагентами (подрядчики, проектировщики, поставщики) | Сотрудники заказчика + представители контрагентов | Совещание на площадке с подрядчиками |
| `problem` | Проблемное | Совещание по конкретному вопросу / инциденту | Заинтересованные стороны | Разбор срыва сроков поставки |

### 3.2 Подтипы оперативных совещаний

Оперативные совещания классифицируются по типу контрагента (поле `operational_subtype`):

| Подтип | Описание |
|--------|----------|
| `contractor` | Совещание с подрядчиками |
| `designer` | Совещание с проектировщиками |
| `supplier` | Совещание с поставщиками |

### 3.3 Использование типов

Тип влияет на:
- **Доступные этапы**: все типы проходят полный цикл из 5 этапов
- **Видимость**: оперативные и проблемные могут быть видны контрагентам (только через email-рассылки)
- **AI-анализ**: для каждого типа могут применяться разные промпты LLM на этапе 3

## 4. Periodicity

### 4.1 Модель периодичности

| Параметр | Разовое (`one_time`) | Периодическое (`recurring`) |
|----------|---------------------|----------------------------|
| Частота | Нет | `cron_expression` (еженедельно, ежемесячно) |
| Нумерация | Без номера | Сквозная: №1, №2, ... в рамках серии |
| Связь протоколов | Нет | `series_id` объединяет протоколы одной серии |
| История задач | Нет цепочки | Задачи из предыдущего протокола → следующий |
| Преобразование | Может быть преобразовано в периодическое | — |

### 4.2 Параметры периодического совещания

```ts
interface RecurringMeetingConfig {
  seriesId: number;           // ID серии протоколов
  protocolNumber: number;     // Порядковый номер (сквозной)
  cronExpression: string;     // CRON-расписание
  autoCreateDaysBefore: number; // За сколько дней автоматически создавать черновик (по умолчанию: 3)
}
```

### 4.3 Преобразование разового в периодическое

Разовое совещание может быть преобразовано в периодическое. При этом:
1. Текущий протокол получает `protocolNumber: 1`
2. Создаётся `series_id`
3. Настраивается `cron_expression`
4. Следующий протокол создаётся автоматически за `autoCreateDaysBefore` дней до даты

## 5. Grouping Methods

Задачи внутри протокола группируются одним из двух методов. Метод выбирается при создании протокола и может быть изменён на этапе 2.

### 5.1 Методы группировки

| Метод | Значение | Описание | Использование |
|-------|---------|----------|---------------|
| **По темам** | `by_topic` | Задачи группируются по разделам рабочей документации или направлениям | Удобно для координационных совещаний проектной команды |
| **По подрядчикам** | `by_subcontractor` | Задачи группируются по организациям-контрагентам | Удобно для оперативных совещаний с подрядчиками |

### 5.2 Группировка по темам

Темы определяются как теги/категории задачи. Пример структуры:

```
Протокол №5 (по темам)
├── Проектирование
│   ├── Задача 1: Уточнить спецификацию оборудования
│   └── Задача 2: Согласовать план расстановки
├── СМР
│   ├── Задача 3: Приёмка фундамента
│   └── Задача 4: Монтаж металлоконструкций
├── Экспертиза
│   └── Задача 5: Пройти госэкспертизу изменений
└── ЗОС
    └── Задача 6: Подготовить акты ЗОС
```

Каждая задача имеет поле `topic_tag` (varchar, nullable).

### 5.3 Группировка по подрядчикам

Задачи привязываются к конкретному контрагенту через `subcontractor_id`. Пример структуры:

```
Протокол №5 (по подрядчикам)
├── ООО "СтройМонтаж"
│   ├── Задача 1: Завершить бетонирование
│   └── Задача 2: Предоставить паспорта на арматуру
├── ООО "ЭлектроМонтаж"
│   └── Задача 3: Проложить кабельные линии
└── Без подрядчика (внутренние)
    └── Задача 4: Актуализировать график
```

### 5.4 Комбинированный режим

При группировке «по темам» задачи могут опционально привязываться к подрядчику (поле `subcontractor_id` на `tasks` остаётся nullable). При группировке «по подрядчикам» темы игнорируются.

## 6. Task Requests

Запрос задачи к повестке — механизм, позволяющий любому сотруднику предложить вопрос для обсуждения на следующем совещании. Не привязан к конкретному этапу протокола.

### 6.1 Жизненный цикл запроса

```
Отправлен (submitted) → На рассмотрении (reviewing) → Принят (accepted) / Отклонён (rejected)
```

| Статус | Описание | Кто меняет |
|--------|----------|-----------|
| `submitted` | Сотрудник отправил запрос | Сотрудник |
| `reviewing` | Контролирующий взял в работу | Контролирующий |
| `accepted` | Запрос одобрен → задача создана в протоколе | Контролирующий |
| `rejected` | Запрос отклонён → сотрудник получает уведомление с причиной | Контролирующий |

### 6.2 DB Schema (task_requests)

```ts
export const taskRequestStatusEnum = pgEnum('task_request_status', [
  'submitted',
  'reviewing',
  'accepted',
  'rejected',
]);

export const taskRequests = pgTable('task_requests', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id')
    .references(() => employees.id, { onDelete: 'cascade' })
    .notNull(),
  meetingSeriesId: integer('meeting_series_id')
    .references(() => meetingProtocols.id, { onDelete: 'cascade' })
    .notNull(),
  description: text('description').notNull(),
  rationale: text('rationale'),                        // Обоснование: почему это важно
  status: taskRequestStatusEnum('status').notNull().default('submitted'),
  reviewerEmployeeId: integer('reviewer_employee_id')
    .references(() => employees.id, { onDelete: 'set null' }),
  rejectionReason: text('rejection_reason'),
  resultingTaskId: integer('resulting_task_id'),        // ID задачи, созданной при accept
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### 6.3 Бизнес-логика

1. **Создание запроса**: любой аутентифицированный сотрудник. Требуется `description` (обязательно) и `rationale` (опционально).
2. **Рассмотрение**: контролирующий переводит запрос в `reviewing`, может запросить уточнение.
3. **Принятие**: контролирующий переводит в `accepted`, система создаёт задачу (`tasks`) и связывает через `resulting_task_id`. Задача автоматически включается в повестку следующего протокола серии.
4. **Отклонение**: контролирующий переводит в `rejected`, указывает `rejectionReason`. Сотрудник получает уведомление (email/telegram — см. notifications.md).

---

## 7. DB Schema

Полная Drizzle ORM схема для meeting-домена. Секция 6 содержит схему `task_requests` — здесь она включена для полноты вместе с остальными таблицами.

### 7.1 Новые Enums

```ts
import { pgTable, serial, varchar, text, integer, timestamp, pgEnum, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';

// ── meeting_protocols enums ──
export const meetingStageEnum = pgEnum('meeting_stage', [
  'draft',         // Этап 1: Подготовка делопроизводителем
  'review',        // Этап 2: Подготовка контролирующими
  'recording',     // Этап 3: Ведение протокола
  'approval',      // Этап 4: Утверждение
  'distribution',  // Этап 5: Рассылка
]);

export const meetingTypeEnum = pgEnum('meeting_type', [
  'strategic',      // Стратегическое
  'coordination',   // Координационное
  'operational',    // Оперативное
  'problem',        // Проблемное
]);

export const meetingPeriodicityEnum = pgEnum('meeting_periodicity', [
  'one_time',   // Разовое
  'periodic',   // Периодическое
]);

export const groupingMethodEnum = pgEnum('grouping_method', [
  'by_topic',       // Группировка задач по темам
  'by_contractor',  // Группировка задач по подрядчикам
]);

// Подтип оперативного совещания (только при meeting_type = 'operational')
export const operationalSubtypeEnum = pgEnum('operational_subtype', [
  'contractor',  // С подрядчиками
  'designer',    // С проектировщиками
  'supplier',    // С поставщиками
]);

// ── task_requests enums ──
export const taskRequestStatusEnum = pgEnum('task_request_status', [
  'pending',    // На рассмотрении
  'approved',   // Утверждён
  'rejected',   // Отклонён
]);

// ── protocol_approvals enums ──
export const approvalStatusEnum = pgEnum('approval_status', [
  'pending',         // Ожидает утверждения
  'approved',        // Утверждено
  'rejected',        // Отклонено (возврат на доработку)
  'auto_approved',   // Автоутверждено по таймауту
]);

// ── meeting_attendance enums ──
export const personTypeEnum = pgEnum('person_type', [
  'employee',              // Сотрудник организации
  'subcontractor',   // Представитель контрагента (внешний участник)
]);

export const attendanceStatusEnum = pgEnum('attendance_status', [
  'invited',     // Приглашён (Stage 1)
  'confirmed',   // Подтвердил участие
  'declined',    // Отказался
  'attended',    // Присутствовал (зафиксировано на Stage 3)
  'absent',      // Отсутствовал (зафиксировано на Stage 3)
]);

// ── protocol_distributions enums ──
export const distributionChannelEnum = pgEnum('distribution_channel', [
  'email',
  'telegram',
]);

export const distributionStatusEnum = pgEnum('distribution_status', [
  'pending',   // Ожидает отправки
  'sent',      // Отправлено успешно
  'failed',    // Ошибка отправки
]);
```

### 7.2 meeting_protocols (расширение v1 → v2)

```ts
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
  // Подтип оперативного (только при meeting_type = 'operational', иначе NULL)
  operationalSubtype: operationalSubtypeEnum('operational_subtype'),

  // ── Связи ──
  subcontractorId: integer('subcontractor_id')
    .references(() => subcontractors.id, { onDelete: 'set null' }),
  // Для периодических: ссылка на родительский протокол (первый в серии)
  parentProtocolId: integer('parent_protocol_id')
    .references((): any => meetingProtocols.id, { onDelete: 'set null' }),
  // Порядковый номер в цепочке периодических совещаний
  sequenceNumber: integer('sequence_number').default(1),

  // ── Данные этапов (JSONB) ──
  // Stage 1: { sentInvitations: boolean }
  // Stage 2: { structure: Array<{ section: string, tasks: number[] }> }
  // Stage 3: { notes: string, aiSuggestions: Array<{ title: string, description: string }> }
  // Stage 4: { approvalDeadline: ISO-string, autoApproved: boolean }
  // Stage 5: { distributedAt: ISO-string, channels: string[] }
  stageData: jsonb('stage_data').$type<Record<string, unknown>>().default({}),

  // ── DEPRECATED (оставлено для обратной совместимости) ──
  // attendees: заменено на meeting_attendance
  attendees: jsonb('attendees').$type<string[]>().default([]),

  // ── Таймстемпы ──
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### 7.3 task_requests

```ts
export const taskRequests = pgTable('task_requests', {
  id: serial('id').primaryKey(),
  protocolId: integer('protocol_id')
    .references(() => meetingProtocols.id, { onDelete: 'cascade' })
    .notNull(),
  employeeId: integer('employee_id')
    .references(() => employees.id, { onDelete: 'cascade' })
    .notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description').notNull().default(''),
  status: taskRequestStatusEnum('status').notNull().default('pending'),
  reasonRejected: text('reason_rejected'),  // причина отказа
  reviewedBy: integer('reviewed_by')
    .references(() => employees.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at'),
  // При approve: ID созданной задачи
  resultingTaskId: integer('resulting_task_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### 7.4 protocol_approvals

```ts
export const protocolApprovals = pgTable('protocol_approvals', {
  id: serial('id').primaryKey(),
  protocolId: integer('protocol_id')
    .references(() => meetingProtocols.id, { onDelete: 'cascade' })
    .notNull(),
  employeeId: integer('employee_id')
    .references(() => employees.id, { onDelete: 'cascade' })
    .notNull(),
  status: approvalStatusEnum('status').notNull().default('pending'),
  comment: text('comment'),  // комментарий при утверждении или отклонении
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  // Один сотрудник — одна запись утверждения на протокол
  uniqueProtocolEmployee: uniqueIndex('uq_protocol_approval')
    .on(table.protocolId, table.employeeId),
}));
```

### 7.5 protocol_distributions

```ts
export const protocolDistributions = pgTable('protocol_distributions', {
  id: serial('id').primaryKey(),
  protocolId: integer('protocol_id')
    .references(() => meetingProtocols.id, { onDelete: 'cascade' })
    .notNull(),
  // Полиморфная связь: кому отправляем
  personType: personTypeEnum('person_type').notNull(),
  personId: integer('person_id').notNull(),
  // Контактные данные для отправки
  email: varchar('email', { length: 255 }),
  telegramChatId: varchar('telegram_chat_id', { length: 100 }),
  // Канал и статус
  channel: distributionChannelEnum('channel').notNull().default('email'),
  status: distributionStatusEnum('status').notNull().default('pending'),
  sentAt: timestamp('sent_at'),
  errorMessage: text('error_message'),
  retryCount: integer('retry_count').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### 7.6 meeting_attendance

```ts
export const meetingAttendance = pgTable('meeting_attendance', {
  id: serial('id').primaryKey(),
  protocolId: integer('protocol_id')
    .references(() => meetingProtocols.id, { onDelete: 'cascade' })
    .notNull(),
  // Полиморфная связь: кто приглашён
  personType: personTypeEnum('person_type').notNull(),
  personId: integer('person_id').notNull(),
  // Статус участия
  status: attendanceStatusEnum('status').notNull().default('invited'),
  // RSVP для внешних участников (без доступа к системе)
  rsvpToken: varchar('rsvp_token', { length: 64 }).unique(),
  // Таймстемпы
  invitedAt: timestamp('invited_at'),
  rsvpAt: timestamp('rsvp_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  // Один человек — одна запись на протокол
  uniqueProtocolPerson: uniqueIndex('uq_protocol_person')
    .on(table.protocolId, table.personType, table.personId),
}));
```

### 7.7 Drizzle Relations

```ts
export const meetingProtocolsRelations = relations(meetingProtocols, ({ one, many }) => ({
  subcontractor: one(subcontractors, {
    fields: [meetingProtocols.subcontractorId],
    references: [subcontractors.id],
  }),
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
  // tasks — через junction protocol_tasks (см. tasks.md)
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
```

### 7.8 Индексы

```sql
-- Быстрый поиск протоколов по статусу
CREATE INDEX idx_meeting_protocols_stage ON meeting_protocols(stage);

-- Поиск дочерних протоколов периодического совещания
CREATE INDEX idx_meeting_protocols_parent ON meeting_protocols(parent_protocol_id);

-- Для проверки таймаута утверждения (частичный индекс)
CREATE INDEX idx_protocol_approvals_pending
  ON protocol_approvals(protocol_id, status)
  WHERE status = 'pending';

-- Поиск запросов задач по статусу
CREATE INDEX idx_task_requests_status ON task_requests(status);
CREATE INDEX idx_task_requests_protocol ON task_requests(protocol_id);

-- Поиск явки по протоколу
CREATE INDEX idx_meeting_attendance_protocol ON meeting_attendance(protocol_id);

-- Поиск рассылок по протоколу и статусу
CREATE INDEX idx_protocol_distributions_protocol ON protocol_distributions(protocol_id);
CREATE INDEX idx_protocol_distributions_pending
  ON protocol_distributions(protocol_id, status)
  WHERE status = 'pending';
```

### 7.9 Полная ERD-диаграмма meeting-домена

```
                         ┌──────────────────────────┐
                         │    meeting_protocols      │
                         │  (расширенная v2)         │
                         │                           │
                         │  +stage, +meetingType     │
                         │  +periodicity, +grouping  │
                         │  +parentProtocolId (self) │
                         │  +stageData (JSONB)       │
                         └──────┬───────────────────┘
                                │
          ┌─────────────────────┼─────────────────────┬──────────────────────┐
          │                     │                     │                      │
          ▼                     ▼                     ▼                      ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│   task_requests  │ │protocol_approvals│ │protocol_distribu│ │meeting_attendance│
│                  │ │                  │ │     tions       │ │                  │
│  protocol_id FK  │ │  protocol_id FK  │ │  protocol_id FK │ │  protocol_id FK  │
│  employee_id FK  │ │  employee_id FK  │ │  person_type    │ │  person_type     │
│  reviewed_by FK  │ │  status          │ │  person_id      │ │  person_id       │
│  status          │ │  comment         │ │  channel        │ │  status          │
│  reason_rejected │ │                  │ │  status         │ │  rsvp_token      │
│  resultingTaskId │ │                  │ │  retry_count    │ │                  │
└──────────────────┘ └──────────────────┘ └──────────────────┘ └──────────────────┘
          │
          ▼
    meeting_protocols ◄──(parent_protocol_id)── meeting_protocols  [self-ref: periodic chain]
    meeting_protocols ──(subcontractor_id)───── subcontractors
    meeting_protocols ──► protocol_tasks ◄── tasks  [junction, см. tasks.md]
```

---

## 8. API Design

Все эндпоинты с префиксом `/api/meetings`. Требуется `requireAuth` на все ручки.

### 8.1 Управление протоколами

```
GET    /api/meetings
       Query: ?subcontractorId=X&type=strategic&stage=in_progress&seriesId=X
       Response 200: MeetingProtocol[]
```

```
POST   /api/meetings
       Body: { title, date, type, periodicity?, groupingMethod?, subcontractorId?, attendees?, agenda }
       Validation: Zod — см. ниже
       Response 201: MeetingProtocol
       Side effects: auditLog('create'), fire-and-forget AI reindex
```

```
GET    /api/meetings/:id
       Response 200: MeetingProtocol
       Error 404: "Meeting protocol not found"
```

```
PUT    /api/meetings/:id
       Body: partial<CreateSchema>
       Response 200: MeetingProtocol
       Error 404: "Meeting protocol not found"
```

```
DELETE /api/meetings/:id
       Response 200: { message: "Deleted" }
       Error 404: "Meeting protocol not found"
```

### 8.2 Переходы между этапами

```
POST   /api/meetings/:id/transition
       Body: { stage: Enum<stage>, metadata?: Record<string, unknown> }
       Validation: stage in ['preparation', 'control_preparation', 'in_progress', 'approval', 'distribution']
       Response 200: MeetingProtocol (с обновлённым stage)
       Business logic:
         - Проверка допустимости перехода (см. State Machine)
         - Автоутверждение: если stage='approval' → 'distribution' по таймауту
       Error 400: "Invalid stage transition from X to Y"
```

### 8.3 Управление утверждениями

```
GET    /api/meetings/:id/approvals
       Response 200: ProtocolApproval[]

POST   /api/meetings/:id/approve
       Body: { employeeId: number, comment?: string }
       Response 200: ProtocolApproval
       Side effects: если все утвердили → авто-переход stage='distribution'
```

### 8.4 Управление явкой

```
GET    /api/meetings/:id/attendance
       Response 200: MeetingAttendance[]

POST   /api/meetings/:id/attendance
       Body: { personType: 'employee'|'contractor', personId: number, status: 'invited'|'confirmed'|'declined'|'attended'|'absent' }
       Response 201: MeetingAttendance
```

```
PATCH  /api/meetings/:id/attendance/:attendanceId
       Body: { status: 'confirmed'|'declined'|'attended'|'absent' }
       Response 200: MeetingAttendance
```

### 8.5 Запросы задач (Task Requests)

```
GET    /api/meetings/task-requests?status=submitted&meetingSeriesId=X
       Response 200: TaskRequest[]

POST   /api/meetings/task-requests
       Body: { meetingSeriesId, description, rationale? }
       Validation: description min 1, meetingSeriesId positive int
       Response 201: TaskRequest
       Side effects: auditLog('create')
```

```
PATCH  /api/meetings/task-requests/:id
       Body: { status: 'reviewing' }
       Response 200: TaskRequest

PATCH  /api/meetings/task-requests/:id
       Body: { status: 'accepted' }
       Business logic:
         1. Создаёт задачу в tasks
         2. Устанавливает resulting_task_id
         3. Добавляет задачу в protocol_tasks текущего активного протокола серии
         4. Уведомляет автора запроса

PATCH  /api/meetings/task-requests/:id
       Body: { status: 'rejected', rejectionReason: string }
       Response 200: TaskRequest
       Side effects: уведомление автору с причиной отказа
```

### 8.6 Рассылка протокола

```
POST   /api/meetings/:id/distribute
       Body: { channels: ('email'|'telegram')[] }
       Business logic:
         1. Проверка stage='distribution'
         2. Для каждого участника (attended + absent): отправка через notification service
         3. Запись в protocol_distributions
       Response 202: { status: "accepted", distributionId: number }
```

### 8.7 Серии периодических совещаний

```
GET    /api/meetings/series/:seriesId
       Response 200: { series: MeetingSeries, protocols: MeetingProtocol[] }

GET    /api/meetings/series/:seriesId/next
       Response 200: MeetingProtocol (следующий протокол серии или null)

POST   /api/meetings/:id/convert-to-recurring
       Body: { cronExpression: string, autoCreateDaysBefore?: number }
       Business logic:
         1. Создаёт meeting_series
         2. Устанавливает series_id, protocolNumber=1
       Response 200: MeetingProtocol
```

### 8.8 Zod-схемы валидации

```ts
const createMeetingSchema = z.object({
  title: z.string().min(1).max(500),
  date: z.string().datetime(),
  type: z.enum(['strategic', 'coordination', 'operational', 'problem']),
  operationalSubtype: z.enum(['contractor', 'designer', 'supplier']).optional(),
  periodicity: z.enum(['one_time', 'recurring']).default('one_time'),
  groupingMethod: z.enum(['by_topic', 'by_subcontractor']).default('by_topic'),
  subcontractorId: z.number().int().positive().nullable().optional(),
  attendees: z.array(z.string()).default([]),
  agenda: z.string().min(1),
  decisions: z.string().optional(),
  notes: z.string().optional(),
  recurringConfig: z.object({
    cronExpression: z.string(),
    autoCreateDaysBefore: z.number().int().min(1).max(30).default(3),
  }).optional(),
});

const transitionSchema = z.object({
  stage: z.enum(['preparation', 'control_preparation', 'in_progress', 'approval', 'distribution']),
});

const attendanceSchema = z.object({
  personType: z.enum(['employee', 'contractor']),
  personId: z.number().int().positive(),
  status: z.enum(['invited', 'confirmed', 'declined', 'attended', 'absent']),
});

const taskRequestSchema = z.object({
  meetingSeriesId: z.number().int().positive(),
  description: z.string().min(1),
  rationale: z.string().optional(),
});

const taskRequestUpdateSchema = z.object({
  status: z.enum(['reviewing', 'accepted', 'rejected']),
  rejectionReason: z.string().optional(),
});

const distributeSchema = z.object({
  channels: z.array(z.enum(['email', 'telegram'])).min(1),
});
```

### 8.9 Обработка ошибок

Все обработчики следуют стандартной конвенции:

```ts
meetingsRouter.post('/', validateBody(createMeetingSchema), async (req, res, next) => {
  try {
    const meeting = /* ... */;
    notifyReindex('meeting', meeting.id);
    await auditLog({ entityType: 'meeting', entityId: meeting.id, employeeId: getEmployeeId(req)!, action: 'create', changes: { ...req.body } });
    res.status(201).json(meeting);
  } catch (e) { next(e); }
});
```

Типовые ошибки:
| Код | Ситуация |
|-----|---------|
| 400 | Zod validation error (некорректное тело запроса) |
| 400 | Недопустимый переход этапа |
| 404 | Протокол / запрос задачи не найден |
| 409 | Дублирующийся запрос задачи |
| 503 | Сервис уведомлений недоступен |

## 10. Testing Strategy

### 10.1 Unit-тесты (backend/__tests__/)

**State Machine (stage transitions):**
```ts
describe('Meeting stage transitions', () => {
  it('allows preparation → control_preparation');
  it('allows control_preparation → in_progress');
  it('allows in_progress → approval');
  it('allows approval → distribution when all approved');
  it('rejects preparation → in_progress (skip)');
  it('rejects in_progress → distribution (skip approval)');
  it('auto-approves after timeout when not all responded');
});
```

**Task Requests:**
```ts
describe('Task requests', () => {
  it('create with required fields returns 201');
  it('create without description returns 400');
  it('accept creates task and links via resulting_task_id');
  it('reject sends notification to author');
  it('duplicate request returns 409');
});
```

**Periodicity:**
```ts
describe('Periodic meetings', () => {
  it('convert one_time → recurring creates series and sets protocolNumber=1');
  it('next protocol auto-creates with correct protocolNumber');
  it('tasks from previous protocol appear in next with status check');
});
```

```ts
describe('Attendance', () => {
  it('add attendee with status "invited"');
  it('update attendee status invited → confirmed');
  it('update attendee status invited → declined');
  it('during stage 3, update confirmed → attended');
  it('during stage 3, update confirmed → absent');
});
```

### 10.2 Интеграционные тесты (API)

```ts
describe('Meetings API', () => {
  describe('POST /api/meetings', () => {
    it('creates protocol with type=operational');
    it('creates protocol with periodicity=recurring and cron config');
    it('validates groupingMethod enum');
    it('validates operationalSubtype only for type=operational');
  });

  describe('POST /api/meetings/:id/transition', () => {
    it('transitions through full lifecycle preparation→distribution');
    it('403 when non-controlling employee tries transition');
  });

  describe('POST /api/meetings/task-requests', () => {
    it('creates task request linked to series');
    it('accept → task appears in protocol_tasks');
    it('reject → author notified');
  });

  describe('POST /api/meetings/:id/distribute', () => {
    it('sends email to all attendees');
    it('records distribution in protocol_distributions');
    it('400 when stage != distribution');
  });
});
```

### 10.3 E2E-тесты (Playwright)

```ts
describe('Meeting Protocols v2 E2E', () => {
  it('full lifecycle: create → prepare → control prepare → conduct → approve → distribute');
  it('periodic meeting: create series → auto-create next → task chain');
  it('task request: employee submits → controller reviews → accepts → task appears');
  it('attendance: invite contractors → confirm → mark attended at stage 3');
  it('grouping: by_topic shows topic tags, by_subcontractor shows contractor sections');
});
```

### 10.4 Специфичные проверки

- **RBAC**: контролирующий может управлять задачами; делопроизводитель — приглашения и ведение; сотрудник — только просмотр + запросы задач
- **Idempotency**: повторный POST `/transition` с тем же stage не создаёт дублей
- **Concurrency**: два одновременных approve на последний голос — только первый вызывает transition
- **AI Integration**: при создании задач из заметок на этапе 3, предложенные задачи не дублируют существующие

---

## 11. Migration Notes (v1 → v2)

### 11.1 Что меняется

| Аспект | v1 (текущая) | v2 (новая) |
|--------|-------------|-----------|
| `meeting_protocols` | 10 полей, без этапов | 18+ полей, 5 этапов |
| `subcontractor_id` | NOT NULL (обязателен) | NULL (стратегические — без подрядчика) |
| `attendees` | JSONB `string[]` | **deprecated** → заменено на `meeting_attendance` |
| `decisions`, `notes` | text (ручной ввод) | Остаются + `stage_data` JSONB + AI-заметки |
| Приглашения | Нет | `meeting_attendance` + RSVP-токены |
| Утверждение | Нет | `protocol_approvals` + автоутверждение по таймауту |
| Рассылка | Нет | `protocol_distributions` + каналы (email, telegram) |
| Запросы задач | Нет | `task_requests` |
| Junction-таблица | Нет | `protocol_tasks` (см. [tasks.md](tasks.md)) |

### 11.2 Пошаговый план миграции

#### Миграция 1: Добавление новых колонок в meeting_protocols

```sql
-- Шаг 1: Создать enum-типы
CREATE TYPE meeting_stage AS ENUM ('draft', 'review', 'recording', 'approval', 'distribution');
CREATE TYPE meeting_type AS ENUM ('strategic', 'coordination', 'operational', 'problem');
CREATE TYPE meeting_periodicity AS ENUM ('one_time', 'periodic');
CREATE TYPE grouping_method AS ENUM ('by_topic', 'by_contractor');
CREATE TYPE operational_subtype AS ENUM ('contractor', 'designer', 'supplier');

-- Шаг 2: Добавить новые колонки (nullable → заполним → NOT NULL)
ALTER TABLE meeting_protocols
  ADD COLUMN stage meeting_stage,
  ADD COLUMN meeting_type meeting_type,
  ADD COLUMN periodicity meeting_periodicity,
  ADD COLUMN grouping_method grouping_method,
  ADD COLUMN operational_subtype operational_subtype,
  ADD COLUMN parent_protocol_id INTEGER REFERENCES meeting_protocols(id) ON DELETE SET NULL,
  ADD COLUMN sequence_number INTEGER DEFAULT 1,
  ADD COLUMN stage_data JSONB DEFAULT '{}';

-- Шаг 3: Заполнить значениями по умолчанию
-- Все существующие протоколы — уже проведены, получают терминальный статус
UPDATE meeting_protocols SET
  stage = 'distribution',
  meeting_type = 'operational',
  periodicity = 'one_time',
  grouping_method = 'by_topic'
WHERE stage IS NULL;

-- Шаг 4: Установить NOT NULL
ALTER TABLE meeting_protocols
  ALTER COLUMN stage SET NOT NULL,
  ALTER COLUMN meeting_type SET NOT NULL,
  ALTER COLUMN periodicity SET NOT NULL,
  ALTER COLUMN grouping_method SET NOT NULL;

-- Шаг 5: subcontractor_id → nullable
ALTER TABLE meeting_protocols
  ALTER COLUMN subcontractor_id DROP NOT NULL;

-- Шаг 6: Индексы
CREATE INDEX idx_meeting_protocols_stage ON meeting_protocols(stage);
CREATE INDEX idx_meeting_protocols_parent ON meeting_protocols(parent_protocol_id);
```

**Почему `stage = 'distribution'` для старых протоколов:** все существующие протоколы уже созданы, проведены и не должны участвовать в новом жизненном цикле. Терминальный статус `distribution` блокирует любые изменения этапа.

#### Миграция 2: Создание новых таблиц

```sql
-- Enums для новых таблиц
CREATE TYPE task_request_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected', 'auto_approved');
CREATE TYPE person_type AS ENUM ('employee', 'subcontractor');
CREATE TYPE attendance_status AS ENUM ('invited', 'confirmed', 'declined', 'attended', 'absent');
CREATE TYPE distribution_channel AS ENUM ('email', 'telegram');
CREATE TYPE distribution_status AS ENUM ('pending', 'sent', 'failed');

-- task_requests
CREATE TABLE task_requests (
  id SERIAL PRIMARY KEY,
  protocol_id INTEGER NOT NULL REFERENCES meeting_protocols(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status task_request_status NOT NULL DEFAULT 'pending',
  reason_rejected TEXT,
  reviewed_by INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  resulting_task_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- protocol_approvals
CREATE TABLE protocol_approvals (
  id SERIAL PRIMARY KEY,
  protocol_id INTEGER NOT NULL REFERENCES meeting_protocols(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  status approval_status NOT NULL DEFAULT 'pending',
  comment TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_protocol_approval UNIQUE (protocol_id, employee_id)
);

-- protocol_distributions
CREATE TABLE protocol_distributions (
  id SERIAL PRIMARY KEY,
  protocol_id INTEGER NOT NULL REFERENCES meeting_protocols(id) ON DELETE CASCADE,
  person_type person_type NOT NULL,
  person_id INTEGER NOT NULL,
  email VARCHAR(255),
  telegram_chat_id VARCHAR(100),
  channel distribution_channel NOT NULL DEFAULT 'email',
  status distribution_status NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMP,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- meeting_attendance
CREATE TABLE meeting_attendance (
  id SERIAL PRIMARY KEY,
  protocol_id INTEGER NOT NULL REFERENCES meeting_protocols(id) ON DELETE CASCADE,
  person_type person_type NOT NULL,
  person_id INTEGER NOT NULL,
  status attendance_status NOT NULL DEFAULT 'invited',
  rsvp_token VARCHAR(64) UNIQUE,
  invited_at TIMESTAMP,
  rsvp_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_protocol_person UNIQUE (protocol_id, person_type, person_id)
);

-- Индексы
CREATE INDEX idx_task_requests_status ON task_requests(status);
CREATE INDEX idx_task_requests_protocol ON task_requests(protocol_id);
CREATE INDEX idx_protocol_approvals_pending ON protocol_approvals(protocol_id, status) WHERE status = 'pending';
CREATE INDEX idx_meeting_attendance_protocol ON meeting_attendance(protocol_id);
CREATE INDEX idx_protocol_distributions_protocol ON protocol_distributions(protocol_id);
CREATE INDEX idx_protocol_distributions_pending ON protocol_distributions(protocol_id, status) WHERE status = 'pending';
```

#### Миграция 3: Данные attendees → meeting_attendance (опционально)

```sql
-- attendees в v1 — массив строк (имена людей), без привязки к employees
-- Автоматическая миграция невозможна — имена могут не совпадать с БД
-- Решение: attendees остаётся deprecated, новые протоколы используют meeting_attendance
-- При необходимости — ручной перенос администратором
```

#### Миграция 4: Drizzle ORM

```bash
# Генерация миграций из обновлённой схемы schema/index.ts
cd backend
npx drizzle-kit generate

# Применение
npx drizzle-kit migrate
```

### 11.3 Rollback-план

```sql
-- Удаление новых таблиц
DROP TABLE IF EXISTS meeting_attendance CASCADE;
DROP TABLE IF EXISTS protocol_distributions CASCADE;
DROP TABLE IF EXISTS protocol_approvals CASCADE;
DROP TABLE IF EXISTS task_requests CASCADE;

-- Удаление новых колонок из meeting_protocols
ALTER TABLE meeting_protocols
  DROP COLUMN IF EXISTS stage,
  DROP COLUMN IF EXISTS meeting_type,
  DROP COLUMN IF EXISTS periodicity,
  DROP COLUMN IF EXISTS grouping_method,
  DROP COLUMN IF EXISTS operational_subtype,
  DROP COLUMN IF EXISTS parent_protocol_id,
  DROP COLUMN IF EXISTS sequence_number,
  DROP COLUMN IF EXISTS stage_data;

-- Возврат subcontractor_id к NOT NULL (если нет NULL-значений)
-- Предварительно: обновить NULL → любое существующее значение
ALTER TABLE meeting_protocols
  ALTER COLUMN subcontractor_id SET NOT NULL;

-- Удаление enum-типов
DROP TYPE IF EXISTS distribution_status CASCADE;
DROP TYPE IF EXISTS distribution_channel CASCADE;
DROP TYPE IF EXISTS attendance_status CASCADE;
DROP TYPE IF EXISTS person_type CASCADE;
DROP TYPE IF EXISTS approval_status CASCADE;
DROP TYPE IF EXISTS task_request_status CASCADE;
DROP TYPE IF EXISTS grouping_method CASCADE;
DROP TYPE IF EXISTS operational_subtype CASCADE;
DROP TYPE IF EXISTS meeting_periodicity CASCADE;
DROP TYPE IF EXISTS meeting_type CASCADE;
DROP TYPE IF EXISTS meeting_stage CASCADE;
```

### 11.4 Проверка совместимости

| Компонент | Влияние | Действие |
|-----------|---------|----------|
| **API v1** (`GET/POST/PUT/DELETE /api/meetings`) | Новые поля в ответе, не обязательны в запросе | ✅ Обратная совместимость |
| **Фронтенд MeetingsView** | Старые поля не удалены, новые добавляются | ✅ Работает без изменений |
| **AI-ассистент** | entity `meeting` → добавить поля `stage`, `meeting_type` в ingestion | 🔧 Обновить ingestion-логику |
| **SubcontractorDetail** | Вкладка «Протоколы» рендерит `subcontractorId` | ✅ Без изменений |
| **TenderSummary** | Использует `meetings` в сводке | ✅ Без изменений |
| **AuditLog** | Новые таблицы → новые `entity_type` | 🔧 Добавить 'task_request', 'protocol_approval', 'meeting_attendance' |

---

## 11. Frontend

### Новые Views

| Путь | Компонент | Описание |
|------|-----------|----------|
| `/meetings` | `MeetingsView.vue` (обновление) | Список протоколов с фильтром по типу, этапу, периодичности |
| `/meetings/new` | `MeetingFormView.vue` | Форма создания протокола (выбор типа, метода группировки, настроек периодичности) |
| `/meetings/:id` | `MeetingDetailView.vue` | Детальная страница протокола с этапами, задачами, утверждениями, явкой |
| `/meetings/:id/tasks` | `MeetingTasksView.vue` | Управление задачами протокола (создание, перенос, порядок) |
| `/meetings/:id/attendance` | `MeetingAttendanceView.vue` | Учёт явки участников (Stage 3) |
| `/meetings/:id/approvals` | `MeetingApprovalsView.vue` | Утверждение протокола ответственными (Stage 4) |
| `/meetings/series/:seriesId` | `MeetingSeriesView.vue` | История протоколов периодического совещания |
| `/task-requests` | `TaskRequestsView.vue` | Запросы задач к повестке (для сотрудников и контролирующих) |

### Новые Stores

| Store | Файл | Методы |
|-------|------|--------|
| `useMeetingStore` (обновление) | `stores/meetings.ts` | Добавить `transition(stage)`, `fetchBySeries(seriesId)` |
| `useTaskStore` (новый) | `stores/tasks.ts` | `fetchByProtocol`, `create`, `update`, `remove`, `move`, `reorder`, `markDone` |
| `useTaskRequestStore` (новый) | `stores/taskRequests.ts` | `fetchAll`, `fetchBySeries`, `create`, `update`, `accept`, `reject` |
| `useAttendanceStore` (новый) | `stores/attendance.ts` | `fetchByProtocol`, `upsert`, `bulkUpdate` |
| `useApprovalStore` (новый) | `stores/approvals.ts` | `fetchByProtocol`, `approve`, `reject` |

### Новые роуты

```ts
// Обновление существующего
{ path: '/meetings', name: 'meetings', component: () => import('@/views/MeetingsView.vue') },

// Новые маршруты
{ path: '/meetings/new',              name: 'meeting-new',               component: () => import('@/views/MeetingFormView.vue') },
{ path: '/meetings/:id',              name: 'meeting-detail',            component: () => import('@/views/MeetingDetailView.vue') },
{ path: '/meetings/:id/tasks',        name: 'meeting-tasks',             component: () => import('@/views/MeetingTasksView.vue') },
{ path: '/meetings/:id/attendance',   name: 'meeting-attendance',        component: () => import('@/views/MeetingAttendanceView.vue') },
{ path: '/meetings/:id/approvals',    name: 'meeting-approvals',         component: () => import('@/views/MeetingApprovalsView.vue') },
{ path: '/meetings/series/:seriesId', name: 'meeting-series',            component: () => import('@/views/MeetingSeriesView.vue') },
{ path: '/task-requests',             name: 'task-requests',             component: () => import('@/views/TaskRequestsView.vue') },
```

### Обновления существующих Views

- **MeetingsView.vue**: добавить фильтры по `type` (4 типа), `stage` (5 этапов), `periodicity`; колонка "Этап" с цветным бейджем статуса
- **AppSidebar.vue**: добавить пункт "Запросы задач" → `/task-requests`
- **SubcontractorDetail.vue**: вкладка "Протоколы" фильтрует по `subcontractorId`

### Новые типы (`types/api.ts`)

```ts
// === Meeting Types & Stages ===
export type MeetingType = 'strategic' | 'coordination' | 'operational' | 'problem'
export type MeetingSubtype = 'contractor' | 'designer' | 'supplier'
export type MeetingStage = 'preparation' | 'control_preparation' | 'in_progress' | 'approval' | 'distribution'
export type MeetingPeriodicity = 'one_time' | 'weekly' | 'monthly'

export interface MeetingProtocol {
  id: number
  title: string
  date: string
  type: MeetingType
  operationalSubtype?: MeetingSubtype
  periodicity: MeetingPeriodicity
  seriesId?: string
  seriesNumber?: number
  stage: MeetingStage
  groupingMethod: 'by_topic' | 'by_subcontractor'
  subcontractorId?: number | null
  attendees: Array<{ name: string; email: string; org?: string; role?: string }>
  agenda: string
  decisions?: string
  notes?: string
  stageData?: Record<string, unknown>
  approvalDeadline?: string
  createdBy: number
  createdAt: string
  updatedAt: string
}

export interface MeetingCreate {
  title: string
  date: string
  type: MeetingType
  operationalSubtype?: MeetingSubtype
  periodicity?: MeetingPeriodicity
  groupingMethod?: 'by_topic' | 'by_subcontractor'
  subcontractorId?: number | null
  attendees: Array<{ name: string; email: string; org?: string; role?: string }>
  agenda: string
  decisions?: string
  notes?: string
  recurringConfig?: { cronExpression: string; autoCreateDaysBefore?: number }
}

// === Tasks ===
export type TaskStatus = 'created' | 'in_progress' | 'done' | 'archived'
export type TaskLinkRole = 'home' | 'delegated'

export interface ProtocolTask {
  id: number
  protocolId: number
  sourceProtocolId?: number | null
  taskNumber: string
  title: string
  description?: string
  assigneeId?: number | null
  controllerId?: number | null
  status: TaskStatus
  resolutionText?: string | null
  resolvedAt?: string | null
  sortOrder: number
  topicTag?: string | null
  createdAt: string
  updatedAt: string
}

export interface TaskCreate {
  title: string
  description?: string
  assigneeId?: number | null
  controllerId?: number | null
  topicTag?: string | null
}

// === Task Requests ===
export type TaskRequestStatus = 'submitted' | 'reviewing' | 'accepted' | 'rejected'

export interface TaskRequest {
  id: number
  meetingSeriesId: number
  employeeId: number
  employeeName?: string
  description: string
  rationale?: string
  status: TaskRequestStatus
  reviewerEmployeeId?: number | null
  rejectionReason?: string | null
  resultingTaskId?: number | null
  createdAt: string
  updatedAt: string
}

// === Attendance ===
export type AttendancePersonType = 'employee' | 'subcontractor'
export type AttendanceStatus = 'invited' | 'confirmed' | 'declined' | 'attended' | 'absent'

export interface MeetingAttendance {
  id: number
  protocolId: number
  personType: AttendancePersonType
  personId: number
  personName: string
  status: AttendanceStatus
  respondedAt?: string | null
}

// === Approvals ===
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export interface ProtocolApproval {
  id: number
  protocolId: number
  approverId: number
  approverName?: string
  status: ApprovalStatus
  comment?: string | null
  approvedAt?: string | null
}
```

### Обновления API-клиента (`api/client.ts`)

```ts
meetings: {
  // ... существующие методы
  transition: (id: number, stage: MeetingStage) =>
    request<MeetingProtocol>(`/meetings/${id}/transition`, { method: 'POST', body: JSON.stringify({ stage }) }),
  attendance: {
    list: (protocolId: number) => request<MeetingAttendance[]>(`/meetings/${protocolId}/attendance`),
    upsert: (protocolId: number, data: Partial<MeetingAttendance>) =>
      request<MeetingAttendance>(`/meetings/${protocolId}/attendance`, { method: 'POST', body: JSON.stringify(data) }),
    update: (protocolId: number, attendanceId: number, data: { status: AttendanceStatus }) =>
      request<MeetingAttendance>(`/meetings/${protocolId}/attendance/${attendanceId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },
  approvals: {
    list: (protocolId: number) => request<ProtocolApproval[]>(`/meetings/${protocolId}/approvals`),
    submit: (protocolId: number, data: { comment?: string }) =>
      request<ProtocolApproval>(`/meetings/${protocolId}/approve`, { method: 'POST', body: JSON.stringify(data) }),
  },
  distribute: (id: number, channels: ('email' | 'telegram')[]) =>
    request<{ status: string; distributionId: number }>(`/meetings/${id}/distribute`, { method: 'POST', body: JSON.stringify({ channels }) }),
  series: (seriesId: string) => request<{ series: MeetingProtocol; protocols: MeetingProtocol[] }>(`/meetings/series/${seriesId}`),
  convertToRecurring: (id: number, data: { cronExpression: string; autoCreateDaysBefore?: number }) =>
    request<MeetingProtocol>(`/meetings/${id}/convert-to-recurring`, { method: 'POST', body: JSON.stringify(data) }),
},
taskRequests: {
  list: (params?: { status?: TaskRequestStatus; meetingSeriesId?: number }) =>
    request<TaskRequest[]>(`/meetings/task-requests${qs(params || {})}`),
  create: (data: { meetingSeriesId: number; description: string; rationale?: string }) =>
    request<TaskRequest>('/meetings/task-requests', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: { status: TaskRequestStatus; rejectionReason?: string }) =>
    request<TaskRequest>(`/meetings/task-requests/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
},
tasks: {
  byProtocol: (protocolId: number) => request<ProtocolTask[]>(`/meetings/${protocolId}/tasks`),
  create: (protocolId: number, data: TaskCreate) =>
    request<ProtocolTask>(`/meetings/${protocolId}/tasks`, { method: 'POST', body: JSON.stringify(data) }),
  update: (protocolId: number, taskId: number, data: Partial<TaskCreate>) =>
    request<ProtocolTask>(`/meetings/${protocolId}/tasks/${taskId}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (protocolId: number, taskId: number) =>
    request<void>(`/meetings/${protocolId}/tasks/${taskId}`, { method: 'DELETE' }),
  move: (protocolId: number, taskId: number, targetProtocolId: number) =>
    request<ProtocolTask>(`/meetings/${protocolId}/tasks/${taskId}/move`, { method: 'POST', body: JSON.stringify({ targetProtocolId }) }),
  reorder: (protocolId: number, taskId: number, sortOrder: number) =>
    request<ProtocolTask>(`/meetings/${protocolId}/tasks/${taskId}/reorder`, { method: 'POST', body: JSON.stringify({ sortOrder }) }),
  markDone: (protocolId: number, taskId: number, resolutionText?: string) =>
    request<ProtocolTask>(`/meetings/${protocolId}/tasks/${taskId}/done`, { method: 'POST', body: JSON.stringify({ resolutionText }) }),
},
```

### Flow данных

```
MeetingFormView (создание)
  → форма с селектом типа, метода группировки, переключателем периодичности
  → useMeetingStore.create(data)
    → api.meetings.create(data)
      → POST /api/meetings

MeetingDetailView
  → useMeetingStore.fetchById(id)
  → useTaskStore.byProtocol(id)
  → useAttendanceStore.fetchByProtocol(id)
  → useApprovalStore.fetchByProtocol(id)
  → отображение: текущий этап (бейдж), timeline этапов, список задач, панель утверждений

MeetingTasksView
  → useTaskStore.byProtocol(protocolId)
  → группировка по topicTag или по subcontractorId (в зависимости от groupingMethod)
  → drag-and-drop для изменения sortOrder → useTaskStore.reorder()
  → кнопка "Перенести в другой протокол" → модал с выбором целевого протокола → useTaskStore.move()

TaskRequestsView
  → useTaskRequestStore.fetchAll()
  → фильтр по статусу (все / ожидают / принятые / отклонённые)
  → для контролирующих: кнопки "Принять" / "Отклонить"
  → для сотрудников: только создание новых запросов
```

### Паттерн этапов в UI

Этапы отображаются как горизонтальный степпер (stepper):

```
[1. Подготовка] → [2. Структура] → [3. Ведение] → [4. Утверждение] → [5. Рассылка]
     ✅                ✅              🔄              ⏳               ⬜
```

Текущий этап подсвечен, пройденные — зелёные галочки, будущие — серые. При клике на пройденный этап можно вернуться назад (если разрешено бизнес-логикой).

### Паттерн группировки задач

При `groupingMethod = 'by_topic'`:
```
Задачи
├── Проектирование (3)
│   ├── Задача 1
│   └── Задача 2
├── СМР (2)
│   └── Задача 3
└── Экспертиза (1)
```

При `groupingMethod = 'by_subcontractor'`:
```
Задачи
├── ООО "СтройМонтаж" (2)
│   ├── Задача 1
│   └── Задача 2
└── Внутренние (2)
```

Группировка реализуется через `computed`-свойство в `MeetingTasksView.vue`, которое группирует массив задач по соответствующему полю.

### Container queries

`MeetingDetailView.vue` использует `container-type: inline-size` для адаптации степпера и списка задач на узких экранах: степпер переносится в несколько строк, карточки задач становятся на всю ширину контейнера.