import asyncio

from fastapi import APIRouter

from .models import ReindexEntityRequest, ReindexEntityResponse, ReindexAllResponse
from ..rag.ingester import reindex_entity, reindex_all

router = APIRouter()


@router.post("/reindex/{entity_type}", response_model=ReindexEntityResponse)
async def reindex_one(entity_type: str, req: ReindexEntityRequest) -> ReindexEntityResponse:
    asyncio.create_task(reindex_entity(entity_type, req.entity_id))
    return ReindexEntityResponse(
        entity_type=entity_type,
        entity_id=req.entity_id,
    )


@router.post("/reindex", response_model=ReindexAllResponse)
async def reindex_full() -> ReindexAllResponse:
    counts = await reindex_all()
    return ReindexAllResponse(indexed=counts)