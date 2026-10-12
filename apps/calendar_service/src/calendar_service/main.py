"""FastAPI application assembly: routers, middleware, lifespan."""

import logging
import secrets
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from starlette.middleware.sessions import SessionMiddleware

from .api.ui.auth import router as auth_router
from .api.ui.calendars import router as calendars_router
from .api.ui.preview import router as preview_router
from .config.settings import get_settings
from .infra.database.session import create_all

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    if not settings.session_secret:
        logger.warning(
            "CALENDAR_SESSION_SECRET is unset: using a per-process key, so sessions will not "
            "survive a restart and will not work across replicas. Set it before deployment."
        )
    if settings.auto_create_schema:
        await create_all()
    yield


app = FastAPI(title="Calendar Service", version="0.1.0", lifespan=lifespan)

_settings = get_settings()
app.add_middleware(
    SessionMiddleware,
    secret_key=_settings.session_secret or secrets.token_urlsafe(32),
    session_cookie="calendar_session",
    max_age=_settings.session_absolute_minutes * 60,
    https_only=_settings.session_cookie_secure,
    same_site="lax",
)

app.include_router(auth_router)
app.include_router(preview_router)
app.include_router(calendars_router)


@app.get("/health", tags=["ops"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
