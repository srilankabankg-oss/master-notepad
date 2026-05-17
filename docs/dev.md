# Development Setup

## Prerequisites

- **Node.js** 18+ (check: `node -v`)
- **npm** (comes with Node.js)
- **Docker** (for PostgreSQL, check: `docker --version`)

## Quick Start

```bash
# 1. Check and install dependencies
./scripts/check-deps.sh

# 2. Start PostgreSQL (Docker)
docker start master-notepad-pg

# 3. Run in dev mode
./scripts/dev.sh
```

After startup:
- **Backend API**: http://localhost:3001
- **Frontend SPA**: http://localhost:5173

## Manual Setup

If you prefer to run commands manually:

```bash
# Install dependencies
npm install

# Configure database (one-time)
cd backend
cp .env.example .env
# Edit DATABASE_URL if your PostgreSQL runs on a non-standard port

# Start PostgreSQL
docker start master-notepad-pg

# Run both servers (in separate terminals)
npm run dev -w backend   # Backend on port 3001
npm run dev -w frontend  # Frontend on port 5173
```

## Project Structure

| Directory | Description |
|-----------|-------------|
| `backend/` | Express API server |
| `frontend/` | Vue 3 SPA |
| `scripts/` | Helper scripts |
| `docs/` | Documentation |
| `e2e/` | Playwright E2E tests |

## Common Commands

```bash
npm run dev            # Start both backend + frontend (requires PostgreSQL)
npm run build          # Build both backend and frontend
npm run build -w backend  # Build backend only
npm run build -w frontend # Build frontend only
npm run test -w frontend  # Run unit tests
npm run db:generate -w backend  # Generate DB migrations
npm run db:migrate -w backend   # Run DB migrations
npm run db:push -w backend      # Push schema to DB (dev)
npx playwright test    # Run E2E tests
```

## Troubleshooting

### PostgreSQL connection refused
```bash
docker start master-notepad-pg
# Wait 5-10 seconds for PostgreSQL to start
```

### Port 3001 already in use
```bash
lsof -i :3001    # find the process
kill <PID>       # kill it
```

### Port 5173 already in use
```bash
lsof -i :5173    # find the process
kill <PID>       # kill it
```

### Dependencies out of date
```bash
rm -rf node_modules backend/node_modules frontend/node_modules
./scripts/check-deps.sh
```

### Backend won't start after code changes
`tsx watch` is used for hot reload. If it crashes, kill the process and restart. The compiled `dist/` directory is always up-to-date from the last `npm run build`.

## Environment Variables

Create `backend/.env` (see `backend/.env.example`):

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/master_notepad
PORT=3001
NODE_ENV=development
```

Key variables:
| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | required | PostgreSQL connection string |
| `PORT` | 3001 | Backend server port |
| `NODE_ENV` | development | Environment mode |

## Database Schema Changes

After modifying `backend/src/db/schema/index.ts`:

```bash
npm run db:generate -w backend   # Generate migration
npm run db:migrate -w backend    # Apply migration
```
