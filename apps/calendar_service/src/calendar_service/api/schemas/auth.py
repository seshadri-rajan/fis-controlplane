"""Transport models for authentication."""

from __future__ import annotations

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    user_name: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=256)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=256)
    new_password: str = Field(min_length=1, max_length=256)


class CurrentUserRead(BaseModel):
    user_name: str
    roles: list[str]
    must_change_password: bool
