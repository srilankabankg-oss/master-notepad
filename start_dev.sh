#!/bin/bash
set -e

echo "🚀 Master Notepad — Dev Mode"
echo "=============================="

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

SKIP_DB=false
SKIP_SEED=false
SKIP_AI=false
SKIP_BACKEND=false
SKIP_FRONTEND=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-db) SKIP_DB=true; shift ;;
    --no-seed) SKIP_SEED=true; shift ;;
    --no-ai) SKIP_AI=true; shift ;;
    --no-backend) SKIP_BACKEND=true; shift ;;
    --no-frontend) SKIP_FRONTEND=true; shift ;;
    --ai-only) SKIP_DB=true; SKIP_SEED=true; SKIP_BACKEND=true; SKIP_FRONTEND=true; shift ;;
    --help|-h)
      echo "Usage: ./start_dev.sh [flags]"
      echo "  --no-db        Пропустить PostgreSQL"
      echo "  --no-seed      Пропустить наполнение тестовыми данными"
      echo "  --no-ai        Пропустить AI-ассистент"
      echo "  --no-backend   Пропустить бэкенд"
      echo "  --no-frontend  Пропустить фронтенд"
      echo "  --ai-only      Только AI-ассистент"
      exit 0 ;;
    *) echo "Неизвестный флаг: $1"; exit 1 ;;
  esac
done

# PostgreSQL
if [ "$SKIP_DB" = false ]; then
  echo ""; echo "📦 PostgreSQL..."
  if docker ps --filter name=master-notepad-pg --format '{{.Names}}' | grep -q master-notepad-pg; then
    echo "   Уже запущен"
  elif docker ps -a --filter name=master-notepad-pg --format '{{.Names}}' | grep -q master-notepad-pg; then
    docker start master-notepad-pg > /dev/null 2>&1; echo "   Запущен"
  else
    docker run -d --name master-notepad-pg -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=master_notepad -p 5433:5432 pgvector/pgvector:pg16 > /dev/null 2>&1
    echo "   Создан и запущен"
  fi
fi

# Install
echo ""; echo "📦 Зависимости..."
[ ! -d "node_modules" ] && npm install

# Config
echo ""; echo "⚙️  Конфигурация..."
[ ! -f "backend/.env" ] && cp backend/.env.example backend/.env && echo "   backend/.env создан"

# DB schema
if [ "$SKIP_DB" = false ] && [ "$SKIP_BACKEND" = false ]; then
  echo ""; echo "🗄️  Схема БД..."
  npm run db:push -w backend
fi

# Seed
if [ "$SKIP_SEED" = false ] && [ "$SKIP_DB" = false ]; then
  echo ""; echo "🌱 Тестовые данные..."
  npx tsx scripts/seed.ts
fi

# Backend
if [ "$SKIP_BACKEND" = false ]; then
  echo ""; echo "🟢 Бэкенд: http://localhost:3355"
  cd "$ROOT/backend"; npx tsx src/index.ts &
  BACKEND_PID=$!; cd "$ROOT"
fi

# Frontend
if [ "$SKIP_FRONTEND" = false ]; then
  echo "🟢 Фронтенд: http://localhost:3356"
  cd "$ROOT/frontend"; npx vite --port 3356 &
  FRONTEND_PID=$!; cd "$ROOT"
fi

# AI Assistant
if [ "$SKIP_AI" = false ]; then
  echo ""; echo "🤖 AI Ассистент..."
  cd "$ROOT/assistant"
  pip install -r requirements.txt -q 2>/dev/null
  pip install eval_type_backport -q 2>/dev/null
  nohup uvicorn src.main:app --port 3002 --host 0.0.0.0 > /tmp/ai-assistant.log 2>&1 &
  AI_PID=$!; cd "$ROOT"
  echo "   AI: http://localhost:3002"
fi

sleep 2
echo ""
echo "=========================================="
echo "✅ Серверы запущены"
echo "   Бэкенд:  http://localhost:3355"
echo "   Фронтенд: http://localhost:3356"
[ "$SKIP_AI" = false ] && echo "   AI:      http://localhost:3002"
echo ""
echo "👤 Логин: pavel@example.com / admin123"
echo "Ctrl+C — остановить"
echo "=========================================="

trap "kill $BACKEND_PID $FRONTEND_PID $AI_PID 2>/dev/null; exit 0" INT TERM
wait