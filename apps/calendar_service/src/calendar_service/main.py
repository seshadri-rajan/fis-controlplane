"""FastAPI application assembly: routers, middleware, lifespan."""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from http import HTTPStatus

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from .api.v1.calendars import router as calendars_router
from .api.v1.run_history import router as run_history_router
from .config.settings import get_settings
from .infra.database.management import ManagementBase
from .infra.database.session import get_engine
from .infra.security.oauth import build_verifier

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    application.state.token_verifier = build_verifier(settings)
    if not settings.auth_enabled:
        logger.warning("Calendar authentication is disabled. Use only for local development.")
    engine = get_engine()
    try:
        if settings.auto_create_schema:
            async with engine.begin() as connection:
                await connection.run_sync(ManagementBase.metadata.create_all)
        yield
    finally:
        await engine.dispose()


app = FastAPI(title="Calendar Management API", version="1.0.0", lifespan=lifespan)
app.include_router(calendars_router)
app.include_router(run_history_router)


@app.exception_handler(HTTPException)
async def http_error(_: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        {
            "status": str(exc.status_code),
            "error": HTTPStatus(exc.status_code).phrase,
            "message": exc.detail,
        },
        status_code=exc.status_code,
        headers=exc.headers,
    )


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
    details = []
    for error in exc.errors():
        field = ""
        for item in error["loc"][1:]:
            field += f"[{item}]" if isinstance(item, int) else f".{item}"
        details.append({"field": field.lstrip(".") or "request", "message": error["msg"]})
    return JSONResponse(
        {
            "status": "400",
            "error": "Bad Request",
            "message": "Request validation failed.",
            "details": details,
        },
        status_code=400,
    )


@app.exception_handler(Exception)
async def unexpected_error(_: Request, exc: Exception) -> JSONResponse:
    logger.error("Unexpected Calendar Management API error", exc_info=exc)
    return JSONResponse(
        {
            "status": "500",
            "error": "Internal Server Error",
            "message": "An unexpected server error occurred.",
        },
        status_code=500,
    )


def _management_openapi() -> dict:
    from fastapi.openapi.utils import get_openapi

    if app.openapi_schema is None:
        schema = get_openapi(title=app.title, version=app.version, routes=app.routes)
        for path, operations in schema["paths"].items():
            if path.startswith("/v1/"):
                for operation in operations.values():
                    operation["responses"].pop("422", None)
        schemas = schema["components"]["schemas"]
        schemas.pop("HTTPValidationError", None)
        app.openapi_schema = schema
    return app.openapi_schema


app.openapi = _management_openapi


@app.get("/health", tags=["ops"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
