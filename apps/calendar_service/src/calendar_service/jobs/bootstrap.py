"""Seed reference data and create the first administrator (O-03).

Idempotent: safe to re-run. The generated password is printed once and never stored in clear.

    python -m calendar_service.jobs.bootstrap --admin-user first.admin --admin-email a@b.com
"""

from __future__ import annotations

import argparse
import asyncio
import secrets
import sys

from sqlalchemy import select

from calendar_core import registered_rules

from ..domain.modules.identity.entity import Role, ROLE_DESCRIPTIONS, User
from ..domain.modules.identity.password_policy import PasswordPolicy
from ..infra.database.models import CalendarRule, HolidayCalendar, Role as RoleModel
from ..infra.database.repositories.audit import AuditRepository
from ..infra.database.repositories.user import UserRepository
from ..infra.database.session import create_all, get_session_factory
from ..infra.services.identity_service import IdentityService

SEED_ACTOR = "bootstrap"


async def seed_roles(session) -> int:
    existing = set((await session.scalars(select(RoleModel.role_name))).all())
    added = 0
    for role, description in ROLE_DESCRIPTIONS.items():
        if role.value not in existing:
            session.add(
                RoleModel(role_name=role.value, role_desc=description, created_by=SEED_ACTOR)
            )
            added += 1
    await session.flush()
    return added


async def seed_rules(session) -> int:
    """Seeds from the engine registry.

    Fidelity supplies the authoritative list (D-09, O-28); until it arrives, only rules with a
    registered evaluator are seeded, because a rule row without one does nothing.
    """
    existing = set((await session.scalars(select(CalendarRule.calendar_rule_nm))).all())
    added = 0
    for name, description in registered_rules().items():
        if name not in existing:
            session.add(
                CalendarRule(
                    calendar_rule_nm=name, calendar_rule_desc=description, created_by=SEED_ACTOR
                )
            )
            added += 1
    await session.flush()
    return added


async def seed_holiday_calendar(session, name: str, region: str) -> int:
    existing = (
        await session.scalars(
            select(HolidayCalendar.holiday_calendar_id).where(
                HolidayCalendar.holiday_calendar_nm == name
            )
        )
    ).one_or_none()
    if existing is not None:
        return existing

    row = HolidayCalendar(holiday_calendar_nm=name, region=region, created_by=SEED_ACTOR)
    session.add(row)
    await session.flush()
    return row.holiday_calendar_id


async def create_admin(session, user_name: str, email: str) -> str | None:
    users = UserRepository(session)
    if await users.get_by_name(user_name):
        return None

    identity = IdentityService(users, AuditRepository(session), PasswordPolicy())
    password = secrets.token_urlsafe(18)
    await identity.create_user(
        User(user_name=user_name, user_email=email, roles={Role.ADMIN}),
        password,
        SEED_ACTOR,
        must_change_password=True,
    )
    return password


async def run(args: argparse.Namespace) -> int:
    await create_all()

    async with get_session_factory()() as session:
        roles_added = await seed_roles(session)
        rules_added = await seed_rules(session)
        holiday_calendar_id = await seed_holiday_calendar(
            session, args.holiday_calendar, args.region
        )
        password = await create_admin(session, args.admin_user, args.admin_email)
        await session.commit()

    print(f"roles seeded:            {roles_added}")
    print(f"calendar rules seeded:   {rules_added}")
    print(f"holiday calendar id:     {holiday_calendar_id}")

    if password is None:
        print(f"admin user:              {args.admin_user} already exists, unchanged")
    else:
        print(f"admin user:              {args.admin_user}")
        print(f"temporary password:      {password}")
        print("Shown once. It must be changed at first login.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--admin-user", default="admin")
    parser.add_argument("--admin-email", default="admin@example.invalid")
    parser.add_argument("--holiday-calendar", default="DEFAULT")
    parser.add_argument("--region", default="DEFAULT")
    return asyncio.run(run(parser.parse_args()))


if __name__ == "__main__":
    sys.exit(main())
