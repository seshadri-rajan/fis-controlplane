"""Rule name to evaluator lookup.

Fidelity supplies the extended rule list (D-09); it has not arrived yet (O-28). This registry is
what keeps late-arriving rules additive: a new rule is a new evaluator plus a test table.

A rule row in the database with no evaluator registered here does nothing.
"""

from __future__ import annotations

from collections.abc import Callable

from ..types import ExtendedRuleSpec, GeneratedDate, Policies
from .holiday import HolidaySet

Evaluator = Callable[[ExtendedRuleSpec, int, HolidaySet, Policies], list[GeneratedDate]]

_EVALUATORS: dict[str, Evaluator] = {}
_DESCRIPTIONS: dict[str, str] = {}


class UnknownRuleError(LookupError):
    pass


def register(name: str, description: str = "") -> Callable[[Evaluator], Evaluator]:
    def decorator(fn: Evaluator) -> Evaluator:
        key = name.upper()
        if key in _EVALUATORS:
            raise ValueError(f"rule {key!r} is already registered")
        _EVALUATORS[key] = fn
        _DESCRIPTIONS[key] = description or (fn.__doc__ or "").strip().splitlines()[0]
        return fn

    return decorator


def get_evaluator(name: str) -> Evaluator:
    try:
        return _EVALUATORS[name.upper()]
    except KeyError:
        raise UnknownRuleError(
            f"no evaluator registered for rule {name!r}; "
            f"registered rules are {sorted(_EVALUATORS)}"
        ) from None


def registered_rules() -> dict[str, str]:
    """Rule name to description. Seed data must match these keys exactly."""
    return dict(_DESCRIPTIONS)
