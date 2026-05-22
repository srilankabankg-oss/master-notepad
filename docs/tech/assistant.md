# AI Ассистент — Технический дизайн

> Продуктовое описание и сценарии использования: [docs/product/assistant.md](../product/assistant.md)

## Архитектура микросервиса

Ассистент — отдельный микросервис на **Python/FastAPI** (порт 3002). Вынесен из основного Node.js-бэкенда для изоляции ML-зависимостей и возможности независимого масштабирования.

```
assistant/
├── src/
│   ├── main.py            # FastAPI entry (порт 3002)
│   ├── api/
│   │   ├── ask.py         # POST /api/ai/ask — основной эндпоинт
│   │   └── reindex.py     # POST /api/ai/reindex/{entity} — переиндексация
│   ├── rag/
│   │   ├── embedder.py    # Векторизация (multilingual-e5-base, 768-dim)
│   │   ├── retriever.py   # Гибридный поиск: 0.7 cosine × 0.3 BM25
│   │   └── ingester.py    # Индексация: запрос данных из основного API → чанки → embeddings → pgvector
│   ├── llm/
│   │   └── provider.py    # Адаптер к OpenAI API (заменяем через конфиг)
│   └── db/
│       └── vector_store.py # Клиент pgvector: HNSW-индекс, similarity search
├── Dockerfile
├── requirements.txt
└── pyproject.toml
```

## Стек

| Компонент | Технология |
|-----------|------------|
| Рантайм | Python 3.11+ / FastAPI + uvicorn |
| Векторная БД | pgvector (таблица `embeddings`, HNSW-индекс, cosine distance) |
| Embedding модель | `intfloat/multilingual-e5-base` (768-dim, ONNX для прода) |
| LLM | OpenAI API (`gpt-4o-mini` по умолчанию, заменяем через `LLM_API_URL`) |
| Поиск | Гибридный: vector similarity (cosine, вес 0.7) + BM25 keyword (вес 0.3) |
| Развёртывание | Docker Compose, CPU-only, лимит 2GB RAM |

## pgvector-схема

```sql
-- Расширение pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Таблица embeddings
CREATE TABLE embeddings (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,    -- subcontractor, review, event, checklist, ...
  entity_id INTEGER NOT NULL,          -- ID из основной таблицы
  chunk_index SMALLINT DEFAULT 0,      -- номер чанка (если запись разбита)
  content TEXT NOT NULL,               -- текст чанка (для BM25 и отображения)
  embedding VECTOR(768),               -- векторное представление чанка
  metadata JSONB DEFAULT '{}',         -- доп. поля (название, дата, связи)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW-индекс для быстрого ANN-поиска
CREATE INDEX ON embeddings USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 200);
```

## API-контракт

**Эндпоинты микросервиса (порт 3002):**

```
POST /api/ai/ask
Content-Type: application/json

Request:
{
  "question": "Какие чек-листы есть по фундаменту?",
  "employeeId": 1,
  "limit": 5
}

Response 200:
{
  "answer": "По фундаменту есть 2 организационных чек-листа: «Проверка фундамента» (12 пунктов) и «Приёмка бетонных работ» (8 пунктов). В чек-листе «Проверка фундамента» 3 последних события-нарушения, которые стоит проверить.",
  "sources": [
    {
      "entityType": "checklist",
      "entityId": 3,
      "title": "Проверка фундамента",
      "excerpt": "Проверить гидроизоляцию, армирование..."
    },
    {
      "entityType": "checklist",
      "entityId": 7,
      "title": "Приёмка бетонных работ",
      "excerpt": "Контроль прочности бетона, геометрия..."
    }
  ],
  "confidence": 0.87
}
```

```
POST /api/ai/reindex/{entity}
Content-Type: application/json

Request:
{
  "entityId": 42
}

Response 202:
{
  "status": "accepted",
  "entity": "subcontractor",
  "entityId": 42,
  "message": "Reindex scheduled"
}

Поддерживаемые entity: subcontractor, review, event, checklist, meeting, survey, comment
```

## Интеграция в основной backend

Основной backend (Node.js/Express порт 3001) проксирует запросы к AI-микросервису через **proxy-роут** `/api/ai`:

```
frontend → backend:3001/api/ai/ask  →  proxy  →  assistant:3002/api/ai/ask
```

Преимущества прокси:
- Фронтенд работает с единым origin (порт 3001), не нужен отдельный CORS
- Backend может добавить валидацию/логирование перед проксированием
- Простое конфигурирование: `AI_SERVICE_URL=http://localhost:3002`

При CRUD-операциях (создание/обновление/удаление любой сущности) backend отправляет **fire-and-forget** запрос на переиндексацию:
```
POST http://assistant:3002/api/ai/reindex/{entity}
```
Если микросервис недоступен — переиндексация откладывается до следующего полного перестроения индекса.

## Развёртывание

```yaml
# docker-compose.yml (фрагмент)
services:
  assistant:
    build: ./assistant
    ports:
      - "3002:3002"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@pg:5432/master_notepad
      - MAIN_API_URL=http://backend:3001
      - LLM_API_URL=https://api.openai.com/v1
      - LLM_MODEL=gpt-4o-mini
      - EMBEDDING_MODEL=intfloat/multilingual-e5-base
      - PORT=3002
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 1G
    restart: unless-stopped
```

```bash
# Самостоятельный запуск (dev)
cd assistant
pip install -r requirements.txt
uvicorn src.main:app --host 0.0.0.0 --port 3002 --reload
```

## Переменные окружения

| Переменная | По умолчанию | Описание |
|------------|-------------|----------|
| `DATABASE_URL` | required | PostgreSQL (с pgvector) для таблицы `embeddings` |
| `MAIN_API_URL` | `http://localhost:3001` | Основной API — источник данных для индексации |
| `LLM_API_URL` | `https://api.openai.com/v1` | OpenAI-совместимый API (заменяем на любой LLM-провайдер) |
| `LLM_MODEL` | `gpt-4o-mini` | Модель для генерации ответов |
| `EMBEDDING_MODEL` | `intfloat/multilingual-e5-base` | Модель для векторизации (ONNX в продакшене) |
| `PORT` | `3002` | Порт микросервиса |

## Безопасность

- Нет аутентификации (MVP) — `employeeId` передаётся в запросе как и в основном API
- Ассистент работает только на чтение — не модифицирует данные системы
- В промпт LLM передаются только обезличенные данные (ФИО сотрудников заменяются на идентификаторы)
- Доступ к `/api/ai/*` только изнутри Docker-сети — внешний доступ через прокси `/api/ai` основного backend
- Все ответы основаны только на данных системы — LLM не выдумывает фактов (RAG constraint)

## Индексация данных

**Полная (при старте / по триггеру):**
1. Запрашивает все сущности из основного API (`GET /api/subcontractors`, `/api/reviews`, etc.)
2. Разбивает на чанки по смысловым единицам (одна запись → один чанк, длинные тексты → несколько)
3. Векторизует через `multilingual-e5-base` (768-dim)
4. Сохраняет в `embeddings` с метаданными (entity_type, entity_id, связи)

**Инкрементальная (на CRUD):**
- Backend отправляет fire-and-forget `POST /api/ai/reindex/{entity}` при каждом create/update/delete
- Микросервис переиндексирует только изменённую запись

## Статус

- ✅ Реализовано
