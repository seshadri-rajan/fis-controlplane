# Delivery Tracker

Last updated: 2026-10-12

Companion documents: [RECORD.md](RECORD.md) for decisions, risks and open items (`D-xx`, `O-xx`,
`R-xx`, `S-xx`); [README.md](README.md) for structure and quickstart;
[docs/architecture/](docs/architecture/hld.md) for HLD, LLD and user flows.

**Legend** — `[x]` done · `[~]` in progress · `[!]` blocked · `[ ]` not started

---

## At a glance

| Component | State | Tests | Blocked by |
|---|---|---|---|
| Decision record | Maintained | — | — |
| Repo structure | Done | — | — |
| `calendar_core` rule engine | Done, rules provisional | 49 | O-28 for the real rule set |
| Calendar Service — preview | Done | 13 | — |
| Calendar Service — schema + CRUD | Done | 18 | — |
| Calendar Service — auth, RBAC, audit | Done | 16 | — |
| Calendar Service — rollover + cliff alert | Done | 9 | — |
| Calendar Service — `/api/v1` | Not started | — | O-19 / O-09 |
| `web` — preview, login, calendar views | Done | — | — |
| `web` — editors and approval queue | Not started | — | **S-13** |
| `airflow_calendar_plugin` | Scaffolding only | — | **O-19** |
| `control_plane` | Scaffolding only | — | **O-13** |
| Migration tooling | Not started | — | **O-28** |
| Infra / CI | Not started | — | O-05, O-25 |
| Docs: HLD, LLD, user flows, screenshots, demo GIF | Done | — | — |
| Handover artefacts | Runbooks outstanding | — | — |

Total automated tests: **105 passing**. Repository pushed to `origin/main`.

---

## 1. Foundations

- [x] Monorepo layout, uv workspace
- [x] Clean-architecture layering with the dependency rule lint-enforced
- [x] Per-component READMEs explaining responsibility and constraints
- [x] `.gitignore`, `.env.example`
- [x] OpenAPI contract exported to `docs/api/openapi.json`
- [x] HLD, LLD and user-flow documents under `docs/architecture/`
- [x] Ten annotated UI screenshots under `docs/screenshots/`
- [x] Nine-frame GIF walkthrough and its recorder under `docs/demo/`
- [ ] CI pipeline running tests, lint and the frontend build
- [ ] Pre-commit hooks

## 2. Rule engine (`calendar_core`)

- [x] Value types, policies, `CalendarSpec` with mutual-exclusivity enforcement (O-08)
- [x] Holiday set, working-day resolution, forward/backward/skip policies
- [x] Business-day calendars, including selected-weekend handling (O-31)
- [x] Collision handling, both `MERGE` and `SHIFT_AGAIN` (O-06)
- [x] Boundary handling, both `CLAMP` and `ALLOW_OVERFLOW` (O-07)
- [x] Rule registry so late-arriving rules stay additive
- [x] Provisional rules: `WEEKEND_EXCLUSION`, `FIRST_BUSINESS_DAY`, `LAST_BUSINESS_DAY`,
      `QUARTER_END`, `DAY_OF_MONTH`
- [x] 46 table-driven tests covering leap years, consecutive holidays, year boundaries
- [!] Fidelity's real rule set — **O-28**
- [ ] Final policy defaults once O-06, O-07 and O-31 are ruled on

## 3. Calendar Service — API

- [x] App assembly, `/health`
- [x] `GET /api/ui/preview/rules`, `POST /api/ui/preview` (stateless, no database)
- [x] Settings via pydantic-settings
- [x] SQLAlchemy models with the section 6 schema defects fixed
- [x] Alembic setup and first migration, including `calendar_change_request`
- [x] Test asserting the migration head matches the models, so the two cannot drift
- [x] Repositories implementing the domain interfaces
- [x] Dependency-injection container
- [x] Calendar CRUD (`/api/ui/calendars`), soft delete
- [x] Date materialisation into `calendar_date`
- [x] Holiday loading CLI (`jobs/load_holidays`), backend only as required
- [x] Demo data seeder (`jobs/seed_demo`) — a fresh database has no calendars and no UI editor yet
- [x] Extended rule seeding from the engine registry; swap to Fidelity's list when it arrives (D-09)
- [!] `/api/v1` scheduling endpoint — contract shape depends on **O-09 / D-06**
- [x] Audit trail writes, with before and after values, plus a history endpoint
- [ ] Structured logging with correlation IDs
- [x] `jobs/generate_year` CLI, parameterised by year and optionally one calendar
- [x] `jobs/check_coverage` CLI — the date-cliff alert, non-zero exit when short (O-04 / R-06)
- [ ] Rate limiting, including the deliberately public preview endpoint (O-32)

## 4. Identity and access

- [x] `app_user`, `role`, `user_role`, `api_client` tables with the RECORD 2.2 password columns
- [x] Argon2id hashing and verification, with constant-cost failure for unknown users
- [x] Login, logout, `me`, session cookie signed and `https_only`
- [x] Idle and absolute session timeouts
- [x] Account lockout after repeated failures
- [x] Password policy and change flow, forcing re-authentication afterwards
- [x] Role seeding and first-Admin bootstrap (`jobs/bootstrap`, O-03)
- [x] Session middleware and role guards on `/api/ui`
- [x] Self-approval blocked even when one user holds both Create and Approver (O-30 evidence)
- [ ] Breached-password list check
- [ ] `api_clients` key issuance and verification
- [ ] API-key middleware on `/api/v1`
- [ ] Password reset without breaking four-eyes (O-01)
- [ ] Session secret sourced from Secrets Manager (O-33)

## 5. Four-eyes approval

- [x] `calendar_change_request` entity and table, present from the first migration
- [x] State machine `PENDING -> APPROVED | REJECTED`, plus maker withdrawal
- [x] Self-approval prevented in the state machine **and** by a database check constraint
- [x] Every mutation routed through the gate, switchable by `approval_required` (D-10)
- [!] **Blocked on S-13** for the payload's real contents and which entities it covers
- [ ] Diff computation for the reviewer
- [ ] Approval scope decision: calendars only, or roles and API keys too (11.5)

## 6. Web UI

- [x] Vite + React 19 + Tailwind 4 + TanStack Query
- [x] Typed client generated from the committed OpenAPI contract
- [x] Preview page: policy controls, twelve-month grid, shifted/holiday highlighting
- [x] Login screen, session handling, sign-out, role display
- [x] Calendar list and detail with materialised dates and audit history
- [!] Calendar editor — blocked on S-13
- [!] Approval queue and reviewer screen — blocked on S-13
- [ ] Password change screen
- [ ] DAG-run view for the control plane
- [ ] shadcn/ui component set
- [ ] Frontend tests
- [ ] Accessibility pass

## 7. Airflow plugin

- [!] **Blocked on O-19 (Airflow version per BU)** — do not start the timetable without it
- [ ] `CalendarTimetable` with `serialize` / `deserialize`
- [ ] `next_dagrun_info` reading the local cache only, no network I/O
- [ ] `AirflowPlugin` registration
- [ ] HTTP client with API key, timeouts, retries
- [ ] Cache reader and writer
- [ ] Reference cache-refresh DAG (O-23)
- [ ] `selfcheck` diagnostic CLI (R-09)
- [ ] Supported-version compatibility matrix (O-24)
- [ ] Integration guide for Fidelity
- [ ] Reference Airflow environment per supported version (R-10)

## 8. Metadata control plane

- [!] **Blocked on O-13** — delivery guarantee must be decided before the ingestion path is written
- [ ] Ingestion endpoint and listener contract
- [ ] Outbox or queue, if that is the ruling
- [ ] Schema-per-BU model (O-15)
- [ ] Read API for the UI
- [ ] Retention and purge ownership (O-17)
- [ ] Clarify the "REST API" line filed under Out Of Scope (O-14)

## 9. Migration

- [!] **Blocked on O-28** — cannot size or build without the rule inventory
- [ ] AutoSys export loader
- [ ] Rule mapping, including unmappable-rule handling (O-29)
- [ ] CSV execution report for migrated and non-migrated calendars
- [ ] Reconciliation and validation
- [ ] Rollback plan
- [ ] Parallel-run comparison against AutoSys before cutover

## 10. Infrastructure

- [ ] Dockerfiles and local compose
- [ ] Terraform: RDS, ECS/Fargate, ALB, Secrets Manager
- [ ] Availability target for the Calendar Service (O-05) — blocks sizing
- [ ] Network path and egress from BU Airflow (O-25, Fidelity-owned)
- [ ] Backups, DR, retention (O-11)
- [ ] Monitoring and alerting, including the coverage alert

## 11. Handover artefacts (D-05, section 9)

- [x] Rollover script, parameterised and runnable standalone
- [x] Coverage alert that exits non-zero, so a monitor can act on it
- [ ] Annual rollover runbook, rehearsed once
- [ ] Coverage alert scheduled in a deployed environment
- [ ] API key rotation runbook (R-08)
- [ ] First-Admin bootstrap and password reset procedures
- [ ] Named Fidelity owner for every TBD in RECORD.md
- [ ] Schema defects fixed, or handed over as known issues

---

## Blockers

| ID | Blocker | Blocks | Owner | Lead time |
|---|---|---|---|---|
| **O-19** | Airflow version per Business Unit | Entire plugin workstream | Fidelity platform teams | Short — one question |
| **O-28** | Extended rule inventory | Rule set, migration, **the estimate** | Fidelity | Long — needs an inventory |
| **O-06** | Skip-vs-shift semantics | What `calendar_dates` contains | Fidelity | Short — evidence ready, see RECORD 12.1 |
| **S-13** | What a four-eyes approval approves | Approval module, all editor screens | Fidelity | Short |
| **O-13** | Control plane delivery guarantee | Entire control plane | Us, then Fidelity | Short — architectural call |
| O-05 | Calendar Service availability target | Infra sizing | Joint | Medium |
| O-25 | Network path from BU Airflow | First plugin use | Fidelity | Long — approvals |
| O-27 | Region and holiday source | Holiday seeding | Fidelity | Short |

O-19 and O-28 are external with the longest lead times — raise both immediately.
O-06 can now be settled by demonstrating the preview rather than discussing prose.

---

## Next up

1. Annual rollover and API key rotation runbooks — the scripts exist, the documentation does not
2. Structured logging and rate limiting
3. API key issuance, ahead of the `/api/v1` endpoint
4. Password change screen in the web app

Plugin and control plane stay parked until their blockers clear. Starting either means guessing,
and both have a decision that invalidates the work if guessed wrong.

---

## Keeping this current

- Tick items here as they land; record *decisions* in RECORD.md, not in this file.
- A new ambiguity found while building gets an `O-xx` in RECORD.md and a `[!]` here.
- Blockers that go unanswered for more than a week should be escalated, not absorbed.
