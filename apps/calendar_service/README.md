# calendar_service

The system of record for calendars. Decides what dates a job should run on, and owns the UI's
backing API.

## Layered structure

```
src/calendar_service/
├── api/                HTTP. Routing, DTOs, auth middleware, status codes.
│   ├── v1/             MACHINE traffic. Airflow plugin. API key auth.
│   ├── ui/             HUMAN traffic. React SPA. Session auth.
│   ├── middlewares/    Two separate auth middlewares, never one with a flag.
│   └── schemas/        Pydantic request/response models.
│
├── domain/             Business logic. Framework-free. Imports nothing below.
│   ├── modules/
│   │   ├── calendar/   Calendars, dates, rules
│   │   ├── approval/   Four-eyes state machine
│   │   ├── identity/   Users, roles, password policy
│   │   └── audit/      Audit trail
│   └── shared/
│
├── infra/              Implementations of domain interfaces.
│   ├── database/       SQLAlchemy models, repositories, Alembic migrations
│   └── security/       Argon2id hashing, API key verification
│
├── config/             Settings and the dependency-injection container
├── jobs/               Standalone CLI scripts (handover deliverables)
└── main.py             FastAPI app assembly
```

### Dependency direction

```
api/  ──►  domain/  ◄──  infra/
```

`domain/` declares abstract interfaces; `infra/` implements them; `config/dependency.py` wires
them together. **`domain/` must never import from `api/` or `infra/`** — Ruff is configured at the
repo root to flag violations.

## The two API surfaces

They are physically separate because they have different callers, different auth and different
blast radius.

| | `api/v1/` | `api/ui/` |
|---|---|---|
| Caller | Airflow plugin (machine) | React SPA (human) |
| Auth | `X-API-Key`, hashed, constant-time compare | Session, local username/password (D-01) |
| Scope | Scheduling queries only | Full CRUD, subject to approval |
| Why separate | Makes the later mTLS/OAuth migration a one-file change (D-04) | |

An API key must never reach a mutation endpoint; a user session must never reach `v1`.

## jobs/

Top-level and CLI-invokable on purpose. These are handed to Fidelity at the end of the engagement
(D-05), so they must be runnable by someone who has never seen this codebase.

```powershell
python -m calendar_service.jobs.generate_year --year 2028
python -m calendar_service.jobs.check_coverage --min-days-ahead 90
```

`check_coverage` is the control for the 2028 date cliff (O-04 / R-06). Without it, calendars
running out of dates is a **silent** failure: DAGs simply stop firing.

## Build order note

`calendar_change_request` (the four-eyes pending change, RECORD.md 11.3) belongs in the **first**
migration, even though the approval UI is built much later. Retrofitting an approval gate into a
system that writes directly to `calendar` means rewriting every mutation path.

## Running

```powershell
fastapi dev                                  # from this directory
uv run alembic upgrade head                  # migrations
uv run pytest apps/calendar_service          # tests
```
