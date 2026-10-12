"""Materialise a full year of dates for a calendar.

Used by the Calendar Service to populate calendar_dates, and by the annual rollover job that is
handed over to Fidelity (RECORD.md section 9).
"""

from __future__ import annotations

from collections.abc import Iterable
from datetime import date

from .rules import get_evaluator
from .rules.business_day import generate as generate_business_days
from .rules.holiday import HolidaySet, coerce
from .types import CalendarSpec, GeneratedDate, Holiday


def generate_year(
    spec: CalendarSpec,
    year: int,
    holidays: HolidaySet | Iterable[Holiday | date] = (),
) -> list[GeneratedDate]:
    resolved = coerce(holidays)

    if spec.business_days is not None:
        generated = generate_business_days(spec.business_days, year, resolved, spec.policies)
    else:
        assert spec.extended_rule is not None  # guaranteed by CalendarSpec.__post_init__
        evaluator = get_evaluator(spec.extended_rule.rule_name)
        generated = evaluator(spec.extended_rule, year, resolved, spec.policies)

    # A shift can push a run past 31 December. The year is the unit of materialisation, so a run
    # that cannot be placed inside it is dropped rather than written into the next year (O-34).
    return [g for g in generated if g.day.year == year]


def generate_years(
    spec: CalendarSpec,
    years: Iterable[int],
    holidays: HolidaySet | Iterable[Holiday | date] = (),
) -> list[GeneratedDate]:
    resolved = coerce(holidays)
    return [g for year in sorted(years) for g in generate_year(spec, year, resolved)]
