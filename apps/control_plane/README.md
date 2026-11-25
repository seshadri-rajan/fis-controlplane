# control_plane

Legacy scaffold for the read-only view of DAG runs across Business Units. The backend is now
one application: `calendar_service.main:app` serves both calendar and run-history APIs.
This scaffold is not a separate running service and is not required in the pip installation.
Airflow listeners are not yet connected; the current run-history endpoints return demo data only.

## Current demo API

The read-only `GET /v1/run-history` endpoint returns the latest generated demo record per
source/type/DAG/task. `GET /v1/run-history/demo` returns the complete generated demo feed.
Neither endpoint reads persisted data; live ingestion and persistence are not implemented.
These unauthenticated demo endpoints are for local development only and must not be exposed as a
production service.

From the repository root, after installing dependencies, start the shared backend:

```powershell
python.exe -m uvicorn calendar_service.main:app --host 127.0.0.1 --port 8000
```

OpenAPI docs are at <http://127.0.0.1:8000/docs>. The web app's Local Backend mode sends all
`/v1` requests to this application. See [backend setup](../calendar_service/README.md).

## Layered structure

The unused scaffold retains the original proposed layering. Active run-history code is in
`apps/calendar_service/src/calendar_service/api/v1/run_history.py`:

```
src/control_plane/
├── api/
│   ├── ingest/     Listener endpoint. Write path from BU Airflow.
│   └── ui/         Read path for the React SPA.
├── domain/
├── infra/
│   └── database/   Schema per BU (O-15)
└── config/
```

## The decision required before live ingestion is built

**O-13 — ingestion delivery guarantee.** The requirements describe fire-and-forget Airflow
listeners with no queue, outbox, retry or dead-letter path, *and* daily reconciliation is
explicitly out of scope.

Together those mean the central view **cannot be guaranteed accurate**: any dropped event is
permanently and undetectably lost. If anyone downstream treats this dashboard as authoritative,
that is a correctness problem shipped by design.

The fix is cheap at design time — an outbox table or a queue between listener and central database
— and expensive to retrofit. **Decide this before writing the ingestion path**, even though this
app is scheduled to be built last.

## Other open items

- **O-14** The requirements list "REST API needs to be built to expose the metadata" under *Out Of
  Scope*. Appears to be in the wrong section; needs clarification.
- **O-15** Schema-per-BU does not scale past the three BUs in this phase. No cross-BU `dag_id`
  collision handling. Timezone for "run date" undefined.
- **O-16** Airflow version. `dag_tag` and `dag_owner_attributes` are internal Airflow tables with
  no stability guarantee across versions.
- **O-17** Thirty-day retention versus "archival managed by Fidelity" — no owner for the purge job.
- **R-04** No authentication is currently defined for this UI. Mitigated by serving it from the
  single React app so it inherits the Calendar Service session.
