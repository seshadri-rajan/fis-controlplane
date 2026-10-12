"""Session verification and role checks for /api/ui."""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, Request, status

from ...config.settings import Settings
from ...domain.modules.identity.entity import CurrentUser, Role

SESSION_USER = "user"
SESSION_ROLES = "roles"
SESSION_ISSUED = "issued_at"
SESSION_SEEN = "last_seen"
SESSION_MUST_CHANGE = "must_change_password"


def establish(request: Request, user_name: str, roles: set[Role], must_change: bool) -> None:
    now = datetime.now(UTC).timestamp()
    request.session.clear()
    request.session.update(
        {
            SESSION_USER: user_name,
            SESSION_ROLES: sorted(r.value for r in roles),
            SESSION_ISSUED: now,
            SESSION_SEEN: now,
            SESSION_MUST_CHANGE: must_change,
        }
    )


def destroy(request: Request) -> None:
    request.session.clear()


def read_session(request: Request, settings: Settings) -> CurrentUser:
    user_name = request.session.get(SESSION_USER)
    if not user_name:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "not authenticated")

    now = datetime.now(UTC)
    issued = datetime.fromtimestamp(request.session.get(SESSION_ISSUED, 0), UTC)
    seen = datetime.fromtimestamp(request.session.get(SESSION_SEEN, 0), UTC)

    if now - issued > timedelta(minutes=settings.session_absolute_minutes):
        request.session.clear()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "session expired")
    if now - seen > timedelta(minutes=settings.session_idle_minutes):
        request.session.clear()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "session idle timeout")

    request.session[SESSION_SEEN] = now.timestamp()
    return CurrentUser(
        user_name=user_name,
        roles=frozenset(Role(r) for r in request.session.get(SESSION_ROLES, [])),
        must_change_password=bool(request.session.get(SESSION_MUST_CHANGE, False)),
    )


def require(*allowed: Role) -> Callable[[CurrentUser], CurrentUser]:
    """Role guard. ADMIN passes everywhere by definition of the role (RECORD 11.4)."""

    def guard(user: CurrentUser) -> CurrentUser:
        if not user.has_any(*allowed, Role.ADMIN):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"requires one of: {', '.join(sorted(r.value for r in allowed))}",
            )
        return user

    return guard
