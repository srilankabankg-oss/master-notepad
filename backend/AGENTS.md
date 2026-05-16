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
│   ├── routes/           # Route handlers (one file per entity)
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
- No authentication (MVP) — employee IDs passed in request body

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

### Rating System
- Reviews have `rating` field (integer, 1-10)
- Subcontractor detail endpoint calculates average rating via SQL `AVG()`
- Prepared for future AI evaluation

## Conventions
- ESM modules (`"type": "module"`)
- TypeScript strict mode
- Arrow functions for route handlers
- Async error handling via `try/catch` with `next(e)`
- No `any` types, no `@ts-ignore`
- Environment variables via `dotenv/config`
- Port: 3001 (configurable via PORT env)
