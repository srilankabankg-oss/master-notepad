# Интеграция API-клиента

## Обзор

API-клиент находится в `src/api/client.ts`. Это тонкая обёртка над нативным `fetch`, которая:
- Добавляет базовый URL `/api`
- Устанавливает `Content-Type: application/json` и `credentials: include`
- Автоматически парсит JSON-ответы
- Обрабатывает ошибки HTTP и выбрасывает типизированный `ApiRequestError`
- Предоставляет типизированные методы для всех эндпоинтов бэкенда

## Функция запроса

```ts
async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T>
```

- `path` — путь относительно `/api` (например, `/subcontractors`, `/reviews/5`)
- `options` — стандартные опции `RequestInit` (method, body, headers и т.д.)
- Возвращает `Promise<T>` — распарсенный JSON-ответ

### Обработка ошибок

При `!response.ok` клиент пытается распарсить тело ответа как JSON и извлекает `error` и `details`. Если парсинг не удался — используется fallback `"Ошибка {status}"`. Выбрасывается `ApiRequestError` с полями `status` и `details`.

```ts
class ApiRequestError extends Error {
  status: number
  details?: string[]
}
```

При статусе `204 No Content` возвращается `undefined` (приведённый к `T`).

### Утилита query-строки

```ts
function qs(params: Record<string, string | number | null | undefined>): string
```

Строит query-строку, пропуская `null`, `undefined` и пустые строки. Используется в методах списка с фильтрами.

```ts
// Пример: subcontractorId=5 → "?subcontractorId=5"
// Пример: нет параметров → ""
```

## Объект `api`

Все методы сгруппированы по сущностям в объекте `api`:

### `api.employees`

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `list()` | `Promise<Employee[]>` | Все сотрудники |
| `get(id)` | `Promise<Employee>` | Один сотрудник по ID |
| `create(data)` | `Promise<Employee>` | Создать сотрудника |
| `update(id, data)` | `Promise<Employee>` | Обновить сотрудника |
| `delete(id)` | `Promise<void>` | Удалить сотрудника |

### `api.subcontractors`

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `list()` | `Promise<Subcontractor[]>` | Все подрядчики |
| `get(id)` | `Promise<Subcontractor>` | Один подрядчик по ID |
| `create(data)` | `Promise<Subcontractor>` | Создать подрядчика |
| `update(id, data)` | `Promise<Subcontractor>` | Обновить подрядчика |
| `delete(id)` | `Promise<void>` | Удалить подрядчика |

### `api.reviews`

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `list(subcontractorId?)` | `Promise<Review[]>` | Отзывы, опционально фильтр по подрядчику |
| `get(id)` | `Promise<Review>` | Один отзыв по ID |
| `create(data)` | `Promise<Review>` | Создать отзыв |
| `update(id, data)` | `Promise<Review>` | Обновить отзыв |
| `delete(id)` | `Promise<void>` | Удалить отзыв |

### `api.comments`

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `list(subcontractorId?)` | `Promise<Comment[]>` | Комментарии, опционально фильтр по подрядчику |
| `get(id)` | `Promise<Comment>` | Один комментарий по ID |
| `create(data)` | `Promise<Comment>` | Создать комментарий |
| `update(id, data)` | `Promise<Comment>` | Обновить комментарий |
| `delete(id)` | `Promise<void>` | Удалить комментарий |

### `api.checklists`

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `list(type?, ownerId?)` | `Promise<Checklist[]>` | Чек-листы, фильтр по типу и/или владельцу |
| `get(id)` | `Promise<Checklist>` | Один чек-лист по ID |
| `create(data)` | `Promise<Checklist>` | Создать чек-лист |
| `update(id, data)` | `Promise<Checklist>` | Обновить чек-лист |
| `delete(id)` | `Promise<void>` | Удалить чек-лист |

### `api.suggestions`

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `list(checklistId?)` | `Promise<Suggestion[]>` | Предложения, опционально фильтр по чек-листу |
| `get(id)` | `Promise<Suggestion>` | Одно предложение по ID |
| `create(data)` | `Promise<Suggestion>` | Создать предложение |
| `update(id, data)` | `Promise<Suggestion>` | Обновить предложение (PATCH) |
| `delete(id)` | `Promise<void>` | Удалить предложение |

### `api.meetings`

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `list(subcontractorId?)` | `Promise<Meeting[]>` | Протоколы, опционально фильтр по подрядчику |
| `get(id)` | `Promise<Meeting>` | Один протокол по ID |
| `create(data)` | `Promise<Meeting>` | Создать протокол |
| `update(id, data)` | `Promise<Meeting>` | Обновить протокол |
| `delete(id)` | `Promise<void>` | Удалить протокол |

### `api.surveys`

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `list()` | `Promise<Survey[]>` | Все опросы |
| `get(id)` | `Promise<Survey>` | Один опрос по ID |
| `create(data)` | `Promise<Survey>` | Создать опрос |
| `update(id, data)` | `Promise<Survey>` | Обновить опрос |
| `delete(id)` | `Promise<void>` | Удалить опрос |
| `respond(id, data)` | `Promise<SurveyResponse>` | Отправить ответ на опрос |
| `responses(id)` | `Promise<SurveyResponse[]>` | Получить все ответы на опрос |

### `api.events`

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `list(subcontractorId?)` | `Promise<ContractorEvent[]>` | События, опционально фильтр по подрядчику |
| `get(id)` | `Promise<ContractorEvent>` | Одно событие по ID |
| `create(data)` | `Promise<ContractorEvent>` | Создать событие |
| `update(id, data)` | `Promise<ContractorEvent>` | Обновить событие |
| `delete(id)` | `Promise<void>` | Удалить событие |
| `suggest(id, checklistId, employeeId)` | `Promise<Suggestion>` | Создать предложение из события |

### `api.tender`

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `summary(id)` | `Promise<TenderSummary>` | Сводка по тендеру (агрегированные данные) |

### `api.auth`

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `login(data)` | `Promise<AuthEmployee>` | Вход по email/паролю |
| `register(data)` | `Promise<AuthEmployee>` | Регистрация нового сотрудника |
| `logout()` | `Promise<void>` | Выход (удаление cookie на сервере) |
| `me()` | `Promise<AuthEmployee>` | Текущий пользователь по cookie |

### `api.ai`

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `ask(data)` | `Promise<AskResponse>` | Запрос к AI-ассистенту |
| `health()` | `Promise<{ status: string }>` | Проверка доступности AI-сервиса |

### `api.audit`

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `list(entityType?, entityId?)` | `Promise<AuditLogEntry[]>` | Журнал изменений, опционально фильтр по сущности |

## Утилита `errorMessage`

```ts
export function errorMessage(e: unknown, fallback = 'Ошибка'): string
```

Используется во всех хранилищах для нормализации ошибок в пользовательские строки. При `ApiRequestError` возвращает `e.message` (сообщение от бэкенда), при любом другом `Error` — `e.message`, при не-ошибках — `fallback`.

## Поток данных: представление → бэкенд

```
View component
  → composable (useEntityForm / useDeleteConfirm)
    → Pinia store action (create / update / remove)
      → api.*.create|update|delete(data)
        → request(path, options)
          → fetch('/api/...', { credentials: 'include', ... })
            → Backend
```

Обратный поток:

```
Backend
  → fetch() resolves
    → response.json()
      → store action возвращает данные
        → composable обновляет локальное состояние
          → View реактивно перерисовывается
```

## Типизация

Все типы сущностей объявлены в `src/types/api.ts` и экспортируются как:
- `Entity` — полная сущность (с `id`, `createdAt`, `updatedAt`)
- `EntityCreate` — payload для создания (без `id`, без дат)
- `EntityUpdate` — payload для обновления (все поля опциональны)

API-клиент использует эти типы в сигнатурах методов, что обеспечивает полную типизацию на всех уровнях: от вызова в представлении до ответа бэкенда.
