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

- This project has **no authentication** in the current version
- The frontend build is a static SPA — serve it from any web server
- Backend serves the API on port 3001 by default
- Configure CORS in `backend/src/app.ts` for production domains
