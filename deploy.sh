#!/bin/bash
set -e

echo "🚀 Master Notepad — Production Deploy"
echo "====================================="

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

# 1. Check prerequisites
echo ""
echo "📋 Проверка..."
command -v node >/dev/null 2>&1 || { echo "❌ Node.js не установлен"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm не установлен"; exit 1; }
echo "   Node.js: $(node -v)"
echo "   npm: $(npm -v)"

# 2. Install
echo ""
echo "📦 Установка зависимостей..."
npm ci --production --ignore-scripts 2>/dev/null || npm install --production

# 3. Build
echo ""
echo "🔨 Сборка..."
npm run build

# 4. Check env
echo ""
echo "⚙️  Конфигурация..."
if [ ! -f "backend/.env" ]; then
  echo "❌ backend/.env не найден. Создайте из backend/.env.example"
  exit 1
fi

# 5. DB migrate
echo ""
echo "🗄️  Миграция БД..."
npm run db:migrate -w backend 2>/dev/null || npm run db:push -w backend

# 6. Start backend
echo ""
echo "🟢 Запуск бэкенда (port 3355)..."
cd backend
NODE_ENV=production node dist/index.js &
BACKEND_PID=$!
cd "$ROOT"

sleep 2
if curl -s http://localhost:3355/api/health > /dev/null 2>&1; then
  echo "   ✅ Бэкенд работает: http://localhost:3355"
else
  echo "   ❌ Бэкенд не отвечает"
  kill $BACKEND_PID 2>/dev/null
  exit 1
fi

# 7. Nginx hint
echo ""
echo "📂 Фронтенд собран в: frontend/dist/"
echo ""
echo "🌐 Пример конфига nginx:"
echo "   server {"
echo "       listen 80;"
echo "       server_name your-domain.com;"
echo "       root $(pwd)/frontend/dist;"
echo "       index index.html;"
echo "       location / { try_files \$uri \$uri/ /index.html; }"
echo "       location /api/ { proxy_pass http://localhost:3355; }"
echo "   }"
echo ""
echo "✅ Деплой завершён. Бэкенд PID: $BACKEND_PID"