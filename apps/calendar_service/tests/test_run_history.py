import pytest
from calendar_service.config.settings import get_settings
from calendar_service.infra.database.session import get_engine, get_session_factory
from calendar_service.main import app
from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path, monkeypatch):
    path = tmp_path / "calendar.db"
    monkeypatch.setenv("CALENDAR_DB_URL", f"sqlite+aiosqlite:///{path.as_posix()}")
    monkeypatch.setenv("CALENDAR_AUTO_CREATE_SCHEMA", "true")
    monkeypatch.setenv("CALENDAR_AUTH_ENABLED", "false")
    get_settings.cache_clear()
    get_engine.cache_clear()
    get_session_factory.cache_clear()
    with TestClient(app) as client:
        yield client
    get_session_factory.cache_clear()
    get_engine.cache_clear()
    get_settings.cache_clear()


def test_run_history_endpoints_return_latest_and_full_demo_feed(client) -> None:
    latest_response = client.get("/v1/run-history")
    demo_response = client.get("/v1/run-history/demo")

    assert latest_response.status_code == 200
    assert demo_response.status_code == 200
    latest = latest_response.json()
    demo = demo_response.json()
    duplicate = next(
        row
        for row in demo
        if row["source"] == "FFIO"
        and row["type"] == "DAG"
        and row["dag_id"] == "cash_forecast_refresh"
        and row["state"] == "success"
    )

    assert len(demo) > len(latest)
    assert demo.count(duplicate) == 2
    assert len({
        (
            row["source"],
            row["type"],
            row["dag_id"],
            row["task_id"] if row["type"] == "Task" else None,
        )
        for row in latest
    }) == len(latest)

    by_key = {
        (
            row["source"],
            row["type"],
            row["dag_id"],
            row["task_id"] if row["type"] == "Task" else None,
        ): row
        for row in latest
    }

    assert by_key[("FFIO", "DAG", "cash_forecast_refresh", None)]["state"] == "success"
    assert by_key[("AM", "DAG", "eod_pricing_extract", None)]["state"] == "queued"
    assert by_key[("AM", "DAG", "daily_reconcile", None)]["state"] == "success"
    assert by_key[("FFIO", "DAG", "daily_reconcile", None)]["state"] == "failed"
    assert by_key[("FFIO", "Task", "cash_forecast_refresh", "extract")]["state"] == "success"
    assert by_key[("FFIO", "Task", "daily_reconcile", "extract")]["state"] == "success"


def test_shared_app_serves_calendar_and_run_history_apis(client) -> None:
    assert client.get("/health").status_code == 200
    assert client.get("/v1/calendars").status_code == 200
    assert client.get("/v1/run-history").status_code == 200
    schema_response = client.get("/openapi.json")
    assert schema_response.status_code == 200
    paths = schema_response.json()["paths"]
    assert "/v1/calendars" in paths
    assert "/v1/run-history" in paths
    assert "/v1/run-history/demo" in paths
