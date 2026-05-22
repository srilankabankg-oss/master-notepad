# Дизайн Pinia-хранилищ

## Принципы проектирования

Каждая сущность системы имеет отдельное хранилище. Все хранилища следуют единому шаблону:

1. **Одно хранилище = одна сущность** (подрядчик, отзыв, сотрудник и т.д.)
2. **Состояние**: массив `items`, флаги `loading` и `error`
3. **Действия**: CRUD-методы, вызывающие API-клиент и обновляющие локальное состояние
4. **Нет оптимистичных обновлений** на этапе MVP — все изменения подтверждаются сервером
5. **Типизация**: все возвращаемые значения и параметры имеют явные TypeScript-типы

## Шаблон хранилища

```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api, errorMessage } from '@/api/client'
import type { Entity, EntityCreate, EntityUpdate } from '@/types/api'

export const useEntityStore = defineStore('entity-name', () => {
  const items = ref<Entity[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchAll(filter?: number) {
    loading.value = true
    error.value = null
    try {
      items.value = await api.entity.list(filter)
    } catch (e: unknown) {
      error.value = errorMessage(e, 'Не удалось загрузить сущности')
    } finally {
      loading.value = false
    }
  }

  async function fetchById(id: number) {
    return api.entity.get(id)
  }

  async function create(data: EntityCreate) {
    const item = await api.entity.create(data)
    items.value.push(item)
    return item
  }

  async function update(id: number, data: Partial<EntityUpdate>) {
    const updated = await api.entity.update(id, data)
    const idx = items.value.findIndex((e) => e.id === id)
    if (idx !== -1) items.value[idx] = updated
    return updated
  }

  async function remove(id: number) {
    await api.entity.delete(id)
    items.value = items.value.filter((e) => e.id !== id)
  }

  return { items, loading, error, fetchAll, fetchById, create, update, remove }
})
```

## Каталог хранилищ

### useAuthStore (`stores/auth.ts`)

**Назначение**: Управление сессией пользователя.

**Состояние**:
- `user: AuthEmployee | null` — данные текущего пользователя
- `loading: boolean` — флаг загрузки
- `error: string | null` — текст ошибки
- `isAuthenticated: ComputedRef<boolean>` — вычисляемое: `user !== null`

**Действия**:
- `login(data: LoginRequest)` — вход по email/паролю, сохраняет `user`, выбрасывает ошибку при неудаче
- `register(data: RegisterRequest)` — регистрация нового сотрудника
- `logout()` — запрос на сервер + сброс `user = null` (ошибки игнорируются)
- `fetchMe()` — запрос текущего пользователя по cookie, используется в `router.beforeEach` и `main.ts`

**Особенности**: `login` и `register` выбрасывают ошибку после сохранения `error`, чтобы вызывающий код мог обработать её. `fetchMe` тихо возвращает `null` при ошибке (неавторизованный доступ).

### useSubcontractorStore (`stores/subcontractors.ts`)

**Назначение**: Список подрядчиков и операции над ними.

**Состояние**: `items: Subcontractor[]`, `loading`, `error`

**Действия**:
- `fetchAll()` — загружает всех подрядчиков
- `fetchById(id)` — запрашивает одного подрядчика, обновляет его в `items` если уже есть, иначе добавляет
- `create(data)` — создаёт подрядчика, добавляет в `items`
- `update(id, data)` — обновляет подрядчика по индексу в `items`
- `remove(id)` — удаляет из `items` по фильтру

### useReviewStore (`stores/reviews.ts`)

**Назначение**: Отзывы о подрядчиках.

**Состояние**: `items: Review[]`, `loading`, `error`

**Действия**:
- `fetchAll(subcontractorId?: number)` — фильтрация по подрядчику через query-параметр
- `fetchById(id)` — только запрос, не обновляет `items`
- `create(data)` — добавляет в `items`
- `update(id, data)` — обновляет по индексу
- `remove(id)` — удаляет по фильтру

### useCommentStore (`stores/comments.ts`)

**Назначение**: Комментарии о подрядчиках.

**Состояние**: `items: Comment[]`, `loading`, `error`

**Действия**:
- `fetchAll(subcontractorId?: number)` — фильтрация по подрядчику
- `create(data)` — добавляет в `items`
- `update(id, data)` — обновляет по индексу
- `remove(id)` — удаляет по фильтру

**Отличие от других хранилищ**: нет `fetchById` — комментарии всегда загружаются списком.

### useChecklistStore (`stores/checklists.ts`)

**Назначение**: Чек-листы проверки объектов.

**Состояние**: `items: Checklist[]`, `loading`, `error`

**Действия**:
- `fetchAll(type?: ChecklistType, ownerId?: number)` — фильтрация по типу (`organization` | `personal`) и/или владельцу
- `fetchById(id)` — только запрос
- `create(data)` — добавляет в `items`
- `update(id, data)` — обновляет по индексу
- `remove(id)` — удаляет по фильтру

### useSuggestionStore (`stores/suggestions.ts`)

**Назначение**: Предложения по улучшению чек-листов.

**Состояние**: `items: Suggestion[]`, `loading`, `error`

**Действия**:
- `fetchAll(checklistId?: number)` — фильтрация по чек-листу
- `fetchById(id)` — только запрос
- `create(data)` — добавляет в `items`
- `update(id, data)` — обновляет по индексу (PATCH на бэкенде)
- `remove(id)` — удаляет по фильтру

### useMeetingStore (`stores/meetings.ts`)

**Назначение**: Протоколы совещаний.

**Состояние**: `items: Meeting[]`, `loading`, `error`

**Действия**:
- `fetchAll(subcontractorId?: number)` — фильтрация по подрядчику
- `fetchById(id)` — только запрос
- `create(data)` — добавляет в `items`
- `update(id, data)` — обновляет по индексу
- `remove(id)` — удаляет по фильтру

### useSurveyStore (`stores/surveys.ts`)

**Назначение**: Опросы и их ответы.

**Состояние**: `items: Survey[]`, `loading`, `error`

**Действия**:
- `fetchAll()` — загружает все опросы
- `fetchById(id)` — только запрос
- `create(data)` — добавляет в `items`
- `update(id, data)` — обновляет по индексу
- `remove(id)` — удаляет по фильтру
- `respond(id, data)` — отправка ответа на опрос (не изменяет `items`)
- `responses(id)` — получение списка ответов на опрос (не изменяет `items`)

### useEventStore (`stores/events.ts`)

**Назначение**: Журнал событий по подрядчикам (положительные/нарушения/информация).

**Состояние**: `items: ContractorEvent[]`, `loading`, `error`

**Действия**:
- `fetchAll(subcontractorId?: number)` — фильтрация по подрядчику
- `fetchById(id)` — только запрос
- `create(data)` — добавляет в `items`
- `update(id, data)` — обновляет по индексу
- `remove(id)` — удаляет по фильтру
- `suggestToChecklist(id, checklistId, employeeId)` — создаёт предложение из события (не изменяет `items`)

### useEmployeeStore (`stores/employees.ts`)

**Назначение**: Список сотрудников организации.

**Состояние**: `items: Employee[]`, `loading`, `error`

**Действия**:
- `fetchAll()` — загружает всех сотрудников
- `fetchById(id)` — только запрос
- `create(data)` — добавляет в `items`
- `update(id, data)` — обновляет по индексу
- `remove(id)` — удаляет по фильтру

### useTenderStore (`stores/tender.ts`)

**Назначение**: Сводка по тендеру (агрегированные данные по подрядчику).

**Состояние**: `summary: TenderSummary | null`, `loading`, `error`

**Действия**:
- `fetchSummary(id)` — загружает сводку по ID тендера

**Отличие от других хранилищ**: хранит одиночный объект `summary`, а не массив `items`.

## Паттерны обновления состояния

### Добавление после создания

```ts
async function create(data: EntityCreate) {
  const item = await api.entity.create(data)
  items.value.push(item)
  return item
}
```

### Обновление по индексу

```ts
async function update(id: number, data: Partial<EntityUpdate>) {
  const updated = await api.entity.update(id, data)
  const idx = items.value.findIndex((e) => e.id === id)
  if (idx !== -1) items.value[idx] = updated
  return updated
}
```

### Удаление по фильтру

```ts
async function remove(id: number) {
  await api.entity.delete(id)
  items.value = items.value.filter((e) => e.id !== id)
}
```

### Обновление одного элемента по ID

```ts
async function fetchById(id: number | string) {
  const item = await api.entity.get(id)
  const idx = items.value.findIndex((e) => e.id === Number(id))
  if (idx !== -1) items.value[idx] = item
  else items.value.push(item)
  return item
}
```

## Обработка ошибок

Все хранилища используют единую утилиту `errorMessage(e, fallback)` из `@/api/client`, которая:
- При `ApiRequestError` возвращает `e.message` (сообщение от бэкенда)
- При любом другом `Error` возвращает `e.message`
- При не-ошибках возвращает `fallback`

Ошибка сохраняется в `error.value` и отображается в представлении через `v-else-if="store.error"`.
