from __future__ import annotations

import hashlib
import json
import logging
import math
import re
import threading
import time
from contextlib import closing
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

import pendulum
from airflow import settings as airflow_settings
from airflow.exceptions import AirflowException
from airflow.models import Variable
from airflow.plugins_manager import AirflowPlugin
from airflow.providers.postgres.hooks.postgres import PostgresHook, USE_PSYCOPG3
from airflow.timetables._cron import CronMixin
from airflow.timetables.base import DagRunInfo, DataInterval, TimeRestriction, Timetable
import airflow.sdk.timezone as timezone
from psycopg2 import Error as Psycopg2Error
from sqlalchemy.exc import SQLAlchemyError

if USE_PSYCOPG3:
    from psycopg import Error as Psycopg3Error

    _DATABASE_ERRORS = (Psycopg2Error, Psycopg3Error, SQLAlchemyError, AirflowException)
else:
    _DATABASE_ERRORS = (Psycopg2Error, SQLAlchemyError, AirflowException)

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class _CacheRecord:
    fetched_at: float
    dates: tuple[date, ...]


_PROCESS_CACHE: dict[str, tuple[float, _CacheRecord]] = {}
_PROCESS_CACHE_LOCK = threading.RLock()
_CACHE_FORMAT_VERSION = 2
_DEFAULT_CACHE_TTL_SECONDS = 24 * 60 * 60
_RAM_CACHE_GRACE_SECONDS = 60
_LOCK_NAMESPACE = "custom_calendar_timetable:GET_RUN_DATES"
_RUN_TIME_UNSET = object()


class CustomCalendarTimetable(Timetable):
    """Schedule run dates using GET_RUN_DATES(run_calendar, exclude_calendar).

    The PostgreSQL function must return a set of rows with one DATE column.
    """

    def __init__(
        self,
        run_calendar: str,
        exclude_calendar: str | None = None,
        postgres_conn_id: str = "calendar_postgres",
        timezone_name: str | None = None,
        cache_ttl_seconds: int | None = None,
        run_time: str | object = _RUN_TIME_UNSET,
        cron: str | None = None,
    ) -> None:
        if not isinstance(run_calendar, str) or not run_calendar:
            raise ValueError("run_calendar must be a nonempty string")
        if not isinstance(postgres_conn_id, str) or not postgres_conn_id:
            raise ValueError("postgres_conn_id must be a nonempty string")
        if run_time is _RUN_TIME_UNSET:
            run_time = "00:00" if cron is None else None
        elif cron is not None:
            raise ValueError("Specify only one of run_time or cron")
        run_times: list[str] = []
        if cron is None:
            if not isinstance(run_time, str) or run_time != run_time.strip():
                raise ValueError(
                    "run_time must be one or more comma-separated 24-hour times in HH:MM format"
                )
            run_times = [item.strip() for item in run_time.split(",")]
            if (
                any(
                    re.fullmatch(r"(?:[01][0-9]|2[0-3]):[0-5][0-9]", item) is None
                    for item in run_times
                )
                or len(set(run_times)) != len(run_times)
            ):
                raise ValueError(
                    "run_time must be one or more unique comma-separated 24-hour times in HH:MM format"
                )
        elif not isinstance(cron, str) or not cron or cron != cron.strip():
            raise ValueError("cron must be a nonempty Airflow cron expression")
        if cache_ttl_seconds is not None:
            self._ttl_seconds(
                "cache_ttl_seconds", cache_ttl_seconds, _DEFAULT_CACHE_TTL_SECONDS
            )

        self.run_calendar = run_calendar
        self.exclude_calendar = exclude_calendar
        self.postgres_conn_id = postgres_conn_id
        self.cache_ttl_seconds = cache_ttl_seconds
        self.run_time = run_time
        self.cron = cron
        self._run_times = tuple(
            sorted(
                (int(hour), int(minute))
                for hour, minute in (item.split(":") for item in run_times)
            )
        )
        # None means Airflow's [core] default_timezone, resolved where the timetable is loaded.
        self._timezone_arg = timezone_name
        if timezone_name is None:
            self._tz = airflow_settings.TIMEZONE
            self.timezone_name = self._tz.name
        else:
            if not isinstance(timezone_name, str) or not timezone_name:
                raise ValueError("timezone_name must be a nonempty string or None")
            self._tz = pendulum.timezone(timezone_name)
            self.timezone_name = timezone_name
        self._cron = CronMixin(cron, self._tz) if cron is not None else None
        if self._cron is not None:
            self._cron.validate()

    @property
    def summary(self) -> str:
        return (
            f"Calendar: {self.run_calendar}, excluding: {self.exclude_calendar}, "
            f"at {self.cron if self.cron is not None else self.run_time} ({self.timezone_name})"
        )

    def serialize(self) -> dict[str, Any]:
        data = {
            "run_calendar": self.run_calendar,
            "exclude_calendar": self.exclude_calendar,
            "postgres_conn_id": self.postgres_conn_id,
            "timezone_name": self._timezone_arg,
            "cache_ttl_seconds": self.cache_ttl_seconds,
        }
        if self.cron is None:
            data["run_time"] = self.run_time
        else:
            data["cron"] = self.cron
        return data

    @classmethod
    def deserialize(cls, data: dict[str, Any]) -> CustomCalendarTimetable:
        return cls(**data)

    def validate(self) -> None:
        self._ttl_seconds(
            "calendar_cache_ttl_seconds",
            self.cache_ttl_seconds,
            _DEFAULT_CACHE_TTL_SECONDS,
        )

    def infer_manual_data_interval(self, *, run_after: datetime) -> DataInterval:
        run_at = pendulum.instance(timezone.coerce_datetime(run_after)).in_timezone(
            self._tz
        )
        return DataInterval.exact(run_at)

    def next_dagrun_info(
        self,
        *,
        last_automated_data_interval: DataInterval | None,
        restriction: TimeRestriction,
    ) -> DagRunInfo | None:
        dates = self._calendar_dates()
        if not dates:
            return None

        if restriction.earliest is None and last_automated_data_interval is None:
            return None
        cutoff = pendulum.instance(
            timezone.coerce_datetime(
                restriction.earliest
                if restriction.earliest is not None
                else last_automated_data_interval.start
            )
        ).in_timezone(self._tz)
        if not restriction.catchup:
            cutoff = max(cutoff, pendulum.now(self._tz).start_of("day"))

        last_run_at = (
            pendulum.instance(
                timezone.coerce_datetime(last_automated_data_interval.start)
            ).in_timezone(self._tz)
            if last_automated_data_interval is not None
            else None
        )

        if self._cron is not None:
            return self._next_cron_run(dates, cutoff, last_run_at, restriction.latest)

        for calendar_date in dates:
            for hour, minute in self._run_times:
                start = pendulum.datetime(
                    calendar_date.year,
                    calendar_date.month,
                    calendar_date.day,
                    hour=hour,
                    minute=minute,
                    tz=self._tz,
                )
                if start < cutoff or (
                    last_run_at is not None and start <= last_run_at
                ):
                    continue
                if restriction.latest is not None:
                    latest = pendulum.instance(
                        timezone.coerce_datetime(restriction.latest)
                    ).in_timezone(self._tz)
                    if start > latest:
                        continue
                return DagRunInfo.exact(start)
        return None

    def _next_cron_run(
        self,
        dates: tuple[date, ...],
        cutoff: pendulum.DateTime,
        last_run_at: pendulum.DateTime | None,
        latest: datetime | None,
    ) -> DagRunInfo | None:
        assert self._cron is not None
        cutoff = cutoff.in_timezone(self._tz)
        last = last_run_at.in_timezone(self._tz) if last_run_at is not None else None
        latest_utc = (
            pendulum.instance(timezone.coerce_datetime(latest)).in_timezone(self._tz)
            if latest is not None
            else None
        )
        for calendar_date in dates:
            if calendar_date < cutoff.in_timezone(self._tz).date():
                continue
            day_start = pendulum.datetime(
                calendar_date.year, calendar_date.month, calendar_date.day, tz=self._tz
            ).in_timezone(self._tz)
            reference = max(day_start, cutoff)
            if last is not None and last >= reference:
                candidate = self._cron._get_next(last)
            else:
                candidate = self._cron._align_to_next(reference)
            if latest_utc is not None and candidate > latest_utc:
                return None
            if candidate.in_timezone(self._tz).date() == calendar_date:
                return DagRunInfo.exact(candidate)
        return None

    def _calendar_dates(self) -> tuple[date, ...] | None:
        cache_key = self._metadata_key()
        now = time.time()
        with _PROCESS_CACHE_LOCK:
            cached = _PROCESS_CACHE.get(cache_key)
            if cached is not None and now < cached[0]:
                return cached[1].dates

        try:
            cache_ttl_seconds = self._ttl_seconds(
                "calendar_cache_ttl_seconds",
                self.cache_ttl_seconds,
                _DEFAULT_CACHE_TTL_SECONDS,
            )
        except _DATABASE_ERRORS:
            log.exception("Unable to read cache TTL for calendar %s", self.run_calendar)
            return self._use_cached_dates(
                cache_key, cached[1] if cached is not None else None, 0
            )
        cached_record = self._read_metadata_cache()
        if cached_record is None and cached is not None:
            cached_record = cached[1]
        if (
            cached_record is not None
            and now < cached_record.fetched_at + cache_ttl_seconds
        ):
            return self._cache_locally(cache_key, cached_record, cache_ttl_seconds)
        try:
            hook = PostgresHook(postgres_conn_id=self.postgres_conn_id)
            with closing(hook.get_conn()) as connection:
                # The lock must span the function call and cache publication.
                connection.autocommit = False
                with connection:
                    with connection.cursor() as cursor:
                        cursor.execute(
                            "SELECT pg_try_advisory_xact_lock(%s)",
                            (self._lock_id(),),
                        )
                        if not cursor.fetchone()[0]:
                            log.info(
                                "Calendar refresh is already in progress for %s "
                                "excluding %s; using cached dates if available",
                                self.run_calendar,
                                self.exclude_calendar,
                            )
                            return self._use_cached_dates(
                                cache_key, cached_record, cache_ttl_seconds
                            )
                        latest_record = self._read_metadata_cache()
                        if latest_record is not None:
                            cached_record = latest_record
                            if time.time() < latest_record.fetched_at + cache_ttl_seconds:
                                return self._cache_locally(
                                    cache_key, latest_record, cache_ttl_seconds
                                )
                        cursor.execute(
                            "SELECT set_config('statement_timeout', %s, true)",
                            ("30s",),
                        )
                        dates = self._fetch_dates(cursor)
                        refreshed_record = self._write_metadata_cache(dates)
            return self._cache_locally(
                cache_key, refreshed_record, cache_ttl_seconds
            )
        except (*_DATABASE_ERRORS, ValueError, OSError) as exc:
            log.exception("Unable to refresh calendar %s: %s", self.run_calendar, exc)
            return self._use_cached_dates(cache_key, cached_record, cache_ttl_seconds)

    def _fetch_dates(self, cursor: Any) -> tuple[date, ...]:
        cursor.execute(
            "SELECT * FROM GET_RUN_DATES(%s::varchar, %s::varchar)",
            (self.run_calendar, self.exclude_calendar),
        )
        parsed: set[date] = set()
        for row in cursor.fetchall():
            if len(row) != 1:
                raise ValueError("GET_RUN_DATES must return exactly one date column")
            value = row[0]
            # datetime is a date subclass; reject timestamps to avoid silent truncation.
            if not isinstance(value, date) or isinstance(value, datetime):
                raise ValueError(
                    f"Invalid calendar date {value!r}; GET_RUN_DATES must return DATE values"
                )
            parsed.add(value)
        return tuple(sorted(parsed))

    @staticmethod
    def _parse_iso_dates(values: list[Any]) -> tuple[date, ...]:
        parsed: list[date] = []
        for value in values:
            if not isinstance(value, str):
                raise ValueError("Every cached date must be a YYYY-MM-DD string")
            parsed_date = date.fromisoformat(value)
            parsed.append(parsed_date)
        return tuple(parsed)

    def _lock_id(self) -> int:
        # Keyed on the GET_RUN_DATES arguments; signed 64-bit for pg_try_advisory_xact_lock(bigint).
        identity = json.dumps(
            [_LOCK_NAMESPACE, self.run_calendar, self.exclude_calendar],
            ensure_ascii=True,
        )
        digest = hashlib.sha256(identity.encode("utf-8")).digest()
        return int.from_bytes(digest[:8], "big", signed=True)

    def _metadata_key(self) -> str:
        parts = ["cached_dates_for", self.run_calendar]
        if self.exclude_calendar:
            parts.append(self.exclude_calendar)
        return "_".join(parts)

    @staticmethod
    def _ttl_seconds(variable_name: str, override: int | None, default: int) -> int:
        if override is not None:
            raw_value = override
        else:
            raw_value = Variable.get(variable_name, default_var=str(default))
        if isinstance(raw_value, bool) or not isinstance(raw_value, (str, int)):
            raise ValueError(f"{variable_name} must be a positive integer")
        try:
            ttl_seconds = int(raw_value)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"{variable_name} must be a positive integer") from exc
        if ttl_seconds <= 0:
            raise ValueError(f"{variable_name} must be a positive integer")
        return ttl_seconds

    def _read_metadata_cache(self) -> _CacheRecord | None:
        try:
            raw = Variable.get(self._metadata_key(), default_var=None)
        except _DATABASE_ERRORS:
            log.exception("Unable to read metadata cache for calendar %s", self.run_calendar)
            return None
        if raw is None:
            return None
        try:
            record = json.loads(raw)
            if not isinstance(record, dict) or not isinstance(record.get("dates"), list):
                raise ValueError("Metadata cache must contain a dates array")
            fetched_at = record["fetched_at"]
            if (
                isinstance(fetched_at, bool)
                or not isinstance(fetched_at, (float, int))
                or not math.isfinite(fetched_at)
                or fetched_at < 0
                or fetched_at > time.time()
            ):
                raise ValueError("Metadata cache has an invalid refresh timestamp")
            version = record.get("version")
            if isinstance(version, bool) or version != _CACHE_FORMAT_VERSION:
                raise ValueError(f"Unsupported metadata cache version {version!r}")
            dates = self._parse_iso_dates(record["dates"])
            return _CacheRecord(fetched_at=float(fetched_at), dates=dates)
        except (KeyError, TypeError, ValueError, json.JSONDecodeError):
            log.warning("Ignoring invalid metadata cache for calendar %s", self.run_calendar)
            return None

    def _write_metadata_cache(self, dates: tuple[date, ...]) -> _CacheRecord:
        record = _CacheRecord(fetched_at=time.time(), dates=dates)
        Variable.set(
            self._metadata_key(),
            json.dumps(
                {
                    "version": _CACHE_FORMAT_VERSION,
                    "fetched_at": record.fetched_at,
                    "dates": [item.isoformat() for item in dates],
                }
            ),
        )
        return record

    def _use_cached_dates(
        self, cache_key: str, record: _CacheRecord | None, ttl_seconds: int
    ) -> tuple[date, ...] | None:
        if record is not None:
            return self._cache_locally(cache_key, record, ttl_seconds)
        log.info(
            "No cached dates exist for %s and refresh could not be completed; "
            "the scheduler will reevaluate on a later cycle",
            self.run_calendar,
        )
        return None

    @staticmethod
    def _cache_locally(
        cache_key: str, record: _CacheRecord, ttl_seconds: int
    ) -> tuple[date, ...]:
        # Stale fallback is retried after one minute, not after another full TTL.
        expires_at = max(
            record.fetched_at + ttl_seconds,
            time.time() + _RAM_CACHE_GRACE_SECONDS,
        )
        with _PROCESS_CACHE_LOCK:
            _PROCESS_CACHE[cache_key] = (expires_at, record)
        return record.dates


class CustomCalendarTimetablePlugin(AirflowPlugin):
    name = "custom_calendar_timetable"
    timetables = [CustomCalendarTimetable]
