#!/usr/bin/env bash
# scripts/dev.sh
# Запуск Master Notepad в режиме разработки

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRIPT_DIR"

echo "=== Master Notepad — Режим разработки ==="
echo ""

# ── Проверка PostgreSQL ──
echo "▸ Проверка PostgreSQL..."
if ! docker ps --format '{{.Names}}' | grep -q '^master-notepad-pg$'; then
  if docker ps -a --format '{{.Names}}' | grep -q '^master-notepad-pg$'; then
    echo "  ▶ Запускаю контейнер master-notepad-pg..."
    docker start master-notepad-pg
  else
    echo "  ❌ Контейнер master-notepad-pg не найден."
    echo "     Создайте его:"
    echo "     docker run --name master-notepad-pg -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=master_notepad -p 5433:5432 -d postgres:15-alpine"
    exit 1
  fi
fi

# Ждём готовности PostgreSQL
echo "  ▶ Ожидание готовности PostgreSQL..."
for i in $(seq 1 30); do
  if docker exec master-notepad-pg pg_isready -U postgres >/dev/null 2>&1; then
    echo "  ✅ PostgreSQL готов (попытка $i)"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "  ❌ PostgreSQL не готов после 30 попыток"
    exit 1
  fi
  sleep 1
done

# ── Запуск серверов ──
echo ""
echo "▸ Запуск backend (порт 3001) и frontend (порт 5173)..."
echo ""

npm run dev
