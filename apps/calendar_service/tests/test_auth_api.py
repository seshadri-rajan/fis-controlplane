"""Login, lockout, session lifetime, password change and role enforcement."""

from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from calendar_service.config.settings import Settings, get_settings
from calendar_service.domain.modules.identity.entity import Role, User
from calendar_service.domain.modules.identity.password_policy import PasswordPolicy
from calendar_service.infra.database.models import Base, Role as RoleModel
from calendar_service.infra.database.repositories.audit import AuditRepository
from calendar_service.infra.database.repositories.user import UserRepository
from calendar_service.infra.database.session import session_scope
from calendar_service.infra.services.identity_service import IdentityService
from calendar_service.main import app

GOOD_PASSWORD = "correct-horse-battery"
OTHER_PASSWORD = "another-long-passphrase"


@pytest_asyncio.fixture
async def session_factory() -> AsyncIterator[async_sessionmaker]:
    engine = create_async_engine("sqlite+aiosqlite://")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        for role in Role:
            session.add(RoleModel(role_name=role.value, created_by="seed"))
        await session.flush()

        identity = IdentityService(
            UserRepository(session), AuditRepository(session), PasswordPolicy()
        )
        await identity.create_user(
            User(user_name="maker", user_email="maker@example.invalid", roles={Role.CREATE}),
            GOOD_PASSWORD,
            "seed",
            must_change_password=False,
        )
        await identity.create_user(
            User(user_name="viewer", user_email="viewer@example.invalid", roles={Role.VIEWER}),
            GOOD_PASSWORD,
            "seed",
            must_change_password=False,
        )
        await session.commit()

    yield factory
    await engine.dispose()


@pytest_asyncio.fixture
async def client(session_factory) -> AsyncIterator[AsyncClient]:
    async def override_session():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[session_scope] = override_session
    app.dependency_overrides[get_settings] = lambda: Settings(
        auto_create_schema=False, session_cookie_secure=False, lockout_threshold=3
    )

    # https so the secure session cookie is retained by the client.
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as client:
        yield client
    app.dependency_overrides.clear()


async def login(client: AsyncClient, user: str = "maker", password: str = GOOD_PASSWORD):
    return await client.post(
        "/api/ui/auth/login", json={"user_name": user, "password": password}
    )


@pytest.mark.asyncio
async def test_login_succeeds_and_reports_roles(client):
    response = await login(client)
    assert response.status_code == 200
    assert response.json()["user_name"] == "maker"
    assert response.json()["roles"] == ["CREATE"]


@pytest.mark.asyncio
async def test_unauthenticated_request_is_rejected(client):
    assert (await client.get("/api/ui/calendars")).status_code == 401


@pytest.mark.asyncio
async def test_session_grants_access_to_protected_routes(client):
    await login(client)
    assert (await client.get("/api/ui/calendars")).status_code == 200
    assert (await client.get("/api/ui/auth/me")).json()["user_name"] == "maker"


@pytest.mark.asyncio
async def test_logout_ends_the_session(client):
    await login(client)
    assert (await client.post("/api/ui/auth/logout")).status_code == 204
    assert (await client.get("/api/ui/calendars")).status_code == 401


@pytest.mark.asyncio
async def test_wrong_password_and_unknown_user_are_indistinguishable(client):
    wrong = await login(client, password="not-the-password")
    unknown = await login(client, user="ghost", password="not-the-password")

    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json()["detail"] == unknown.json()["detail"] == "invalid credentials"


@pytest.mark.asyncio
async def test_repeated_failures_lock_the_account(client):
    for _ in range(3):
        assert (await login(client, password="wrong")).status_code == 401

    locked = await login(client)
    assert locked.status_code == 423
    assert "locked" in locked.json()["detail"]


@pytest.mark.asyncio
async def test_successful_login_clears_the_failure_count(client):
    await login(client, password="wrong")
    await login(client, password="wrong")
    assert (await login(client)).status_code == 200

    await login(client, password="wrong")
    assert (await login(client)).status_code == 200


@pytest.mark.asyncio
async def test_viewer_cannot_create_a_calendar(client):
    await login(client, user="viewer")
    response = await client.post(
        "/api/ui/calendars", json={"calendar_nm": "nope", "weekdays": [0]}
    )
    assert response.status_code == 403
    assert "CREATE" in response.json()["detail"]


@pytest.mark.asyncio
async def test_create_role_cannot_approve(client):
    await login(client)
    response = await client.post("/api/ui/change-requests/1/approve")
    assert response.status_code == 403
    assert "APPROVER" in response.json()["detail"]


@pytest.mark.asyncio
async def test_viewer_can_read(client):
    await login(client, user="viewer")
    assert (await client.get("/api/ui/calendars")).status_code == 200


@pytest.mark.asyncio
async def test_password_change_requires_the_current_password(client):
    await login(client)
    response = await client.post(
        "/api/ui/auth/password",
        json={"current_password": "wrong", "new_password": OTHER_PASSWORD},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_password_change_rejects_a_short_password(client):
    await login(client)
    response = await client.post(
        "/api/ui/auth/password",
        json={"current_password": GOOD_PASSWORD, "new_password": "short"},
    )
    assert response.status_code == 422
    assert "at least" in response.json()["detail"]


@pytest.mark.asyncio
async def test_password_change_rejects_reuse(client):
    await login(client)
    response = await client.post(
        "/api/ui/auth/password",
        json={"current_password": GOOD_PASSWORD, "new_password": GOOD_PASSWORD},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_password_change_succeeds_and_forces_reauthentication(client):
    await login(client)
    changed = await client.post(
        "/api/ui/auth/password",
        json={"current_password": GOOD_PASSWORD, "new_password": OTHER_PASSWORD},
    )
    assert changed.status_code == 204
    assert (await client.get("/api/ui/calendars")).status_code == 401

    assert (await login(client, password=GOOD_PASSWORD)).status_code == 401
    assert (await login(client, password=OTHER_PASSWORD)).status_code == 200


@pytest.mark.asyncio
async def test_idle_session_expires(session_factory):
    async def override_session():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[session_scope] = override_session
    app.dependency_overrides[get_settings] = lambda: Settings(
        auto_create_schema=False, session_cookie_secure=False, session_idle_minutes=0
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as client:
        await login(client)
        assert (await client.get("/api/ui/calendars")).status_code == 401
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_password_is_never_returned_or_echoed(client):
    response = await login(client)
    assert GOOD_PASSWORD not in response.text
    me = await client.get("/api/ui/auth/me")
    assert "password" not in me.text.lower().replace("must_change_password", "")
