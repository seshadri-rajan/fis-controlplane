from datetime import UTC, datetime, timedelta
from io import BytesIO

import httpx
import jwt
import pytest
from calendar_service.config.settings import get_settings
from calendar_service.infra.database.session import get_engine, get_session_factory
from calendar_service.main import app
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient
from openpyxl import Workbook, load_workbook
from sqlalchemy import create_engine, text

BASE = "/v1/calendars"
ISSUER = "https://identity.example.test"
AUDIENCE = "calendar-api"
UPLOAD_YEAR = datetime.now(UTC).year + 1
XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@pytest.fixture
def db_path(tmp_path, monkeypatch):
    path = tmp_path / "calendar.db"
    monkeypatch.setenv("CALENDAR_DB_URL", f"sqlite+aiosqlite:///{path.as_posix()}")
    monkeypatch.setenv("CALENDAR_AUTO_CREATE_SCHEMA", "true")
    get_settings.cache_clear()
    get_engine.cache_clear()
    get_session_factory.cache_clear()
    yield path
    get_session_factory.cache_clear()
    get_engine.cache_clear()
    get_settings.cache_clear()


@pytest.fixture
def client(db_path, monkeypatch):
    monkeypatch.setenv("CALENDAR_AUTH_ENABLED", "false")
    monkeypatch.setenv("CALENDAR_UPLOAD_MAX_BYTES", "5242880")
    with TestClient(app) as client:
        yield client


def create(client, name, *dates):
    return client.post(BASE, json={"calendarName": name, "dates": list(dates)})


def xlsx(*values, header="Calendar date", extra_sheet=False):
    workbook = Workbook()
    sheet = workbook.active
    sheet.append([header])
    for value in values:
        sheet.append(list(value) if isinstance(value, tuple) else [value])
    if extra_sheet:
        workbook.create_sheet("Unexpected")
    output = BytesIO()
    workbook.save(output)
    return output.getvalue()


def upload(
    client,
    name,
    workbook,
    *,
    create_only=False,
    year=str(UPLOAD_YEAR),
    media_type=XLSX_MEDIA_TYPE,
    filename="calendar.xlsx",
    data_type="application/json",
):
    return client.post(
        f"{BASE}/{name}/upload" + ("?createOnly=true" if create_only else ""),
        files={
            "data": (None, f'{{"year":"{year}"}}', data_type),
            "file": (filename, workbook, media_type),
        },
    )


def test_calendar_lifecycle_and_audit(client, db_path):
    assert client.get("/health").json() == {"status": "ok"}
    assert client.get("/api/ui/calendars").status_code == 404
    assert client.get(BASE).json() == {
        "calendars": [], "page": 1, "pageSize": 20, "totalItems": 0, "totalPages": 0,
    }

    created = create(client, "Test", "01-01-2028", "31-12-2027")
    assert created.status_code == 201
    assert created.headers["Location"] == f"{BASE}/Test"
    initial = created.json()
    assert initial["dates"] == ["31-12-2027", "01-01-2028"]
    assert initial["createdAt"] == initial["updatedAt"]
    assert initial["createdBy"] == "local-development"
    assert create(client, "Test").status_code == 400
    assert create(client, "test").status_code == 201
    assert create(client, "uploadedCalendars").status_code == 400
    assert create(client, "bad name").status_code == 400
    assert create(client, "BadDate", "29-02-2027").status_code == 400
    assert create(client, "Duplicate", "01-01-2028", "01-01-2028").status_code == 400
    assert client.get(f"{BASE}/bad%20name").status_code == 400

    page = client.get(BASE, params={"limit": 1, "offset": 2}).json()
    assert [row["calendarName"] for row in page["calendars"]] == ["test"]
    assert (page["totalItems"], page["totalPages"]) == (2, 2)
    assert client.get(BASE, params={"calendarName": "Tes", "migrated": "false"}).json()[
        "calendars"
    ] == [initial]
    assert client.get(BASE, params={"migrated": "true"}).json()["calendars"] == []
    assert client.get(BASE, params={"offset": 0}).json()["details"][0]["field"] == "offset"

    assert upload(client, "Test", xlsx(f"{UPLOAD_YEAR}-01-01")).status_code == 201
    update = {"calendarName": "Test", "status": "ACTIVE", "dates": ["29-02-2028"]}
    assert client.patch(f"{BASE}/test/update", json=update).status_code == 400
    assert client.patch(f"{BASE}/Absent/update", json=update | {
        "calendarName": "Absent",
    }).status_code == 404
    changed = client.patch(f"{BASE}/Test/update", json=update)
    assert changed.status_code == 200
    assert changed.json()["status"] == "ACTIVE"
    assert changed.json()["dates"] == ["29-02-2028"]
    assert changed.json()["createdAt"] == initial["createdAt"]
    assert changed.json()["updatedAt"] > initial["updatedAt"]
    assert client.get(f"{BASE}/Test").json() == changed.json()

    engine = create_engine(f"sqlite:///{db_path.as_posix()}")
    try:
        with engine.connect() as conn:
            assert conn.execute(text("select action from audit_log order by audit_log_id")).scalars(
            ).all() == ["CREATE", "CREATE", "UPLOAD", "UPDATE"]
    finally:
        engine.dispose()


def test_new_calendar_name_is_alphanumeric_and_limited_to_70(client):
    assert create(client, "A" * 70).status_code == 201
    assert create(client, "B" * 71).status_code == 400
    assert create(client, "calendar_name").status_code == 400


def test_create_calendar_from_upload_is_single_request_and_rejects_existing_name(client):
    created = upload(
        client,
        "FromFile",
        xlsx(f"{UPLOAD_YEAR}-01-01"),
        create_only=True,
    )
    assert created.status_code == 201
    assert created.json()["uploaded"] is True
    assert created.json()["dates"] == [f"01-01-{UPLOAD_YEAR}"]

    conflict = upload(
        client,
        "FromFile",
        xlsx(f"{UPLOAD_YEAR}-01-02"),
        create_only=True,
    )
    assert conflict.status_code == 409
    assert client.get(f"{BASE}/FromFile").json()["dates"] == [f"01-01-{UPLOAD_YEAR}"]


def test_admin_calendar_lifecycle_and_audit(client, db_path):
    assert create(client, "ordinary").status_code == 201
    assert client.post(f"{BASE}/ordinary/deactivate").status_code == 409

    assert upload(client, "managed", xlsx(f"{UPLOAD_YEAR}-01-01")).status_code == 201
    deactivated = client.post(f"{BASE}/managed/deactivate")
    assert deactivated.status_code == 200
    assert deactivated.json()["status"] == "INACTIVE"
    activated = client.post(f"{BASE}/managed/activate")
    assert activated.status_code == 200
    assert activated.json()["status"] == "ACTIVE"

    engine = create_engine(f"sqlite:///{db_path.as_posix()}")
    try:
        with engine.connect() as conn:
            assert conn.execute(
                text("select action from audit_log order by audit_log_id")
            ).scalars().all() == ["CREATE", "UPLOAD", "DEACTIVATE", "ACTIVATE"]
    finally:
        engine.dispose()


def test_upload_replace_year_and_exclude_dates(client):
    assert client.get(f"{BASE}/uploadedCalendars").json() == []
    next_year = UPLOAD_YEAR + 1
    assert create(client, "main", f"02-01-{UPLOAD_YEAR}", f"01-01-{next_year}").status_code == 201
    assert upload(
        client, "main", xlsx(f"{UPLOAD_YEAR}-01-31", f"{UPLOAD_YEAR}-01-01")
    ).json()["dates"] == [
        f"01-01-{UPLOAD_YEAR}", f"31-01-{UPLOAD_YEAR}", f"01-01-{next_year}",
    ]
    assert upload(
        client, "exclude", xlsx(f"{UPLOAD_YEAR}-01-31", f"{UPLOAD_YEAR}-01-02")
    ).status_code == 201
    assert client.get(f"{BASE}/uploadedCalendars").json() == [
        {"name": "exclude", "migrated": False}, {"name": "main", "migrated": False},
    ]
    dates_path = f"{BASE}/main/dates"
    assert client.get(dates_path, params={"excludeCalendar": "exclude"}).json() == [
        "01-01-2027", "01-01-2028",
    ]
    assert client.get(dates_path, params={"excludeCalendar": "absent"}).status_code == 404
    yesterday = datetime.now(UTC).date() - timedelta(days=1)
    past_date = yesterday.isoformat()
    invalid_workbooks = (
        xlsx(),
        xlsx(f"{UPLOAD_YEAR}-01-01", header="date"),
        xlsx(f"{UPLOAD_YEAR}-01-01", f"{UPLOAD_YEAR}-01-01"),
        xlsx(f"01-01-{UPLOAD_YEAR}"),
        xlsx(f"{UPLOAD_YEAR}-02-30"),
        xlsx(past_date),
        xlsx((f"{UPLOAD_YEAR}-01-01", "extra")),
        xlsx(f"{UPLOAD_YEAR}-01-01", extra_sheet=True),
    )
    for contents in invalid_workbooks:
        assert upload(client, "main", contents).status_code == 400
    assert upload(
        client, "main", xlsx(f"{UPLOAD_YEAR + 2}-01-01"), year=str(UPLOAD_YEAR + 2)
    ).status_code == 400
    assert upload(
        client, "a" * 71, xlsx(f"{UPLOAD_YEAR}-01-01")
    ).status_code == 400
    assert upload(client, "main", b"x" * (5_242_880 + 1)).status_code == 413
    unsupported_file = upload(
        client, "main", xlsx(f"{UPLOAD_YEAR}-01-01"), media_type="application/json"
    )
    assert unsupported_file.status_code == 415
    assert upload(
        client, "main", xlsx(f"{UPLOAD_YEAR}-01-01"), filename="calendar.csv"
    ).status_code == 415
    assert upload(
        client, "main", xlsx(f"{UPLOAD_YEAR}-01-01"), data_type="text/plain"
    ).status_code == 415
    assert client.post(f"{BASE}/main/upload", json={}).status_code == 415
    assert client.get(dates_path).json() == [
        f"01-01-{UPLOAD_YEAR}", f"31-01-{UPLOAD_YEAR}", f"01-01-{next_year}",
    ]


def test_verify_dates_returns_per_row_status_and_errors(client):
    yesterday = datetime.now(UTC).date() - timedelta(days=1)
    past_date = yesterday.isoformat()
    response = client.post(
        f"{BASE}/upload/verify",
        files={
            "data": (
                "metadata.json",
                f'{{"year":"{UPLOAD_YEAR}"}}',
                "application/json",
            ),
            "file": (
                "calendar.xlsx",
                xlsx(
                    f"{UPLOAD_YEAR}-01-01",
                    past_date,
                    f"{UPLOAD_YEAR}-Jan-01",
                    f"01-01-{UPLOAD_YEAR}",
                ),
                XLSX_MEDIA_TYPE,
            ),
        },
    )

    assert response.status_code == 200
    result = response.json()
    assert result["year"] == UPLOAD_YEAR
    assert result["valid"] is False
    assert result["items"][0] == {
        "row": 2,
        "value": f"{UPLOAD_YEAR}-01-01",
        "date": f"{UPLOAD_YEAR}-01-01",
        "valid": True,
        "errors": [],
    }
    assert "Past dates are not allowed." in result["items"][1]["errors"]
    assert "Dates must not contain letters." in result["items"][2]["errors"]
    assert "Date must use the YYYY-MM-DD format." in result["items"][3]["errors"]


def test_excel_export_includes_all_dates_as_iso_strings(client):
    dates = [f"01-01-{UPLOAD_YEAR}", f"31-12-{UPLOAD_YEAR + 1}"]
    assert create(client, "Exportable", *dates).status_code == 201

    response = client.get(f"{BASE}/Exportable/export")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith(XLSX_MEDIA_TYPE)
    workbook = load_workbook(BytesIO(response.content), read_only=True, data_only=True)
    try:
        rows = list(workbook.active.iter_rows(values_only=True))
    finally:
        workbook.close()
    assert rows == [
        ("Calendar date",),
        (f"{UPLOAD_YEAR}-01-01",),
        (f"{UPLOAD_YEAR + 1}-12-31",),
    ]


def test_starts_without_auth_configuration_by_default(db_path, monkeypatch):
    monkeypatch.chdir(db_path.parent)
    monkeypatch.delenv("CALENDAR_AUTH_ENABLED", raising=False)
    with TestClient(app) as local:
        assert local.post(BASE, json={"calendarName": "local"}).status_code == 201


def test_auth_enabled_without_provider_fails_startup(db_path, monkeypatch):
    monkeypatch.setenv("CALENDAR_AUTH_ENABLED", "true")
    monkeypatch.setenv("CALENDAR_OAUTH_ISSUER", "")
    with pytest.raises(ValueError, match="OAuth requires"), TestClient(app):
        pytest.fail("The application started without OAuth configuration")


def test_jwt_signature_audience_issuer_expiry_and_editor_mapping(db_path, monkeypatch):
    monkeypatch.setenv("CALENDAR_AUTH_ENABLED", "true")
    monkeypatch.setenv("CALENDAR_OAUTH_MODE", "jwt")
    monkeypatch.setenv("CALENDAR_OAUTH_ISSUER", ISSUER)
    monkeypatch.setenv("CALENDAR_OAUTH_AUDIENCE", AUDIENCE)
    monkeypatch.setenv("CALENDAR_OAUTH_JWKS_URL", f"{ISSUER}/jwks")
    monkeypatch.setenv("CALENDAR_OAUTH_ROLE_CLAIM", "realm_access.roles")
    monkeypatch.setenv("CALENDAR_OAUTH_ROLE_MAP", '{"calendar-write":"EDITOR"}')
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    jwk = jwt.algorithms.RSAAlgorithm.to_jwk(key.public_key(), as_dict=True)
    monkeypatch.setattr(jwt.PyJWKClient, "fetch_data", lambda _: {
        "keys": [jwk | {"kid": "test-key", "alg": "RS256"}],
    })

    def headers(signing_key=key, **claims):
        token = jwt.encode(
            {
                "iss": ISSUER, "aud": AUDIENCE, "sub": "client-123",
                "exp": datetime.now(UTC) + timedelta(minutes=5),
            } | claims,
            signing_key, algorithm="RS256", headers={"kid": "test-key"},
        )
        return {"Authorization": f"Bearer {token}"}

    with TestClient(app) as authenticated:
        unauthorized = authenticated.get(BASE)
        assert unauthorized.status_code == 401
        assert unauthorized.headers["WWW-Authenticate"] == 'Bearer realm="calendar-api"'
        assert authenticated.get(BASE, headers=headers()).status_code == 200
        wrong_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        for invalid in (
            headers(aud="other"), headers(iss="https://other.example.test"),
            headers(exp=datetime.now(UTC) - timedelta(seconds=1)), headers(wrong_key),
        ):
            assert authenticated.get(BASE, headers=invalid).status_code == 401
        assert authenticated.post(BASE, json={"calendarName": "denied"}, headers=headers(
            realm_access={"roles": ["EDITOR"]},
        )).status_code == 403
        written = authenticated.post(BASE, json={"calendarName": "allowed"}, headers=headers(
            realm_access={"roles": ["calendar-write"]}, preferred_username="editor-user",
        ))
        assert written.status_code == 201
        assert written.json()["createdBy"] == "editor-user"
        uploaded = authenticated.post(
            f"{BASE}/allowed/upload",
            files={
                "data": (None, f'{{"year":"{UPLOAD_YEAR}"}}', "application/json"),
                "file": (
                    "calendar.xlsx",
                    xlsx(f"{UPLOAD_YEAR}-01-01"),
                    XLSX_MEDIA_TYPE,
                ),
            },
            headers=headers(realm_access={"roles": ["calendar-write"]}),
        )
        assert uploaded.status_code == 201
        amendment = authenticated.patch(
            f"{BASE}/allowed/update",
            json={"calendarName": "allowed", "status": "ACTIVE", "dates": ["02-01-2027"]},
            headers=headers(realm_access={"roles": ["calendar-write"]}),
        )
        assert amendment.status_code == 403
        lifecycle = authenticated.post(
            f"{BASE}/allowed/deactivate",
            headers=headers(realm_access={"roles": ["calendar-write"]}),
        )
        assert lifecycle.status_code == 403


def test_opaque_token_introspection(db_path, monkeypatch):
    monkeypatch.setenv("CALENDAR_AUTH_ENABLED", "true")
    monkeypatch.setenv("CALENDAR_OAUTH_MODE", "introspection")
    monkeypatch.setenv("CALENDAR_OAUTH_ISSUER", ISSUER)
    monkeypatch.setenv("CALENDAR_OAUTH_AUDIENCE", AUDIENCE)
    monkeypatch.setenv("CALENDAR_OAUTH_INTROSPECTION_URL", f"{ISSUER}/introspect")
    monkeypatch.setenv("CALENDAR_OAUTH_CLIENT_ID", "calendar")
    monkeypatch.setenv("CALENDAR_OAUTH_CLIENT_SECRET", "test-only")

    def introspect(url, *, data, auth, timeout):
        assert url == f"{ISSUER}/introspect"
        assert auth == ("calendar", "test-only")
        return httpx.Response(200, request=httpx.Request("POST", url), json={
            "active": data["token"] != "inactive",
            "aud": "other" if data["token"] == "wrong-resource" else AUDIENCE,
            "sub": "some-client",
        })

    monkeypatch.setattr(httpx, "post", introspect)
    with TestClient(app) as authenticated:
        for token, status in (("opaque", 200), ("inactive", 401), ("wrong-resource", 401)):
            assert authenticated.get(
                BASE, headers={"Authorization": f"Bearer {token}"},
            ).status_code == status
