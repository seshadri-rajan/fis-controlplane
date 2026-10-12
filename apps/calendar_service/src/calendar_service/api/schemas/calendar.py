"""Transport models for calendar CRUD and the approval queue."""

from __future__ import annotations

from dataclasses import asdict
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field, model_validator

from calendar_core import Weekday

from ...domain.modules.calendar.entity import (
    Calendar,
    CalendarKind,
    CalendarPolicies,
)
from .preview import PoliciesIn


class CalendarWrite(BaseModel):
    calendar_nm: str = Field(min_length=1, max_length=100)
    calendar_desc: str | None = None
    weekdays: list[Weekday] | None = None
    rule_name: str | None = None
    rule_params: dict[str, int] = Field(default_factory=dict)
    policies: PoliciesIn = Field(default_factory=PoliciesIn)
    holiday_calendar_id: int | None = None
    bu_id: int | None = None
    app_id: int | None = None

    @model_validator(mode="after")
    def exactly_one_kind(self) -> CalendarWrite:
        if (self.weekdays is None) == (self.rule_name is None):
            raise ValueError("provide exactly one of weekdays or rule_name")
        if self.weekdays is not None and not self.weekdays:
            raise ValueError("weekdays must not be empty")
        return self

    def to_entity(self, actor: str) -> Calendar:
        return Calendar(
            calendar_nm=self.calendar_nm,
            calendar_desc=self.calendar_desc,
            kind=(
                CalendarKind.BUSINESS_DAYS
                if self.weekdays is not None
                else CalendarKind.EXTENDED_RULE
            ),
            weekdays=list(self.weekdays) if self.weekdays is not None else None,
            rule_name=self.rule_name,
            rule_params=dict(self.rule_params),
            policies=CalendarPolicies(
                holiday=self.policies.holiday.value,
                collision=self.policies.collision.value,
                boundary=self.policies.boundary.value,
            ),
            holiday_calendar_id=self.holiday_calendar_id,
            bu_id=self.bu_id,
            app_id=self.app_id,
            created_by=actor,
        )


class CalendarRead(BaseModel):
    calendar_key: int
    calendar_nm: str
    calendar_desc: str | None
    kind: CalendarKind
    weekdays: list[int] | None
    rule_name: str | None
    rule_params: dict[str, int]
    policies: dict[str, str]
    holiday_calendar_id: int | None
    active_flag: bool
    created_by: str

    @classmethod
    def of(cls, calendar: Calendar) -> CalendarRead:
        assert calendar.calendar_key is not None
        return cls(
            calendar_key=calendar.calendar_key,
            calendar_nm=calendar.calendar_nm,
            calendar_desc=calendar.calendar_desc,
            kind=calendar.kind,
            weekdays=calendar.weekdays,
            rule_name=calendar.rule_name,
            rule_params=calendar.rule_params,
            policies=asdict(calendar.policies),
            holiday_calendar_id=calendar.holiday_calendar_id,
            active_flag=calendar.active_flag,
            created_by=calendar.created_by,
        )


class CalendarDateRead(BaseModel):
    calendar_date: date
    shifted_from: date | None
    remarks: str


class ChangeRequestRead(BaseModel):
    change_request_id: int
    entity: str
    entity_key: int | None
    action: str
    status: str
    maker: str
    made_at: datetime | None
    checker: str | None
    checked_at: datetime | None
    reject_reason: str | None
    payload: dict[str, Any]


class AuditEntryRead(BaseModel):
    audit_key: int | None
    entity: str
    entity_key: int | None
    action: str
    old_value: dict[str, Any] | None
    new_value: dict[str, Any] | None
    updated_by: str
    updated_at: datetime | None


class MutationResult(BaseModel):
    """Either the applied calendar, or the pending request awaiting a second pair of eyes."""

    applied: CalendarRead | None
    change_request: ChangeRequestRead


class RejectRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=500)


class MaterialiseRequest(BaseModel):
    years: list[int] = Field(min_length=1)
