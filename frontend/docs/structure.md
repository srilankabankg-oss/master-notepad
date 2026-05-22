# Структура Vue-компонентов

## Обзор архитектуры

Приложение построено на Vue 3 с Composition API и `<script setup lang="ts">`. Структура компонентов разделена на три уровня: корневой макет, переиспользуемые примитивы и страницы-представления.

## Дерево компонентов

```
App.vue                          # Корневой макет: выбор auth-layout / app-layout
├── AppSidebar.vue               # Боковая панель навигации (фиксированная, скрывается на мобильных)
│   └── [router-link] × 11       # Пункты меню для каждого раздела
├── AppHeader.vue                # Шапка страницы с динамическим заголовком по route.name
└── <router-view />              # Текущая страница (View-компонент)

Views (страницы)
├── SubcontractorsView.vue       # Список подрядчиков (таблица + модальное окно CRUD)
├── SubcontractorDetail.vue      # Карточка подрядчика с вкладками
│   ├── EntityHeader.vue         # Заголовок карточки (название, компания, рейтинг, описание)
│   └── TabGroup.vue             # Переключатель вкладок
│       ├── ReviewsTab.vue       # Вкладка "Отзывы"
│       ├── CommentsTab.vue      # Вкладка "Комментарии"
│       ├── MeetingsTab.vue      # Вкладка "Протоколы"
│       ├── SurveysTab.vue       # Вкладка "Опросы"
│       └── EventsTab.vue        # Вкладка "События"
├── ReviewsView.vue              # Список отзывов (фильтр по подрядчику)
├── ChecklistsView.vue           # Список чек-листов (фильтр по типу/владельцу)
├── MeetingsView.vue             # Список протоколов совещаний
├── SurveysView.vue              # Список опросов
├── EmployeesView.vue            # Список сотрудников
├── SuggestionsView.vue          # Список предложений по улучшению
├── EventsView.vue               # Журнал событий (фильтр по типу события)
├── TenderSummaryView.vue        # Сводка по тендеру
├── ChatView.vue                 # Интерфейс AI-ассистента
├── LoginView.vue                # Форма входа
├── RegisterView.vue             # Форма регистрации
└── AuditLogView.vue             # Журнал изменений

Shared components (переиспользуемые примитивы)
├── BaseButton.vue               # Кнопка с вариантами primary/secondary/ghost/danger/success/warning
├── Modal.vue                    # Модальное окно с Teleport, Transition, overlay-click-to-close
├── TabGroup.vue                 # Группа вкладок (v-model + tabs array)
├── EntityHeader.vue             # Заголовок карточки сущности
├── RatingBadge.vue              # Бейдж с числовым рейтингом (цвет по значению)
└── EventBadge.vue               # Бейдж типа события (Позитивное/Нарушение/Информация)
```

## Layout: App.vue

`App.vue` реализует два режима отображения через `v-if / v-else`:

- **auth-layout** — для неавторизованных пользователей: только `<router-view />` на фоне `var(--color-bg)`.
- **app-layout** — для авторизованных: `<AppSidebar />` + `<div class="app-main">` с `<AppHeader />` и `<main class="app-content">` с `<router-view />`.

Контейнер `.app-content` имеет `container-type: inline-size` и `container-name: app-content`, что позволяет дочерним представлениям использовать контейнерные запросы `@container`.

```vue
<!-- App.vue -->
<div v-if="!auth.isAuthenticated" class="auth-layout">
  <router-view />
</div>
<div v-else class="app-layout">
  <AppSidebar />
  <div class="app-main">
    <AppHeader />
    <main class="app-content">
      <router-view />
    </main>
  </div>
</div>
```

## Layout: AppSidebar.vue

Фиксированная боковая панель шириной `15rem` (`--sidebar-width`). На десктопе всегда видна, на мобильных (`max-width: 767px`) скрывается за левым краем с анимацией `transform: translateX(-100%) → translateX(0)` и появляется гамбургер-кнопка. Закрытие по клику на backdrop или по смене маршрута (watch на `route.path`).

Навигация декларируется в массиве `navItems` с полями `to`, `label`, `name`. Активный пункт определяется через `route.name` с учётом родительского маршрута (`subcontractor-detail` подсвечивает `subcontractors`).

## Layout: AppHeader.vue

Динамический заголовок страницы. Маппинг `route.name → заголовок` реализован через объект `titles`. Высота хедера `3.75rem`, на мобильных сдвиг вправо на ширину гамбургера (`padding-left: 3.75rem`).

## Паттерн страницы-списка (List View)

Все страницы-списки следуют единому паттерну:

```
onMounted → store.fetchAll()
  ├── v-if="store.loading"   → "Загрузка..."
  ├── v-else-if="store.error" → "{{ store.error }}"
  ├── v-else-if="items.length === 0" → "Нет записей"
  └── v-else → таблица / карточки
```

CRUD-операции инкапсулированы в два переиспользуемых composable:

- **`useEntityForm()`** — управляет модальным окном создания/редактирования: `showForm`, `editingId`, `formData`, `formError`, `formLoading`, `openCreate()`, `openEdit(entity)`, `closeForm()`, `submitForm()`.
- **`useDeleteConfirm()`** — обёртка над `confirm()` + `store.remove(id)`: `deleteItem(id)`.

## Паттерн страницы-детали (Detail View)

`SubcontractorDetail.vue` загружает данные подрядчика и все связанные сущности параллельно через `Promise.all()`:

```ts
const [fetched] = await Promise.all([
  subcontractorStore.fetchById(subId),
  reviewStore.fetchAll(subId),
  commentStore.fetchAll(subId),
  meetingStore.fetchAll(subId),
  surveyStore.fetchAll(),
  eventStore.fetchAll(subId),
  employeeStore.fetchAll(),
])
```

Вкладки управляются через `activeTab` (тип `'reviews' | 'comments' | 'meetings' | 'surveys' | 'events'`) и компонент `TabGroup` с `v-model`. Каждая вкладка получает `:sub-id="subId"` и эмитит событие `@refresh="loadAll"` для обновления данных после изменений.

## Переиспользуемые компоненты

### BaseButton.vue

Принимает пропсы `variant`, `size`, `disabled`, `type`. Классы собираются динамически: `btn btn-{variant}` + опционально `btn-sm`. Слот для контента.

```vue
<BaseButton variant="primary" size="sm" :disabled="loading">Сохранить</BaseButton>
```

### Modal.vue

Teleport к `<body>`, Transition `modal-fade` (opacity 0.2s). Props: `modelValue` (v-model), `title`. Слот для тела. Закрытие по клику на overlay (`@click.self`) или по крестику. Эмитит `update:modelValue` и `close`.

### TabGroup.vue

Принимает `modelValue` (строка ключа вкладки) и `tabs: { key, label }[]`. Эмитит `update:modelValue` при клике на вкладку. Активная вкладка получает класс `active`.

### EntityHeader.vue

Отображает название, компанию, специализацию, рейтинг (с цветом через `ratingColor()`), описание и контактную информацию. Используется только на странице детали подрядчика.

### RatingBadge.vue

Пилюс-бейдж с числовым рейтингом. Цвет фона определяется через `ratingColor(rating)`:
- `≥ 7` → зелёный `#16a34a`
- `≥ 5` → жёлтый `#ca8a04`
- `< 5` → красный `#dc2626`
- `undefined` → серый `#9ca3af`

### EventBadge.vue

Бейдж типа события. Использует `eventTypeLabel()` для текста и `eventTypeClass()` для CSS-класса (`badge-positive`, `badge-violation`, `badge-info`).

## Container queries

Каждая страница-представление оборачивает корневой элемент в `container-type: inline-size`:

```css
.view { max-width: 56.25rem; container-type: inline-size; }
```

Внутри используются `@container (max-width: 40rem)` для адаптации таблиц (преобразование в карточки на узких экранах), формы и модальных окон (на мобильных модальное окно выезжает снизу как bottom-sheet).

## Соглашения по именованию

- Компоненты: `PascalCase.vue` (`SubcontractorsView.vue`, `BaseButton.vue`)
- Composables: `camelCase.ts` с префиксом `use` (`useEntityForm.ts`, `useRating.ts`)
- Stores: `camelCase.ts` с префиксом `use` и суффиксом `Store` (`useSubcontractorStore`)
- CSS-классы: `kebab-case`, префикс по назначению (`btn-`, `badge-`, `state-`, `form-`)
