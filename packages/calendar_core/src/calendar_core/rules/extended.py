"""Named extended rules.

The set below covers only the examples named in the requirements document and is **provisional**.
Fidelity supplies the authoritative list (D-09, O-28); each new rule is an additive function here
plus a test table.
"""

from __future__ import annotations

from calendar import monthrange
from datetime import date, timedelta

from ..types import (
    BoundaryPolicy,
    ExtendedRuleSpec,
    GeneratedDate,
    HolidayPolicy,
    Policies,
)
from .holiday import HolidaySet, is_working_day, resolve, walk_to_working_day
from .registry import register


def _last_day_of_month(year: int, month: int) -> date:
    return date(year, month, monthrange(year, month)[1])


@register("WEEKEND_EXCLUSION", "Every working day; weekends and holidays excluded")
def weekend_exclusion(
    spec: ExtendedRuleSpec, year: int, holidays: HolidaySet, policies: Policies
) -> list[GeneratedDate]:
    results: list[GeneratedDate] = []
    day = date(year, 1, 1)
    end = date(year, 12, 31)
    while day <= end:
        if is_working_day(day, holidays, policies.weekend):
            results.append(GeneratedDate(day))
        day += timedelta(days=1)
    return results


@register("FIRST_BUSINESS_DAY", "First working day of each month")
def first_business_day(
    spec: ExtendedRuleSpec, year: int, holidays: HolidaySet, policies: Policies
) -> list[GeneratedDate]:
    return [
        GeneratedDate(walk_to_working_day(date(year, month, 1), holidays, policies.weekend, step=1))
        for month in range(1, 13)
    ]


@register("LAST_BUSINESS_DAY", "Last working day of each month")
def last_business_day(
    spec: ExtendedRuleSpec, year: int, holidays: HolidaySet, policies: Policies
) -> list[GeneratedDate]:
    # Defined in terms of working days, so it is inherently clamped to its month.
    return [
        GeneratedDate(
            walk_to_working_day(
                _last_day_of_month(year, month), holidays, policies.weekend, step=-1
            )
        )
        for month in range(1, 13)
    ]


@register("QUARTER_END", "Last working day of each quarter")
def quarter_end(
    spec: ExtendedRuleSpec, year: int, holidays: HolidaySet, policies: Policies
) -> list[GeneratedDate]:
    return [
        GeneratedDate(
            walk_to_working_day(
                _last_day_of_month(year, month), holidays, policies.weekend, step=-1
            )
        )
        for month in (3, 6, 9, 12)
    ]


@register("DAY_OF_MONTH", "A fixed day number each month, resolved off non-working days")
def day_of_month(
    spec: ExtendedRuleSpec, year: int, holidays: HolidaySet, policies: Policies
) -> list[GeneratedDate]:
    """Params: day. The requirements' "15th of every month" example."""
    try:
        wanted = int(spec.params["day"])
    except KeyError:
        raise ValueError("DAY_OF_MONTH requires a 'day' parameter") from None
    if not 1 <= wanted <= 31:
        raise ValueError(f"DAY_OF_MONTH 'day' must be 1-31, got {wanted}")

    results: list[GeneratedDate] = []
    for month in range(1, 13):
        target = date(year, month, min(wanted, monthrange(year, month)[1]))
        landed = resolve(target, holidays, policies.holiday, policies.weekend)
        if landed is None:
            continue

        # O-07: shifting can push the date out of its own month.
        if policies.boundary is BoundaryPolicy.CLAMP and landed.month != target.month:
            back = -1 if policies.holiday is HolidayPolicy.SHIFT_FORWARD else 1
            landed = walk_to_working_day(target, holidays, policies.weekend, step=back)
            if landed.month != target.month:
                continue

        results.append(
            GeneratedDate(
                landed,
                shifted_from=target if landed != target else None,
                reason=(holidays.name_for(target) or "non-working day")
                if landed != target
                else "",
            )
        )
    return results
