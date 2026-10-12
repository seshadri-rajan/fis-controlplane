"""SQLAlchemy implementation of the user repository."""

from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from ....domain.modules.identity.entity import Role, User
from ....domain.modules.identity.repository import IUserRepository
from ..models import AppUser, Role as RoleModel, UserRole, as_utc


class UserRepository(IUserRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_name(self, user_name: str) -> User | None:
        row = (
            await self._session.scalars(select(AppUser).where(AppUser.user_name == user_name))
        ).one_or_none()
        if row is None:
            return None

        roles = (
            await self._session.scalars(
                select(RoleModel.role_name)
                .join(UserRole, UserRole.role_id == RoleModel.role_id)
                .where(UserRole.user_id == row.user_id)
            )
        ).all()

        return User(
            user_id=row.user_id,
            user_name=row.user_name,
            user_email=row.user_email,
            first_name=row.first_name,
            last_name=row.last_name,
            status=row.status,
            roles={Role(name) for name in roles},
            password_hash=row.password_hash,
            failed_login_count=row.failed_login_count,
            locked_until=as_utc(row.locked_until),
            must_change_password=row.must_change_password,
        )

    async def create(self, user: User, password_hash: str) -> User:
        row = AppUser(
            user_name=user.user_name,
            user_email=user.user_email,
            first_name=user.first_name,
            last_name=user.last_name,
            status=user.status,
            password_hash=password_hash,
            must_change_password=user.must_change_password,
            created_by=user.user_name,
        )
        self._session.add(row)
        await self._session.flush()
        user.user_id = row.user_id

        if user.roles:
            await self.assign_roles(user.user_name, user.roles, user.user_name)
        return user

    async def save_login_state(self, user: User) -> None:
        assert user.user_id is not None
        row = await self._session.get(AppUser, user.user_id)
        if row is None:
            raise LookupError(user.user_id)
        row.failed_login_count = user.failed_login_count
        row.locked_until = user.locked_until
        await self._session.flush()

    async def set_password(self, user_name: str, password_hash: str) -> None:
        row = (
            await self._session.scalars(select(AppUser).where(AppUser.user_name == user_name))
        ).one_or_none()
        if row is None:
            raise LookupError(user_name)
        row.password_hash = password_hash
        row.must_change_password = False
        await self._session.flush()

    async def assign_roles(self, user_name: str, roles: set[Role], actor: str) -> None:
        row = (
            await self._session.scalars(select(AppUser).where(AppUser.user_name == user_name))
        ).one_or_none()
        if row is None:
            raise LookupError(user_name)

        await self._session.execute(delete(UserRole).where(UserRole.user_id == row.user_id))
        for role in roles:
            role_id = (
                await self._session.scalars(
                    select(RoleModel.role_id).where(RoleModel.role_name == role.value)
                )
            ).one_or_none()
            if role_id is None:
                raise LookupError(f"role {role.value} is not seeded")
            self._session.add(
                UserRole(user_id=row.user_id, role_id=role_id, created_by=actor)
            )
        await self._session.flush()
