import os
import tempfile

# Throwaway file-based SQLite so tables persist across connections in tests.
_db_fd, _db_path = tempfile.mkstemp(suffix=".sqlite")
os.environ.setdefault("DATABASE_URL", f"sqlite+aiosqlite:///{_db_path}")
os.environ.setdefault("SESSION_SECRET", "test-session-secret")
os.environ.setdefault("APP_SECRET_KEY", "test-app-secret-key")
os.environ.setdefault("EVIDENCE_DIR", tempfile.mkdtemp(prefix="evidence-"))

import pytest_asyncio
from httpx import ASGITransport, AsyncClient

import app.models  # noqa: F401  (register all models)
from app.core.db import engine
from app.main import app
from app.models.base import Base


@pytest_asyncio.fixture(autouse=True)
async def _schema():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
