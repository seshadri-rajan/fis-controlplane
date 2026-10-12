"""User and Role entities. Hashing lives in infra/security, not here."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum


class Role(StrEnum):
    VIEWER = "VIEWER"
    ADMIN = "ADMIN"
    CREATE = "CREATE"
    APPROVER = "APPROVER"


ROLE_DESCRIPTIONS = {
    Role.VIEWER: "Read-only access",
    Role.ADMIN: "Create, update, delete and approve",
    Role.CREATE: "Create, update and delete calendars",
    Role.APPROVER: "Verify four-eyes operations on calendar records",
}


@dataclass(slots=True)
class User:
    user_name: str
    user_email: str
    user_id: int | None = None
    first_name: str | None = None
    last_name: str | None = None
    status: str = "ACTIVE"
    roles: set[Role] = field(default_factory=set)
    password_hash: str | None = None
    failed_login_count: int = 0
    locked_until: datetime | None = None
    must_change_password: bool = True

    @property
    def is_active(self) -> bool:
        return self.status == "ACTIVE"

    def is_locked(self, now: datetime) -> bool:
        return self.locked_until is not None and self.locked_until > now


@dataclass(frozen=True, slots=True)
class CurrentUser:
    """The authenticated caller, as carried through a request."""

    user_name: str
    roles: frozenset[Role]
    must_change_password: bool = False

    def has_any(self, *roles: Role) -> bool:
        return bool(self.roles.intersection(roles))
