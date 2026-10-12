"""IChangeRequestRepository."""

from __future__ import annotations

from abc import ABC, abstractmethod

from .entity import ChangeRequest, ChangeStatus


class IChangeRequestRepository(ABC):
    @abstractmethod
    async def create(self, request: ChangeRequest) -> ChangeRequest: ...

    @abstractmethod
    async def get(self, change_request_id: int) -> ChangeRequest | None: ...

    @abstractmethod
    async def list(self, status: ChangeStatus | None = None) -> list[ChangeRequest]: ...

    @abstractmethod
    async def save(self, request: ChangeRequest) -> ChangeRequest: ...
