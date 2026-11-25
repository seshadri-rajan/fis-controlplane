"""Wire models and strict date validation for Calendar Management v1."""

import re
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, StringConstraints

NAME_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$"
NEW_NAME_PATTERN = r"^[A-Za-z0-9]{1,70}$"
DATE_PATTERN = r"^[0-9]{2}-[0-9]{2}-[0-9]{4}$"
CalendarName = Annotated[str, StringConstraints(min_length=1, max_length=128, pattern=NAME_PATTERN)]
NewCalendarName = Annotated[str, StringConstraints(pattern=NEW_NAME_PATTERN)]
CalendarStatus = Literal["ACTIVE", "INACTIVE"]


def parse_date(value: str) -> date:
    if not re.fullmatch(DATE_PATTERN, value):
        raise ValueError("Must be a valid date in DD-MM-YYYY format.")
    day, month, year = map(int, value.split("-"))
    try:
        return date(year, month, day)
    except ValueError as exc:
        raise ValueError("Must be a valid date in DD-MM-YYYY format.") from exc


def format_date(day: date) -> str:
    return f"{day.day:02d}-{day.month:02d}-{day.year:04d}"


def validate_dates(values: list[str]) -> list[str]:
    for value in values:
        parse_date(value)
    if len(set(values)) != len(values):
        raise ValueError("Duplicate dates are not allowed.")
    return values


CalendarDate = Annotated[str, StringConstraints(pattern=DATE_PATTERN)]
WriteDates = Annotated[list[CalendarDate], AfterValidator(validate_dates)]


class CreateCalendar(BaseModel):
    model_config = ConfigDict(extra="forbid")

    calendarName: NewCalendarName
    dates: WriteDates = []


class UpdateCalendar(BaseModel):
    model_config = ConfigDict(extra="forbid")

    calendarName: CalendarName
    dates: WriteDates = []
    status: CalendarStatus


class CalendarResponse(BaseModel):
    calendarName: CalendarName
    dates: list[CalendarDate]
    migrated: bool
    uploaded: bool
    status: CalendarStatus
    createdBy: str
    createdAt: datetime
    updatedAt: datetime


class CalendarPage(BaseModel):
    calendars: list[CalendarResponse]
    page: int
    pageSize: int
    totalItems: int
    totalPages: int


class UploadedCalendar(BaseModel):
    name: CalendarName
    migrated: bool


class UploadMetadata(BaseModel):
    model_config = ConfigDict(extra="forbid")

    year: Annotated[str, StringConstraints(pattern=r"^[0-9]{4}$")]


class UploadVerificationItem(BaseModel):
    row: int
    value: str | None
    date: str | None
    valid: bool
    errors: list[str]


class UploadVerificationResponse(BaseModel):
    year: int
    valid: bool
    items: list[UploadVerificationItem]
    errors: list[str]


class ValidationErrorDetail(BaseModel):
    field: str
    message: str


class ErrorResponse(BaseModel):
    status: str
    error: str
    message: str
    details: list[ValidationErrorDetail] | None = None
