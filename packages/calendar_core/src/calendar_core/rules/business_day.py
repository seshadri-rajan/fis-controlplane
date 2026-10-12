"""Weekday-based calendars, e.g. "Monday to Friday"."""

from __future__ import annotations

from collections.abc import Iterator
from datetime import date, timedelta

from ..types import (
    BusinessDaySpec,
    CollisionPolicy,
    GeneratedDate,
    HolidayPolicy,
    Policies,
    Weekday,
)
from .holiday import HolidaySet, walk_to_working_day


def generate(
    spec: BusinessDaySpec,
    year: int,
    holidays: HolidaySet,
    policies: Policies,
) -> list[GeneratedDate]:
    """Every selected weekday in `year`, with holidays resolved per policy."""
    # A weekday the user selected counts as a working day for this calendar, weekend or not.
    weekend = policies.weekend - spec.weekdays

    scheduled = [day for day in _days_in(year) if Weekday(day.weekday()) in spec.weekdays]

    # Natural run days are claimed first, so a shifted date can never displace a real run.
    results = [GeneratedDate(day) for day in scheduled if day not in holidays]
    taken = {g.day for g in results}

    for day in scheduled:
        if day in holidays:
            shifted = _shift(day, holidays, policies, weekend, taken)
            if shifted is not None:
                taken.add(shifted.day)
                results.append(shifted)

    results.sort(key=lambda g: g.day)
    return results


def _days_in(year: int) -> Iterator[date]:
    day = date(year, 1, 1)
    end = date(year, 12, 31)
    while day <= end:
        yield day
        day += timedelta(days=1)


def _shift(
    scheduled: date,
    holidays: HolidaySet,
    policies: Policies,
    weekend: frozenset[Weekday],
    taken: set[date],
) -> GeneratedDate | None:
    if policies.holiday is HolidayPolicy.SKIP:
        return None

    step = 1 if policies.holiday is HolidayPolicy.SHIFT_FORWARD else -1
    candidate = walk_to_working_day(scheduled, holidays, weekend, step=step)

    # O-06: the shifted date may already be a scheduled run.
    if policies.collision is CollisionPolicy.SHIFT_AGAIN:
        while candidate in taken:
            candidate = walk_to_working_day(
                candidate + timedelta(days=step), holidays, weekend, step=step
            )
    elif candidate in taken:
        return None

    return GeneratedDate(
        candidate,
        shifted_from=scheduled,
        reason=holidays.name_for(scheduled) or "holiday",
    )
