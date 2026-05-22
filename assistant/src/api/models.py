from pydantic import BaseModel, Field


class AskRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    subcontractor_id: int | None = Field(None, ge=1)
    entity_types: list[str] | None = Field(
        None,
        description="Filter by entity types: review, comment, meeting, event, checklist, survey, subcontractor",
    )
    limit: int = Field(5, ge=1, le=20)


class Source(BaseModel):
    entity_type: str
    entity_id: int
    content: str
    score: float
    metadata: dict | None = None


class AskResponse(BaseModel):
    answer: str
    sources: list[Source]
    confidence: float


class ReindexEntityRequest(BaseModel):
    entity_id: int = Field(..., ge=1)


class ReindexEntityResponse(BaseModel):
    status: str = "accepted"
    entity_type: str
    entity_id: int
    message: str = "Reindex scheduled"


class ReindexAllResponse(BaseModel):
    status: str = "ok"
    indexed: dict[str, int]


class HealthResponse(BaseModel):
    status: str = "ok"
    embedding_model: str
    llm_model: str