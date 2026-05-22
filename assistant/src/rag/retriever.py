from __future__ import annotations
from ..db.vector_store import vector_store
from .embedder import embed_query

BM25_WEIGHT = 0.3
SEMANTIC_WEIGHT = 0.7


async def retrieve(
    question: str,
    entity_types: list[str] | None = None,
    limit: int = 10,
) -> list[dict]:
    query_embedding = embed_query(question)
    results = await vector_store.search(query_embedding, entity_types, limit)
    return results


async def hybrid_search(
    question: str,
    entity_types: list[str] | None = None,
    limit: int = 10,
) -> list[dict]:
    results = await retrieve(question, entity_types, limit * 2)

    reranked: list[dict] = []
    seen: set[tuple[str, int]] = set()
    for r in results:
        key = (r["entity_type"], r["entity_id"])
        if key not in seen:
            seen.add(key)
            reranked.append(r)
        if len(reranked) >= limit:
            break

    return reranked