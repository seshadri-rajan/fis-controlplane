"""Preview endpoint: contract, validation and the rule catalogue."""

from datetime import date

import pytest
from fastapi.testclient import TestClient

from calendar_service.main import app


@pytest.fixture
def client():
    return TestClient(app)


def post(client, **body):
    return client.post("/api/ui/preview", json=body)


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_rule_catalogue_matches_the_engine_registry(client):
    response = client.get("/api/ui/preview/rules")
    assert response.status_code == 200
    names = {r["rule_name"] for r in response.json()}
    assert {"LAST_BUSINESS_DAY", "QUARTER_END", "WEEKEND_EXCLUSION"} <= names
    assert all(r["description"] for r in response.json())


def test_business_day_preview_summarises_by_month(client):
    response = post(client, name="mon-fri", year=2027, business_days=[0, 1, 2, 3, 4])
    assert response.status_code == 200

    body = response.json()
    assert body["total"] == 261
    assert body["shifted_count"] == 0
    assert sum(body["by_month"].values()) == 261
    assert body["dates"][0]["day"] == "2027-01-01"


def test_preview_reports_shifted_dates_with_their_reason(client):
    response = post(
        client,
        name="mondays",
        year=2027,
        business_days=[0],
        holidays=[{"day": "2027-01-04", "name": "New Year observed"}],
    )
    body = response.json()

    shifted = [d for d in body["dates"] if d["shifted_from"]]
    assert body["shifted_count"] == 1
    assert shifted[0]["day"] == "2027-01-05"
    assert shifted[0]["shifted_from"] == "2027-01-04"
    assert shifted[0]["reason"] == "New Year observed"


def test_extended_rule_preview(client):
    response = post(
        client, name="month-end", year=2027, extended_rule={"rule_name": "LAST_BUSINESS_DAY"}
    )
    body = response.json()
    assert body["total"] == 12
    assert date.fromisoformat(body["dates"][0]["day"]) == date(2027, 1, 29)


def test_extended_rule_params_are_passed_through(client):
    response = post(
        client,
        name="fifteenth",
        year=2027,
        extended_rule={"rule_name": "DAY_OF_MONTH", "params": {"day": 15}},
    )
    days = [d["day"] for d in response.json()["dates"]]
    assert "2027-08-16" in days  # 15 August 2027 is a Sunday


def test_policies_change_the_result(client):
    body = {
        "name": "mondays",
        "year": 2027,
        "business_days": [0],
        "holidays": [{"day": "2027-01-04"}],
    }
    shifted = post(client, **body).json()
    skipped = post(client, **body, policies={"holiday": "skip"}).json()

    assert shifted["total"] == skipped["total"] + 1


def test_unknown_rule_returns_404(client):
    response = post(client, year=2027, extended_rule={"rule_name": "NOPE"})
    assert response.status_code == 404
    assert "NOPE" in response.json()["detail"]


def test_missing_rule_parameter_returns_422(client):
    response = post(client, year=2027, extended_rule={"rule_name": "DAY_OF_MONTH"})
    assert response.status_code == 422


def test_both_calendar_kinds_is_rejected(client):
    response = post(
        client,
        year=2027,
        business_days=[0],
        extended_rule={"rule_name": "LAST_BUSINESS_DAY"},
    )
    assert response.status_code == 422


def test_neither_calendar_kind_is_rejected(client):
    assert post(client, year=2027).status_code == 422


def test_year_is_bounded(client):
    assert post(client, year=1800, business_days=[0]).status_code == 422
