"""ChangeRequest entity: the proposed payload plus maker identity."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from typing import Any


class ChangeStatus(StrEnum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class ChangeAction(StrEnum):
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    DELETE = "DELETE"


@dataclass(slots=True)
class ChangeRequest:
    entity: str
    action: ChangeAction
    payload: dict[str, Any]
    maker: str
    change_request_id: int | None = None
    entity_key: int | None = None
    status: ChangeStatus = ChangeStatus.PENDING
    made_at: datetime | None = None
    checker: str | None = None
    checked_at: datetime | None = None
    reject_reason: str | None = None
