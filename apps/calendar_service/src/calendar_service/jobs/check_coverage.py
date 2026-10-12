"""Alert when any active calendar lacks dates beyond a look-ahead threshold.

The control for the date cliff (O-04 / R-06). Without it, calendars running out of dates is a
silent failure: DAGs simply stop firing with no error anywhere.

Exits non-zero when any calendar is short, so a scheduler or monitor can alert on it.

    python -m calendar_service.jobs.check_coverage --min-days-ahead 90
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from dataclasses import dataclass
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from ..infra.database.repositories.calendar import CalendarRepository
from ..infra.database.session import get_session_factory


@dataclass(frozen=True, slots=True)
class Coverage:
    calendar_nm: str
    calendar_key: int
    last_date: date | None
    days_ahead: int
    ok: bool

    @property
    def status(self) -> str:
        if self.last_date is None:
            return "NO DATES"
        return "ok" if self.ok else "SHORT"


async def check(
    session: AsyncSession,
    *,
    min_days_ahead: int,
    today: date,
) -> list[Coverage]:
    """`today` is passed in rather than read from the clock, so results are reproducible."""
    calendars = CalendarRepository(session)
    report: list[Coverage] = []

    for calendar in await calendars.list():
        assert calendar.calendar_key is not None
        last = await calendars.max_date(calendar.calendar_key)
        days_ahead = (last - today).days if last else 0
        report.append(
            Coverage(
                calendar_nm=calendar.calendar_nm,
                calendar_key=calendar.calendar_key,
                last_date=last,
                days_ahead=days_ahead,
                ok=last is not None and days_ahead >= min_days_ahead,
            )
        )

    return report


async def run(args: argparse.Namespace) -> int:
    today = date.fromisoformat(args.today) if args.today else date.today()

    async with get_session_factory()() as session:
        report = await check(session, min_days_ahead=args.min_days_ahead, today=today)

    if not report:
        print("no active calendars", file=sys.stderr)
        return 1

    for coverage in sorted(report, key=lambda c: c.days_ahead):
        last = coverage.last_date.isoformat() if coverage.last_date else "-"
        print(
            f"{coverage.calendar_nm:<40} last={last:<12} "
            f"days_ahead={coverage.days_ahead:>5}  {coverage.status}"
        )

    short = [c for c in report if not c.ok]
    if short:
        print(
            f"\n{len(short)} of {len(report)} calendar(s) have fewer than "
            f"{args.min_days_ahead} days of dates remaining.",
            file=sys.stderr,
        )
        print("Run generate_year for the next year before they run out.", file=sys.stderr)
        return 1

    print(f"\nall {len(report)} calendar(s) covered beyond {args.min_days_ahead} days")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--min-days-ahead", type=int, default=90)
    parser.add_argument("--today", help="ISO date override, for testing")
    return asyncio.run(run(parser.parse_args()))


if __name__ == "__main__":
    sys.exit(main())
