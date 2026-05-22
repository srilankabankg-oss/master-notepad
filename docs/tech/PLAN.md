# План технической документации

> Подготовлен совместно с Oracle (архитектура) и Plan-агентом (структура).
> Покрытие: `docs/product/overview.md` → `docs/tech/`

## Разрыв: продукт vs тех. документация

| Продуктовая фича | Раздел в overview.md | Текущая тех. документация |
|---|---|---|---|
| Протоколы v2 (5 этапов, типы, периодичность) | §5 | Нет — только базовая форма в architecture.md |
| AI на этапе ведения (заметки→задачи, стенограмма) | §5 Этап 3 | Нет |
| Приглашения и учёт явки | §5 Этапы 1, 3 | Нет |
| Задачи (нумерация, параллелизация, цепочки) | §6 | Нет |
| Email-уведомления (приглашения, рассылка, отказы) | §5, §6, §11 | Нет |
| Telegram-уведомления | 🔜 Будущее развитие | Нет |
| Организации + сотрудники контрагентов | §10 | Нет |
| Ролевая модель (RBAC, 5 ролей) | §11 | Нет — admin/employee без enforcement |
| ИИ-анализ отзывов и событий | 🔜 Будущее развитие | Нет |
| Экспорт отчётов (PDF) | 🔜 Будущее развитие | Нет |
| Импорт из Excel | 🔜 Будущее развитие | Нет |

## Архитектурные решения (Oracle)

### Задачи
- Отдельная таблица `tasks` + junction `protocol_tasks(role: home|delegated, sort_order)`
- Параллелизация: перенос = новая junction-строка с `role='delegated'`, `source_protocol_id`
- Решение подтягивается обратно через `resolution_text` + `resolved_at` на task
- Нумерация: уникальный `TASK-YYYY-NNNNN`, порядок внутри протокола через `sort_order`

### Протоколы
- `stage` enum на `meeting_protocols` + stage_data JSONB
- Отдельные таблицы: `protocol_approvals`, `protocol_distributions`
- Переходы: выделенный `PUT /api/meetings/:id/transition`

### RBAC
- `requireRole(...roles)` middleware factory
- Роль в сессии, `req.body.employeeId` fallback — удалить
- Подрядчики: без API-доступа, только email

### Организации
- Новая таблица `organizations`
- `subcontractors` расширяется `organization_id` FK (nullable)
- Отдельная `contractor_employees` НЕ нужна

### Уведомления (Email + Telegram)
- Единый модуль уведомлений: email (nodemailer) + Telegram (telegraf)
- Email: приглашения (Stage 1), рассылка протоколов (Stage 5), уведомления об отказе запроса задачи
- Telegram: уведомления о новых задачах, дедлайнах, утверждении протокола
- `protocol_distributions` трекает статус отправки для всех каналов
- Шаблоны, retry-политика, очередь — в notifications.md

### ИИ-анализ
- Анализ текстов отзывов и событий: sentiment, паттерны нарушений, группировка похожих событий
- Интеграция с AI-ассистентом (pgvector), expansion существующего assistant.md или новый ai-analysis.md

### Отчёты и импорт
- Экспорт: PDF-отчёты (тендерная справка, сводка по подрядчику, протокол)
- Импорт: Excel-загрузка (подрядчики, сотрудники)

## Файлы для создания (7 шт.)

### Wave 1 — параллельно

**`docs/tech/meeting-protocols-v2.md`**
1. Overview
2. State Machine (5 этапов + переходы + автоутверждение)
   - Invitations & Attendance: приглашения на Stage 1, RSVP, связь с учётом явки на Stage 3, модель `meeting_attendance(person_type, person_id, status)`
3. Meeting Types (стратегическое/координационное/оперативное/проблемное)
4. Periodicity (разовое/периодическое, нумерация)
5. Grouping Methods (по темам / по подрядчикам)
6. Task Requests (запрос задачи к повестке)
7. DB Schema (meeting_protocols + task_requests + protocol_approvals + protocol_distributions + meeting_attendance)
8. API Design
9. AI Integration — Stage 3 (заметки→задачи: формат suggestions, API; стенограмма: audio→text→protocol pipeline)
10. Testing Strategy
11. Migration Notes (v1 → v2)

**`docs/tech/organizations-rbac.md`**
1. Overview
2. Organizations (поля, схема, API)
3. Contractor Employees (поля, схема, связь с org)
4. RBAC Roles (админ/делопроизводитель/контролирующий/сотрудник/подрядчики)
5. Permission Matrix (роль × сущность × операция)
6. Middleware Design (requireRole)
7. DB Schema
8. API Design
9. Testing Strategy

**`docs/tech/notifications.md`**
1. Overview — единая система уведомлений
2. Channels: Email (nodemailer) + Telegram (telegraf)
3. Email Infrastructure — SMTP, шаблоны, retry, tracking через protocol_distributions
4. Telegram Infrastructure — telegraf bot, webhook/long-polling, chat-id mapping
5. Use Cases — приглашения, рассылка протокола, отказ запроса, дедлайны задач
6. API Design — send, status, preferences
7. DB Schema — protocol_distributions (расширение), user_notification_preferences
8. Testing Strategy

**`docs/tech/ai-analysis.md`**
1. Overview — анализ текстов отзывов и событий
2. Sentiment Analysis — тональность отзывов, оценка рисков
3. Pattern Detection — повторяющиеся нарушения, группировка похожих событий
4. Integration with RAG — новые embedding-типы для analysis results
5. API Design — analyze reviews, analyze events, get patterns
6. Testing Strategy

**`docs/tech/reporting.md`**
1. Overview — экспорт и импорт данных
2. PDF Export — тендерная справка, сводка по подрядчику, протокол
3. Excel Import — подрядчики, сотрудники, валидация
4. Template Engine — HTML→PDF, шаблоны отчётов
5. API Design — export endpoints, import endpoints
6. Testing Strategy

### Wave 2 (после Wave 1)

**`docs/tech/tasks.md`** — зависит от meeting-protocols-v2
1. Overview
2. Data Model (tasks: resolution_text + resolved_at; junction: sort_order, role home|delegated)
3. Unique Numbering (TASK-YYYY-NNNNN)
4. Reformulation Chains (уточнение, подзадачи)
5. Parallelization (junction, AI suggestions — перенос вручную, AI предлагает)
6. Lifecycle (Создана → В работе → Выполнена → Архив; resolution_text + resolved_at текут обратно в home-протокол)
7. DB Schema
8. API Design (CRUD, move, reorder, status transitions)
9. AI Integration (формат suggestions для переноса, RAG indexing)
10. Testing Strategy

### Wave 3 (после Wave 1+2)

**`docs/tech/architecture-integration.md`** — зависит от всех трёх
1. What's New (сводка изменений v1→v2)
2. Complete ERD (все таблицы + связи)
3. DB Schema Recap
4. Migration Strategy (пошагово, с rollback)
5. Cross-Cutting Concerns
   - Notifications: см. notifications.md (email + telegram)
   - Task-Protocol linking, Org-Protocol participants, RBAC enforcement points
6. Updated API Map (все endpoints)
7. Frontend Routes (новые views)
8. AI Assistant Impact (новые entity types для RAG)
9. Conventions

## Стратегия коммитов

| # | Коммит | Файл |
|---|--------|------|
| 1 | `docs: add meeting protocols v2 technical design` | meeting-protocols-v2.md |
| 2 | `docs: add organizations and RBAC technical design` | organizations-rbac.md |
| 3 | `docs: add notifications system technical design` | notifications.md |
| 4 | `docs: add AI analysis technical design` | ai-analysis.md |
| 5 | `docs: add reporting and import technical design` | reporting.md |
| 6 | `docs: add tasks system technical design` | tasks.md |
| 7 | `docs: add architecture integration overview` | architecture-integration.md |

Коммиты 1–5 — параллельно (Wave 1). 6 после 1. 7 после всех.

## Критерии готовности

- [ ] 7 файлов в `docs/tech/`
- [ ] Каждый содержит Testing Strategy
- [ ] meeting-protocols-v2.md: AI Integration (Stage 3) — заметки→задачи и стенограмма
- [ ] meeting-protocols-v2.md: Invitations & Attendance — модель meeting_attendance
- [ ] tasks.md: sort_order в junction, resolution_text в task model
- [ ] notifications.md: email (nodemailer) + telegram (telegraf), каналы и use cases
- [ ] ai-analysis.md: sentiment, pattern detection, RAG-интеграция
- [ ] reporting.md: PDF-экспорт, Excel-импорт, шаблоны
- [ ] architecture-integration.md: ссылается на все 6 feature-доков + существующий architecture.md
- [ ] Перекрёстные ссылки согласованы
- [ ] Dependencies разрешены без циклов