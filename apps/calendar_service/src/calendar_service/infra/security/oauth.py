"""Provider-independent OAuth access token validation."""

import time
from dataclasses import dataclass
from typing import Protocol
from urllib.parse import quote_plus, urlsplit

import httpx
import jwt

from calendar_service.config.settings import Settings


class InvalidToken(Exception):
    pass


class ProviderUnavailable(Exception):
    pass


@dataclass(frozen=True)
class Principal:
    username: str
    roles: frozenset[str]


class TokenVerifier(Protocol):
    def claims(self, token: str) -> dict[str, object]: ...


class JwtVerifier:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.keys = jwt.PyJWKClient(settings.oauth_jwks_url, timeout=5)

    def claims(self, token: str) -> dict[str, object]:
        try:
            header = jwt.get_unverified_header(token)
            if header.get("alg") != self.settings.oauth_algorithm or not isinstance(
                header.get("kid"), str
            ):
                raise InvalidToken
            key = self.keys.get_signing_key(header["kid"])
            if key.algorithm_name != self.settings.oauth_algorithm:
                raise InvalidToken
            return jwt.decode(
                token,
                key,
                algorithms=[self.settings.oauth_algorithm],
                issuer=self.settings.oauth_issuer,
                audience=self.settings.oauth_audience,
                options={"require": ["iss", "aud", "exp", "sub"]},
            )
        except jwt.PyJWKClientConnectionError as exc:
            raise ProviderUnavailable from exc
        except jwt.PyJWTError as exc:
            raise InvalidToken from exc


class IntrospectionVerifier:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def claims(self, token: str) -> dict[str, object]:
        settings = self.settings
        try:
            response = httpx.post(
                settings.oauth_introspection_url,
                data={"token": token, "token_type_hint": "access_token"},
                auth=(
                    quote_plus(settings.oauth_client_id),
                    quote_plus(settings.oauth_client_secret.get_secret_value()),
                ),
                timeout=5,
            )
            response.raise_for_status()
            claims = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise ProviderUnavailable from exc
        if not isinstance(claims, dict):
            raise ProviderUnavailable
        audience = claims.get("aud")
        audiences = audience if isinstance(audience, list) else [audience]
        expiry = claims.get("exp")
        if (
            claims.get("active") is not True
            or settings.oauth_audience not in audiences
            or ("iss" in claims and claims["iss"] != settings.oauth_issuer)
            or ("exp" in claims and (type(expiry) is not int or expiry <= time.time()))
        ):
            raise InvalidToken
        return claims


def build_verifier(settings: Settings) -> TokenVerifier | None:
    if not settings.auth_enabled:
        return None
    if not settings.oauth_issuer.strip() or not settings.oauth_audience.strip():
        raise ValueError("OAuth requires CALENDAR_OAUTH_ISSUER and CALENDAR_OAUTH_AUDIENCE")
    endpoint = (
        settings.oauth_jwks_url
        if settings.oauth_mode == "jwt"
        else settings.oauth_introspection_url
    )
    url = urlsplit(endpoint)
    if url.scheme != "https" or not url.hostname or url.username or url.password or url.fragment:
        raise ValueError("OAuth requires a configured HTTPS JWKS or introspection URL")
    if settings.oauth_mode == "jwt":
        return JwtVerifier(settings)
    if not settings.oauth_client_id or not settings.oauth_client_secret.get_secret_value():
        raise ValueError("OAuth introspection requires a client ID and secret")
    return IntrospectionVerifier(settings)


def claim_value(claims: dict[str, object], path: str) -> object:
    value: object = claims
    for key in path.split("."):
        if not isinstance(value, dict):
            return None
        value = value.get(key)
    return value


def principal_from_claims(claims: dict[str, object], settings: Settings) -> Principal:
    subject = claims.get("sub")
    if not isinstance(subject, str) or not subject.strip() or len(subject) > 256:
        raise InvalidToken
    name = claim_value(claims, settings.oauth_username_claim)
    username = name if isinstance(name, str) and name.strip() and len(name) <= 256 else subject
    roles = claim_value(claims, settings.oauth_role_claim)
    values = [roles] if isinstance(roles, str) else roles if isinstance(roles, list) else []
    return Principal(
        username,
        frozenset(
            settings.oauth_role_map[value]
            for value in values
            if isinstance(value, str) and value in settings.oauth_role_map
        ),
    )
