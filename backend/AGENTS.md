# Backend AGENTS.md

## Architecture Overview
**Stack**: Node.js + Express + TypeScript + Drizzle ORM + PostgreSQL

## Project Structure
```
backend/
├── src/
│   ├── index.ts          # Entry point, starts HTTP server
│   ├── app.ts            # Express app setup, middleware, route mounting
│   ├── db/
│   │   ├── index.ts      # Drizzle connection + pool
│   │   └── schema/
│   │       └── index.ts  # All database tables, relations, enums
│   ├── routes/           # Route handlers (one file per entity) + AI proxy
│   │   ├── employees.ts
│   │   ├── subcontractors.ts
│   │   ├── reviews.ts
│   │   ├── comments.ts
│   │   ├── checklists.ts
│   │   ├── suggestions.ts
│   │   ├── meetings.ts
│   │   ├── surveys.ts
│   │   ├── events.ts
│   │   ├── tender.ts
│   │   └── ai-proxy.ts     # POST /api/ai/ask, /api/ai/reindex/{entity}
│   ├── middleware/
│   │   ├── error-handler.ts  # Global error handler (AppError, ZodError)
│   │   └── validation.ts     # Zod validation middleware factory
│   └── types/            # Shared TypeScript types
├── drizzle/              # Generated migrations (by drizzle-kit)
├── drizzle.config.ts     # Drizzle Kit configuration
└── package.json
```

## Design Decisions

### Database (Drizzle ORM)
- **Why Drizzle**: Type-safe, lightweight, no code generation bloat, excellent PostgreSQL support
- **Schema**: All tables in single file with relations, explicit column naming
- **Migrations**: `drizzle-kit generate` → `drizzle-kit migrate`
- **Connection**: node-postgres pool, connection string from DATABASE_URL env var

### API Design
- RESTful, JSON responses
- Route prefix: `/api/`
- Validation: Zod schemas on request body
- Error handling: AppError class + global error middleware
- Session-based authentication (express-session + PostgreSQL store, bcrypt passwords)
- Two roles: `admin` and `employee` (role column, RBAC enforcement planned)
- Auth endpoints: POST /api/auth/register, POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me
- requireAuth middleware protects all routes; employeeId from session with body fallback

### Entities & Tables
| Entity | Table | Description |
|--------|-------|-------------|
| Employees | `employees` | Organization staff |
| Subcontractors | `subcontractors` | External construction companies |
| Reviews | `reviews` | Employee reviews with 1-10 rating |
| Comments | `comments` | Supplementary info about subcontractors |
| Checklists | `checklists` | Org/personal inspection checklists |
| ChecklistSuggestions | `checklist_suggestions` | Improvement proposals, pending/approved/rejected |
| MeetingProtocols | `meeting_protocols` | Standard meeting minutes |
| Surveys | `surveys` | Employee surveys with JSON questions |
| SurveyResponses | `survey_responses` | Individual responses to surveys |
| ContractorEvents | `contractor_events` | Event log: positive/violation/info entries |
| AuditLog | `audit_log` | Change history: who changed what and when |

### Rating System
- Reviews have `rating` field (integer, 1-10)
- Subcontractor detail endpoint calculates average rating via SQL `AVG()`
- Prepared for future AI evaluation

### AI Assistant Integration

The backend proxies requests to a separate Python/FastAPI microservice (port 3002) that provides RAG-based Q&A over system data.

**Architecture:**
```
Frontend (5173) → Backend (3001) → AI Assistant (3002)
                       ↓                    ↓
                  PostgreSQL           pgvector
                  (main data)      (embeddings table)
```

**Proxy route** — `/api/ai` on the backend forwards to the AI microservice:
- `POST /api/ai/ask` — free-form question → answer + sources
- `POST /api/ai/reindex/{entity}` — trigger reindexing of a single record

Config: `AI_SERVICE_URL=http://localhost:3002` (env var).

**Fire-and-forget reindexing:**
On every CRUD operation (create/update/delete), the backend fires an async `POST /api/ai/reindex/{entity}` to the AI service. If unreachable, reindexing is deferred to the next full index rebuild. Non-blocking — CRUD response is sent immediately.

**pgvector schema** (in same PostgreSQL, via extension):
- Table `embeddings(id, entity_type, entity_id, chunk_index, content, embedding VECTOR(768), metadata JSONB)`
- HNSW index on `embedding` with `vector_cosine_ops`
- Embedding model: `intfloat/multilingual-e5-base` (768-dim)

Backend proxy attaches employeeId from session automatically (client sends only `question`).

pgvector extension required. Embeddings table with HNSW index. Embedding model: intfloat/multilingual-e5-base (768-dim).
LLM: OpenAI-compatible API via LLM_API_URL env var.

Start AI service: `cd assistant && source venv/bin/activate && uvicorn src.main:app --port 3002`

**LLM:** OpenAI-compatible API (`LLM_API_URL`, `LLM_MODEL` env vars), replaceable.

**Security:**
- No auth (MVP) — matches main API convention
- Read-only — AI service never mutates main data tables
- Employee names stripped from LLM prompts (IDs only)
- AI endpoints not exposed externally — accessible only through the backend proxy

See `docs/product/assistant.md` for full feature description and scenarios. Technical design: `docs/tech/assistant.md`.

## Conventions
- ESM modules (`"type": "module"`)
- TypeScript strict mode
- Arrow functions for route handlers
- Async error handling via `try/catch` with `next(e)`
- No `any` types, no `@ts-ignore`
- Environment variables via `dotenv/config`
- Port: 3001 (configurable via PORT env)
