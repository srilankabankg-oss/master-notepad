#!/usr/bin/env bash
# scripts/prod.sh
# Запуск Master Notepad в production режиме

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRIPT_DIR"

echo "=== Master Notepad — Production ==="
echo ""

# ── Проверка переменных окружения ──
if [ ! -f "backend/.env" ]; then
  echo "❌ backend/.env не найден. Создайте из .env.example и установите DATABASE_URL."
  exit 1
fi

export NODE_ENV=production

# ── Сборка ──
echo "▸ Сборка backend..."
npm run build -w backend
echo "  ✅ Backend собран"

echo "▸ Сборка frontend..."
npm run build
echo "  ✅ Frontend собран"

# ── Миграции БД ──
echo ""
echo "▸ Проверка PostgreSQL..."
if ! docker ps --format '{{.Names}}' | grep -q '^master-notepad-pg$'; then
  if docker ps -a --format '{{.Names}}' | grep -q '^master-notepad-pg$'; then
    echo "  ▶ Запускаю контейнер master-notepad-pg..."
    docker start master-notepad-pg
  else
    echo "  ❌ Контейнер master-notepad-pg не найден."
    exit 1
  fi
fi

echo "  ▶ Ожидание готовности PostgreSQL..."
for i in $(seq 1 30); do
  if docker exec master-notepad-pg pg_isready -U postgres >/dev/null 2>&1; then
    echo "  ✅ PostgreSQL готов"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "  ❌ PostgreSQL не готов после 30 попыток"
    exit 1
  fi
  sleep 1
done

echo ""
echo "▸ Применение миграций..."
npm run db:migrate -w backend
echo "  ✅ Миграции применены"

# ── Запуск ──
echo ""
echo "▸ Запуск production сервера (порт 3001)..."
echo ""
cd backend && npm run start
