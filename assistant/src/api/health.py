from fastapi import APIRouter

from .models import HealthResponse
from ..config import settings

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        embedding_model=settings.embedding_model,
        llm_model=settings.llm_model,
    )