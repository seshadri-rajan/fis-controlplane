"""Authentication and account operations over the user repository."""

from __future__ import annotations

from datetime import UTC, datetime

from ...domain.modules.audit.entity import ENTITY_USER_ROLE, AuditEntry
from ...domain.modules.audit.repository import IAuditRepository
from ...domain.modules.identity.entity import Role, User
from ...domain.modules.identity.password_policy import PasswordPolicy
from ...domain.modules.identity.repository import IUserRepository
from ..security.password import hash_password, verify_password


class AuthenticationError(Exception):
    pass


class AccountLockedError(AuthenticationError):
    pass


class IdentityService:
    def __init__(
        self,
        users: IUserRepository,
        audit: IAuditRepository,
        policy: PasswordPolicy,
    ) -> None:
        self._users = users
        self._audit = audit
        self._policy = policy

    async def authenticate(self, user_name: str, password: str) -> User:
        now = datetime.now(UTC)
        user = await self._users.get_by_name(user_name)

        if user is None:
            # Hash anyway so a missing account is not distinguishable by timing.
            verify_password(None, password)
            raise AuthenticationError("invalid credentials")

        if user.is_locked(now):
            raise AccountLockedError("account is temporarily locked")

        if not user.is_active or not verify_password(user.password_hash, password):
            self._policy.register_failure(user, now)
            await self._users.save_login_state(user)
            raise AuthenticationError("invalid credentials")

        self._policy.register_success(user)
        await self._users.save_login_state(user)
        return user

    async def change_password(self, user_name: str, current: str, new: str) -> None:
        user = await self.authenticate(user_name, current)
        self._policy.validate(new, user_name=user_name)
        if verify_password(user.password_hash, new):
            raise ValueError("new password must differ from the current one")
        await self._users.set_password(user_name, hash_password(new))

    async def create_user(
        self, user: User, password: str, actor: str, *, must_change_password: bool = True
    ) -> User:
        self._policy.validate(password, user_name=user.user_name)
        user.must_change_password = must_change_password
        created = await self._users.create(user, hash_password(password))

        await self._audit.record(
            AuditEntry(
                entity=ENTITY_USER_ROLE,
                entity_key=created.user_id,
                action="CREATE",
                new_value={
                    "user_name": created.user_name,
                    "roles": sorted(r.value for r in created.roles),
                },
                updated_by=actor,
            )
        )
        return created

    async def assign_roles(self, user_name: str, roles: set[Role], actor: str) -> None:
        existing = await self._users.get_by_name(user_name)
        if existing is None:
            raise LookupError(user_name)

        await self._users.assign_roles(user_name, roles, actor)
        await self._audit.record(
            AuditEntry(
                entity=ENTITY_USER_ROLE,
                entity_key=existing.user_id,
                action="UPDATE",
                old_value={"roles": sorted(r.value for r in existing.roles)},
                new_value={"roles": sorted(r.value for r in roles)},
                updated_by=actor,
            )
        )
