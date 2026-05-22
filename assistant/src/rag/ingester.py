import httpx

from ..config import settings
from ..db.vector_store import vector_store
from .embedder import embed_passages

ENTITY_ENDPOINTS: dict[str, str] = {
    "subcontractor": "/api/subcontractors",
    "review": "/api/reviews",
    "comment": "/api/comments",
    "checklist": "/api/checklists",
    "meeting": "/api/meetings",
    "survey": "/api/surveys",
    "event": "/api/events",
}

_entity_to_type: dict[str, str] = {
    "subcontractors": "subcontractor",
    "reviews": "review",
    "comments": "comment",
    "checklists": "checklist",
    "meetings": "meeting",
    "surveys": "survey",
    "events": "event",
}


async def reindex_entity(entity_type: str, entity_id: int) -> None:
    endpoint = ENTITY_ENDPOINTS.get(entity_type)
    if not endpoint:
        return

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(f"{settings.main_api_url}{endpoint}/{entity_id}")
        if resp.status_code != 200:
            return
        data = resp.json()

    chunks = _chunk_entity(entity_type, data)
    if not chunks:
        return

    passages = [c[1] for c in chunks]
    embeddings = embed_passages(passages)
    full_chunks = [
        (c[0], c[1], emb, c[2]) for c, emb in zip(chunks, embeddings)
    ]
    await vector_store.upsert(entity_type, entity_id, full_chunks)


async def reindex_all() -> dict[str, int]:
    counts: dict[str, int] = {}
    async with httpx.AsyncClient(timeout=60) as client:
        for entity_type, endpoint in ENTITY_ENDPOINTS.items():
            resp = await client.get(f"{settings.main_api_url}{endpoint}")
            if resp.status_code != 200:
                continue
            items = resp.json()
            table_type = _entity_to_type.get(endpoint.strip("/").rsplit("/", 1)[-1], entity_type)
            for item in items:
                item_id = item.get("id")
                if not item_id:
                    continue
                chunks = _chunk_entity(entity_type, item)
                if not chunks:
                    continue
                passages = [c[1] for c in chunks]
                embeddings = embed_passages(passages)
                full_chunks = [
                    (c[0], c[1], emb, c[2]) for c, emb in zip(chunks, embeddings)
                ]
                await vector_store.upsert(entity_type, item_id, full_chunks)
                counts[entity_type] = counts.get(entity_type, 0) + 1
    return counts


def _chunk_entity(
    entity_type: str, data: dict
) -> list[tuple[int, str, dict]]:
    chunks: list[tuple[int, str, dict]] = []

    meta = {
        "date": data.get("createdAt") or data.get("eventDate") or data.get("created_at", ""),
        "subcontractor_id": data.get("subcontractorId") or data.get("subcontractor_id"),
        "employee_id": data.get("employeeId") or data.get("employee_id"),
    }

    if entity_type in ("review", "comment", "event", "subcontractor"):
        text = data.get("content") or data.get("description") or data.get("name", "")
        if entity_type == "subcontractor":
            text = f"{data.get('name', '')} — {data.get('specialization', '')}"
        if entity_type == "event":
            text = f"[{data.get('type', '')}] {text}"
        if entity_type == "review":
            meta["rating"] = data.get("rating")
        if text.strip():
            chunks.append((0, text.strip(), meta))

    elif entity_type == "meeting":
        for label, key in [("agenda", "agenda"), ("decisions", "decisions"), ("notes", "notes")]:
            text = data.get(key, "")
            if text and text.strip():
                chunks.append((len(chunks), f"[{label}] {text.strip()}", meta))

    elif entity_type == "survey":
        questions = data.get("questions", [])
        if isinstance(questions, list):
            text = " | ".join(str(q) for q in questions)
            if text.strip():
                chunks.append((0, text, meta))
        elif isinstance(questions, str):
            if questions.strip():
                chunks.append((0, questions, meta))

    elif entity_type == "checklist":
        text = data.get("title", "") or data.get("name", "")
        items = data.get("items", [])
        if isinstance(items, list):
            text += "\n" + "\n".join(f"- {i}" for i in items)
        if text.strip():
            chunks.append((0, text, meta))

    return chunks