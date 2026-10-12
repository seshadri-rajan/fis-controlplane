"""Calendar CRUD, materialisation and the four-eyes gate."""

from collections.abc import AsyncIterator
from datetime import date

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from calendar_service.config.dependency import get_current_user
from calendar_service.config.settings import Settings, get_settings
from calendar_service.domain.modules.identity.entity import CurrentUser, Role
from calendar_service.infra.database.models import (
    Base,
    CalendarRule,
    HolidayCalendar,
    HolidayDate,
)
from calendar_service.infra.database.session import session_scope
from calendar_service.main import app

MON_TO_FRI = [0, 1, 2, 3, 4]


def as_user(name: str, *roles: Role):
    return lambda: CurrentUser(user_name=name, roles=frozenset(roles))


@pytest_asyncio.fixture
async def session_factory() -> AsyncIterator[async_sessionmaker]:
    engine = create_async_engine("sqlite+aiosqlite://")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        holiday_calendar = HolidayCalendar(holiday_calendar_nm="US", created_by="seed")
        session.add(holiday_calendar)
        await session.flush()
        session.add_all(
            [
                HolidayDate(
                    holiday_calendar_id=holiday_calendar.holiday_calendar_id,
                    holiday_date=date(2027, 1, 1),
                    holiday_name="New Year",
                ),
                CalendarRule(calendar_rule_nm="LAST_BUSINESS_DAY", created_by="seed"),
            ]
        )
        await session.commit()

    yield factory
    await engine.dispose()


def build_client(session_factory, *, approval_required: bool) -> AsyncClient:
    """Overrides only the session and settings.

    The service is still constructed by the real container, so it shares the request-scoped
    session with the route that commits it.
    """

    async def override_session():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[session_scope] = override_session
    app.dependency_overrides[get_settings] = lambda: Settings(
        approval_required=approval_required, auto_create_schema=False
    )
    app.dependency_overrides[get_current_user] = as_user("maker.user", Role.CREATE)

    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest_asyncio.fixture
async def client(session_factory) -> AsyncIterator[AsyncClient]:
    async with build_client(session_factory, approval_required=False) as client:
        yield client
    app.dependency_overrides.clear()


def business_days(name: str = "mon-fri", **extra) -> dict:
    return {"calendar_nm": name, "weekdays": MON_TO_FRI, **extra}


# --- direct-apply mode (approval gate off) ---


@pytest.mark.asyncio
async def test_create_then_read_back(client):
    created = await client.post("/api/ui/calendars", json=business_days())
    assert created.status_code == 201

    body = created.json()
    assert body["applied"]["calendar_nm"] == "mon-fri"
    assert body["change_request"]["status"] == "APPROVED"
    # No second pair of eyes was involved, and the record says so rather than naming the maker.
    assert body["change_request"]["checker"] is None

    key = body["applied"]["calendar_key"]
    fetched = await client.get(f"/api/ui/calendars/{key}")
    assert fetched.status_code == 200
    assert fetched.json()["kind"] == "BUSINESS_DAYS"


@pytest.mark.asyncio
async def test_create_materialises_dates(client):
    created = await client.post("/api/ui/calendars", json=business_days())
    key = created.json()["applied"]["calendar_key"]

    dates = await client.get(f"/api/ui/calendars/{key}/dates", params={"year": 2027})
    assert dates.status_code == 200
    assert len(dates.json()) > 200


@pytest.mark.asyncio
async def test_materialisation_applies_the_seeded_holiday(client):
    created = await client.post("/api/ui/calendars", json=business_days())
    key = created.json()["applied"]["calendar_key"]
    await client.post(f"/api/ui/calendars/{key}/materialise", json={"years": [2027]})

    dates = await client.get(f"/api/ui/calendars/{key}/dates", params={"year": 2027})
    days = [d["calendar_date"] for d in dates.json()]
    assert "2027-01-01" not in days  # seeded holiday


@pytest.mark.asyncio
async def test_duplicate_name_is_rejected(client):
    await client.post("/api/ui/calendars", json=business_days())
    duplicate = await client.post("/api/ui/calendars", json=business_days())
    assert duplicate.status_code == 409


@pytest.mark.asyncio
async def test_extended_rule_calendar_resolves_the_rule(client):
    created = await client.post(
        "/api/ui/calendars",
        json={"calendar_nm": "month-end", "rule_name": "LAST_BUSINESS_DAY"},
    )
    assert created.status_code == 201
    assert created.json()["applied"]["rule_name"] == "LAST_BUSINESS_DAY"

    key = created.json()["applied"]["calendar_key"]
    dates = await client.get(f"/api/ui/calendars/{key}/dates", params={"year": 2027})
    assert len(dates.json()) == 12


@pytest.mark.asyncio
async def test_unregistered_rule_is_rejected(client):
    response = await client.post(
        "/api/ui/calendars", json={"calendar_nm": "nope", "rule_name": "NOT_SEEDED"}
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_both_kinds_at_once_is_rejected(client):
    response = await client.post(
        "/api/ui/calendars",
        json={"calendar_nm": "both", "weekdays": MON_TO_FRI, "rule_name": "LAST_BUSINESS_DAY"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_update_changes_policies_and_regenerates(client):
    created = await client.post("/api/ui/calendars", json=business_days())
    key = created.json()["applied"]["calendar_key"]

    updated = await client.put(
        f"/api/ui/calendars/{key}",
        json=business_days(weekdays=[0], policies={"holiday": "skip"}),
    )
    assert updated.status_code == 200
    assert updated.json()["applied"]["policies"]["holiday"] == "skip"

    dates = await client.get(f"/api/ui/calendars/{key}/dates", params={"year": 2027})
    assert len(dates.json()) < 60  # Mondays only


@pytest.mark.asyncio
async def test_delete_is_a_soft_delete(client):
    created = await client.post("/api/ui/calendars", json=business_days())
    key = created.json()["applied"]["calendar_key"]

    assert (await client.delete(f"/api/ui/calendars/{key}")).status_code == 200
    assert (await client.get("/api/ui/calendars")).json() == []
    assert (
        await client.get("/api/ui/calendars", params={"include_inactive": True})
    ).json()[0]["active_flag"] is False


@pytest.mark.asyncio
async def test_missing_calendar_returns_404(client):
    assert (await client.get("/api/ui/calendars/999")).status_code == 404


# --- audit trail ---


@pytest.mark.asyncio
async def test_every_change_is_audited_with_before_and_after(client):
    created = await client.post("/api/ui/calendars", json=business_days())
    key = created.json()["applied"]["calendar_key"]
    await client.put(f"/api/ui/calendars/{key}", json=business_days(weekdays=[0]))
    await client.delete(f"/api/ui/calendars/{key}")

    history = (await client.get(f"/api/ui/calendars/{key}/history")).json()
    assert [entry["action"] for entry in history] == ["DELETE", "UPDATE", "CREATE"]
    assert all(entry["updated_by"] == "maker.user" for entry in history)

    create_entry = history[-1]
    assert create_entry["old_value"] is None
    assert create_entry["new_value"]["calendar_nm"] == "mon-fri"

    update_entry = history[1]
    assert update_entry["old_value"]["weekdays"] == MON_TO_FRI
    assert update_entry["new_value"]["weekdays"] == [0]


@pytest.mark.asyncio
async def test_approval_decisions_are_audited(session_factory):
    async with build_client(session_factory, approval_required=True) as client:
        created = await client.post("/api/ui/calendars", json=business_days())
        request_id = created.json()["change_request"]["change_request_id"]

        app.dependency_overrides[get_current_user] = as_user("checker.user", Role.APPROVER)
        await client.post(f"/api/ui/change-requests/{request_id}/approve")

        calendars = (await client.get("/api/ui/calendars")).json()
        history = (
            await client.get(f"/api/ui/calendars/{calendars[0]['calendar_key']}/history")
        ).json()

        # The applied change is attributed to the approver, not the maker.
        assert history[0]["action"] == "CREATE"
        assert history[0]["updated_by"] == "checker.user"
    app.dependency_overrides.clear()


# --- four-eyes mode (approval gate on) ---


@pytest.mark.asyncio
async def test_create_is_held_pending_when_approval_required(session_factory):
    async with build_client(session_factory, approval_required=True) as client:
        response = await client.post("/api/ui/calendars", json=business_days())
        assert response.status_code == 202
        assert response.json()["applied"] is None
        assert response.json()["change_request"]["status"] == "PENDING"

        assert (await client.get("/api/ui/calendars")).json() == []
        assert len((await client.get("/api/ui/change-requests")).json()) == 1
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_maker_cannot_approve_their_own_change(session_factory):
    """O-30: even a user holding both Create and Approver cannot approve their own change."""
    async with build_client(session_factory, approval_required=True) as client:
        app.dependency_overrides[get_current_user] = as_user(
            "maker.user", Role.CREATE, Role.APPROVER
        )
        created = await client.post("/api/ui/calendars", json=business_days())
        request_id = created.json()["change_request"]["change_request_id"]

        denied = await client.post(f"/api/ui/change-requests/{request_id}/approve")
        assert denied.status_code == 403
        assert "different person" in denied.json()["detail"]
    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_second_person_approves_and_the_calendar_appears(session_factory):
    async with build_client(session_factory, approval_required=True) as client:
        created = await client.post("/api/ui/calendars", json=business_days())
        request_id = created.json()["change_request"]["change_request_id"]

        app.dependency_overrides[get_current_user] = as_user("checker.user", Role.APPROVER)
        approved = await client.post(f"/api/ui/change-requests/{request_id}/approve")
        assert approved.status_code == 200
        assert approved.json()["status"] == "APPROVED"
        assert approved.json()["checker"] == "checker.user"

        calendars = (await client.get("/api/ui/calendars")).json()
        assert len(calendars) == 1
        assert calendars[0]["calendar_nm"] == "mon-fri"
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_rejection_requires_a_reason_and_blocks_the_change(session_factory):
    async with build_client(session_factory, approval_required=True) as client:
        created = await client.post("/api/ui/calendars", json=business_days())
        request_id = created.json()["change_request"]["change_request_id"]

        app.dependency_overrides[get_current_user] = as_user("checker.user", Role.APPROVER)
        blank = await client.post(
            f"/api/ui/change-requests/{request_id}/reject", json={"reason": ""}
        )
        assert blank.status_code == 422

        rejected = await client.post(
            f"/api/ui/change-requests/{request_id}/reject", json={"reason": "wrong weekdays"}
        )
        assert rejected.status_code == 200
        assert rejected.json()["status"] == "REJECTED"
        assert (await client.get("/api/ui/calendars")).json() == []
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_a_resolved_request_cannot_be_approved_again(session_factory):
    async with build_client(session_factory, approval_required=True) as client:
        created = await client.post("/api/ui/calendars", json=business_days())
        request_id = created.json()["change_request"]["change_request_id"]

        app.dependency_overrides[get_current_user] = as_user("checker.user", Role.APPROVER)
        await client.post(f"/api/ui/change-requests/{request_id}/approve")
        again = await client.post(f"/api/ui/change-requests/{request_id}/approve")
        assert again.status_code == 409
    app.dependency_overrides.clear()
