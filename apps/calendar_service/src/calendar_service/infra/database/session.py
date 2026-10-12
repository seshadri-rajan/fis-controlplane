"""Async engine and session factory."""

from __future__ import annotations

from collections.abc import AsyncIterator
from functools import lru_cache

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from ...config.settings import get_settings
from .models import Base


@lru_cache
def get_engine() -> AsyncEngine:
    settings = get_settings()
    return create_async_engine(settings.db_url, echo=settings.db_echo, future=True)


@lru_cache
def get_session_factory() -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(get_engine(), expire_on_commit=False)


async def session_scope() -> AsyncIterator[AsyncSession]:
    async with get_session_factory()() as session:
        yield session


async def create_all() -> None:
    """Development convenience only; deployed environments use Alembic."""
    async with get_engine().begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
