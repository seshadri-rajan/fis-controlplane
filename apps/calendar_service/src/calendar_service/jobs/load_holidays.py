"""Load holiday dates from CSV into a holiday calendar.

Backend-only by requirement: there is no UI for holiday maintenance.

    python -m calendar_service.jobs.load_holidays holidays.csv --calendar DEFAULT

CSV columns: date,name  (header optional, ISO dates)
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import sys
from datetime import date
from pathlib import Path

from sqlalchemy import select

from ..infra.database.models import HolidayCalendar, HolidayDate
from ..infra.database.session import get_session_factory


def read_csv(path: Path) -> list[tuple[date, str]]:
    rows: list[tuple[date, str]] = []
    with path.open(newline="", encoding="utf-8") as handle:
        for record in csv.reader(handle):
            if not record or not record[0].strip():
                continue
            try:
                day = date.fromisoformat(record[0].strip())
            except ValueError:
                continue  # header or malformed line
            rows.append((day, record[1].strip() if len(record) > 1 else ""))
    return rows


async def run(args: argparse.Namespace) -> int:
    holidays = read_csv(Path(args.csv))
    if not holidays:
        print("no valid rows found", file=sys.stderr)
        return 1

    async with get_session_factory()() as session:
        calendar_id = (
            await session.scalars(
                select(HolidayCalendar.holiday_calendar_id).where(
                    HolidayCalendar.holiday_calendar_nm == args.calendar
                )
            )
        ).one_or_none()
        if calendar_id is None:
            print(f"holiday calendar {args.calendar!r} not found; run bootstrap first", file=sys.stderr)
            return 1

        existing = set(
            (
                await session.scalars(
                    select(HolidayDate.holiday_date).where(
                        HolidayDate.holiday_calendar_id == calendar_id
                    )
                )
            ).all()
        )

        added = 0
        for day, name in holidays:
            if day in existing:
                continue
            session.add(
                HolidayDate(
                    holiday_calendar_id=calendar_id, holiday_date=day, holiday_name=name
                )
            )
            added += 1
        await session.commit()

    print(f"read {len(holidays)} rows, inserted {added}, skipped {len(holidays) - added}")
    print("Re-materialise affected calendars so the new holidays take effect.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv", help="path to a CSV of date,name rows")
    parser.add_argument("--calendar", default="DEFAULT")
    return asyncio.run(run(parser.parse_args()))


if __name__ == "__main__":
    sys.exit(main())
