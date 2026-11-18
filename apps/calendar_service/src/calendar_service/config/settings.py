"""Environment-backed settings via pydantic-settings. See .env.example."""

from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="CALENDAR_", env_file=".env", extra="ignore")

    log_level: str = "INFO"
    db_url: str = "sqlite+aiosqlite:///./calendar.db"
    db_echo: bool = False
    auto_create_schema: bool = True
    upload_max_bytes: int = Field(default=2 * 1024 * 1024, gt=0)

    auth_enabled: bool = True
    oauth_mode: Literal["jwt", "introspection"] = "jwt"
    oauth_issuer: str = ""
    oauth_audience: str = ""
    oauth_jwks_url: str = ""
    oauth_algorithm: Literal["RS256", "RS384", "RS512", "PS256", "ES256", "ES384"] = "RS256"
    oauth_introspection_url: str = ""
    oauth_client_id: str = ""
    oauth_client_secret: SecretStr = SecretStr("")
    oauth_role_claim: str = "roles"
    oauth_role_map: dict[str, Literal["VIEWER", "EDITOR", "ADMIN"]] = Field(
        default_factory=lambda: {"VIEWER": "VIEWER", "EDITOR": "EDITOR", "ADMIN": "ADMIN"}
    )
    oauth_username_claim: str = "preferred_username"

    materialise_years: int = 2


@lru_cache
def get_settings() -> Settings:
    return Settings()
