"""Business-day calendars: selected weekdays, holiday shifts, collisions.

The O-06 cases below are named deliberately. They encode behaviour the client has not yet ruled
on, so the expected values are the *proposed* defaults, not settled requirements.
"""

from datetime import date

import pytest

from calendar_core import (
    BusinessDaySpec,
    CalendarSpec,
    CollisionPolicy,
    Holiday,
    HolidayPolicy,
    Policies,
    Weekday,
    generate_year,
)

MON_TO_FRI = BusinessDaySpec(
    frozenset(
        {Weekday.MONDAY, Weekday.TUESDAY, Weekday.WEDNESDAY, Weekday.THURSDAY, Weekday.FRIDAY}
    )
)
MONDAYS = BusinessDaySpec(frozenset({Weekday.MONDAY}))
MON_AND_TUE = BusinessDaySpec(frozenset({Weekday.MONDAY, Weekday.TUESDAY}))


def days(generated):
    return [g.day for g in generated]


def in_january(generated):
    return [d for d in days(generated) if d.month == 1]


def test_weekday_selection_excludes_weekends():
    result = generate_year(CalendarSpec("mon-fri", business_days=MON_TO_FRI), 2027)
    assert all(d.weekday() < 5 for d in days(result))
    # 2027 has 261 weekdays.
    assert len(result) == 261


def test_single_weekday_selection():
    result = generate_year(CalendarSpec("mondays", business_days=MONDAYS), 2027)
    assert all(d.weekday() == Weekday.MONDAY for d in days(result))
    assert date(2027, 1, 4) in days(result)


def test_saturday_is_a_run_day_when_selected():
    """A selected weekday is a working day for its own calendar, weekend or not."""
    spec = BusinessDaySpec(frozenset({Weekday.SATURDAY}))
    result = generate_year(CalendarSpec("saturdays", business_days=spec), 2027)
    assert all(d.weekday() == Weekday.SATURDAY for d in days(result))
    assert len(result) == 52


def test_o31_selected_weekend_day_shifts_to_the_next_non_weekend_day():
    """O-31. Unresolved: a Saturday calendar whose Saturday is a holiday lands on Monday.

    The alternative ruling is that it should land on the next *selected* day, i.e. the following
    Saturday. Pinned here so the behaviour is visible rather than accidental.
    """
    spec = BusinessDaySpec(frozenset({Weekday.SATURDAY}))
    result = generate_year(
        CalendarSpec("saturdays", business_days=spec), 2027, [Holiday(date(2027, 1, 2))]
    )
    assert date(2027, 1, 4) in days(result)


def test_holiday_shifts_monday_run_to_tuesday():
    """The requirements' own example: Monday is a holiday, so the job runs Tuesday."""
    holiday = Holiday(date(2027, 1, 4), "New Year observed")
    result = generate_year(CalendarSpec("mondays", business_days=MONDAYS), 2027, [holiday])

    assert date(2027, 1, 4) not in days(result)
    assert date(2027, 1, 5) in days(result)

    shifted = next(g for g in result if g.day == date(2027, 1, 5))
    assert shifted.shifted_from == date(2027, 1, 4)
    assert shifted.reason == "New Year observed"


def test_holiday_skip_policy_drops_the_run():
    policies = Policies(holiday=HolidayPolicy.SKIP)
    spec = CalendarSpec("mondays", business_days=MONDAYS, policies=policies)
    result = generate_year(spec, 2027, [Holiday(date(2027, 1, 4))])

    assert date(2027, 1, 4) not in days(result)
    assert date(2027, 1, 5) not in days(result)


def test_holiday_shift_backward_policy():
    policies = Policies(holiday=HolidayPolicy.SHIFT_BACKWARD)
    spec = CalendarSpec("mondays", business_days=MONDAYS, policies=policies)
    result = generate_year(spec, 2027, [Holiday(date(2027, 1, 11))])

    # 2027-01-09 and -10 are the weekend, so it lands on Friday the 8th.
    assert date(2027, 1, 8) in days(result)


def test_consecutive_holidays_shift_past_both():
    holidays = [Holiday(date(2027, 1, 4)), Holiday(date(2027, 1, 5))]
    result = generate_year(CalendarSpec("mondays", business_days=MONDAYS), 2027, holidays)
    assert date(2027, 1, 6) in days(result)


def test_holiday_on_friday_shifts_over_the_weekend():
    result = generate_year(
        CalendarSpec("fridays", business_days=BusinessDaySpec(frozenset({Weekday.FRIDAY}))),
        2027,
        [Holiday(date(2027, 1, 8))],
    )
    assert date(2027, 1, 11) in days(result)


# --- O-06: shifted date collides with a date the calendar already includes ---


def test_o06_collision_merge_produces_one_run():
    """Monday holiday shifts onto Tuesday, which is already a run day."""
    spec = CalendarSpec(
        "mon+tue",
        business_days=MON_AND_TUE,
        policies=Policies(collision=CollisionPolicy.MERGE),
    )
    result = generate_year(spec, 2027, [Holiday(date(2027, 1, 4))])

    january = in_january(result)
    assert january.count(date(2027, 1, 5)) == 1
    assert date(2027, 1, 4) not in january


def test_o06_collision_shift_again_preserves_both_runs():
    spec = CalendarSpec(
        "mon+tue",
        business_days=MON_AND_TUE,
        policies=Policies(collision=CollisionPolicy.SHIFT_AGAIN),
    )
    result = generate_year(spec, 2027, [Holiday(date(2027, 1, 4))])

    january = in_january(result)
    assert date(2027, 1, 5) in january
    assert date(2027, 1, 6) in january


def test_results_are_sorted_and_unique():
    result = generate_year(
        CalendarSpec("mon+tue", business_days=MON_AND_TUE), 2027, [Holiday(date(2027, 1, 4))]
    )
    assert days(result) == sorted(days(result))
    assert len(set(days(result))) == len(result)


def test_leap_year_is_handled():
    result = generate_year(CalendarSpec("mon-fri", business_days=MON_TO_FRI), 2028)
    assert date(2028, 2, 29) in days(result)


def test_empty_weekday_selection_is_rejected():
    with pytest.raises(ValueError, match="at least one weekday"):
        BusinessDaySpec(frozenset())
