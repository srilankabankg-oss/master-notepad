# Master Notepad - AGENTS.md

## Project Overview
**Master Notepad** — система управления подрядчиками строительной организации. Позволяет хранить отзывы сотрудников о подрядчиках, вести чек-листы проверки объектов, протоколы совещаний (v2 с 7-этапным жизненным циклом), задачи с параллелизацией, опросы, рейтинги, уведомления (email + telegram) и AI-анализ.

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL + Drizzle ORM + pgvector |
| Frontend | Vue 3 + TypeScript + Pinia + Vue Router |
| Build | Vite + PWA plugin |
| Package Manager | npm workspaces |
| AI | Python + FastAPI + pgvector (port 3002) |

## Project Structure
```
master-notepad/
├── backend/          # Express API server (port 3355)
│   ├── AGENTS.md     # Backend architecture & conventions
│   └── src/
│       ├── db/       # Drizzle ORM connection + schema
│       ├── routes/   # REST API handlers (13 modules)
│       ├── middleware/ # Auth, RBAC, validation, error handling, audit
│       └── notifications/ # Email + Telegram services
├── frontend/         # Vue 3 SPA (port 3356)
│   ├── AGENTS.md     # Frontend architecture & conventions
│   └── src/
│       ├── views/    # Page components (17 views)
│       ├── stores/   # Pinia state management
│       ├── api/      # API client + types
│       ├── router/   # Vue Router config
│       └── components/ # Shared layout components
├── assistant/        # AI microservice (Python/FastAPI, port 3002)
│   └── src/
│       ├── api/      # API endpoints (ask, analyze, transcribe)
│       ├── analysis/ # Sentiment, patterns, audio pipeline
│       ├── rag/      # Embeddings, retrieval, ingestion
│       ├── llm/      # LLM provider adapter
│       └── db/       # pgvector vector store
├── docs/
│   ├── product/      # Продуктовая документация
│   └── tech/         # Техническая документация + PLAN.md
└── package.json      # Workspace root
```

## Getting Started

### Prerequisites
- **Node.js** 18+ (`node -v`)
- **Docker** (`docker --version`) — для PostgreSQL
- **Python** 3.10+ (`python3 --version`) — для AI-ассистента (опционально)

### Быстрый старт (dev)

```bash
# 1. Установка зависимостей
npm install

# 2. Запуск PostgreSQL
docker run -d --name master-notepad-pg \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=master_notepad \
  -p 5433:5432 postgres:16-alpine

# 3. Конфигурация
cd backend
cp .env.example .env

# 4. Миграция схемы БД
npm run db:push -w backend

# 5. Наполнение тестовыми данными
npm run seed

# 6. Запуск
npm run dev
```

После запуска:
| Сервис | URL |
|--------|-----|
| Фронтенд | http://localhost:3356 |
| Бэкенд API | http://localhost:3355 |
| Health check | http://localhost:3355/api/health |

**Тестовые учётные записи** (после `npm run seed`):

| Email | Пароль | Роль |
|-------|--------|------|
| pavel@example.com | admin123 | Администратор |
| anna@example.com | clerk123 | Делопроизводитель |
| ivan@example.com | ctrl123 | Контролирующий |
| sergey@example.com | ctrl123 | Контролирующий |
| maria@example.com | emp123 | Сотрудник |

### Продакшен

```bash
# 1. Сборка
npm run build

# 2. Бэкенд (port 3355)
cd backend && NODE_ENV=production npm run start

# 3. Фронтенд — раздать статику через nginx/Caddy
# frontend/dist/ — готовая статика
```

**Пример конфига nginx:**
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:3355;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

**Переменные окружения** (`backend/.env`):

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `DATABASE_URL` | `postgresql://...:5433/master_notepad` | Строка подключения PostgreSQL |
| `PORT` | `3355` | Порт бэкенда |
| `NODE_ENV` | `development` | `development` / `production` |
| `CORS_ORIGIN` | `http://localhost:3356` | Разрешённый origin для CORS |
| `SESSION_SECRET` | (обязательно) | Секрет для сессий (мин. 32 символа) |
| `AI_SERVICE_URL` | `http://localhost:3002` | URL AI-микросервиса |
| `SMTP_HOST` | `localhost` | SMTP-сервер для email |
| `SMTP_PORT` | `587` | Порт SMTP |
| `TELEGRAM_BOT_TOKEN` | — | Токен Telegram-бота (опционально) |

### AI Assistant Setup
```bash
cd assistant
pip install -r requirements.txt
uvicorn src.main:app --port 3002 --reload
```

## Core Features
1. **Подрядчики**: CRUD с рейтингом (AVG + взвешенный)
2. **Отзывы**: Оценка 1-10 + текст
3. **Чек-листы**: Организационные и личные, предложения улучшений
4. **Протоколы v2**: 7-этапный жизненный цикл, 4 типа, периодичность, группировка, AI этапа 3
5. **Задачи**: TASK-YYYY-NNNNN нумерация, параллелизация между протоколами, цепочки
6. **Организации**: Учёт юрлиц с ИНН, связи с договорами
7. **RBAC**: 5 ролей (admin, clerk, controller, employee, contractors)
8. **Уведомления**: Email (nodemailer) + Telegram (telegraf)
9. **AI Ассистент**: RAG-чат + анализ тональности + поиск паттернов + транскрибация
10. **Отчёты**: PDF-экспорт (puppeteer), Excel-импорт (xlsx)

## Development Commands
```bash
npm run dev          # Start both backend + frontend
npm run build        # Build both
npm run db:push -w backend  # Push schema to DB (dev)
npm run db:generate -w backend  # Generate migration
npm run db:migrate -w backend   # Run migration
```

## Architecture Decisions
- **Monorepo** via npm workspaces
- **Session auth** via express-session + PostgreSQL store, bcrypt, 2 роли (admin/employee)
- **RBAC** via requireRole middleware factory
- **Rating system** AVG aggregation + weighted (reviews ± events)
- **PWA** via vite-plugin-pwa for offline mobile access
- **Drizzle ORM** for type-safe database access
- **Notifications** fire-and-forget with retry, multi-channel (email + telegram)
- **PDF export** via puppeteer headless Chrome
- **AI microservice** separate Python/FastAPI service on port 3002