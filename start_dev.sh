#!/bin/bash
# Master Notepad — Dev Mode
# Запускает PostgreSQL, бэкенд, фронтенд и AI-ассистент для разработки

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

SKIP_DB=false; SKIP_SEED=false; SKIP_AI=false; SKIP_BACKEND=false; SKIP_FRONTEND=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-db) SKIP_DB=true ;;    --no-seed) SKIP_SEED=true ;;
    --no-ai) SKIP_AI=true ;;    --no-backend) SKIP_BACKEND=true ;;
    --no-frontend) SKIP_FRONTEND=true ;;  --ai-only) SKIP_DB=true; SKIP_SEED=true; SKIP_BACKEND=true; SKIP_FRONTEND=true ;;
    --help|-h) echo "Usage: ./start_dev.sh [flags]"; echo "  --no-db --no-seed --no-ai --no-backend --no-frontend --ai-only"; exit 0 ;;
    *) echo "Unknown flag: $1"; exit 1 ;;
  esac
  shift
done

fail() { echo "FAIL: $1"; exit 1; }
check() { command -v "$1" >/dev/null 2>&1 || fail "$1 not found"; }

echo "Master Notepad — Dev Mode"
echo "=========================="

check node; check npm; check docker

# PostgreSQL
if [ "$SKIP_DB" = false ]; then
  echo ""; echo "PostgreSQL..."
  if docker ps --filter name=master-notepad-pg --format '{{.Names}}' | grep -q master-notepad-pg; then
    echo "   Already running"
  elif docker ps -a --filter name=master-notepad-pg --format '{{.Names}}' | grep -q master-notepad-pg; then
    docker start master-notepad-pg > /dev/null 2>&1 && echo "   Started" || fail "Failed to start container"
  else
    docker run -d --name master-notepad-pg -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=master_notepad -p 5433:5432 pgvector/pgvector:pg16 > /dev/null 2>&1 && echo "   Created and started" || fail "Failed to create container"
  fi
  sleep 2
fi

# Install
echo ""; echo "Dependencies..."
[ ! -d "node_modules" ] && npm install && echo "   Installed"

# Config
echo ""; echo "Config..."
[ ! -f "backend/.env" ] && cp backend/.env.example backend/.env && echo "   backend/.env created"

# DB schema
if [ "$SKIP_DB" = false ] && [ "$SKIP_BACKEND" = false ]; then
  echo ""; echo "DB schema..."
  npm run db:push -w backend || fail "DB push failed"
  # Create session table (used by express-session)
  docker exec master-notepad-pg psql -U postgres -d master_notepad -c \
    "CREATE TABLE IF NOT EXISTS \"session\" (sid varchar NOT NULL, sess json NOT NULL, expire timestamp(6) NOT NULL, CONSTRAINT session_pkey PRIMARY KEY (sid)); CREATE INDEX IF NOT EXISTS \"IDX_session_expire\" ON \"session\" (expire);" > /dev/null 2>&1 || true
fi

# Seed
if [ "$SKIP_SEED" = false ] && [ "$SKIP_DB" = false ]; then
  echo ""; echo "Seed data..."
  npx tsx scripts/seed.ts || echo "   WARNING: seed failed (continuing anyway)"
fi

# Kill processes on our ports
for port in 3355 3356 3002; do
  lsof -ti:$port 2>/dev/null | xargs kill 2>/dev/null || true
done
sleep 1

# Backend FIRST (start and wait before frontend)
if [ "$SKIP_BACKEND" = false ]; then
  echo ""; echo "Backend: http://localhost:3355"
  cd "$ROOT/backend"; npx tsx src/index.ts & BACKEND_PID=$!; cd "$ROOT"
  # Wait until backend is ready
  for i in $(seq 1 10); do
    sleep 1
    curl -s http://localhost:3355/api/health > /dev/null 2>&1 && break
    [ $i -eq 10 ] && echo "   WARNING: backend didn't start in 10s"
  done
fi

# Frontend (after backend is ready)
if [ "$SKIP_FRONTEND" = false ]; then
  echo "Frontend: http://localhost:3356"
  cd "$ROOT/frontend"; npx vite --port 3356 --strictPort & FRONTEND_PID=$!; cd "$ROOT"
fi

# AI Assistant
if [ "$SKIP_AI" = false ]; then
  echo ""; echo "AI Assistant..."
  check python3
  cd "$ROOT/assistant"
  pip install -r requirements.txt -q 2>/dev/null && pip install eval_type_backport -q 2>/dev/null
  nohup uvicorn src.main:app --port 3002 --host 0.0.0.0 > /tmp/ai-assistant.log 2>&1 & AI_PID=$!
  cd "$ROOT"
  echo "   AI: http://localhost:3002"
fi

sleep 3
echo ""
echo "=========================================="
echo "SERVERS STARTED"
echo "   Backend:  http://localhost:3355"
echo "   Frontend: http://localhost:3356"
[ "$SKIP_AI" = false ] && echo "   AI:       http://localhost:3002"
echo ""
echo "Login: pavel@example.com / admin123"
echo "Ctrl+C to stop"
echo "=========================================="

trap 'kill $BACKEND_PID $FRONTEND_PID $AI_PID 2>/dev/null; exit 0' INT TERM
wait