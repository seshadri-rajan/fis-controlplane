"""Value types for the rule engine. Plain dataclasses; no persistence concerns."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from enum import Enum, IntEnum


class Weekday(IntEnum):
    """Matches datetime.date.weekday()."""

    MONDAY = 0
    TUESDAY = 1
    WEDNESDAY = 2
    THURSDAY = 3
    FRIDAY = 4
    SATURDAY = 5
    SUNDAY = 6


DEFAULT_WEEKEND: frozenset[Weekday] = frozenset({Weekday.SATURDAY, Weekday.SUNDAY})


class HolidayPolicy(Enum):
    """What happens when a scheduled date falls on a holiday."""

    SHIFT_FORWARD = "shift_forward"
    SHIFT_BACKWARD = "shift_backward"
    SKIP = "skip"


class CollisionPolicy(Enum):
    """O-06. What happens when a shifted date lands on a date already scheduled."""

    MERGE = "merge"
    SHIFT_AGAIN = "shift_again"


class BoundaryPolicy(Enum):
    """O-07. What happens when shifting pushes a date out of its own period."""

    CLAMP = "clamp"
    ALLOW_OVERFLOW = "allow_overflow"


@dataclass(frozen=True, slots=True)
class Policies:
    """Defaults are provisional until O-06 and O-07 are ruled on by the client."""

    holiday: HolidayPolicy = HolidayPolicy.SHIFT_FORWARD
    collision: CollisionPolicy = CollisionPolicy.MERGE
    boundary: BoundaryPolicy = BoundaryPolicy.CLAMP
    weekend: frozenset[Weekday] = DEFAULT_WEEKEND


@dataclass(frozen=True, slots=True)
class Holiday:
    day: date
    name: str = ""


@dataclass(frozen=True, slots=True)
class BusinessDaySpec:
    weekdays: frozenset[Weekday]

    def __post_init__(self) -> None:
        if not self.weekdays:
            raise ValueError("a business-day calendar must select at least one weekday")


@dataclass(slots=True)
class ExtendedRuleSpec:
    rule_name: str
    params: dict[str, int] = field(default_factory=dict)


@dataclass(slots=True)
class CalendarSpec:
    name: str
    business_days: BusinessDaySpec | None = None
    extended_rule: ExtendedRuleSpec | None = None
    policies: Policies = field(default_factory=Policies)

    def __post_init__(self) -> None:
        # O-08: mutual exclusivity is enforced here, not only in the UI.
        if (self.business_days is None) == (self.extended_rule is None):
            raise ValueError(
                f"calendar {self.name!r} must have exactly one of business_days or extended_rule"
            )


@dataclass(frozen=True, slots=True)
class GeneratedDate:
    day: date
    shifted_from: date | None = None
    reason: str = ""

    @property
    def was_shifted(self) -> bool:
        return self.shifted_from is not None
