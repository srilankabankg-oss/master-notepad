from fastapi import APIRouter

from .models import AskRequest, AskResponse, Source
from ..rag.retriever import hybrid_search
from ..llm.provider import generate
from ..config import settings

router = APIRouter()


@router.post("/ask", response_model=AskResponse)
async def ask(req: AskRequest) -> AskResponse:
    entity_types = req.entity_types
    if req.subcontractor_id and not entity_types:
        entity_types = ["review", "comment", "event", "meeting", "checklist", "survey", "subcontractor"]

    results = await hybrid_search(req.question, entity_types, req.limit)
    answer, confidence = generate(req.question, results)

    sources = [
        Source(
            entity_type=r["entity_type"],
            entity_id=r["entity_id"],
            content=r["content"],
            score=r["score"],
            metadata=r.get("metadata"),
        )
        for r in results
    ]

    return AskResponse(answer=answer, sources=sources, confidence=confidence)