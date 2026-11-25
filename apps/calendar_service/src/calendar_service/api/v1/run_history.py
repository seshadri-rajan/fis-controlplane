"""Read-only run-history demo endpoints served by the shared backend."""

from datetime import UTC, datetime, timedelta
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict

router = APIRouter(prefix="/v1/run-history", tags=["Run history"])


class RunHistoryRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source: str
    type: Literal["DAG", "Task"]
    state: str
    dag_id: str
    task_id: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    elapsed_time: str | None = None
    business_date: str | None = None


def _record(
    *,
    source: str,
    kind: Literal["DAG", "Task"],
    dag_id: str,
    state: str,
    now: datetime,
    minutes_ago: int | None,
    duration_minutes: int | None = None,
    task_id: str | None = None,
) -> RunHistoryRecord:
    start = now - timedelta(minutes=minutes_ago) if minutes_ago is not None else None
    end = (
        start + timedelta(minutes=duration_minutes)
        if start and duration_minutes is not None
        else None
    )
    elapsed = None
    if start and end:
        seconds = int((end - start).total_seconds())
        hours, remainder = divmod(seconds, 3600)
        minutes, seconds = divmod(remainder, 60)
        elapsed = f"{hours:02d}:{minutes:02d}:{seconds:02d}.000000"

    return RunHistoryRecord(
        source=source,
        type=kind,
        state=state,
        dag_id=dag_id,
        task_id=task_id,
        start_date=(
            start.isoformat(timespec="microseconds").replace("+00:00", "Z") if start else None
        ),
        end_date=end.isoformat(timespec="microseconds").replace("+00:00", "Z") if end else None,
        elapsed_time=elapsed,
        business_date=now.strftime("%y%m%d"),
    )


def demo_records(now: datetime | None = None) -> list[RunHistoryRecord]:
    current = now or datetime.now(UTC)
    if current.tzinfo is None:
        current = current.replace(tzinfo=UTC)
    current = current.astimezone(UTC)

    records = [
        _record(
            source="FFIO", kind="DAG", dag_id="cash_forecast_refresh", state="failed",
            now=current, minutes_ago=150, duration_minutes=12,
        ),
        _record(
            source="FFIO", kind="DAG", dag_id="cash_forecast_refresh", state="success",
            now=current, minutes_ago=60, duration_minutes=8,
        ),
        _record(
            source="FFIO", kind="Task", dag_id="cash_forecast_refresh", task_id="extract",
            state="failed", now=current, minutes_ago=145, duration_minutes=4,
        ),
        _record(
            source="FFIO", kind="Task", dag_id="cash_forecast_refresh", task_id="extract",
            state="success", now=current, minutes_ago=56, duration_minutes=3,
        ),
        _record(
            source="FFIO", kind="Task", dag_id="cash_forecast_refresh", task_id="publish",
            state="success", now=current, minutes_ago=52, duration_minutes=2,
        ),
        _record(
            source="AM", kind="DAG", dag_id="daily_reconcile", state="success",
            now=current, minutes_ago=20, duration_minutes=2,
        ),
        _record(
            source="AM", kind="Task", dag_id="daily_reconcile", task_id="compare",
            state="success", now=current, minutes_ago=19, duration_minutes=1,
        ),
        _record(
            source="FFIO", kind="DAG", dag_id="daily_reconcile", state="failed",
            now=current, minutes_ago=25, duration_minutes=3,
        ),
        _record(
            source="FFIO", kind="Task", dag_id="daily_reconcile", task_id="compare",
            state="failed", now=current, minutes_ago=24, duration_minutes=2,
        ),
        _record(
            source="FFIO", kind="Task", dag_id="daily_reconcile", task_id="extract",
            state="success", now=current, minutes_ago=23, duration_minutes=2,
        ),
        _record(
            source="AM", kind="DAG", dag_id="eod_pricing_extract", state="success",
            now=current, minutes_ago=200, duration_minutes=20,
        ),
        _record(
            source="AM", kind="DAG", dag_id="eod_pricing_extract", state="queued",
            now=current, minutes_ago=None,
        ),
        _record(
            source="AM", kind="Task", dag_id="eod_pricing_extract",
            task_id="wait_for_market_close", state="queued", now=current, minutes_ago=None,
        ),
    ]
    records.append(records[1].model_copy(deep=True))
    return records


def latest_records(records: list[RunHistoryRecord]) -> list[RunHistoryRecord]:
    latest: dict[tuple[str, str, str, str | None], RunHistoryRecord] = {}

    def key(record: RunHistoryRecord) -> tuple[str, str, str, str | None]:
        task_id = record.task_id if record.type == "Task" else None
        return record.source, record.type, record.dag_id, task_id

    def rank(record: RunHistoryRecord) -> tuple[float, float]:
        def timestamp(value: str | None) -> float:
            if value is None:
                return float("-inf")
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return parsed.timestamp()

        start = timestamp(record.start_date)
        if record.start_date is None:
            start = float("inf")
        return start, timestamp(record.end_date)

    for record in records:
        record_key = key(record)
        current = latest.get(record_key)
        if current is None or rank(record) > rank(current):
            latest[record_key] = record

    return sorted(
        latest.values(),
        key=lambda record: (record.source, record.type, record.dag_id, record.task_id or ""),
    )


@router.get("", response_model=list[RunHistoryRecord])
async def list_run_history() -> list[RunHistoryRecord]:
    """Return the latest demo record for each DAG and task."""
    return latest_records(demo_records())


@router.get("/demo", response_model=list[RunHistoryRecord])
async def get_demo_run_history() -> list[RunHistoryRecord]:
    """Return all generated demo records, including older and duplicate runs."""
    return demo_records()
