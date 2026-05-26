#!/bin/bash
# Master Notepad — Production Deploy
# Usage: ./deploy.sh [--no-ai]

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

WITH_AI=true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-ai) WITH_AI=false ;;
    --help|-h)
      echo "Usage: ./deploy.sh [--no-ai]"
      echo "  --no-ai  Deploy without AI assistant (hides AI tab in frontend)"
      exit 0 ;;
    *) echo "Unknown: $1"; exit 1 ;;
  esac
  shift
done

fail() { echo "FAIL: $1"; exit 1; }
check() { command -v "$1" >/dev/null 2>&1 || fail "$1 not found (install it first)"; }

echo "Master Notepad — Production Deploy"
[ "$WITH_AI" = false ] && echo "(without AI assistant)"
echo "==================================="

echo ""; echo "Prerequisites..."
check node; check npm; check docker
echo "   Node.js: $(node -v)"
echo "   npm:    $(npm -v)"
docker ps --filter name=master-notepad-pg --format '{{.Names}}' | grep -q master-notepad-pg || \
  fail "PostgreSQL not running — start: docker start master-notepad-pg"

# Install
echo ""; echo "Installing dependencies..."
if [ -f "package-lock.json" ]; then
  npm ci --omit=dev 2>/dev/null || npm install --omit=dev || fail "npm install failed"
else
  npm install --omit=dev || fail "npm install failed"
fi

# Build
echo ""; echo "Building..."
if [ "$WITH_AI" = false ]; then
  VITE_ENABLE_AI=false npm run build || fail "Build failed"
else
  npm run build || fail "Build failed"
fi
[ -f "backend/dist/index.js" ] || fail "backend/dist/index.js not found"
[ -d "frontend/dist" ] || fail "frontend/dist/ not found"

# Config
echo ""; echo "Configuration..."
if [ ! -f "backend/.env" ]; then
  cp backend/.env.example backend/.env || fail "Cannot create backend/.env"
  echo "   WARNING: backend/.env created from .env.example — set SESSION_SECRET!"
fi
source backend/.env 2>/dev/null || true
if [ -z "$SESSION_SECRET" ] || [ ${#SESSION_SECRET} -lt 32 ]; then
  echo "   WARNING: SESSION_SECRET must be at least 32 characters!"
fi

# DB
echo ""; echo "DB migration..."
npm run db:push -w backend || fail "DB push failed"

# Kill old
kill $(lsof -ti:3355) 2>/dev/null || true
sleep 1

# Start
echo ""; echo "Starting backend (port 3355)..."
cd backend
NODE_ENV=production node dist/index.js &
BACKEND_PID=$!
cd "$ROOT"

sleep 3
if curl -s --max-time 3 http://localhost:3355/api/health > /dev/null 2>&1; then
  echo "   Backend OK: $(curl -s http://localhost:3355/api/health)"
else
  fail "Backend not responding — check logs"
fi

# Nginx hint
echo ""
echo "Frontend built: frontend/dist/"
echo ""
echo "nginx config (/etc/nginx/sites-available/master-notepad):"
echo "   server {"
echo "       listen 80;"
echo "       server_name your-domain.com;"
echo "       root $(pwd)/frontend/dist;"
echo "       index index.html;"
echo "       location / { try_files \$uri \$uri/ /index.html; }"
echo "       location /api/ { proxy_pass http://localhost:3355; proxy_set_header Host \$host; }"
echo "   }"
echo ""
echo "Then: sudo ln -s /etc/nginx/sites-available/master-notepad /etc/nginx/sites-enabled/"
echo "      sudo nginx -t && sudo systemctl reload nginx"
echo ""
echo "DEPLOY COMPLETE. Backend PID: $BACKEND_PID"