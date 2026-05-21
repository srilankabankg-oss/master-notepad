#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRIPT_DIR"

echo "=== Master Notepad — Режим разработки ==="

# Проверка PostgreSQL (pgvector)
echo "▸ Проверка PostgreSQL..."
if ! docker ps --format '{{.Names}}' | grep -q '^master-notepad-pg$'; then
  if docker ps -a --format '{{.Names}}' | grep -q '^master-notepad-pg$'; then
    docker start master-notepad-pg
  else
    echo "  Создаю контейнер master-notepad-pg..."
    docker run -d --name master-notepad-pg \
      -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
      -e POSTGRES_DB=master_notepad -p 5433:5432 \
      pgvector/pgvector:pg16
  fi
fi

for i in $(seq 1 30); do
  if docker exec master-notepad-pg pg_isready -U postgres >/dev/null 2>&1; then
    echo "  ✅ PostgreSQL готов"; break
  fi
  [ "$i" -eq 30 ] && { echo "  ❌ PostgreSQL не готов"; exit 1; }
  sleep 1
done

# Проверка .env
if [ ! -f backend/.env ]; then
  echo "▸ Создаю backend/.env..."
  cat > backend/.env << 'EOF'
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/master_notepad
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
SESSION_SECRET=dev-secret-change-in-production-1234567890
AI_SERVICE_URL=http://localhost:3002
EOF
fi

# Миграции
echo "▸ Миграции..."
npm run db:push -w backend 2>/dev/null || npm run db:migrate -w backend

# AI сервис (опционально)
if [ -d assistant/src ]; then
  echo "▸ AI Assistant..."
  cd assistant
  if [ ! -d venv ]; then python3 -m venv venv; fi
  source venv/bin/activate
  pip install -q fastapi uvicorn httpx python-dotenv 2>/dev/null
  lsof -ti:3002 | xargs kill -9 2>/dev/null || true
  DATABASE_URL=postgresql://postgres:postgres@localhost:5433/master_notepad \
  MAIN_API_URL=http://localhost:3001 \
  LLM_MODEL=step-3.5-flash PORT=3002 \
  uvicorn src.main:app --host 0.0.0.0 --port 3002 &>/tmp/ai.log &
  cd "$SCRIPT_DIR"
  echo "  ✅ AI на порту 3002"
fi

# Запуск
echo ""
echo "▸ Запуск backend (3001) + frontend (5173)..."
npm run dev
