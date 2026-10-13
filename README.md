# Fidelity Airflow Calendar Platform

Monorepo for the AutoSys-compatible calendar utility for Apache Airflow, and the Airflow metadata
control plane.

> **Start here, then read [RECORD.md](RECORD.md).** That file holds every agreed decision, open
> question and accepted risk. If something in the code looks surprising, the reason is usually
> recorded there with an ID (`D-xx` decision, `O-xx` open item, `R-xx` risk, `S-xx` schema defect).
>
> For current progress, what is pending and what is blocked, see [TRACKER.md](TRACKER.md).
>
> For design: [High Level Design](docs/architecture/hld.md) ·
> [Low Level Design](docs/architecture/lld.md) ·
> [User Flows](docs/architecture/user-flows.md).
>
> To see it running: [GIF walkthrough](docs/demo/README.md) ·
> [Screenshots](docs/screenshots/README.md).

---

## What we are building

Three deliverables, not one. They have different users, different lifecycles and different
deployment targets.

| # | Deliverable | What it does | Who runs it |
|---|-------------|--------------|-------------|
| 1 | **Calendar Service** | Authoritative source for "should this job run today". Calendar CRUD, RBAC, four-eyes approval, date materialisation. | Us (AWS) |
| 2 | **Metadata Control Plane** | Read-only central view of DAG runs across Business Units. | Us (AWS) |
| 3 | **Airflow plugin** | Custom `Timetable` that schedules DAGs from a calendar name. | **Fidelity**, inside their Airflow environments (D-07) |

Deliverable 3 is installed into environments we do not control. That constraint shapes a lot of
this repo — see [Rules that are not negotiable](#rules-that-are-not-negotiable).

---

## Repository map

```
fidility/
├── apps/                          Deployable applications
│   ├── calendar_service/          FastAPI. The calendar system of record.
│   ├── control_plane/             FastAPI. DAG-run metadata ingestion + read API.
│   └── web/                       React SPA. UI for both services.
│
├── packages/                      Shared / distributable libraries
│   ├── calendar_core/             Pure date-rule engine. No I/O, no framework.
│   └── airflow_calendar_plugin/   Pip package shipped to Fidelity.
│
├── infra/                         Terraform, Docker, CI
├── docs/                          Architecture notes, API contract, runbooks
└── RECORD.md                      Decisions, open items, risks
```

---

## Where does my code go?

| If you are writing... | It belongs in... |
|---|---|
| Logic that answers "is 2027-08-16 a run day for this rule?" | `packages/calendar_core/` |
| An HTTP endpoint the **Airflow plugin** calls | `apps/calendar_service/src/calendar_service/api/v1/` |
| An HTTP endpoint the **React UI** calls | `apps/calendar_service/src/calendar_service/api/ui/` |
| A business rule or entity invariant | `apps/calendar_service/src/calendar_service/domain/` |
| A SQL query, SQLAlchemy model or migration | `apps/calendar_service/src/calendar_service/infra/` |
| Password hashing, API key verification | `apps/calendar_service/src/calendar_service/infra/security/` |
| A script someone runs once a year by hand | `apps/calendar_service/src/calendar_service/jobs/` |
| Anything that imports `airflow` | `packages/airflow_calendar_plugin/` |
| A React screen | `apps/web/src/features/` |

---

## Architecture: layers and dependency direction

`calendar_service` and `control_plane` follow clean architecture.

```
      api/  ──────►  domain/  ◄──────  infra/
   (HTTP, DTOs)   (entities,      (SQLAlchemy, security,
                   rules,           external adapters)
                   interfaces)
```

**The one rule that matters:**

> `domain/` must never import from `api/` or `infra/`.

`domain/` declares abstract interfaces (`ICalendarRepository`). `infra/` implements them. `api/`
depends on `domain/` and receives implementations by dependency injection from `config/`.

If you find yourself importing SQLAlchemy inside `domain/`, the design has drifted — put the
interface in `domain/` and the implementation in `infra/`.

### Why `calendar_core` is separate from `domain/`

`domain/` is application business logic and may know about repositories and persistence concepts.
`calendar_core` is **pure computation**: given a rule, a year and a holiday list, return dates. It
has no dependencies at all, so it can be exhaustively unit tested with plain tables of inputs and
expected outputs, and it is the artefact handed over for the annual rollover (section 9 of
RECORD.md).

---

## Rules that are not negotiable

These exist because they are cheap now and very expensive later. Each links to its rationale.

1. **`calendar_core` has zero runtime dependencies.** No FastAPI, no SQLAlchemy, no Airflow,
   no network, no clock reads. Pass dates in; get dates out.

2. **`airflow_calendar_plugin` depends only on `httpx`.** It installs into Airflow environments we
   cannot inspect (D-07). Every extra dependency is a potential version conflict. It must **not**
   import `calendar_core` or anything under `apps/`.

3. **`api/v1/` and `api/ui/` stay physically separate**, with separate middleware (5.4). `v1` is
   machine traffic authenticated by API key; `ui` is human traffic authenticated by session. Never
   one middleware with a flag — the separation is what makes the future mTLS migration a one-file
   change.

4. **All timestamps are `TIMESTAMPTZ`.** This is a scheduling product (S-10).

5. **No network I/O in Airflow DAG-parse paths.** The plugin's `next_dagrun_info()` runs inside the
   scheduler loop and must read from a local cache only (10.4).

6. **Mutations go through the approval workflow**, not directly to the table (11.3). The pending
   change entity exists from the first migration even before the approval UI is built.

---

## Quickstart

### Prerequisites

- Python 3.12 or newer (3.14 is what the workspace is currently built against)
- Node.js 20 or newer
- No database server required: local development defaults to SQLite. PostgreSQL is the deployment
  target, and the models carry dialect variants so both work.

### One-time setup

```powershell
# From the repository root
py -3.14 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip pytest pytest-asyncio
.\.venv\Scripts\python.exe -m pip install -e packages/calendar_core
.\.venv\Scripts\python.exe -m pip install "fastapi[standard]" pydantic-settings "sqlalchemy[asyncio]" aiosqlite alembic
.\.venv\Scripts\python.exe -m pip install --no-deps -e apps/calendar_service

npm install --prefix apps/web
```

`uv` is the intended workspace tool (`uv sync` replaces the pip steps above) but is not required.

### Run the tests

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

Expect **103 passing**: 47 rule-engine tests and 56 service tests.

### Database

Development creates the SQLite schema automatically on startup. To use migrations explicitly, or
to point at PostgreSQL:

```powershell
$env:CALENDAR_DB_URL = "postgresql+asyncpg://user@localhost:5432/calendar"
cd apps/calendar_service
..\..\.venv\Scripts\python.exe -m alembic upgrade head
```

A test asserts the migration head matches the models, so the two cannot silently drift.

### Create the first administrator

Seeds the four roles, the rule catalogue and a holiday calendar, then creates an admin whose
temporary password is printed **once**. Re-running is safe.

```powershell
.\.venv\Scripts\python.exe -m calendar_service.jobs.bootstrap --admin-user first.admin --admin-email you@example.com
```

Holidays are backend-managed by requirement, so they load from CSV rather than the UI:

```powershell
.\.venv\Scripts\python.exe -m calendar_service.jobs.load_holidays holidays.csv --calendar DEFAULT
```

### Populate the UI with something to look at

There is no calendar editor yet (blocked on S-13), so a fresh database leaves the Calendars page
empty. This creates four representative calendars plus US 2027 holidays, and is safe to re-run:

```powershell
.\.venv\Scripts\python.exe -m calendar_service.jobs.seed_demo
```

2028 is left unmaterialised on purpose so the date-cliff warning is visible.

### Annual rollover and the date-cliff alert

Calendar dates are materialised per year. A calendar that runs out of dates **stops scheduling
silently**, so the coverage check exits non-zero and is meant to be wired to a monitor.

```powershell
.\.venv\Scripts\python.exe -m calendar_service.jobs.generate_year --year 2028
.\.venv\Scripts\python.exe -m calendar_service.jobs.check_coverage --min-days-ahead 90
```

### Run it locally

Two terminals.

```powershell
# Terminal 1 - API on http://127.0.0.1:8000
.\.venv\Scripts\python.exe -m uvicorn calendar_service.main:app --host 127.0.0.1 --port 8000
```

```powershell
# Terminal 2 - UI on http://localhost:5173
npm run dev --prefix apps/web
```

Then open <http://localhost:5173/preview>. Vite proxies `/api` to the API, so there is no CORS
configuration and the dev setup matches production, where FastAPI serves the built frontend from
the same origin.

Interactive API docs are at <http://127.0.0.1:8000/docs>.

> **Authentication is local username and password** (D-01); there is no SSO in this phase. Log in
> at `POST /api/ui/auth/login` with the bootstrap credentials. The session cookie is `https_only`,
> so over plain http set `CALENDAR_SESSION_COOKIE_SECURE=false` for local development.
>
> `CALENDAR_SESSION_SECRET` must be set before deployment — unset falls back to a per-process key
> that breaks across restarts and replicas (O-33).

### After changing the API

Regenerate the contract and the frontend's types:

```powershell
.\.venv\Scripts\python.exe apps/calendar_service/scripts/export_openapi.py
npm run generate:api --prefix apps/web
```

Both `docs/api/openapi.json` and `src/lib/api/schema.d.ts` are committed. Do not hand-edit either.

### Build the frontend

```powershell
npm run build --prefix apps/web
```

---

## Per-component documentation

- [apps/calendar_service/README.md](apps/calendar_service/README.md)
- [apps/control_plane/README.md](apps/control_plane/README.md)
- [apps/web/README.md](apps/web/README.md)
- [packages/calendar_core/README.md](packages/calendar_core/README.md)
- [packages/airflow_calendar_plugin/README.md](packages/airflow_calendar_plugin/README.md)

---

## Status

See [TRACKER.md](TRACKER.md) for the full breakdown of done, pending and blocked work.

| Component | State |
|---|---|
| `calendar_core` | Rule engine implemented, 47 tests passing. Extended rule set is **provisional** (O-28). |
| `calendar_service` | Preview, calendar CRUD, materialisation, four-eyes gate, local authentication with RBAC, audit trail, annual rollover and the date-cliff alert. 56 tests. |
| `control_plane` | Scaffolding only. Blocked on the O-13 ingestion decision. |
| `web` | Preview, login, and calendar list/detail with dates and audit history. Editors blocked on S-13. |
| `airflow_calendar_plugin` | Scaffolding only. Blocked on O-19. |

The preview endpoint is stateless — holidays are supplied in the request — so it runs without a
database. It exists to make the undecided rule semantics visible to the client.

The OpenAPI contract is exported to [docs/api/openapi.json](docs/api/openapi.json) and committed;
the web client generates its types from that file, so it needs no running server.

Blocking unknowns before significant work on the plugin or the rule set — see RECORD.md:

- **O-19** Airflow version per Business Unit (blocks plugin design)
- **O-28** Fidelity's extended rule inventory (drives estimate)
- **O-06 / O-07 / O-31** holiday collision, period-boundary and selected-weekend semantics. Each
  is encoded as a named, passing test with a *proposed* default — run the preview and have the
  client rule on the output.
