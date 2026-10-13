"""Create a set of demonstration calendars and holidays.

Fills a freshly bootstrapped database so the UI has something to show, since there is no calendar
editor yet (blocked on S-13). Idempotent: existing calendars and holidays are left alone.

    python -m calendar_service.jobs.seed_demo

2028 is deliberately left unmaterialised so the date-cliff warning is visible in the UI. Run
`jobs.generate_year --year 2028` to clear it.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from datetime import date

from sqlalchemy import select

from ..domain.modules.calendar.entity import Calendar, CalendarKind, CalendarPolicies
from ..infra.database.models import HolidayCalendar, HolidayDate
from ..infra.database.repositories.audit import AuditRepository
from ..infra.database.repositories.calendar import CalendarRepository, HolidayRepository
from ..infra.database.repositories.change_request import ChangeRequestRepository
from ..infra.database.session import create_all, get_session_factory
from ..infra.services.calendar_service import CalendarService

SEED_ACTOR = "seed_demo"

US_HOLIDAYS_2027 = [
    (date(2027, 1, 1), "New Year's Day"),
    (date(2027, 1, 18), "Martin Luther King Jr. Day"),
    (date(2027, 2, 15), "Presidents Day"),
    (date(2027, 5, 31), "Memorial Day"),
    (date(2027, 7, 5), "Independence Day (observed)"),
    (date(2027, 9, 6), "Labor Day"),
    (date(2027, 11, 25), "Thanksgiving"),
    (date(2027, 12, 24), "Christmas Day (observed)"),
]

DEMO_CALENDARS = [
    Calendar(
        calendar_nm="US_Business_Days",
        calendar_desc="Monday to Friday, US holidays applied",
        kind=CalendarKind.BUSINESS_DAYS,
        weekdays=[0, 1, 2, 3, 4],
        created_by=SEED_ACTOR,
    ),
    Calendar(
        calendar_nm="Monday_Batch",
        calendar_desc="Weekly Monday run, shifts off holidays",
        kind=CalendarKind.BUSINESS_DAYS,
        weekdays=[0],
        policies=CalendarPolicies(holiday="shift_forward", collision="shift_again"),
        created_by=SEED_ACTOR,
    ),
    Calendar(
        calendar_nm="Month_End_Close",
        calendar_desc="Last working day of each month",
        kind=CalendarKind.EXTENDED_RULE,
        rule_name="LAST_BUSINESS_DAY",
        created_by=SEED_ACTOR,
    ),
    Calendar(
        calendar_nm="Quarter_End_Reporting",
        calendar_desc="Last working day of each quarter",
        kind=CalendarKind.EXTENDED_RULE,
        rule_name="QUARTER_END",
        created_by=SEED_ACTOR,
    ),
]


async def ensure_holiday_calendar(session, name: str) -> int:
    holidays = HolidayRepository(session)
    existing = await holidays.default_calendar_id()
    if existing is not None:
        return existing

    row = HolidayCalendar(holiday_calendar_nm=name, region=name, created_by=SEED_ACTOR)
    session.add(row)
    await session.flush()
    return row.holiday_calendar_id


async def ensure_holidays(session, holiday_calendar_id: int) -> int:
    known = set(
        (
            await session.scalars(
                select(HolidayDate.holiday_date).where(
                    HolidayDate.holiday_calendar_id == holiday_calendar_id
                )
            )
        ).all()
    )
    added = 0
    for day, name in US_HOLIDAYS_2027:
        if day not in known:
            session.add(
                HolidayDate(
                    holiday_calendar_id=holiday_calendar_id,
                    holiday_date=day,
                    holiday_name=name,
                )
            )
            added += 1
    await session.flush()
    return added


async def run(args: argparse.Namespace) -> int:
    await create_all()

    async with get_session_factory()() as session:
        holiday_calendar_id = await ensure_holiday_calendar(session, args.holiday_calendar)
        holidays_added = await ensure_holidays(session, holiday_calendar_id)

        calendars = CalendarRepository(session)
        service = CalendarService(
            calendars,
            HolidayRepository(session),
            ChangeRequestRepository(session),
            AuditRepository(session),
            approval_required=False,
        )

        created: list[tuple[str, int]] = []
        skipped: list[str] = []

        for template in DEMO_CALENDARS:
            if await calendars.get_by_name(template.calendar_nm):
                skipped.append(template.calendar_nm)
                continue

            template.holiday_calendar_id = holiday_calendar_id
            applied, _ = await service.create(template, SEED_ACTOR)
            assert applied is not None and applied.calendar_key is not None
            await service.materialise(applied.calendar_key, [args.year])
            dates = await calendars.list_dates(applied.calendar_key, args.year)
            created.append((template.calendar_nm, len(dates)))

        await session.commit()

    print(f"holidays added:       {holidays_added}")
    for name, count in created:
        print(f"  created {name:<24} {count:>4} dates for {args.year}")
    for name in skipped:
        print(f"  skipped {name:<24} already exists")
    if created:
        print(f"\n{args.year + 1} left unmaterialised on purpose, so the date-cliff warning shows.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--year", type=int, default=2027)
    parser.add_argument("--holiday-calendar", default="US")
    return asyncio.run(run(parser.parse_args()))


if __name__ == "__main__":
    sys.exit(main())
