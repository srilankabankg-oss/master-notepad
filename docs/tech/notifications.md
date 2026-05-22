# Система уведомлений

## 1. Обзор

Единая система уведомлений для Master Notepad, поддерживающая два канала доставки: Email (nodemailer) и Telegram (telegraf). Отвечает за все внешние коммуникации системы: приглашения на совещания, рассылка протоколов, уведомления об отказе в запросе задачи, дедлайны задач.

### Архитектура

```
┌─────────────────────────────────────────────────────┐
│              Backend (Express)                       │
│  ┌─────────────┐    ┌──────────────────────────┐   │
│  │   Роуты     │───▶│  NotificationService      │   │
│  │ (meetings,  │    │  ┌────────────────────┐  │   │
│  │  tasks)     │    │  │  EmailProvider      │  │   │
│  └─────────────┘    │  │  TelegramProvider   │  │   │
│                     │  └────────────────────┘  │   │
│                     └──────────────────────────┘   │
│                              │                      │
│                     ┌────────▼────────┐            │
│                     │ protocol_distributions │    │
│                     │ user_notification_prefs │   │
│                     └─────────────────┘            │
└─────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐    ┌──────────┐    ┌──────────┐
        │  SMTP    │    │ Telegram │    │  Retry   │
        │  (smtp)  │    │  (bot)   │    │  Queue   │
        └──────────┘    └──────────┘    └──────────┘
```

### События, triggering уведомления

| Событие | Канал | Получатель |
|---------|-------|------------|
| Приглашение на совещание (Stage 1) | Email | Участники |
| Рассылка протокола (Stage 5) | Email | Участники + отсутствовавшие |
| Отказ в запросе задачи | Email | Сотрудник, создавший запрос |
| Новая задача назначена | Telegram | Исполнитель |
| Дедлайн задачи approaching | Telegram | Исполнитель + контролирующий |
| Протокол утверждён | Email | Автор протокола |
| Протокол возвращён на доработку | Email | Делопроизводитель |

## 2. Каналы

### Email (nodemailer)

```ts
// backend/src/notifications/email.ts
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE === 'true',
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
})

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  await transporter.sendMail({ from: env.SMTP_FROM, to, subject, html })
}
```

### Telegram (telegraf)

```ts
// backend/src/notifications/telegram.ts
import { Telegraf } from 'telegraf'

const bot = new Telegraf(env.TELEGRAM_BOT_TOKEN)

async function sendTelegram(chatId: string, text: string): Promise<void> {
  await bot.telegram.sendMessage(chatId, text)
}
```

Маппинг `employeeId → chatId` хранится в `employees.telegram_chat_id` (дополнительное поле, nullable).

## 3. Email Infrastructure

### Шаблоны

Шаблоны писем хранятся в `backend/src/notifications/templates/` как HTML-файлы с плейсхолдерами `{{variable}}`:

```
templates/
├── meeting-invitation.html    # Приглашение на совещание
├── protocol-distributed.html  # Рассылка протокола
├── task-request-rejected.html # Отказ в запросе задачи
├── protocol-approved.html     # Утверждение протокола
└── protocol-returned.html     # Возврат на доработку
```

Рендеринг через простой `replace(/\{\{(\w+)\}\}/g, ...)` или шаблонизатор (Handlebars/EJS при необходимости).

### Retry-политика

```ts
async function sendWithRetry<T>(
  sendFn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 5000,
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await sendFn()
    } catch (e) {
      if (attempt === maxRetries) throw e
      await new Promise(r => setTimeout(r, delayMs * attempt))
    }
  }
  throw new Error('Unreachable')
}
```

### Tracking через `protocol_distributions`

Каждая отправка логируется в `protocol_distributions`:

| Поле | Описание |
|------|----------|
| `protocolId` | Ссылка на протокол |
| `channel` | `email` или `telegram` |
| `recipient` | Email или chat_id |
| `status` | `pending` → `sent` → `delivered`/`bounced`/`failed` |
| `sentAt` | Время отправки |
| `error` | Текст ошибки при неудаче |

## 4. Telegram Infrastructure

### Bot setup

```ts
// backend/src/notifications/telegram.ts
const bot = new Telegraf(env.TELEGRAM_BOT_TOKEN)

// Webhook для получения chat_id при первом контакте
bot.command('start', (ctx) => {
  const chatId = String(ctx.chat.id)
  // Сохранить chatId в БД по employeeId из сессии
})
```

### Сценарии

| Событие | Формат сообщения |
|---------|-----------------|
| Новая задача | `🔔 Новая задача: {title}\nПротокол: {protocolTitle}\nСрок: {deadline}` |
| Дедлайн через 24ч | `⏰ Задача "{title}" подходит к концу срока\nПротокол: {protocolTitle}` |
| Задача выполнена | `✅ Задача "{title}" выполнена` |

## 5. Use Cases

### UC1: Приглашение на совещание

1. Делопроизводитель переводит протокол в `published` (Stage 3)
2. Бэкенд вызывает `NotificationService.inviteToMeeting(protocolId)`
3. Для каждого участника: создаётся запись в `protocol_distributions` + отправляется email через `sendWithRetry`
4. Участник получает приглашение с ссылкой на протокол (если у него есть доступ) или с информацией о совещании

### UC2: Рассылка протокола

1. Протокол переводится в `approved` → `distributed` (Stage 5)
2. Бэкенд вызывает `NotificationService.distributeProtocol(protocolId)`
3. Рассылка участникам (присутствовавшим) и отсутствовавшим
4. Статус доставки обновляется в `protocol_distributions`

### UC3: Отказ в запросе задачи

1. Контролирующий отклоняет запрос задачи: `PUT /approvals/:id { status: 'rejected', comment }`
2. Бэкенд вызывает `NotificationService.taskRequestRejected(requestId)`
3. Сотрудник, создавший запрос, получает email с причиной отказа

### UC4: Уведомление о дедлайне задачи

1. Фоновая задача (cron) раз в час проверяет задачи с дедлайном через 24 часа
2. Для каждой такой задачи: отправка Telegram исполнителю и контролирующему
3. Запись в `protocol_distributions` с `channel = 'telegram'`

## 6. API Design

Все эндпоинты с префиксом `/api/`. Защищены `requireAuth`.

### Notification Preferences

```
GET    /api/notifications/preferences
       Response 200: NotificationPreferences
       Error 404: "No preferences found" — авто-создание с defaults при первом запросе

PUT    /api/notifications/preferences
       Body: NotificationPreferencesUpdate
       Validation: Zod schema (см. ниже)
       Response 200: NotificationPreferences
       Error 400: validation error
```

### Distribution Status

```
GET    /api/meetings/:id/distributions
       Response 200: ProtocolDistribution[]
       Error 404: "Meeting protocol not found"
```

### Manual Send

```
POST   /api/meetings/:id/send-invitations
       Business logic: для каждого attendee со status='invited' → email через NotificationService
       Response 202: { status: "accepted", distributionCount: N }
       Error 404: "Meeting protocol not found"
       Error 400: "Protocol stage must be distribution"

POST   /api/meetings/:id/distribute
       Body: { channels: ('email'|'telegram')[] }
       Validation: Zod schema
       Business logic: рассылка участникам + отсутствовавшим по выбранным каналам
       Response 202: { status: "accepted", distributionCount: N }
       Error 400: "Protocol stage must be distribution"
```

### Zod-схемы

```ts
const updatePreferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
  telegramEnabled: z.boolean().optional(),
  taskDeadlines: z.boolean().optional(),
  protocolDistributed: z.boolean().optional(),
  taskRequestResult: z.boolean().optional(),
});

const distributeSchema = z.object({
  channels: z.array(z.enum(['email', 'telegram'])).min(1),
});
```

### Обработка ошибок

Все обработчики следуют стандартной конвенции `try/catch` + `next(e)`:

```ts
notificationsRouter.put('/preferences', requireRole('admin', 'clerk', 'controller', 'employee'), validateBody(updatePreferencesSchema), async (req, res, next) => {
  try {
    const [prefs] = await db.update(schema.userNotificationPreferences)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(schema.userNotificationPreferences.employeeId, getEmployeeId(req)))
      .returning();
    if (!prefs) throw new AppError(404, 'Notification preferences not found');
    res.json(prefs);
  } catch (e) { next(e); }
});
```

| Код | Ситуация |
|-----|---------|
| 400 | Zod validation error |
| 401 | Не аутентифицирован |
| 403 | Недостаточно прав |
| 404 | Протокол / настройки не найдены |
| 503 | SMTP или Telegram-сервис недоступен |

## 7. Схема базы данных (Drizzle)

### `protocol_distributions`

```ts
import { pgTable, serial, integer, varchar, timestamp, text } from 'drizzle-orm/pg-core';

export const protocolDistributions = pgTable('protocol_distributions', {
  id: serial('id').primaryKey(),
  protocolId: integer('protocol_id')
    .references(() => meetingProtocols.id, { onDelete: 'cascade' })
    .notNull(),
  channel: varchar('channel', { length: 20 }).notNull(),       // 'email' | 'telegram'
  recipient: varchar('recipient', { length: 255 }).notNull(),   // email или chat_id
  recipientType: varchar('recipient_type', { length: 20 }).notNull().default('attendee'), // 'attendee' | 'absent' | 'author' | 'reviewer'
  entityType: varchar('entity_type', { length: 50 }).notNull(), // 'meeting_invitation' | 'protocol_distribution' | 'task_request_rejected' | ...
  entityId: integer('entity_id').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),  // 'pending' | 'sent' | 'delivered' | 'bounced' | 'failed'
  sentAt: timestamp('sent_at'),
  deliveredAt: timestamp('delivered_at'),
  error: text('error'),
  retryCount: integer('retry_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
```

### `user_notification_preferences`

```ts
export const userNotificationPreferences = pgTable('user_notification_preferences', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id')
    .references(() => employees.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  emailEnabled: varchar('email_enabled', { length: 1 }).notNull().default('1'),      // boolean через char(1)
  telegramEnabled: varchar('telegram_enabled', { length: 1 }).notNull().default('0'),
  taskDeadlines: varchar('task_deadlines', { length: 1 }).notNull().default('1'),
  protocolDistributed: varchar('protocol_distributed', { length: 1 }).notNull().default('1'),
  taskRequestResult: varchar('task_request_result', { length: 1 }).notNull().default('1'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

### Миграция `employees` (Telegram chat ID)

```ts
// Добавить в employees таблицу:
telegramChatId: varchar('telegram_chat_id', { length: 50 }),
```

## 8. Testing Strategy

### Unit

- Рендеринг шаблонов: плейсхолдеры заменяются корректно
- Retry: при ошибке отправки повторяется нужное количество раз
- При 3-й неудаче выбрасывается ошибка

### Integration

- Создание протокола → вызов `inviteToMeeting` → записи в `protocol_distributions`
- Отклонение запроса задачи → вызов `taskRequestRejected` → email отправлен
- Несуществующий email → статус `bounced`, ошибка в `error` поле
- Настройки пользователя: `email_enabled = false` → email не отправляется

## Frontend

### Новые Views

| Путь | Компонент | Описание |
|------|-----------|----------|
| `/notifications/preferences` | `NotificationPreferencesView.vue` | Настройки уведомлений пользователя |

### Новые Stores

| Store | Файл | Методы |
|-------|------|--------|
| `useNotificationPreferenceStore` | `stores/notificationPreferences.ts` | `fetchMine`, `update` |

### Новые роуты

```ts
{ path: '/notifications/preferences', name: 'notification-preferences', component: () => import('@/views/NotificationPreferencesView.vue') },
```

### Обновления существующих Views

- **MeetingsView.vue**: кнопка "Отправить приглашения" (если статус `draft`), кнопка "Разослать протокол" (если статус `approved`)
- **SuggestionsView.vue** (запросы задач): при отклонении автоматически отправляется уведомление через бэкенд

### Новые типы (`types/api.ts`)

```ts
interface NotificationPreferences {
  id: number
  employeeId: number
  emailEnabled: boolean
  telegramEnabled: boolean
  taskDeadlines: boolean
  protocolDistributed: boolean
  taskRequestResult: boolean
  createdAt: string
  updatedAt: string
}

interface NotificationPreferencesUpdate {
  emailEnabled?: boolean
  telegramEnabled?: boolean
  taskDeadlines?: boolean
  protocolDistributed?: boolean
  taskRequestResult?: boolean
}
```

### Обновления API-клиента (`api/client.ts`)

```ts
notifications: {
  preferences: {
    get: () => request<NotificationPreferences>('/notifications/preferences'),
    update: (data: NotificationPreferencesUpdate) =>
      request<NotificationPreferences>('/notifications/preferences', { method: 'PUT', body: JSON.stringify(data) }),
  },
}
```

### Flow данных

```
NotificationPreferencesView
  → useNotificationPreferenceStore.fetchMine()
    → api.notifications.preferences.get()
      → GET /api/notifications/preferences

  → форма с чекбоксами (emailEnabled, telegramEnabled, ...)
  → useNotificationPreferenceStore.update(prefs)
    → api.notifications.preferences.update(data)
      → PUT /api/notifications/preferences
```

### Уведомления в UI

Уведомления не отображаются в реальном времени в интерфейсе (MVP). Пользователь видит статус рассылки на странице протокола:

```
Статус рассылки:
  ✅ email → ivanov@org.ru — доставлено
  ✅ email → petrov@org.ru — доставлено
  ❌ email → sidorov@org.ru — bounced (неверный адрес)
```

Статус загружается через `GET /api/protocols/:id/distributions` и отображается в `MeetingsView.vue` или `ProtocolDetail.vue`.
