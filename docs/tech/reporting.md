# Отчёты и импорт

## 1. Обзор

Модуль отчётов и импорта предоставляет два типа операций с данными системы:
- **Экспорт**: генерация PDF-отчётов (тендерная справка, сводка по подрядчику, протокол совещания)
- **Импорт**: загрузка данных из Excel-файлов (подрядчики, сотрудники)

### Архитектура экспорта

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   View      │────▶│  API Route  │────▶│ ReportService│
│ (кнопка     │     │  /reports   │     │             │
│  "Экспорт") │     └─────────────┘     └──────┬──────┘
└─────────────┘                                │
                                               ▼
                                    ┌─────────────────────┐
                                    │  Template Engine    │
                                    │  (HTML → PDF)       │
                                    └──────────┬──────────┘
                                               │
                                               ▼
                                    ┌─────────────────────┐
                                    │  PDF Buffer         │
                                    │  (Content-Disposition│
                                    │   attachment)       │
                                    └─────────────────────┘
```

## 2. PDF Export

### Типы отчётов

| Отчёт | Эндпоинт | Содержимое |
|-------|----------|------------|
| Тендерная справка | `GET /api/reports/tender/:id` | Сводка по подрядчику для тендера (рейтинг, отзывы, события, протоколы, комментарии, опросы, нарушения) |
| Сводка по подрядчику | `GET /api/reports/subcontractor/:id` | Полная карточка подрядчика: все отзывы, события, протоколы, комментарии, опросы, рейтинг |
| Протокол совещания | `GET /api/reports/meeting/:id` | Протокол в формате PDF для печати и рассылки |

### Параметры

```
GET /api/reports/:type/:id?lang=ru&includeDetails=true
```

| Параметр | Описание |
|----------|----------|
| `lang` | Язык отчёта (`ru` по умолчанию) |
| `includeDetails` | Включить полные тексты отзывов и событий (`true` по умолчанию) |
| `dateFrom` / `dateTo` | Фильтр по дате для отчёта по подрядчику |

### Формат PDF

- Размер страницы: A4
| Ориентация: портретная
- Шапка: название отчёта, дата генерации, логотип
- Подвал: номер страницы, конфиденциальность
- Таблицы: стилизованные, с заголовками и чередованием строк
- Рейтинг: цветной бейдж (зелёный ≥ 7, жёлтый ≥ 5, красный < 5)

## 3. Excel Import

### Поддерживаемые сущности

| Сущность | Эндпоинт | Обязательные поля |
|----------|----------|-------------------|
| Подрядчики | `POST /api/import/subcontractors` | `name` |
| Сотрудники | `POST /api/import/employees` | `name`, `email` |

### Формат Excel

Импорт поддерживает `.xlsx` и `.xls`. Первая строка — заголовки на русском:

**Подрядчики:**
| Название | Компания | Специализация | Контакты | Описание |
|----------|----------|---------------|----------|----------|

**Сотрудники:**
| ФИО | Email | Должность |
|-----|-------|----------|

### Валидация

- Пустые обязательные поля → ошибка с указанием строки
- Дубликаты по `name` (подрядчики) или `email` (сотрудники) → предупреждение, строка пропускается
- Неверный формат email → ошибка
- Ограничение: максимум 1000 строк за один запрос

### Ответ

```ts
interface ImportResult {
  imported: number
  skipped: number
  errors: Array<{ row: number; message: string }>
}
```

## 4. Template Engine

### Обзор

Шаблоны отчётов преобразуют HTML в PDF с помощью библиотеки генерации PDF. Выбор библиотеки: **Puppeteer** (Chrome headless) или **pdfmake** (чистая генерация). Puppeteer предпочтительнее для сложной вёрстки с CSS, pdfmake — для простых табличных отчётов.

### Puppeteer-based pipeline

```
HTML Template (с CSS)
        │
        ▼
  puppeteer.launch()
        │
        ▼
  page.setContent(html)
        │
        ▼
  page.pdf({ format: 'A4', printBackground: true })
        │
        ▼
  PDF Buffer → Response
```

### Структура шаблона

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'DejaVu Sans', Arial, sans-serif; font-size: 10pt; color: #111; }
    .header { border-bottom: 2px solid #1a56db; padding-bottom: 12px; margin-bottom: 20px; }
    .header h1 { font-size: 18pt; color: #1a56db; margin: 0; }
    .meta { font-size: 8pt; color: #6b7280; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th { background: #f3f4f6; text-align: left; padding: 8px; font-size: 8pt; text-transform: uppercase; }
    td { padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 9pt; }
    .rating-badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-weight: bold; color: white; }
    .footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 8pt; color: #9ca3af; }
    @page { margin: 20mm 15mm 20mm 15mm; }
  </style>
</head>
<body>
  <div class="header">
    <h1>{{reportTitle}}</h1>
    <div class="meta">Сгенерировано: {{generatedAt}} | Подрядчик: {{subcontractorName}}</div>
  </div>
  {{content}}
  <div class="footer">Стр. {{pageNumber}} из {{totalPages}} | Конфиденциально</div>
</body>
</html>
```

### Переменные шаблона

| Переменная | Описание |
|------------|----------|
| `{{reportTitle}}` | Название отчёта |
| `{{generatedAt}}` | Дата и время генерации |
| `{{subcontractorName}}` | Название подрядчика |
| `{{content}}` | Основное содержимое (таблицы, списки) |
| `{{pageNumber}}` / `{{totalPages}}` | Нумерация страниц |

### Сборка контента

Контент генерируется на бэкенде через сериализацию данных в HTML-таблицы:

```ts
function buildSubcontractorReport(sub: Subcontractor, reviews: Review[], events: ContractorEvent[]): string {
  const reviewsHtml = reviews.map(r => `
    <tr>
      <td>${r.employeeName}</td>
      <td>${r.rating}/10</td>
      <td>${r.content}</td>
      <td>${formatDate(r.createdAt)}</td>
    </tr>`).join('')

  return `
    <h2>Отзывы (${reviews.length})</h2>
    <table>
      <thead><tr><th>Автор</th><th>Оценка</th><th>Текст</th><th>Дата</th></tr></thead>
      <tbody>${reviewsHtml}</tbody>
    </table>
    <!-- ... события, протоколы ... -->
  `
}
```

### Кэширование

PDF-отчёты кэшируются на 15 минут в памяти (Map) по ключу `${type}:${id}:${paramsHash}`. При повторном запросе с теми же параметрами возвращается кэшированный буфер.

## 5. API Design

Все эндпоинты с префиксом `/api/`. Защищены `requireRole('admin', 'clerk', 'controller', 'employee')`.

### Экспорт (PDF)

```
GET    /api/reports/tender/:id
       Query: ?lang=ru&includeDetails=true
       Response 200: application/pdf
         Headers: Content-Disposition: attachment; filename="tender-{id}-{timestamp}.pdf"
       Error 404: "Subcontractor not found"

GET    /api/reports/subcontractor/:id
       Query: ?lang=ru&includeDetails=true&dateFrom=2025-01-01&dateTo=2025-12-31
       Response 200: application/pdf
         Headers: Content-Disposition: attachment; filename="subcontractor-{id}-{timestamp}.pdf"
       Error 404: "Subcontractor not found"

GET    /api/reports/meeting/:id
       Response 200: application/pdf
         Headers: Content-Disposition: attachment; filename="meeting-protocol-{id}.pdf"
       Error 404: "Meeting protocol not found"
```

**Кэширование:** PDF-буферы кэшируются в `Map<string, { buffer: Buffer; expiresAt: number }>` на 15 минут. Ключ: `${type}:${id}:${queryHash}`.

### Импорт (Excel)

```
POST   /api/import/subcontractors
       Content-Type: multipart/form-data
       Body: file (поле формы, .xlsx или .xls)
       Access: admin, clerk
       Validation: max 1000 строк, обязательное поле name
       Response 200: ImportResult
       Response 200 (partial): { imported: N, skipped: M, errors: [...rows] }
       Error 400: "Invalid file format" / "File exceeds 1000 rows limit"

POST   /api/import/employees
       Content-Type: multipart/form-data
       Body: file (поле формы)
       Access: admin
       Validation: max 1000 строк, обязательные поля name, email
       Response 200: ImportResult
       Response 200 (partial): as above
       Error 400: "Invalid file format"
```

### Zod-схемы

```ts
import { z } from 'zod';

const reportQuerySchema = z.object({
  lang: z.enum(['ru']).default('ru'),
  includeDetails: z.enum(['true', 'false']).default('true'),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

const importErrorSchema = z.object({
  row: z.number().int().positive(),
  message: z.string(),
});

const importResultSchema = z.object({
  imported: z.number().int().min(0),
  skipped: z.number().int().min(0),
  errors: z.array(importErrorSchema),
});
```

### Обработка ошибок

```ts
reportsRouter.get('/tender/:id', requireRole('admin', 'clerk', 'controller', 'employee'), async (req, res, next) => {
  try {
    const id = +req.params.id;
    const [subcontractor] = await db.select().from(schema.subcontractors)
      .where(eq(schema.subcontractors.id, id))
      .limit(1);
    if (!subcontractor) throw new AppError(404, 'Subcontractor not found');

    // Проверка кэша
    const cacheKey = `tender:${id}:${JSON.stringify(req.query)}`;
    const cached = pdfCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="tender-${id}-${Date.now()}.pdf"`);
      return res.send(cached.buffer);
    }

    // Сбор данных
    const data = await collectTenderData(id);

    // Генерация PDF
    const buffer = await generatePDF('tender', data);

    // Кэширование
    pdfCache.set(cacheKey, { buffer, expiresAt: Date.now() + 15 * 60 * 1000 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="tender-${id}-${Date.now()}.pdf"`);
    res.send(buffer);
  } catch (e) { next(e); }
});
```

| Код | Ситуация |
|-----|---------|
| 400 | Zod validation error / неверный формат файла / превышен лимит строк |
| 401 | Не аутентифицирован |
| 403 | Недостаточно прав (для импорта) |
| 404 | Сущность не найдена |

## 6. Testing Strategy

### Unit

- Шаблон рендеринга: все плейсхолдеры заменяются, HTML валидный
- Валидация Excel: пустые обязательные поля → ошибка с номером строки
- Валидация email: неверный формат → ошибка
- Кэширование: повторный запрос → кэшированный буфер

### Integration

- Запрос отчёта → PDF с правильным Content-Type и Content-Disposition
- Импорт корректного Excel → все строки импортированы
- Импорт с ошибками → частичный импорт, ошибки в ответе
- Импорт дубликатов → строка пропущена, в errors предупреждение

## Frontend

### Новые Views

| Путь | Компонент | Описание |
|------|-----------|----------|
| `/reports` | `ReportsView.vue` | Выбор типа отчёта и параметров, список готовых отчётов |
| `/reports/tender/:id` | `TenderReportView.vue` | Предпросмотр и скачивание тендерной справки |
| `/reports/subcontractor/:id` | `SubcontractorReportView.vue` | Предпросмотр и скачивание сводки по подрядчику |

### Новые Stores

| Store | Файл | Методы |
|-------|------|--------|
| `useReportStore` | `stores/reports.ts` | `generateTender`, `generateSubcontractor`, `generateMeeting`, `download` |
| `useImportStore` | `stores/import.ts` | `importSubcontractors`, `importEmployees` |

### Новые роуты

```ts
{ path: '/reports',                      name: 'reports',                      component: () => import('@/views/ReportsView.vue') },
{ path: '/reports/tender/:id',           name: 'report-tender',                component: () => import('@/views/TenderReportView.vue') },
{ path: '/reports/subcontractor/:id',    name: 'report-subcontractor',         component: () => import('@/views/SubcontractorReportView.vue') },
```

### Обновления существующих Views

- **TenderSummaryView.vue**: добавить кнопку "Скачать PDF" → вызывает `useReportStore.generateTender(id)` → скачивает файл
- **SubcontractorDetail.vue**: добавить кнопку "Экспорт в PDF" в шапке карточки
- **MeetingsView.vue**: добавить кнопку "Экспорт протокола" в строке протокола
- **AppSidebar.vue**: добавить пункт "Отчёты" → `/reports`

### Новые типы (`types/api.ts`)

```ts
interface ImportResult {
  imported: number
  skipped: number
  errors: Array<{ row: number; message: string }>
}

interface ReportMeta {
  type: 'tender' | 'subcontractor' | 'meeting'
  id: number
  title: string
  generatedAt: string
  filename: string
}
```

### Обновления API-клиента (`api/client.ts`)

```ts
reports: {
  tender: (id: number, params?: { lang?: string; includeDetails?: boolean }) =>
    request<Blob>(`/reports/tender/${id}${qs(params || {})}`, { /* responseType: 'blob' */ }),
  subcontractor: (id: number, params?: { lang?: string; includeDetails?: boolean; dateFrom?: string; dateTo?: string }) =>
    request<Blob>(`/reports/subcontractor/${id}${qs(params || {})}`),
  meeting: (id: number) =>
    request<Blob>(`/reports/meeting/${id}`),
},
import: {
  subcontractors: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return fetch('/api/import/subcontractors', { method: 'POST', body: form, credentials: 'include' })
      .then(r => r.json() as Promise<ImportResult>)
  },
  employees: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return fetch('/api/import/employees', { method: 'POST', body: form, credentials: 'include' })
      .then(r => r.json() as Promise<ImportResult>)
  },
},
```

> **Примечание**: `request()` в текущем клиенте отправляет JSON. Для загрузки файлов используется прямой `fetch` с `FormData`, так как `multipart/form-data` несовместим с JSON-сериализацией.

### Flow данных

```
TenderSummaryView
  → BaseButton "Скачать PDF"
    → useReportStore.generateTender(id)
      → api.reports.tender(id)
        → GET /api/reports/tender/:id (responseType: blob)
          → создание <a download> → клик → скачивание

ReportsView (импорт)
  → <input type="file" accept=".xlsx,.xls">
    → useImportStore.importSubcontractors(file)
      → FormData POST /api/import/subcontractors
        → ImportResult { imported, skipped, errors }
          → отображение: "Импортировано: 45, Пропущено: 3, Ошибки: 2"
```

### Импорт в UI

Страница импорта (`ReportsView.vue` или отдельная `ImportView.vue`) содержит:
- Селект типа сущности для импорта (Подрядчики / Сотрудники)
- Drag-and-drop зона для файла
- Кнопка "Импортировать"
- Результат: прогресс-бар или таблица с импортированными строками и списком ошибок
