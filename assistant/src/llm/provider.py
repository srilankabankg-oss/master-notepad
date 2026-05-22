from openai import OpenAI

from ..config import settings

_system_prompt = (
    "Ты — AI-ассистент системы управления подрядчиками Master Notepad. "
    "Твоя задача — отвечать на вопросы сотрудников строительной организации, "
    "используя ТОЛЬКО переданный контекст из базы данных системы. "
    "Если в контексте недостаточно информации для ответа — честно скажи об этом. "
    "Не выдумывай факты. Отвечай на русском языке, кратко и по делу. "
    "Если в контексте есть ссылки на конкретные записи — упоминай их в ответе."
)


def build_prompt(question: str, sources: list[dict]) -> list[dict]:
    context_parts: list[str] = []
    for i, src in enumerate(sources, 1):
        entity = src.get("entity_type", "?")
        content = src.get("content", "")
        meta = src.get("metadata", {})
        date = meta.get("date", "")
        rating = meta.get("rating", "")
        extra = f" (дата: {date})" if date else ""
        extra += f" (оценка: {rating}/10)" if rating else ""
        context_parts.append(f"[{i}] {entity}{extra}:\n{content}")

    context = "\n\n".join(context_parts)

    return [
        {"role": "system", "content": _system_prompt},
        {
            "role": "user",
            "content": f"Контекст из базы данных:\n\n{context}\n\nВопрос: {question}",
        },
    ]


def generate(question: str, sources: list[dict]) -> tuple[str, float]:
    client = OpenAI(
        api_key=settings.llm_api_key,
        base_url=settings.llm_api_url,
    )

    messages = build_prompt(question, sources)

    response = client.chat.completions.create(
        model=settings.llm_model,
        messages=messages,
        temperature=0.3,
        max_tokens=1024,
    )

    answer = response.choices[0].message.content or ""
    confidence = 1.0
    if sources:
        confidence = min(1.0, sum(s.get("score", 0) for s in sources) / len(sources))

    return answer, confidence