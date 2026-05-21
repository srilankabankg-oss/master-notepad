#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ASSISTANT_DIR="$PROJECT_DIR/assistant"
BACKEND_DIR="$PROJECT_DIR/backend"
PG_CONTAINER="master-notepad-pg"
PG_IMAGE="pgvector/pgvector:pg16"
PG_PORT=5433
PG_DB="master_notepad"
PG_USER="postgres"
PG_PASS="postgres"
BACKEND_PORT=3001
AI_PORT=3002
FRONTEND_PORT=5173

echo "================================================"
echo "  Master Notepad — AI Assistant Deployment"
echo "================================================"
echo ""

# ── 1. Preflight ──
log "Checking prerequisites..."

command -v docker >/dev/null 2>&1 || err "Docker не установлен. Установи: sudo apt install docker.io"
command -v python3 >/dev/null 2>&1 || err "Python3 не установлен"
command -v node >/dev/null 2>&1 || err "Node.js не установлен"
command -v curl >/dev/null 2>&1 || err "curl не установлен"

PYTHON_VER=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
if [ "$(echo "$PYTHON_VER >= 3.11" | bc -l 2>/dev/null || echo 0)" = "1" ]; then
    log "Python $PYTHON_VER ✓"
else
    warn "Python $PYTHON_VER — рекомендуется 3.11+"
fi

log "Prerequisites OK"

# ── 2. PostgreSQL + pgvector ──
echo ""
log "Setting up PostgreSQL with pgvector..."

if docker ps -a --format '{{.Names}}' | grep -q "^${PG_CONTAINER}$"; then
    OLD_IMAGE=$(docker inspect "$PG_CONTAINER" --format '{{.Config.Image}}')
    if [[ "$OLD_IMAGE" != *"pgvector"* ]]; then
        warn "Old container uses $OLD_IMAGE — migrating to $PG_IMAGE"
        log "Backing up data..."
        docker exec "$PG_CONTAINER" pg_dump -U "$PG_USER" -d "$PG_DB" -Fc > /tmp/pg_backup.dump 2>/dev/null || warn "No data to backup (fresh DB)"
        
        log "Removing old container..."
        docker stop "$PG_CONTAINER" 2>/dev/null || true
        docker rm "$PG_CONTAINER" 2>/dev/null || true
        
        log "Starting pgvector container..."
        docker run -d \
            --name "$PG_CONTAINER" \
            -e POSTGRES_USER="$PG_USER" \
            -e POSTGRES_PASSWORD="$PG_PASS" \
            -e POSTGRES_DB="$PG_DB" \
            -p "$PG_PORT":5432 \
            "$PG_IMAGE" > /dev/null
        
        log "Waiting for PostgreSQL..."
        for i in $(seq 1 30); do
            if docker exec "$PG_CONTAINER" pg_isready -U "$PG_USER" >/dev/null 2>&1; then
                break
            fi
            sleep 1
        done
        
        if [ -f /tmp/pg_backup.dump ]; then
            log "Restoring data..."
            docker exec -i "$PG_CONTAINER" pg_restore -U "$PG_USER" -d "$PG_DB" < /tmp/pg_backup.dump 2>/dev/null || warn "Restore had warnings (may be empty DB)"
            rm -f /tmp/pg_backup.dump
        fi
    else
        log "pgvector container already running — restarting..."
        docker restart "$PG_CONTAINER" >/dev/null
        sleep 2
    fi
else
    log "Creating pgvector container..."
    docker run -d \
        --name "$PG_CONTAINER" \
        -e POSTGRES_USER="$PG_USER" \
        -e POSTGRES_PASSWORD="$PG_PASS" \
        -e POSTGRES_DB="$PG_DB" \
        -p "$PG_PORT":5432 \
        "$PG_IMAGE" > /dev/null
    
    log "Waiting for PostgreSQL..."
    for i in $(seq 1 30); do
        if docker exec "$PG_CONTAINER" pg_isready -U "$PG_USER" >/dev/null 2>&1; then
            break
        fi
        sleep 1
    done
    log "Running migrations..."
    (cd "$BACKEND_DIR" && npm run db:migrate 2>/dev/null) || warn "Migration may need manual run: npm run db:migrate -w backend"
fi

log "PostgreSQL + pgvector ready"

# ── 3. Python dependencies ──
echo ""
log "Installing Python dependencies for AI microservice..."

cd "$ASSISTANT_DIR"

if [ ! -d "venv" ]; then
    python3 -m venv venv
    log "Created virtual environment"
fi

source venv/bin/activate
pip install -q --upgrade pip
pip install -q -r requirements.txt 2>&1 | tail -1
log "Python dependencies installed"

# ── 4. Pre-download embedding model ──
echo ""
log "Pre-downloading embedding model (multilingual-e5-base, ~1.1 GB)..."
python3 -c "
from sentence_transformers import SentenceTransformer
print('  Downloading...')
model = SentenceTransformer('intfloat/multilingual-e5-base')
print('  Model loaded. Testing...')
emb = model.encode(['query: test'])
print(f'  Embedding dim: {len(emb[0])}')
print('  Model ready.')
" || warn "Model download failed — will retry on first request"

# ── 5. Backend env check ──
echo ""
log "Checking backend environment..."
if [ ! -f "$BACKEND_DIR/.env" ]; then
    cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
    warn "Created backend/.env from .env.example — verify DATABASE_URL"
fi

# ── 6. Start backend ──
echo ""
log "Starting backend (port $BACKEND_PORT)..."

PREV_PID=$(lsof -ti:$BACKEND_PORT 2>/dev/null || true)
if [ -n "$PREV_PID" ]; then
    kill "$PREV_PID" 2>/dev/null || true
    sleep 1
fi

cd "$BACKEND_DIR"
npx tsx src/index.ts &>/tmp/backend.log &
BACKEND_PID=$!
sleep 2

if kill -0 "$BACKEND_PID" 2>/dev/null; then
    log "Backend started (PID $BACKEND_PID)"
else
    err "Backend failed to start — check /tmp/backend.log"
fi

# ── 7. Start AI microservice ──
echo ""
log "Starting AI microservice (port $AI_PORT)..."

PREV_AI_PID=$(lsof -ti:$AI_PORT 2>/dev/null || true)
if [ -n "$PREV_AI_PID" ]; then
    kill "$PREV_AI_PID" 2>/dev/null || true
    sleep 1
fi

cd "$ASSISTANT_DIR"
source venv/bin/activate
python3 -c "
import uvicorn
uvicorn.run('src.main:app', host='0.0.0.0', port=$AI_PORT)
" &>/tmp/ai-service.log &
AI_PID=$!
sleep 3

if kill -0 "$AI_PID" 2>/dev/null; then
    log "AI microservice started (PID $AI_PID)"
else
    warn "AI microservice may have failed — check /tmp/ai-service.log"
    cat /tmp/ai-service.log | tail -5
fi

# ── 8. Verification ──
echo ""
echo "================================================"
echo "  Verification"
echo "================================================"

log "Testing backend health..."
BACKEND_HEALTH=$(curl -s http://localhost:$BACKEND_PORT/api/health 2>/dev/null || echo '{"status":"down"}')
echo "  Backend: $BACKEND_HEALTH"

log "Testing AI microservice health..."
AI_HEALTH=$(curl -s http://localhost:$AI_PORT/api/ai/health 2>/dev/null || echo '{"status":"down"}')
echo "  AI Service: $AI_HEALTH"

log "Testing proxy endpoint..."
PROXY_HEALTH=$(curl -s http://localhost:$BACKEND_PORT/api/ai/health 2>/dev/null || echo '{"status":"down"}')
echo "  Proxy: $PROXY_HEALTH"

if echo "$AI_HEALTH" | grep -q '"status":"ok"'; then
    log "Testing RAG indexing (full reindex)..."
    REINDEX_RESULT=$(curl -s -X POST http://localhost:$AI_PORT/api/ai/reindex 2>/dev/null || echo '{"error":"failed"}')
    echo "  Reindex: $REINDEX_RESULT"

    log "Testing AI ask..."
    ASK_RESULT=$(curl -s -X POST http://localhost:$AI_PORT/api/ai/ask \
        -H 'Content-Type: application/json' \
        -d '{"question":"Какие подрядчики есть в системе?","limit":3}' 2>/dev/null || echo '{"error":"failed"}')
    echo "  Ask: $(echo "$ASK_RESULT" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(f\"answer={d.get(\"answer\",\"?\")[:100]}... confidence={d.get(\"confidence\",\"?\")}\")' 2>/dev/null || echo '  Ask: failed to parse')"
else
    warn "AI service not healthy — check /tmp/ai-service.log"
    echo "  Last 10 lines:"
    tail -10 /tmp/ai-service.log 2>/dev/null || echo "  (no log)"
fi

# ── 9. Summary ──
echo ""
echo "================================================"
echo "  Deployment Complete"
echo "================================================"
echo ""
echo "  Backend:       http://localhost:$BACKEND_PORT"
echo "  AI Service:    http://localhost:$AI_PORT"
echo "  AI Proxy:      http://localhost:$BACKEND_PORT/api/ai"
echo ""
echo "  Logs:"
echo "    Backend:     /tmp/backend.log"
echo "    AI Service:  /tmp/ai-service.log"
echo ""
echo "  Stop all:      kill $BACKEND_PID $AI_PID"
echo ""