from __future__ import annotations
import struct
from typing import Any

from pgvector.psycopg import register_vector_async
import psycopg
from psycopg.rows import dict_row

from ..config import settings


class VectorStore:
    def __init__(self) -> None:
        self._conn: psycopg.AsyncConnection | None = None

    async def connect(self) -> None:
        self._conn = await psycopg.AsyncConnection.connect(
            settings.database_url,
            row_factory=dict_row,
            autocommit=True,
        )
        async with self._conn.cursor() as cur:
            await cur.execute("CREATE EXTENSION IF NOT EXISTS vector")
        await self._conn.execute("SELECT 1")
        await register_vector_async(self._conn)

    async def close(self) -> None:
        if self._conn:
            await self._conn.close()

    async def ensure_schema(self) -> None:
        assert self._conn
        async with self._conn.cursor() as cur:
            await cur.execute("""
                CREATE TABLE IF NOT EXISTS embeddings (
                    id SERIAL PRIMARY KEY,
                    entity_type VARCHAR(50) NOT NULL,
                    entity_id INTEGER NOT NULL,
                    chunk_index SMALLINT DEFAULT 0,
                    content TEXT NOT NULL,
                    embedding VECTOR(768),
                    metadata JSONB DEFAULT '{}',
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)
            await cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_embeddings_hnsw
                ON embeddings USING hnsw (embedding vector_cosine_ops)
                WITH (m = 16, ef_construction = 200)
            """)

    async def upsert(
        self,
        entity_type: str,
        entity_id: int,
        chunks: list[tuple[int, str, list[float], dict[str, Any]]],
    ) -> None:
        assert self._conn
        await self._conn.execute(
            "DELETE FROM embeddings WHERE entity_type = %s AND entity_id = %s",
            (entity_type, entity_id),
        )
        for chunk_index, content, embedding, metadata in chunks:
            vec = _pack_f32_vec(embedding)
            await self._conn.execute(
                """
                INSERT INTO embeddings (entity_type, entity_id, chunk_index, content, embedding, metadata)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (entity_type, entity_id, chunk_index, content, vec, metadata),
            )

    async def search(
        self,
        embedding: list[float],
        entity_types: list[str] | None = None,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        assert self._conn
        vec = _pack_f32_vec(embedding)
        if entity_types:
            rows = await self._conn.execute(
                """
                SELECT id, entity_type, entity_id, chunk_index, content, metadata,
                       1 - (embedding <=> %s) AS score
                FROM embeddings
                WHERE entity_type = ANY(%s)
                ORDER BY embedding <=> %s
                LIMIT %s
                """,
                (vec, entity_types, vec, limit),
            )
        else:
            rows = await self._conn.execute(
                """
                SELECT id, entity_type, entity_id, chunk_index, content, metadata,
                       1 - (embedding <=> %s) AS score
                FROM embeddings
                ORDER BY embedding <=> %s
                LIMIT %s
                """,
                (vec, vec, limit),
            )
        return await rows.fetchall()


def _pack_f32_vec(values: list[float]) -> str:
    return "[" + ",".join(str(v) for v in values) + "]"


vector_store = VectorStore()