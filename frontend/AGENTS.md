# Frontend AGENTS.md

## Architecture Overview
**Stack**: Vue 3 + TypeScript + Pinia + Vue Router + Vite + PWA

## Project Structure
frontend/
├── src/
│   ├── main.ts           # App entry, install Pinia + Router
│   ├── App.vue           # Root layout with sidebar + router-view
│   ├── api/
│   │   └── client.ts     # Fetch wrapper for backend API calls
│   ├── router/
│   │   └── index.ts      # Vue Router configuration
│   ├── stores/           # Pinia stores (one per entity)
│   │   ├── subcontractors.ts
│   │   ├── reviews.ts
│   │   ├── employees.ts
│   │   ├── comments.ts
│   │   ├── checklists.ts
│   │   ├── suggestions.ts
│   │   ├── meetings.ts
│   │   └── surveys.ts
│   ├── views/            # Page components
│   └── components/       # Reusable components (layout)
├── vite.config.ts        # Vite + Vue plugin + PWA plugin + proxy
├── tsconfig.json
└── package.json
```

## Design Decisions

### Why Vue 3 Composition API
- Better TypeScript integration
- Cleaner component logic organization
- Script setup syntax for concise code
- Composables for reusable logic

### State Management (Pinia)
- One store per entity
- Each store: items array, loading/error state, CRUD actions
- Actions call API client, update local state
- No optimistic updates (MVP)

### Routing (Vue Router)
- Hash-free history mode
- Nested routes for subcontractor detail with tabs
- Route guards not needed (no auth in MVP)

### Styling
- Scoped CSS in every component
- No CSS framework (lightweight)
- CSS custom properties for theme
- Blue primary (#1a56db), gray background (#f3f4f6)
- Professional business aesthetic

### API Client
- Fetch wrapper around `/api/*`
- Automatic JSON parsing
- Error response handling
- Typed response interfaces

### PWA (vite-plugin-pwa)
- Auto-update registration
- Network-first caching for API calls
- Standalone display mode
- SVG icons for all sizes

## UI Patterns
- Sidebar + main content layout
- Tables with action buttons (edit/delete)
- Modal or inline forms for create/edit
- Loading spinners and error messages
- Russian language throughout

## Conventions
- Composition API with `<script setup lang="ts">`
- Scoped styles only
- TypeScript strict mode
- No external CSS frameworks
- No inline styles
- No emoji
- Descriptive variable/function names, no explanatory comments
