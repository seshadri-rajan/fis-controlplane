# airflow_calendar_plugin

The pip package shipped to Fidelity. Registers a custom Airflow `Timetable` that schedules DAGs
from a calendar name.

**This package is a published contract, not an internal module.** Fidelity installs it into three
Business Unit Airflow environments that we do not control and cannot inspect (D-07). The three BUs
upgrade independently, so breaking changes need real versioning discipline.

## Hard constraints

1. **`httpx` is the only dependency.** Anything else risks a version conflict with Airflow's own
   pins in an environment we cannot see.
2. **Must not import `calendar_core` or anything under `apps/`.** Communication with the Calendar
   Service is over HTTP only.
3. **No network I/O during DAG parsing.** `next_dagrun_info()` runs inside the scheduler loop.
   It reads the local cache and nothing else (RECORD.md 10.4).

## Layout

```
src/airflow_calendar_plugin/
├── plugin.py       AirflowPlugin registration - how a custom Timetable reaches Airflow
├── timetable.py    CalendarTimetable: serialize/deserialize, next_dagrun_info
├── client.py       httpx client for the Calendar Service. API key, timeouts, retries.
├── cache.py        Local snapshot reader/writer. The only thing timetable.py may read.
├── selfcheck.py    CLI: prove connectivity, auth and cache freshness without our involvement
└── example_dags/
    └── refresh_calendar_cache.py   Reference DAG. Fidelity deploys and operates it (O-23).
```

## How it is used

Fidelity binds a calendar to a DAG at definition time:

```python
with DAG(dag_id="eod_positions", schedule=CalendarTimetable("US_Business_Days")):
    ...
```

The binding is static; the calendar behind it is live. An admin editing that calendar in our UI
changes the schedule of every DAG bound to it, with no code change and no redeploy. That is the
AutoSys-like behaviour the design is reaching for (RECORD.md 10.3).

A timetable **cannot** be created or changed while a DAG is running.

## Serialisation constraint

Airflow serialises DAGs into its metadata database, so `CalendarTimetable` must implement
`serialize()` / `deserialize()` and may carry **only JSON-serialisable state** — the calendar name
and nothing more. No HTTP client, no resolved date list. The scheduler reconstructs the instance
from JSON on every parse, which is the underlying reason for the no-I/O rule above.

## The failure mode to design around

If the cached snapshot runs out of future dates, `next_dagrun_info()` returns `None` and the DAG
**silently stops scheduling** — no error, no task failure, no alert.

This is the 2028 date cliff (O-04 / R-06) expressed in code. The coverage alert in the Calendar
Service is the control for it.

## Boundary

| Ours | Fidelity's |
|---|---|
| This package, the reference cache DAG, the self-check command, the integration guide, the supported-version matrix | Installation, DAG wiring, operating the cache DAG, network and TLS, scheduler tuning, end-to-end acceptance |

## Blocked

**O-19 — Airflow version per BU.** Timetable APIs and DAG parsing differ materially between
Airflow 2 and 3 (separate dag-processor in 3). Do not start the timetable implementation without
this.
