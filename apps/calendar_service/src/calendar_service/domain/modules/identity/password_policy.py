"""Password rules and lockout policy: length, breach check, failure threshold (2.1)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

from .entity import User


class WeakPasswordError(ValueError):
    pass


@dataclass(frozen=True, slots=True)
class PasswordPolicy:
    min_length: int = 12
    lockout_threshold: int = 5
    lockout_minutes: int = 15

    def validate(self, password: str, *, user_name: str = "") -> None:
        """Length and obvious-reuse checks only.

        No composition rules: they push users towards predictable substitutions without adding
        meaningful entropy. A breached-password list is the missing control (RECORD 2.1).
        """
        if len(password) < self.min_length:
            raise WeakPasswordError(
                f"password must be at least {self.min_length} characters"
            )
        if user_name and user_name.lower() in password.lower():
            raise WeakPasswordError("password must not contain the user name")

    def register_failure(self, user: User, now: datetime) -> User:
        user.failed_login_count += 1
        if user.failed_login_count >= self.lockout_threshold:
            user.locked_until = now + timedelta(minutes=self.lockout_minutes)
            user.failed_login_count = 0
        return user

    def register_success(self, user: User) -> User:
        user.failed_login_count = 0
        user.locked_until = None
        return user
