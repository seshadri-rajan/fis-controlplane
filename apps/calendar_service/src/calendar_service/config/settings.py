"""Environment-backed settings via pydantic-settings. See .env.example."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="CALENDAR_", env_file=".env", extra="ignore")

    log_level: str = "INFO"
    preview_max_years: int = 5

    db_url: str = "sqlite+aiosqlite:///./calendar.db"
    db_echo: bool = False
    auto_create_schema: bool = True

    # When true, mutations raise a pending change request instead of applying directly (11.3).
    # Off until S-13 is answered; the change-request table exists either way.
    approval_required: bool = False

    # Empty means a random per-process key: sessions do not survive a restart, which is fine for
    # development and unacceptable in deployment.
    session_secret: str = ""
    session_idle_minutes: int = 30
    session_absolute_minutes: int = 480
    session_cookie_secure: bool = True

    password_min_length: int = 12
    lockout_threshold: int = 5
    lockout_minutes: int = 15

    materialise_years: int = 2


@lru_cache
def get_settings() -> Settings:
    return Settings()
