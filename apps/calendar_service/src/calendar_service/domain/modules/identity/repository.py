"""IUserRepository, IRoleRepository."""

from __future__ import annotations

from abc import ABC, abstractmethod

from .entity import Role, User


class IUserRepository(ABC):
    @abstractmethod
    async def get_by_name(self, user_name: str) -> User | None: ...

    @abstractmethod
    async def create(self, user: User, password_hash: str) -> User: ...

    @abstractmethod
    async def save_login_state(self, user: User) -> None: ...

    @abstractmethod
    async def set_password(self, user_name: str, password_hash: str) -> None: ...

    @abstractmethod
    async def assign_roles(self, user_name: str, roles: set[Role], actor: str) -> None: ...
