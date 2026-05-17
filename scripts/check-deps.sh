#!/usr/bin/env bash
# scripts/check-deps.sh
# Проверяет и устанавливает все зависимости проекта Master Notepad

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== Master Notepad — Проверка зависимостей ==="
echo ""

# ── Node.js ──
echo "▸ Проверка Node.js..."
if ! command -v node &>/dev/null; then
  echo "  ❌ Node.js не найден. Установите Node.js 18+ с https://nodejs.org/"
  exit 1
fi
NODE_VER=$(node -v | sed 's/v//')
echo "  ✅ Node.js $NODE_VER"

# ── npm ──
echo "▸ Проверка npm..."
if ! command -v npm &>/dev/null; then
  echo "  ❌ npm не найден."
  exit 1
fi
echo "  ✅ npm $(npm -v)"

# ── Docker ──
echo "▸ Проверка Docker..."
if ! command -v docker &>/dev/null; then
  echo "  ❌ Docker не найден. Установите Docker с https://docs.docker.com/get-docker/"
  exit 1
fi
echo "  ✅ Docker $(docker --version | sed 's/Docker version //; s/,.*//')"

# ── PostgreSQL контейнер ──
echo "▸ Проверка контейнера PostgreSQL (master-notepad-pg)..."
if docker ps --format '{{.Names}}' | grep -q '^master-notepad-pg$'; then
  echo "  ✅ Контейнер master-notepad-pg запущен"
elif docker ps -a --format '{{.Names}}' | grep -q '^master-notepad-pg$'; then
  echo "  ⚠️  Контейнер master-notepad-pg существует но остановлен. Запустите: docker start master-notepad-pg"
else
  echo "  ⚠️  Контейнер master-notepad-pg не найден."
  echo "     Создайте его: docker run --name master-notepad-pg -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=master_notepad -p 5433:5432 -d postgres:15-alpine"
fi

# ── node_modules ──
echo ""
echo "▸ Проверка node_modules..."

if [ ! -d "$SCRIPT_DIR/node_modules" ] || [ -z "$(ls -A "$SCRIPT_DIR/node_modules" 2>/dev/null)" ]; then
  echo "  ⚠️  Зависимости не установлены. Устанавливаю..."
  cd "$SCRIPT_DIR" && npm install
  echo "  ✅ Зависимости установлены"
else
  echo "  ✅ node_modules уже есть"
fi

# ── Workspace node_modules ──
if [ ! -d "$SCRIPT_DIR/backend/node_modules" ] || [ -z "$(ls -A "$SCRIPT_DIR/backend/node_modules" 2>/dev/null)" ]; then
  echo "  ⚠️  Зависимости backend не установлены. Устанавливаю..."
  cd "$SCRIPT_DIR" && npm install -w backend
  echo "  ✅ Зависимости backend установлены"
else
  echo "  ✅ backend/node_modules уже есть"
fi

if [ ! -d "$SCRIPT_DIR/frontend/node_modules" ] || [ -z "$(ls -A "$SCRIPT_DIR/frontend/node_modules" 2>/dev/null)" ]; then
  echo "  ⚠️  Зависимости frontend не установлены. Устанавливаю..."
  cd "$SCRIPT_DIR" && npm install -w frontend
  echo "  ✅ Зависимости frontend установлены"
else
  echo "  ✅ frontend/node_modules уже есть"
fi

echo ""
echo "=== Все проверки пройдены ==="
echo ""
echo "Запустите ./scripts/dev.sh для старта в режиме разработки."
