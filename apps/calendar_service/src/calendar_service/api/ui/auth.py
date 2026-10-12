"""Login, logout, password change. Local credentials only; no SSO in this phase (D-01)."""

from fastapi import APIRouter, HTTPException, Request, status

from ...config.dependency import CurrentUserDep, IdentityServiceDep, SessionDep
from ...domain.modules.identity.password_policy import WeakPasswordError
from ...infra.services.identity_service import AccountLockedError, AuthenticationError
from ..middlewares import session_auth
from ..schemas.auth import ChangePasswordRequest, CurrentUserRead, LoginRequest

router = APIRouter(prefix="/api/ui/auth", tags=["auth"])


@router.post("/login")
async def login(
    request: Request,
    body: LoginRequest,
    identity: IdentityServiceDep,
    session: SessionDep,
) -> CurrentUserRead:
    try:
        user = await identity.authenticate(body.user_name, body.password)
    except AccountLockedError as exc:
        await session.commit()
        raise HTTPException(status.HTTP_423_LOCKED, str(exc)) from exc
    except AuthenticationError as exc:
        await session.commit()
        # Deliberately identical for unknown user and wrong password.
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid credentials") from exc

    await session.commit()
    session_auth.establish(request, user.user_name, user.roles, user.must_change_password)
    return CurrentUserRead(
        user_name=user.user_name,
        roles=sorted(r.value for r in user.roles),
        must_change_password=user.must_change_password,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(request: Request) -> None:
    session_auth.destroy(request)


@router.get("/me")
async def me(user: CurrentUserDep) -> CurrentUserRead:
    return CurrentUserRead(
        user_name=user.user_name,
        roles=sorted(r.value for r in user.roles),
        must_change_password=user.must_change_password,
    )


@router.post("/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    request: Request,
    body: ChangePasswordRequest,
    user: CurrentUserDep,
    identity: IdentityServiceDep,
    session: SessionDep,
) -> None:
    try:
        await identity.change_password(user.user_name, body.current_password, body.new_password)
    except AuthenticationError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid credentials") from exc
    except WeakPasswordError as exc:
        raise HTTPException(422, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc

    await session.commit()
    # Force re-authentication so any other session using the old password is invalidated.
    session_auth.destroy(request)
