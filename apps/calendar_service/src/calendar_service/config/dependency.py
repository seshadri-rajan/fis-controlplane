"""Dependency injection container.

The only place that knows both domain interfaces and infra implementations. Keeping the wiring
here is what lets domain/ stay framework-free.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ..api.middlewares.session_auth import read_session, require
from ..domain.modules.identity.entity import CurrentUser, Role
from ..domain.modules.identity.password_policy import PasswordPolicy
from ..infra.database.repositories.audit import AuditRepository
from ..infra.database.repositories.calendar import CalendarRepository, HolidayRepository
from ..infra.database.repositories.change_request import ChangeRequestRepository
from ..infra.database.repositories.user import UserRepository
from ..infra.database.session import session_scope
from ..infra.services.calendar_service import CalendarService
from ..infra.services.identity_service import IdentityService
from .settings import Settings, get_settings

SettingsDep = Annotated[Settings, Depends(get_settings)]
SessionDep = Annotated[AsyncSession, Depends(session_scope)]


def get_current_user(request: Request, settings: SettingsDep) -> CurrentUser:
    return read_session(request, settings)


CurrentUserDep = Annotated[CurrentUser, Depends(get_current_user)]


def _role_guard(*allowed: Role):
    guard = require(*allowed)

    def dependency(user: CurrentUserDep) -> CurrentUser:
        return guard(user)

    return dependency


CanWriteDep = Annotated[CurrentUser, Depends(_role_guard(Role.CREATE))]
CanApproveDep = Annotated[CurrentUser, Depends(_role_guard(Role.APPROVER))]


def get_calendar_service(session: SessionDep, settings: SettingsDep) -> CalendarService:
    return CalendarService(
        CalendarRepository(session),
        HolidayRepository(session),
        ChangeRequestRepository(session),
        AuditRepository(session),
        approval_required=settings.approval_required,
        materialise_years=settings.materialise_years,
    )


def get_identity_service(session: SessionDep, settings: SettingsDep) -> IdentityService:
    return IdentityService(
        UserRepository(session),
        AuditRepository(session),
        PasswordPolicy(
            min_length=settings.password_min_length,
            lockout_threshold=settings.lockout_threshold,
            lockout_minutes=settings.lockout_minutes,
        ),
    )


CalendarServiceDep = Annotated[CalendarService, Depends(get_calendar_service)]
IdentityServiceDep = Annotated[IdentityService, Depends(get_identity_service)]
