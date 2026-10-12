"""Calendar entity and invariants.

Date computation lives in calendar_core; this owns identity, lifecycle and rule binding.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from enum import StrEnum

from calendar_core import (
    BoundaryPolicy,
    BusinessDaySpec,
    CalendarSpec,
    CollisionPolicy,
    ExtendedRuleSpec,
    HolidayPolicy,
    Policies,
    Weekday,
)


class CalendarKind(StrEnum):
    BUSINESS_DAYS = "BUSINESS_DAYS"
    EXTENDED_RULE = "EXTENDED_RULE"


@dataclass(slots=True)
class CalendarPolicies:
    holiday: str = HolidayPolicy.SHIFT_FORWARD.value
    collision: str = CollisionPolicy.MERGE.value
    boundary: str = BoundaryPolicy.CLAMP.value

    def to_core(self) -> Policies:
        return Policies(
            holiday=HolidayPolicy(self.holiday),
            collision=CollisionPolicy(self.collision),
            boundary=BoundaryPolicy(self.boundary),
        )


@dataclass(slots=True)
class Calendar:
    calendar_nm: str
    kind: CalendarKind
    calendar_key: int | None = None
    calendar_desc: str | None = None
    weekdays: list[int] | None = None
    calendar_rule_id: int | None = None
    rule_name: str | None = None
    rule_params: dict[str, int] = field(default_factory=dict)
    policies: CalendarPolicies = field(default_factory=CalendarPolicies)
    holiday_calendar_id: int | None = None
    bu_id: int | None = None
    app_id: int | None = None
    active_flag: bool = True
    created_by: str = ""

    def __post_init__(self) -> None:
        if self.kind is CalendarKind.BUSINESS_DAYS:
            if not self.weekdays:
                raise ValueError("a business-day calendar must select at least one weekday")
            if self.calendar_rule_id is not None:
                raise ValueError("a business-day calendar must not reference a rule")
        else:
            if self.calendar_rule_id is None and self.rule_name is None:
                raise ValueError("an extended-rule calendar must reference a rule")
            if self.weekdays:
                raise ValueError("an extended-rule calendar must not select weekdays")

    def to_spec(self) -> CalendarSpec:
        if self.kind is CalendarKind.BUSINESS_DAYS:
            assert self.weekdays is not None
            return CalendarSpec(
                name=self.calendar_nm,
                business_days=BusinessDaySpec(frozenset(Weekday(d) for d in self.weekdays)),
                policies=self.policies.to_core(),
            )

        if self.rule_name is None:
            raise ValueError(f"calendar {self.calendar_nm!r} has no resolved rule name")
        return CalendarSpec(
            name=self.calendar_nm,
            extended_rule=ExtendedRuleSpec(self.rule_name, dict(self.rule_params)),
            policies=self.policies.to_core(),
        )


@dataclass(frozen=True, slots=True)
class CalendarDate:
    calendar_date: date
    shifted_from: date | None = None
    remarks: str = ""
