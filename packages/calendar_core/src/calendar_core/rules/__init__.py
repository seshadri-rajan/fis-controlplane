"""Rule evaluators.

Each evaluator is a pure function: (spec, year, holidays, policies) -> list[GeneratedDate].
Register new evaluators in registry.py so they are reachable by rule name.
"""

from . import extended  # noqa: F401  -- import registers the built-in evaluators
from .registry import UnknownRuleError, get_evaluator, register, registered_rules

__all__ = ["UnknownRuleError", "get_evaluator", "register", "registered_rules"]
