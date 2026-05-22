# Production Deployment

## Prerequisites

- Node.js 18+
- Docker (for PostgreSQL)
- Reverse proxy (nginx/Caddy) recommended for TLS termination

## Environment Variables

```env
DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<database>
PORT=3001
NODE_ENV=production
SESSION_SECRET=<strong-random-secret>
AI_SERVICE_URL=http://localhost:3002
```

## Deployment Steps

### 1. PostgreSQL

```bash
# Docker
docker run --name master-notepad-pg \
  -e POSTGRES_USER=<user> \
  -e POSTGRES_PASSWORD=<strong-password> \
  -e POSTGRES_DB=master_notepad \
  -p 5433:5432 \
  -d postgres:15-alpine
```

Enable the pgvector extension for AI Assistant embeddings:

```bash
docker exec -it master-notepad-pg psql -U <user> -d master_notepad -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### 2. Install Dependencies

```bash
npm install --production --ignore-scripts
```

### 3. Build

```bash
npm run build -w backend
npm run build -w frontend
```

### 4. Apply Migrations

```bash
npm run db:migrate -w backend
```

### 5. Start Backend

```bash
cd backend && npm run start
```

### 6. Serve Frontend

The `frontend/dist/` directory is a static build. Serve it with nginx, Caddy, or any static file server:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /path/to/master-notepad/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## AI Assistant Service

The AI Assistant runs as a separate service on port 3002. It provides RAG-powered responses over contractor and meeting data.

### Docker

```bash
docker run --name master-notepad-ai \
  -e DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<database> \
  -e MAIN_API_URL=http://localhost:3001 \
  -e LLM_API_URL=https://api.openai.com/v1 \
  -e LLM_MODEL=gpt-4o-mini \
  -e EMBEDDING_MODEL=intfloat/multilingual-e5-base \
  -e PORT=3002 \
  -p 3002:3002 \
  master-notepad-ai:latest
```

### Health Check

```bash
curl http://localhost:3002/api/health
# Expected: {"status":"ok"}
```

## Docker Deployment

```bash
# Start PostgreSQL
docker start master-notepad-pg

# Build and run
./scripts/prod.sh
```

## Health Check

```bash
curl http://localhost:3001/api/health
# Expected: {"status":"ok"}
```

## Database Backups

```bash
docker exec master-notepad-pg pg_dump -U postgres master_notepad > backup.sql
```

## Notes

- The frontend build is a static SPA — serve it from any web server
- Backend serves the API on port 3001 by default
- AI Assistant service runs on port 3002
- Configure CORS in `backend/src/app.ts` for production domains
