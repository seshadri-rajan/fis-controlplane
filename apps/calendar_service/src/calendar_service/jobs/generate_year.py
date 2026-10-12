"""Materialise calendar dates for a given year.

The annual rollover. Runnable standalone and parameterised by year, not hardcoded to 2026/2027
(O-04). This is a handover deliverable: see docs/runbooks/annual-rollover.md.

    python -m calendar_service.jobs.generate_year --year 2028
    python -m calendar_service.jobs.generate_year --year 2028 --calendar US_Business_Days
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from ..domain.modules.audit.entity import ENTITY_CALENDAR, AuditEntry
from ..infra.database.repositories.audit import AuditRepository
from ..infra.database.repositories.calendar import CalendarRepository, HolidayRepository
from ..infra.database.repositories.change_request import ChangeRequestRepository
from ..infra.database.session import get_session_factory
from ..infra.services.calendar_service import CalendarService

SYSTEM_ACTOR = "generate_year"


@dataclass(frozen=True, slots=True)
class GenerationResult:
    calendar_nm: str
    calendar_key: int
    year: int
    dates_written: int


async def generate(
    session: AsyncSession,
    year: int,
    *,
    only: str | None = None,
    actor: str = SYSTEM_ACTOR,
) -> list[GenerationResult]:
    calendars = CalendarRepository(session)
    audit = AuditRepository(session)
    service = CalendarService(
        calendars,
        HolidayRepository(session),
        ChangeRequestRepository(session),
        audit,
        approval_required=False,
    )

    results: list[GenerationResult] = []
    for calendar in await calendars.list():
        if only and calendar.calendar_nm != only:
            continue
        assert calendar.calendar_key is not None

        written = await service.materialise(calendar.calendar_key, [year])
        await audit.record(
            AuditEntry(
                entity=ENTITY_CALENDAR,
                entity_key=calendar.calendar_key,
                action="MATERIALISE",
                new_value={"year": year, "dates_written": written},
                updated_by=actor,
            )
        )
        results.append(
            GenerationResult(calendar.calendar_nm, calendar.calendar_key, year, written)
        )

    return results


async def run(args: argparse.Namespace) -> int:
    async with get_session_factory()() as session:
        results = await generate(session, args.year, only=args.calendar)
        await session.commit()

    if not results:
        print("no active calendars matched", file=sys.stderr)
        return 1

    for result in results:
        print(f"{result.calendar_nm:<40} {result.year}  {result.dates_written:>5} dates")
    print(f"\n{len(results)} calendar(s) materialised for {args.year}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--calendar", help="limit to a single calendar name")
    return asyncio.run(run(parser.parse_args()))


if __name__ == "__main__":
    sys.exit(main())
