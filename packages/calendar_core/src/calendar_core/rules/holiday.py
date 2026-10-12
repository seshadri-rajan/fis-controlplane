"""Holiday lookup and working-day resolution.

Single region for this phase (D-08), but holidays are always passed in explicitly so that
multi-region stays additive.
"""

from __future__ import annotations

from collections.abc import Iterable, Iterator
from datetime import date, timedelta

from ..types import DEFAULT_WEEKEND, Holiday, HolidayPolicy, Weekday

_MAX_SEARCH_DAYS = 400


class HolidaySet:
    """Immutable, fast-lookup holiday collection."""

    __slots__ = ("_names",)

    def __init__(self, holidays: Iterable[Holiday | date] = ()) -> None:
        names: dict[date, str] = {}
        for item in holidays:
            if isinstance(item, Holiday):
                names[item.day] = item.name
            else:
                names[item] = ""
        self._names = names

    def __contains__(self, day: date) -> bool:
        return day in self._names

    def __len__(self) -> int:
        return len(self._names)

    def __iter__(self) -> Iterator[date]:
        return iter(sorted(self._names))

    def name_for(self, day: date) -> str | None:
        return self._names.get(day)

    def max_date(self) -> date | None:
        return max(self._names) if self._names else None


def coerce(holidays: HolidaySet | Iterable[Holiday | date]) -> HolidaySet:
    return holidays if isinstance(holidays, HolidaySet) else HolidaySet(holidays)


def is_weekend(day: date, weekend: frozenset[Weekday] = DEFAULT_WEEKEND) -> bool:
    return Weekday(day.weekday()) in weekend


def is_working_day(
    day: date,
    holidays: HolidaySet,
    weekend: frozenset[Weekday] = DEFAULT_WEEKEND,
) -> bool:
    return not is_weekend(day, weekend) and day not in holidays


def walk_to_working_day(
    start: date,
    holidays: HolidaySet,
    weekend: frozenset[Weekday] = DEFAULT_WEEKEND,
    *,
    step: int = 1,
) -> date:
    """First working day at or after (step=1) / at or before (step=-1) `start`."""
    if step not in (1, -1):
        raise ValueError("step must be 1 or -1")
    day = start
    for _ in range(_MAX_SEARCH_DAYS):
        if is_working_day(day, holidays, weekend):
            return day
        day += timedelta(days=step)
    raise ValueError(f"no working day found within {_MAX_SEARCH_DAYS} days of {start}")


def next_working_day(
    start: date,
    holidays: HolidaySet,
    weekend: frozenset[Weekday] = DEFAULT_WEEKEND,
) -> date:
    return walk_to_working_day(start + timedelta(days=1), holidays, weekend, step=1)


def resolve(
    day: date,
    holidays: HolidaySet,
    policy: HolidayPolicy,
    weekend: frozenset[Weekday] = DEFAULT_WEEKEND,
) -> date | None:
    """Apply the holiday policy to a scheduled date. None means "do not run"."""
    if is_working_day(day, holidays, weekend):
        return day
    match policy:
        case HolidayPolicy.SKIP:
            return None
        case HolidayPolicy.SHIFT_FORWARD:
            return walk_to_working_day(day, holidays, weekend, step=1)
        case HolidayPolicy.SHIFT_BACKWARD:
            return walk_to_working_day(day, holidays, weekend, step=-1)
