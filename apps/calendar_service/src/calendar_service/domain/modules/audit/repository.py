"""IAuditRepository."""

from __future__ import annotations

from abc import ABC, abstractmethod

from .entity import AuditEntry


class IAuditRepository(ABC):
    @abstractmethod
    async def record(self, entry: AuditEntry) -> None: ...

    @abstractmethod
    async def list_for(self, entity: str, entity_key: int | None = None) -> list[AuditEntry]: ...
