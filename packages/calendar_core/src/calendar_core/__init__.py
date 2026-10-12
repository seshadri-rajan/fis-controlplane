"""Pure date-rule engine.

Zero runtime dependencies by design: no framework, no I/O, no clock reads.
See packages/calendar_core/README.md.
"""

from .generation import generate_year, generate_years
from .rules import UnknownRuleError, get_evaluator, register, registered_rules
from .rules.holiday import HolidaySet
from .types import (
    DEFAULT_WEEKEND,
    BoundaryPolicy,
    BusinessDaySpec,
    CalendarSpec,
    CollisionPolicy,
    ExtendedRuleSpec,
    GeneratedDate,
    Holiday,
    HolidayPolicy,
    Policies,
    Weekday,
)

__all__ = [
    "DEFAULT_WEEKEND",
    "BoundaryPolicy",
    "BusinessDaySpec",
    "CalendarSpec",
    "CollisionPolicy",
    "ExtendedRuleSpec",
    "GeneratedDate",
    "Holiday",
    "HolidayPolicy",
    "HolidaySet",
    "Policies",
    "UnknownRuleError",
    "Weekday",
    "generate_year",
    "generate_years",
    "get_evaluator",
    "register",
    "registered_rules",
]
