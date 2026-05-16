# Master Notepad - AGENTS.md

## Project Overview
**Master Notepad** — система управления подрядчиками строительной организации. Позволяет хранить отзывы сотрудников о подрядчиках, вести чек-листы проверки объектов, протоколы совещаний, опросы и рейтинги.

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL + Drizzle ORM |
| Frontend | Vue 3 + TypeScript + Pinia + Vue Router |
| Build | Vite + PWA plugin |
| Package Manager | npm workspaces |

## Project Structure
```
master-notepad/
├── backend/          # Express API server (port 3001)
│   ├── AGENTS.md     # Backend architecture & conventions
│   └── src/
│       ├── db/       # Drizzle ORM connection + schema
│       ├── routes/   # REST API handlers
│       └── middleware/ # Validation + error handling
├── frontend/         # Vue 3 SPA (port 5173)
│   ├── AGENTS.md     # Frontend architecture & conventions
│   └── src/
│       ├── views/    # Page components
│       ├── stores/   # Pinia state management
│       ├── api/      # API client + types
│       ├── router/   # Vue Router config
│       └── components/ # Shared layout components
└── package.json      # Workspace root
```

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 14+

### Setup
```bash
# Install dependencies
npm install

# Configure database (copy .env.example to .env and set DATABASE_URL)
cd backend
cp .env.example .env

# Generate and run migrations
npm run db:generate -w backend
npm run db:migrate -w backend

# Start development
npm run dev  # starts both backend and frontend
```

## Core Features
1. **Подрядчики**: CRUD с рейтингом (среднее отзывов)
2. **Отзывы**: Оценка 1-10 + текст
3. **Чек-листы**: Организационные и личные, предложения улучшений
4. **Протоколы совещаний**: Стандартная форма (повестка, участники, решения)
5. **Комментарии**: Дополнительная информация о подрядчиках
6. **Опросы**: Стандартный шаблон из 5 вопросов
7. **Сотрудники**: Управление персоналом организации

## Development Commands
```bash
npm run dev          # Start both backend + frontend
npm run build        # Build both
npm run db:push -w backend  # Push schema to DB (dev)
```

## Architecture Decisions
- **Monorepo** via npm workspaces for simplicity
- **No authentication** in MVP — employee IDs passed in request body
- **Rating system** prepared for AI integration (AVG aggregation, 1-10 scale)
- **PWA** via vite-plugin-pwa for offline-capable mobile access
- **Drizzle ORM** for type-safe database access without code generation bloat
