# AI-анализ данных — Технический дизайн

> Интеллектуальный анализ отзывов, событий и протоколов: тональность, паттерны нарушений, аудио→текст, LLM-суммаризация.
> Базовый AI-ассистент (чат с RAG): [docs/tech/assistant.md](assistant.md).

## Архитектура ML-модулей

AI-анализ расширяет существующий микросервис `assistant/` (Python/FastAPI, порт 3002) тремя новыми модулями:

```
assistant/
├── src/
│   ├── analysis/              # Новый пакет AI-анализа
│   │   ├── sentiment.py       # Анализ тональности (оценка рисков)
│   │   ├── patterns.py        # Обнаружение повторяющихся паттернов
│   │   ├── summarizer.py      # Суммаризация: тендерная справка, сводка
│   │   └── audio_pipeline.py  # Конвейер аудио→текст→протокол
│   ├── api/
│   │   ├── analyze.py         # POST /api/ai/analyze/{entity}
│   │   └── transcribe.py      # POST /api/ai/transcribe
│   ├── db/
│   │   └── analysis_store.py  # Таблицы analysis_results, event_patterns
│   ├── rag/                   # (существующий, расширен новыми entity_type)
│   └── llm/                   # (существующий)
```

### Почему в том же микросервисе

| Причина | Обоснование |
|---------|------------|
| Общий embedding-движок | Sentiment и pattern detection используют ту же `multilingual-e5-base`, что и RAG |
| Общий LLM-клиент | Summarization и audio→text используют тот же OpenAI-совместимый API |
| Единое pgvector-хранилище | Результаты анализа + embeddings в одной БД |
| CPU-only деплой | Все модели помещаются в те же 2-3GB RAM, GPU не нужен |

## Модель данных

### Таблица analysis_results

```sql
CREATE TABLE analysis_results (
  id SERIAL PRIMARY KEY,
  analysis_type VARCHAR(50) NOT NULL,   -- sentiment | pattern | summary
  entity_type VARCHAR(50) NOT NULL,      -- review | event | meeting | subcontractor
  entity_id INTEGER NOT NULL,
  result JSONB NOT NULL,                 -- структурированный результат анализа
  model_version VARCHAR(64),             -- версия модели
  confidence FLOAT,                      -- уверенность модели (0-1)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analysis_results_entity
  ON analysis_results (entity_type, entity_id);
```

### Таблица event_patterns

```sql
CREATE TABLE event_patterns (
  id SERIAL PRIMARY KEY,
  pattern_label VARCHAR(255) NOT NULL,   -- «срыв сроков поставки», «некачественная сварка»
  entity_type VARCHAR(50) DEFAULT 'event',
  cluster_id INTEGER,                    -- группа семантически близких событий
  event_ids INTEGER[] NOT NULL,          -- ID событий в паттерне
  subcontractor_ids INTEGER[],           -- затронутые подрядчики
  frequency INTEGER DEFAULT 1,           -- частота повторения
  first_seen TIMESTAMPTZ,
  last_seen TIMESTAMPTZ,
  embedding VECTOR(768),                 -- центроид кластера (для быстрого поиска)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_event_patterns_cluster ON event_patterns (cluster_id);
CREATE INDEX ON event_patterns USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 128);
```

---

## 1. Анализ тональности (Sentiment Analysis)

### Назначение

Автоматическая оценка эмоциональной окраски текстов отзывов (`reviews`), комментариев (`comments`) и описаний событий (`contractor_events`) для:

- Выявления рисковых подрядчиков (негативная тональность в отзывах)
- Подсветки скрытых проблем (отзыв с оценкой 8, но текст негативный)
- Формирования объективного рейтинга на основе текстов, а не только числовых оценок

### Выбор модели

| Кандидат | Размер | Язык | Выбор |
|----------|--------|------|-------|
| `blanchefort/rubert-base-cased-sentiment` | 178M | Ru | **Основная** — 3 класса, F1=0.89 |
| `cointegrated/rubert-tiny-sentiment` | 29M | Ru | Запасная — CPU-only, F1=0.82 |
| `intfloat/multilingual-e5-base` | 278M | Multi | Уже загружена для RAG |

**Решение:** `rubert-base-cased-sentiment` (основная), `rubert-tiny-sentiment` для dev. Загружается лениво при первом вызове.

### Реализация

```python
# assistant/src/analysis/sentiment.py

from transformers import pipeline

_sentiment_pipeline = None

def get_sentiment_pipeline():
    global _sentiment_pipeline
    if _sentiment_pipeline is None:
        _sentiment_pipeline = pipeline(
            "sentiment-analysis",
            model="blanchefort/rubert-base-cased-sentiment",
        )
    return _sentiment_pipeline


def analyze_sentiment(text: str) -> dict:
    """Анализ одного текста. Возвращает метку и уверенность."""
    pipe = get_sentiment_pipeline()
    result = pipe(text[:512])[0]
    return {
        "label": result["label"],       # positive / neutral / negative
        "score": round(result["score"], 4),
    }


async def risk_assessment(subcontractor_id: int) -> dict:
    """Оценка рисков подрядчика на основе тональности."""
    # Собирает все отзывы и события подрядчика
    # Считает долю негативных текстов
    # Сравнивает sentiment с числовым rating (rating=8, sentiment=negative -> флаг)
    # Возвращает: risk_score (0-1), flagged_reviews, recommendation
    ...
```

### API-контракт

```
POST /api/ai/analyze/sentiment
Content-Type: application/json

Request:
{
  "entity_type": "review",       // review | comment | event
  "entity_ids": [1, 2, 3],       // конкретные ID или [] для всех
  "subcontractor_id": 5           // опционально — фильтр по подрядчику
}

Response 200:
{
  "status": "completed",
  "analyzed": 12,
  "results": [
    {
      "entity_id": 1,
      "text_preview": "Подрядчик сорвал сроки...",
      "sentiment": { "label": "negative", "score": 0.97 }
    }
  ],
  "summary": { "positive": 5, "neutral": 4, "negative": 3 }
}
```

```
GET /api/ai/analyze/risk/{subcontractor_id}

Response 200:
{
  "subcontractor_id": 5,
  "risk_score": 0.65,
  "risk_level": "medium",
  "flagged_reviews": [
    {
      "review_id": 3,
      "rating": 8,
      "sentiment": "negative",
      "excerpt": "в целом хорошо, но..."
    }
  ],
  "recommendation": "Рекомендуется дополнительная проверка перед тендером"
}
```

### Интеграция с RAG

Результаты индексируются как `entity_type = "sentiment_analysis"`:

```python
# content = "Подрядчик X: риск medium, 3 негативных отзыва, 2 флага расхождения"
# metadata = {"subcontractor_id": 5, "risk_score": 0.65, ...}
```

### Производительность

| Метрика | `rubert-base` | `rubert-tiny` |
|---------|---------------|---------------|
| Время на 1 текст (CPU) | ~80ms | ~15ms |
| RAM (загруженная) | ~350MB | ~60MB |
| Точность (F1, 3 класса) | 0.89 | 0.82 |
| 1000 текстов (batch=32) | ~8s | ~1.5s |

---

## 2. Обнаружение паттернов (Pattern Detection)

### Назначение

Автоматическое выявление повторяющихся нарушений и типовых проблем в журнале событий (`contractor_events`) и отзывах (`reviews`).

**Пример:** если у 3 разных подрядчиков в событиях фигурирует «срыв сроков поставки арматуры», система группирует их в паттерн и предлагает добавить пункт в чек-лист.

### Алгоритм

```
Этап 1: Embedding + кластеризация
  Все events (type=violation) -> multilingual-e5-base -> 768-dim векторы
  -> DBSCAN (cosine distance, eps=0.3, min_samples=3)
  -> Группы семантически близких событий

Этап 2: LLM-лейблинг
  Для каждого кластера (>=3 событий):
  -> LLM (gpt-4o-mini) генерирует label и description
  -> Сохраняем в event_patterns
```

### Реализация

```python
# assistant/src/analysis/patterns.py

from sklearn.cluster import DBSCAN
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
from ..rag.embedder import embed_passages
from ..llm.provider import generate_pattern_label


async def detect_patterns(
    entity_type: str = "event",
    event_type: str | None = "violation",
    min_cluster_size: int = 3,
    since_days: int = 90,
) -> dict:
    events = await fetch_events(entity_type, event_type, since_days)
    if len(events) < min_cluster_size:
        return {"clusters_found": 0, "patterns": []}

    texts = [e["description"] for e in events]
    embeddings = embed_passages(texts)
    emb_matrix = np.array(embeddings)

    cos_sim = cosine_similarity(emb_matrix)
    distance_matrix = 1 - cos_sim

    clustering = DBSCAN(eps=0.3, min_samples=min_cluster_size, metric="precomputed")
    labels = clustering.fit_predict(distance_matrix)

    patterns = []
    for cluster_id in set(labels):
        if cluster_id == -1:
            continue
        cluster_events = [events[i] for i in range(len(events)) if labels[i] == cluster_id]
        label, description = await generate_pattern_label(cluster_events)
        patterns.append({
            "pattern_label": label,
            "description": description,
            "event_ids": [e["id"] for e in cluster_events],
            "subcontractor_ids": list(set(e["subcontractorId"] for e in cluster_events)),
            "frequency": len(cluster_events),
        })

    await upsert_patterns(patterns)
    return {"clusters_found": len(patterns), "patterns": patterns}


async def generate_pattern_label(events: list[dict]) -> tuple[str, str]:
    """LLM генерирует название и описание паттерна."""
    event_texts = "\n".join(
        f"- [{e.get('type', '?')}] {e['description']}" for e in events
    )
    prompt = f"""Дан список нарушений от разных подрядчиков. Выдели общий паттерн.

События:
{event_texts}

Верни JSON:
{{"label": "короткое название (3-7 слов)", "description": "развёрнутое описание (1-2 предложения)"}}"""
    # вызов LLM с JSON mode
    ...
```

### API-контракт

```
POST /api/ai/analyze/patterns
Content-Type: application/json

Request:
{
  "entity_type": "event",
  "event_type": "violation",
  "min_cluster_size": 3,
  "since_days": 90
}

Response 200:
{
  "status": "completed",
  "clusters_found": 4,
  "patterns": [
    {
      "id": 1,
      "pattern_label": "срыв сроков поставки материалов",
      "description": "Подрядчики систематически задерживают поставку материалов на 2-5 дней",
      "frequency": 7,
      "affected_subcontractors": [3, 7, 12],
      "first_seen": "2025-01-15",
      "last_seen": "2025-05-10",
      "suggested_checklist_item": "Контроль сроков поставки материалов"
    }
  ]
}
```

```
GET /api/ai/analyze/patterns?subcontractor_id=5
POST /api/ai/analyze/patterns/{pattern_id}/suggest  # Предложить паттерн в чек-лист
```

### Интеграция с RAG

Паттерны индексируются как `entity_type = "event_pattern"`. Ассистент отвечает: *«Какие типовые нарушения по электрике?» -> «Паттерн "некачественная сварка": 3 случая за 90 дней.»*

---

## 3. LLM-суммаризация

### Назначение

Автоматическое формирование текстовых сводок: тендерная справка, сводка по нарушениям, итоги опроса. Использует существующий LLM-провайдер.

### API

```
POST /api/ai/analyze/summarize
Content-Type: application/json

Request:
{
  "entity_type": "subcontractor",
  "entity_id": 5,
  "format": "tender",
  "include_sections": ["rating", "reviews", "events", "patterns"]
}

Response 200:
{
  "summary": "ООО «СтройМонтаж» — подрядчик по фундаментам...",
  "sections": ["rating", "reviews", "events"],
  "generated_at": "2025-05-22T12:00:00Z"
}
```

---

## 4. Конвейер аудио→текст→протокол (Audio-to-Text Pipeline)

> Полная спецификация жизненного цикла протоколов — в [meeting-protocols-v2.md](meeting-protocols-v2.md), раздел «AI Integration — Stage 3». Здесь — ML-составляющая.

### Назначение

Автоматическая расшифровка аудиозаписей совещаний и формирование черновика протокола для Stage 3 («Ведение протокола»).

### Архитектура конвейера

```
Аудиофайл (MP3/WAV/OGG)
  -> [Whisper] транскрибация (текст + таймкоды)
  -> [LLM] структурирование:
       - Повестка
       - Участники (по упоминаниям имён)
       - Принятые решения
       - Задачи (ответственный + срок)
  -> Черновик протокола (JSON, готовый к Stage 3)
```

### Выбор модели транскрибации

| Модель | Размер | Скорость (CPU) | Точность (RU WER) |
|--------|--------|----------------|---------------------|
| OpenAI Whisper API `whisper-1` | Cloud | ~2 мин/час | WER ~6% |
| `openai/whisper-small` | 461MB | ~0.3x RT | WER ~15% |
| `openai/whisper-medium` | 1.5GB | ~0.5x RT | WER ~10% |
| `nyrahealth/CrisperWhisper` | 1.2GB | ~0.5x RT | WER ~7% |

**Решение:**
- **Продакшен:** OpenAI Whisper API — минимальная задержка, $0.006/мин
- **Офлайн:** `openai/whisper-small` — CPU-only, 460MB RAM

### Реализация

```python
# assistant/src/analysis/audio_pipeline.py

from openai import OpenAI
from ..config import settings


async def transcribe_audio(audio_data: bytes, use_api: bool = True) -> dict:
    """Транскрибация аудио в текст с таймкодами."""
    if use_api:
        client = OpenAI(api_key=settings.llm_api_key, base_url=settings.llm_api_url)
        # временный файл -> Whisper API
        transcript = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            language="ru",
            response_format="verbose_json",
            timestamp_granularities=["segment"],
        )
        return {"text": transcript.text, "segments": [
            {"start": s.start, "end": s.end, "text": s.text}
            for s in transcript.segments
        ]}
    else:
        from transformers import pipeline
        pipe = pipeline("automatic-speech-recognition", model="openai/whisper-small",
                        chunk_length_s=30, return_timestamps=True)
        result = pipe(audio_data)
        return {"text": result["text"], "segments": result.get("chunks", [])}


async def transcript_to_protocol(transcript: dict, meeting_title: str,
                                  known_participants: list[str]) -> dict:
    """LLM структурирует расшифровку в формат протокола (agenda, decisions, tasks)."""
    prompt = f"""Расшифровка совещания «{meeting_title}».
Известные участники: {", ".join(known_participants)}.

Текст: {transcript["text"]}

Структурируй в JSON-протокол:
{{"agenda": "...", "attendees": [...], "decisions": [...],
  "tasks": [{{"description": "...", "assignee": "...", "deadline": "YYYY-MM-DD"}}], "notes": "..."}}"""
    return generate_structured(prompt)  # LLM вызов с JSON mode
```

### API-контракт

```
POST /api/ai/transcribe
Content-Type: multipart/form-data

Request:
  audio: <file.mp3>                  # аудиофайл (до 500MB, 4 часа)
  meeting_title: "Оперативное совещание ЖК Восток"
  meeting_id: 42                      # опционально — привязать к протоколу

Response 200:
{
  "status": "completed",
  "transcript": {
    "text": "Полный текст расшифровки...",
    "segments": [{"start": 0.0, "end": 12.5, "text": "Итак, начинаем..."}]
  },
  "protocol_draft": {
    "agenda": "Обсуждение сроков поставки...",
    "attendees": ["Иванов И.И.", "Смирнов А.А."],
    "decisions": ["Перенести поставку арматуры на 25 мая"],
    "tasks": [{"description": "Новый график поставок", "assignee": "Смирнов А.А.", "deadline": "2025-05-24"}],
    "notes": "Подрядчик СтройМонтаж отсутствовал"
  },
  "duration_seconds": 1847
}
```

### Интеграция в протоколы

Расшифровка и черновик передаются на Stage 3 (`PUT /api/meetings/:id/transition`). Делопроизводитель редактирует черновик и утверждает задачи. См. [meeting-protocols-v2.md](meeting-protocols-v2.md).

### Производительность

| Метод | 1 час аудио | Стоимость |
|-------|-------------|-----------|
| Whisper API | ~2 мин | $0.36 |
| Whisper-small (CPU) | ~3 часа | бесплатно |

---

## 5. Полный API-контракт ML-модулей

### Сводка эндпоинтов (порт 3002)

| Метод | Путь | Описание |
|-------|------|----------|
| `POST` | `/api/ai/ask` | RAG-вопрос (существующий) |
| `POST` | `/api/ai/reindex/{entity}` | Переиндексация сущности |
| `POST` | `/api/ai/reindex` | Полная переиндексация |
| `GET` | `/api/ai/health` | Health-check |
| **Новые:** | | |
| `POST` | `/api/ai/analyze/sentiment` | Анализ тональности |
| `GET` | `/api/ai/analyze/risk/{subcontractor_id}` | Оценка рисков |
| `POST` | `/api/ai/analyze/patterns` | Обнаружение паттернов |
| `GET` | `/api/ai/analyze/patterns?subcontractor_id=X` | Паттерны подрядчика |
| `POST` | `/api/ai/analyze/patterns/{id}/suggest` | Предложить в чек-лист |
| `POST` | `/api/ai/analyze/summarize` | LLM-суммаризация |
| `POST` | `/api/ai/transcribe` | Аудио -> текст + черновик |

### Pydantic-модели (ключевые)

```python
# assistant/src/api/analysis_models.py
from pydantic import BaseModel, Field

class SentimentRequest(BaseModel):
    entity_type: str = Field(..., pattern="^(review|comment|event)$")
    entity_ids: list[int] = Field(default_factory=list, max_length=100)
    subcontractor_id: int | None = None

class PatternDetectRequest(BaseModel):
    entity_type: str = "event"
    event_type: str | None = None
    min_cluster_size: int = Field(3, ge=2, le=10)
    since_days: int = Field(90, ge=1, le=365)

class SummarizeRequest(BaseModel):
    entity_type: str
    entity_id: int
    format: str = "brief"
    include_sections: list[str] = Field(default_factory=list)
```

### Интеграция в основной backend

Новые эндпоинты проксируются через `backend/src/routes/ai.ts`:

```typescript
// backend/src/routes/ai.ts (расширение)

aiRouter.post('/analyze/sentiment', requireAuth, async (req, res) => {
  const response = await fetch(`${AI_SERVICE_URL}/api/ai/analyze/sentiment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req.body),
  });
  res.status(response.status).json(await response.json());
});
// Аналогично для patterns, summarize, transcribe...
```

---

## 6. Переменные окружения

К существующим переменным `assistant/` добавляются:

| Переменная | По умолчанию | Описание |
|------------|-------------|----------|
| `SENTIMENT_MODEL` | `blanchefort/rubert-base-cased-sentiment` | Модель тональности |
| `WHISPER_MODEL` | `openai/whisper-small` | Модель транскрибации (локальная) |
| `WHISPER_USE_API` | `true` | Использовать OpenAI API вместо локальной |
| `PATTERN_MIN_CLUSTER` | `3` | Минимальный размер кластера |
| `PATTERN_DETECTION_SCHEDULE` | `0 3 * * 1` | Cron: еженедельный запуск |
| `LLM_API_KEY` | required | API-ключ (OpenAI или совместимый) |

---

## 7. Развёртывание

### Docker Compose (расширение)

```yaml
services:
  assistant:
    build: ./assistant
    ports:
      - "3002:3002"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@pg:5432/master_notepad
      - MAIN_API_URL=http://backend:3001
      - LLM_API_URL=https://api.openai.com/v1
      - LLM_API_KEY=${LLM_API_KEY}
      - LLM_MODEL=gpt-4o-mini
      - EMBEDDING_MODEL=intfloat/multilingual-e5-base
      - SENTIMENT_MODEL=blanchefort/rubert-base-cased-sentiment
      - WHISPER_MODEL=openai/whisper-small
      - WHISPER_USE_API=true
      - PORT=3002
    volumes:
      - model_cache:/root/.cache/huggingface
    deploy:
      resources:
        limits:
          memory: 3G
        reservations:
          memory: 1.5G
    restart: unless-stopped

volumes:
  model_cache:
```

### Рекомендации по памяти

| Конфигурация | Модели в памяти | RAM |
|-------------|-----------------|-----|
| Минимальная | embedding + sentiment-tiny | 800MB |
| Стандартная | embedding + sentiment + whisper-small | 1.5GB |
| Максимальная | embedding + sentiment + whisper-medium | 2.5GB |

При использовании Whisper API и sentiment-tiny: <1GB.

---

## 8. Стратегия тестирования

### Модульные тесты

```python
# tests/analysis/test_sentiment.py

def test_sentiment_positive():
    result = analyze_sentiment("Отличный подрядчик, всё сделали в срок!")
    assert result["label"] == "positive"
    assert result["score"] > 0.8

def test_sentiment_negative():
    result = analyze_sentiment("Сорвали все сроки, ужасное качество!")
    assert result["label"] == "negative"


# tests/analysis/test_patterns.py

def test_pattern_detection_min_cluster():
    events = create_mock_events([
        "срыв сроков поставки арматуры",
        "задержка поставки арматуры на 5 дней",
        "сорвали срок поставки арматуры",
        "некачественная гидроизоляция",  # другой паттерн — один
    ])
    patterns = detect_patterns_sync(events, min_cluster_size=3)
    assert len(patterns) == 1
    assert "арматур" in patterns[0]["pattern_label"].lower()


# tests/analysis/test_audio.py

def test_whisper_transcription():
    audio = load_test_audio("meeting_sample.mp3")
    result = transcribe_audio(audio, use_api=False)
    assert len(result["text"]) > 100
    assert len(result["segments"]) > 0
```

### Интеграционные тесты

```python
# tests/api/test_analyze_endpoints.py
import pytest
from httpx import AsyncClient, ASGITransport
from assistant.src.main import app

@pytest.mark.anyio
async def test_sentiment_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/ai/analyze/sentiment", json={
            "entity_type": "review", "entity_ids": [1, 2],
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "completed"

@pytest.mark.anyio
async def test_risk_endpoint():
    ...
```

### Критерии приёмки

| Критерий | Значение |
|----------|----------|
| Sentiment accuracy (F1, 3 класса) | >= 0.85 |
| Pattern precision@3 | >= 0.7 (3/5 паттернов валидны) |
| Whisper WER (русский, стройка) | <= 12% |
| Время ответа `/analyze/sentiment` (10 текстов) | <= 1.5s |
| Потребление RAM (все модели) | <= 3GB |

---

## 9. Статус реализации

| Компонент | Статус |
|-----------|--------|
| RAG-ассистент (чат) | ✅ Реализован |
| Sentiment Analysis | 🔜 Планируется |
| Pattern Detection | 🔜 Планируется |
| LLM Summarization | 🔜 Планируется |
| Audio-to-Text Pipeline | 🔜 Планируется |

---

## Связанные документы

- [AI Ассистент — Технический дизайн](assistant.md) — базовый RAG-ассистент, pgvector-схема, API `/ask`
- [AI Ассистент — Продуктовое описание](../product/assistant.md)
- [Протоколы v2](meeting-protocols-v2.md) — интеграция audio->text в Stage 3
- [Архитектура системы](architecture.md) — общая архитектура и API
- [Development Setup](development.md) — запуск ML-сервисов локально
