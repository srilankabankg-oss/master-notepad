from __future__ import annotations
from contextlib import asynccontextmanager

from fastapi import FastAPI

from .config import settings
from .db.vector_store import vector_store
from .api.ask import router as ask_router
from .api.reindex import router as reindex_router
from .api.health import router as health_router


@asynccontextmanager
async def lifespan(application: FastAPI):
    await vector_store.connect()
    await vector_store.ensure_schema()
    yield
    await vector_store.close()


app = FastAPI(
    title="Master Notepad — AI Assistant",
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(ask_router, prefix="/api/ai")
app.include_router(reindex_router, prefix="/api/ai")
app.include_router(health_router, prefix="/api/ai")