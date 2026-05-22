# Управление состоянием UI

## Уровни состояния

Состояние в приложении распределено по трём уровням:

1. **Глобальное состояние** — Pinia-хранилища (данные сущностей, сессия пользователя)
2. **Локальное состояние компонента** — `ref` / `reactive` внутри `<script setup>`
3. **Состояние маршрута** — `route.params`, `route.query` через `vue-router`

## Глобальное состояние (Pinia)

### Паттерн хранилища

Каждое хранилище экспортирует:
- **Реактивные примитивы**: `items` (массив сущностей), `loading` (boolean), `error` (string | null)
- **Действия**: асинхронные методы для загрузки и изменения данных

```ts
const { items, loading, error, fetchAll, create, update, remove } = useSubcontractorStore()
```

### Инициализация данных

Данные загружаются в `onMounted` страницы:

```ts
onMounted(() => {
  store.fetchAll()
})
```

Для страницы детали подрядчика используется параллельная загрузка:

```ts
onMounted(async () => {
  await Promise.all([
    subcontractorStore.fetchById(subId),
    reviewStore.fetchAll(subId),
    commentStore.fetchAll(subId),
    meetingStore.fetchAll(subId),
    surveyStore.fetchAll(),
    eventStore.fetchAll(subId),
    employeeStore.fetchAll(),
  ])
})
```

### Сессия пользователя (useAuthStore)

Инициализируется в `main.ts` до монтирования приложения:

```ts
const auth = useAuthStore()
await auth.fetchMe()
app.mount('#app')
```

Дополнительно проверяется в `router.beforeEach` при каждом переходе. Это гарантирует, что `auth.user` всегда актуален при доступе к защищённым маршрутам.

### Разделение ответственности хранилищ

Хранилища отвечают **только** за данные сущностей. Они не управляют:
- состоянием UI (открыто/закрыто модальное окно, активная вкладка)
- формой редактирования
- подтверждением удаления

Эти аспекты инкапсулированы в composables.

## Локальное состояние компонента

### Состояние загрузки и ошибок

Каждая страница дублирует `loading` и `error` из хранилища в локальные `ref` для независимого управления:

```ts
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    await loadAll()
  } catch (e: unknown) {
    error.value = String(e)
  } finally {
    loading.value = false
  }
})
```

### Активная вкладка (SubcontractorDetail.vue)

```ts
const activeTab = ref<'reviews' | 'comments' | 'meetings' | 'surveys' | 'events'>('reviews')
```

Привязана к `TabGroup` через `v-model`. При переключении вкладки соответствующий дочерний компонент отображает свои данные. При обновлении данных (после создания/редактирования) эмитится событие `@refresh`, которое вызывает `loadAll()` для повторной загрузки всех связанных сущностей.

### Форма редактирования (useEntityForm)

Состояние формы инкапсулировано в composable `useEntityForm`:

```ts
const {
  showForm,        // boolean — видимость модального окна
  editingId,       // number | null — ID редактируемой сущности (null = создание)
  formData,        // TCreate — двусторонне связанные значения полей формы
  formError,       // string — текст ошибки валидации или API
  formLoading,     // boolean — флаг отправки
  openCreate,      // () => void — открыть окно создания
  openEdit,        // (entity) => void — открыть окно редактирования
  closeForm,       // () => void — закрыть окно
  submitForm,      // () => Promise<void> — отправить форму
} = useEntityForm({ ... })
```

`formData` инициализируется через `structuredClone(defaultCreateValues)` для изоляции между сеансами открытия модалки.

### Подтверждение удаления (useDeleteConfirm)

```ts
const { deleteItem } = useDeleteConfirm(
  (id: number) => store.remove(id),
  'подрядчик'
)
```

`deleteItem(id)` вызывает `confirm()` и при подтверждении выполняет `store.remove(id)`. Ошибки отображаются через `alert()`.

## Composables (переиспользуемая логика)

### useEntityForm

Универсальный composable для паттерна "модальное окно с формой создания/редактирования". Параметризуется через объект опций:

```ts
useEntityForm({
  entityName: 'Подрядчик',              // для сообщений об ошибках
  defaultCreateValues: { name: '', ... }, // значения по умолчанию для новой сущности
  toCreateData: (entity) => ({ ... }),    // маппинг существующей сущности в форму
  onSubmit: async ({ isEdit, id, values }) => { ... }, // сохранение через store
  validate: () => { ... },                // клиентская валидация
})
```

Используется в: `SubcontractorsView`, `ReviewsView`, `MeetingsView`, `EmployeesView`, `ChecklistsView`, `EventsView`.

### useDeleteConfirm

Обёртка над `confirm()` + `store.remove()`:

```ts
useDeleteConfirm(
  removeFn: (id: number) => Promise<void>,
  entityName: string  // для текста в диалоге подтверждения
)
```

Используется во всех представлениях со списками сущностей.

### useRating

Вспомогательные функции для отображения рейтинга:

- `ratingColor(rating)` — цвет бейджа по значению (зелёный ≥ 7, жёлтый ≥ 5, красный < 5, серый undefined)
- `ratingText(rating)` — текст для отображения (число или тире)

### useEventLabels

Вспомогательные функции для журнала событий:

- `eventTypeLabel(type)` — русская метка типа события (`'Позитивное'`, `'Нарушение'`, `'Информация'`)
- `eventTypeClass(type)` — CSS-класс бейджа (`badge-positive`, `badge-violation`, `badge-info`)

### useStatusLabel

Маппинг статуса предложения на русскую метку:

- `pending` → `'На рассмотрении'`
- `approved` → `'Одобрено'`
- `rejected` → `'Отклонено'`

### useDateFormatter

Форматирование дат в русской локали:

- `formatDate(dateStr)` — короткая дата (`17.05.2026`)
- `formatDateTime(dateStr)` — дата и время (`17.05.2026 14:30:00`)

### useEmployeeName / useSubcontractorName

Функции-поисковики для получения имени сотрудника или подрядчика по ID из списка. Возвращают `#${id}` если запись не найдена.

## Паттерны условного отображения

Все страницы-списки используют единый паттерн:

```vue
<div v-if="store.loading" class="state-message">Загрузка...</div>
<div v-else-if="store.error" class="state-message state-error">{{ store.error }}</div>
<div v-else-if="store.items.length === 0" class="state-message">Нет записей</div>
<!-- содержимое -->
```

Классы `.state-message` и `.state-error` определены в `styles.css` и используют CSS-переменные для цветов.

## Адаптивность состояния UI

На мобильных экранах (`max-width: 767px`):
- Боковая панель скрыта, управляется через гамбургер и `sidebarOpen` в `AppSidebar.vue`
- Таблицы преобразуются в карточки через `@container (max-width: 40rem)` в scoped CSS каждой страницы
- Модальные окна выезжают снизу как bottom-sheet (`align-items: flex-end`, `border-radius: 0.75rem 0.75rem 0 0`)
