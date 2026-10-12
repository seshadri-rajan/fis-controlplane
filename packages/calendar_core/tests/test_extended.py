"""Extended rules, and the O-07 period-boundary cases.

Reference weekdays for 2027: 1 January is a Friday, 29 January is a Friday, 31 March is a
Wednesday, 1 August is a Sunday.
"""

from datetime import date

import pytest

from calendar_core import (
    BoundaryPolicy,
    CalendarSpec,
    ExtendedRuleSpec,
    Holiday,
    HolidayPolicy,
    Policies,
    UnknownRuleError,
    generate_year,
    registered_rules,
)


def run(rule: str, year: int = 2027, holidays=(), policies=None, **params):
    spec = CalendarSpec(
        rule,
        extended_rule=ExtendedRuleSpec(rule, params),
        policies=policies or Policies(),
    )
    return [g.day for g in generate_year(spec, year, holidays)]


def test_registry_exposes_the_provisional_rule_set():
    rules = registered_rules()
    assert "LAST_BUSINESS_DAY" in rules
    assert "QUARTER_END" in rules
    assert rules["LAST_BUSINESS_DAY"]


def test_unknown_rule_is_rejected_with_the_available_names():
    with pytest.raises(UnknownRuleError, match="LAST_BUSINESS_DAY"):
        run("NO_SUCH_RULE")


def test_rule_name_is_case_insensitive():
    assert run("last_business_day") == run("LAST_BUSINESS_DAY")


# --- LAST_BUSINESS_DAY ---


def test_last_business_day_of_january_2027():
    # 31 January 2027 is a Sunday, so the last working day is Friday the 29th.
    assert date(2027, 1, 29) in run("LAST_BUSINESS_DAY")


def test_last_business_day_returns_one_date_per_month():
    result = run("LAST_BUSINESS_DAY")
    assert len(result) == 12
    assert sorted({d.month for d in result}) == list(range(1, 13))


def test_last_business_day_walks_back_over_a_holiday():
    result = run("LAST_BUSINESS_DAY", holidays=[Holiday(date(2027, 1, 29))])
    assert date(2027, 1, 28) in result


def test_last_business_day_never_leaves_its_month():
    """O-07. Defined in terms of working days, so it is inherently clamped."""
    holidays = [Holiday(date(2027, 1, 29)), Holiday(date(2027, 1, 28))]
    result = run("LAST_BUSINESS_DAY", holidays=holidays)
    january = [d for d in result if d.month == 1]
    assert january == [date(2027, 1, 27)]


# --- FIRST_BUSINESS_DAY ---


def test_first_business_day_of_january_2027():
    # 1 January 2027 is a Friday and a working day by default.
    assert date(2027, 1, 1) in run("FIRST_BUSINESS_DAY")


def test_first_business_day_skips_new_year_holiday_to_monday():
    result = run("FIRST_BUSINESS_DAY", holidays=[Holiday(date(2027, 1, 1), "New Year")])
    # 2 and 3 January 2027 are the weekend.
    assert date(2027, 1, 4) in result


# --- QUARTER_END ---


def test_quarter_end_has_four_dates_in_the_right_months():
    result = run("QUARTER_END")
    assert len(result) == 4
    assert [d.month for d in result] == [3, 6, 9, 12]


def test_quarter_end_q1_2027():
    # 31 March 2027 is a Wednesday.
    assert date(2027, 3, 31) in run("QUARTER_END")


# --- DAY_OF_MONTH, and the O-07 boundary cases ---


def test_day_of_month_requires_its_parameter():
    with pytest.raises(ValueError, match="requires a 'day' parameter"):
        run("DAY_OF_MONTH")


def test_day_of_month_rejects_out_of_range_values():
    with pytest.raises(ValueError, match="must be 1-31"):
        run("DAY_OF_MONTH", day=40)


def test_day_of_month_shifts_the_15th_off_a_weekend():
    """The requirements' example: the 15th is not a working day, so it runs on the next one."""
    result = run("DAY_OF_MONTH", day=15)
    # 15 August 2027 is a Sunday.
    assert date(2027, 8, 16) in result
    assert date(2027, 8, 15) not in result


def test_day_of_month_shifts_off_a_holiday():
    result = run("DAY_OF_MONTH", day=15, holidays=[Holiday(date(2027, 1, 15), "Holiday")])
    # 16 and 17 January 2027 are the weekend.
    assert date(2027, 1, 18) in result


def test_day_of_month_clamps_back_into_its_month():
    """O-07. Shifting forward would leave the month, so CLAMP walks backward instead."""
    holidays = [Holiday(date(2027, 1, 29)), Holiday(date(2027, 2, 1))]
    result = run("DAY_OF_MONTH", day=31, holidays=holidays)
    january = [d for d in result if d.month == 1]
    # 31 January is a Sunday; 29 January is a holiday, so it lands on Thursday the 28th.
    assert january == [date(2027, 1, 28)]


def test_day_of_month_allows_overflow_when_configured():
    """O-07. The opposite ruling: the run is permitted to move into the next month."""
    policies = Policies(boundary=BoundaryPolicy.ALLOW_OVERFLOW)
    result = run("DAY_OF_MONTH", day=31, policies=policies)
    # 31 January 2027 is a Sunday, so it moves to Monday 1 February.
    assert date(2027, 2, 1) in result


def test_day_of_month_clamps_short_months():
    result = run("DAY_OF_MONTH", day=31)
    february = [d for d in result if d.month == 2]
    assert len(february) == 1


def test_day_of_month_skip_policy_drops_the_run():
    policies = Policies(holiday=HolidayPolicy.SKIP)
    result = run("DAY_OF_MONTH", day=15, policies=policies)
    assert date(2027, 8, 15) not in result
    assert date(2027, 8, 16) not in result


# --- WEEKEND_EXCLUSION ---


def test_weekend_exclusion_matches_the_weekday_count():
    result = run("WEEKEND_EXCLUSION")
    assert len(result) == 261
    assert all(d.weekday() < 5 for d in result)


def test_weekend_exclusion_removes_holidays():
    result = run("WEEKEND_EXCLUSION", holidays=[Holiday(date(2027, 1, 1))])
    assert date(2027, 1, 1) not in result
    assert len(result) == 260
