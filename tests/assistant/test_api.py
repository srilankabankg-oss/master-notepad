from httpx import ASGITransport, AsyncClient
import pytest


@pytest.mark.asyncio
async def test_health():
    from src.main import app
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        r = await client.get("/api/ai/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"