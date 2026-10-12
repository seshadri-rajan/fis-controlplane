"""Audit entry: what changed, who changed it, and when."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any

ENTITY_CALENDAR = "CALENDAR"
ENTITY_CHANGE_REQUEST = "CHANGE_REQUEST"
ENTITY_USER_ROLE = "USER_ROLE"
ENTITY_API_CLIENT = "API_CLIENT"


@dataclass(slots=True)
class AuditEntry:
    entity: str
    action: str
    updated_by: str
    audit_key: int | None = None
    entity_key: int | None = None
    old_value: dict[str, Any] | None = None
    new_value: dict[str, Any] | None = None
    updated_at: datetime | None = None
