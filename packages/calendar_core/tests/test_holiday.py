"""Holiday set behaviour, working-day resolution, and CalendarSpec invariants."""

from datetime import date

import pytest

from calendar_core import (
    BusinessDaySpec,
    CalendarSpec,
    ExtendedRuleSpec,
    Holiday,
    HolidayPolicy,
    HolidaySet,
    Weekday,
    generate_years,
)
from calendar_core.rules.holiday import (
    is_working_day,
    next_working_day,
    resolve,
    walk_to_working_day,
)

MONDAYS = BusinessDaySpec(frozenset({Weekday.MONDAY}))


def test_holiday_set_accepts_dates_and_holidays():
    holidays = HolidaySet([date(2027, 1, 1), Holiday(date(2027, 12, 25), "Christmas")])
    assert date(2027, 1, 1) in holidays
    assert holidays.name_for(date(2027, 12, 25)) == "Christmas"
    assert holidays.name_for(date(2027, 1, 1)) == ""
    assert holidays.name_for(date(2027, 6, 1)) is None
    assert len(holidays) == 2


def test_holiday_set_iterates_in_date_order():
    holidays = HolidaySet([date(2027, 12, 25), date(2027, 1, 1)])
    assert list(holidays) == [date(2027, 1, 1), date(2027, 12, 25)]
    assert holidays.max_date() == date(2027, 12, 25)


def test_empty_holiday_set_has_no_max_date():
    assert HolidaySet().max_date() is None


def test_is_working_day_excludes_weekends_and_holidays():
    holidays = HolidaySet([date(2027, 1, 1)])
    assert not is_working_day(date(2027, 1, 1), holidays)  # Friday, but a holiday
    assert not is_working_day(date(2027, 1, 2), holidays)  # Saturday
    assert is_working_day(date(2027, 1, 4), holidays)  # Monday


def test_next_working_day_is_strictly_after_the_given_day():
    assert next_working_day(date(2027, 1, 4), HolidaySet()) == date(2027, 1, 5)


def test_walk_to_working_day_returns_the_day_itself_when_valid():
    assert walk_to_working_day(date(2027, 1, 4), HolidaySet()) == date(2027, 1, 4)


def test_walk_rejects_an_invalid_step():
    with pytest.raises(ValueError, match="step must be"):
        walk_to_working_day(date(2027, 1, 4), HolidaySet(), step=2)


def test_resolve_returns_none_for_skip():
    holidays = HolidaySet([date(2027, 1, 4)])
    assert resolve(date(2027, 1, 4), holidays, HolidayPolicy.SKIP) is None


def test_custom_weekend_is_respected():
    friday_saturday = frozenset({Weekday.FRIDAY, Weekday.SATURDAY})
    assert not is_working_day(date(2027, 1, 1), HolidaySet(), friday_saturday)  # Friday
    assert is_working_day(date(2027, 1, 3), HolidaySet(), friday_saturday)  # Sunday


def test_calendar_spec_rejects_both_kinds_at_once():
    with pytest.raises(ValueError, match="exactly one of"):
        CalendarSpec(
            "both",
            business_days=MONDAYS,
            extended_rule=ExtendedRuleSpec("LAST_BUSINESS_DAY"),
        )


def test_calendar_spec_rejects_neither():
    with pytest.raises(ValueError, match="exactly one of"):
        CalendarSpec("neither")


def test_generate_years_spans_the_year_boundary():
    spec = CalendarSpec("mondays", business_days=MONDAYS)
    result = generate_years(spec, [2026, 2027])
    years = {g.day.year for g in result}
    assert years == {2026, 2027}
    assert [g.day for g in result] == sorted(g.day for g in result)
