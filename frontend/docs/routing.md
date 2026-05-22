# Определения маршрутов

## Конфигурация роутера

Роутер создаётся в `src/router/index.ts` через `createRouter()` с `createWebHistory()` (hash-free history mode). Все компоненты страниц загружаются лениво через динамический `import()`.

```ts
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const publicRoutes = ['/login', '/register']

const router = createRouter({
  history: createWebHistory(),
  routes: [ /* ... */ ],
})
```

## Полный список маршрутов

| Путь | Имя | Компонент | Назначение |
|------|-----|-----------|------------|
| `/` | — | redirect → `/subcontractors` | Редирект по умолчанию |
| `/login` | `login` | `LoginView.vue` | Форма входа |
| `/register` | `register` | `RegisterView.vue` | Форма регистрации |
| `/subcontractors` | `subcontractors` | `SubcontractorsView.vue` | Список подрядчиков |
| `/subcontractors/:id` | `subcontractor-detail` | `SubcontractorDetail.vue` | Карточка подрядчика с вкладками |
| `/reviews` | `reviews` | `ReviewsView.vue` | Список отзывов |
| `/checklists` | `checklists` | `ChecklistsView.vue` | Список чек-листов |
| `/meetings` | `meetings` | `MeetingsView.vue` | Список протоколов совещаний |
| `/surveys` | `surveys` | `SurveysView.vue` | Список опросов |
| `/tender/:id` | `tender-summary` | `TenderSummaryView.vue` | Сводка по тендеру |
| `/employees` | `employees` | `EmployeesView.vue` | Список сотрудников |
| `/suggestions` | `suggestions` | `SuggestionsView.vue` | Список предложений |
| `/events` | `events` | `EventsView.vue` | Журнал событий |
| `/chat` | `chat` | `ChatView.vue` | Интерфейс AI-ассистента |
| `/audit-log` | `audit-log` | `AuditLogView.vue` | Журнал изменений |

## Route guards

Гвард `beforeEach` реализует защиту маршрутов на основе состояния авторизации:

```ts
router.beforeEach(async (to, _from, next) => {
  const auth = useAuthStore()
  if (!auth.user) {
    await auth.fetchMe()
  }
  if (!auth.isAuthenticated && !publicRoutes.includes(to.path)) {
    next('/login')
  } else if (auth.isAuthenticated && publicRoutes.includes(to.path)) {
    next('/subcontractors')
  } else {
    next()
  }
})
```

**Логика**:
1. При каждом переходе проверяется наличие `auth.user`. Если отсутствует — выполняется `fetchMe()` для проверки cookie-сессии.
2. Если пользователь не авторизован и пытается зайти не на публичный маршрут — редирект на `/login`.
3. Если пользователь авторизован и пытается зайти на `/login` или `/register` — редирект на `/subcontractors`.
4. В остальных случаях — переход разрешён.

Публичные маршруты объявлены в массиве `publicRoutes = ['/login', '/register']`.

## Навигация в боковой панели

`AppSidebar.vue` декларирует все пункты меню в массиве `navItems`:

```ts
const navItems = [
  { to: '/subcontractors', label: 'Подрядчики', name: 'subcontractors' },
  { to: '/reviews',        label: 'Отзывы',      name: 'reviews' },
  { to: '/checklists',     label: 'Чек-листы',    name: 'checklists' },
  { to: '/meetings',       label: 'Протоколы',    name: 'meetings' },
  { to: '/surveys',        label: 'Опросы',       name: 'surveys' },
  { to: '/employees',      label: 'Сотрудники',   name: 'employees' },
  { to: '/suggestions',    label: 'Предложения',  name: 'suggestions' },
  { to: '/events',         label: 'События',      name: 'events' },
  { to: '/chat',           label: 'Ассистент',    name: 'chat' },
  { to: '/audit-log',      label: 'Журнал изменений', name: 'audit-log' },
  { to: '/tender/1',       label: 'Тендерная справка', name: 'tender-summary' },
]
```

Функция `isActive(name)` определяет активный пункт с учётом родительских маршрутов:
- `subcontractor-detail` подсвечивает `subcontractors`
- `tender-summary` подсвечивает сам себя

## Динамические сегменты

### `/subcontractors/:id`

Подрядчик загружается в `SubcontractorDetail.vue` через `useRoute().params.id`. Все связанные сущности (отзывы, комментарии, протоколы, опросы, события) загружаются параллельно в `onMounted`.

### `/tender/:id`

ID тендера передаётся в `TenderSummaryView.vue` через `useRoute().params.id`. Данные загружаются через `useTenderStore().fetchSummary(id)`.

## Отсутствующие возможности (MVP)

- **Вложенные маршруты** для вкладок подрядчика не реализованы — вкладки управляются локальным состоянием `activeTab` в компоненте, а не через роутер.
- **Route-параметры для фильтров** не используются — фильтрация по подрядчику/типу передаётся через props или напрямую в store-действия.
- **Route guards на уровне маршрутов** не настроены — вся логика в глобальном `beforeEach`.
- **Анимации переходов** между страницами не настроены.
