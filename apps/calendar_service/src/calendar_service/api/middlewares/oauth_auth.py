"""Bearer authentication and write authorization for the management API."""

from typing import Annotated

from fastapi import Depends, HTTPException, Request, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from calendar_service.config.dependency import SettingsDep
from calendar_service.infra.security.oauth import (
    InvalidToken,
    Principal,
    ProviderUnavailable,
    TokenVerifier,
    principal_from_claims,
)

bearer = HTTPBearer(scheme_name="bearerAuth", auto_error=False)


def get_principal(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Security(bearer)],
    settings: SettingsDep,
) -> Principal:
    if not settings.auth_enabled:
        return Principal("local-development", frozenset({"ADMIN"}))
    challenge = {"WWW-Authenticate": 'Bearer realm="calendar-api"'}
    if credentials is None:
        raise HTTPException(401, "A bearer access token is required.", headers=challenge)
    verifier: TokenVerifier | None = getattr(request.app.state, "token_verifier", None)
    if verifier is None:
        raise HTTPException(500, "OAuth token validation is unavailable.")
    try:
        return principal_from_claims(verifier.claims(credentials.credentials), settings)
    except InvalidToken as exc:
        raise HTTPException(401, "Invalid or expired access token.", headers=challenge) from exc
    except ProviderUnavailable as exc:
        raise HTTPException(500, "OAuth token validation is unavailable.") from exc


PrincipalDep = Annotated[Principal, Depends(get_principal)]


def require_editor(user: PrincipalDep) -> Principal:
    if not user.roles.intersection({"EDITOR", "ADMIN"}):
        raise HTTPException(403, "This operation requires EDITOR or ADMIN.")
    return user


EditorDep = Annotated[Principal, Depends(require_editor)]
