"""Transport models for the preview endpoint.

Deliberately mirrors calendar_core's vocabulary rather than inventing a second one, so there is
one place to change when the rule semantics are ruled on.
"""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel, Field, model_validator

from calendar_core import (
    BoundaryPolicy,
    BusinessDaySpec,
    CalendarSpec,
    CollisionPolicy,
    ExtendedRuleSpec,
    Holiday,
    HolidayPolicy,
    Policies,
    Weekday,
)


class HolidayIn(BaseModel):
    day: date
    name: str = ""

    def to_domain(self) -> Holiday:
        return Holiday(day=self.day, name=self.name)


class PoliciesIn(BaseModel):
    holiday: HolidayPolicy = HolidayPolicy.SHIFT_FORWARD
    collision: CollisionPolicy = CollisionPolicy.MERGE
    boundary: BoundaryPolicy = BoundaryPolicy.CLAMP

    def to_domain(self) -> Policies:
        return Policies(holiday=self.holiday, collision=self.collision, boundary=self.boundary)


class ExtendedRuleIn(BaseModel):
    rule_name: str
    params: dict[str, int] = Field(default_factory=dict)


class PreviewRequest(BaseModel):
    name: str = "preview"
    year: int = Field(ge=2000, le=2100)
    business_days: list[Weekday] | None = None
    extended_rule: ExtendedRuleIn | None = None
    policies: PoliciesIn = Field(default_factory=PoliciesIn)
    holidays: list[HolidayIn] = Field(default_factory=list)

    @model_validator(mode="after")
    def exactly_one_kind(self) -> PreviewRequest:
        if (self.business_days is None) == (self.extended_rule is None):
            raise ValueError("provide exactly one of business_days or extended_rule")
        if self.business_days is not None and not self.business_days:
            raise ValueError("business_days must not be empty")
        return self

    def to_spec(self) -> CalendarSpec:
        return CalendarSpec(
            name=self.name,
            business_days=(
                BusinessDaySpec(frozenset(self.business_days))
                if self.business_days is not None
                else None
            ),
            extended_rule=(
                ExtendedRuleSpec(self.extended_rule.rule_name, dict(self.extended_rule.params))
                if self.extended_rule is not None
                else None
            ),
            policies=self.policies.to_domain(),
        )


class PreviewDate(BaseModel):
    day: date
    shifted_from: date | None = None
    reason: str = ""


class PreviewResponse(BaseModel):
    name: str
    year: int
    total: int
    shifted_count: int
    by_month: dict[int, int]
    dates: list[PreviewDate]


class RuleSummary(BaseModel):
    rule_name: str
    description: str
