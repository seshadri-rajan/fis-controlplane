# Decision Record — Airflow Calendar Service & Metadata Control Plane

Last updated: 2026-10-12

Scope: decisions agreed during review of
[Airflow Enterprise Calendar Service Requirement Details Document.docx](Airflow%20Enterprise%20Calendar%20Service%20Requirement%20Details%20Document.docx)
and [Airflow Metadata Control Plane on AWS.docx](Airflow%20Metadata%20Control%20Plane%20on%20AWS.docx).

---

## 1. Confirmed decisions

| # | Decision | Status | Date |
|---|----------|--------|------|
| D-01 | SSO / SAML / OAuth2 federation is **out of scope**. Authentication is local username + password held in our own database. | Agreed | 2026-10-12 |
| D-02 | Roles are **managed locally** in `roles` / `user_roles`. Not derived from IdP group claims. | Agreed | 2026-10-12 |
| D-03 | The Metadata Control Plane UI having no access-management integration is a **deliberate deferral**, not an oversight. | Agreed | 2026-10-12 |
| D-04 | Service-to-service auth (Airflow plugin → Calendar Service) uses a **static API key** for this phase. Migration to mTLS / OAuth2 client credentials is deferred. | Agreed | 2026-10-12 |
| D-05 | Per the SOW, the engagement covers **one year only** as of now. Calendar date generation for 2026 and 2027 is therefore in scope; anything beyond is outside the contracted period. | Agreed | 2026-10-12 |
| D-06 | Airflow integration is a **custom `Timetable` registered through an Airflow plugin**, parameterised by calendar name, reading from a locally cached calendar snapshot. See section 10. | **Proposed** — pending Airflow version confirmation (O-16) | 2026-10-12 |
| D-07 | We deliver the **plugin package only**. Installation, DAG wiring, deployment and operation inside BU Airflow environments are **Fidelity's responsibility**. See section 10.7. | Agreed | 2026-10-12 |
| D-08 | **Single region** for holidays in this phase. One holiday calendar applies to all business and extended calendars; no per-region or per-BU holiday variation. | Agreed | 2026-10-12 |
| D-09 | The **extended rule list is supplied by Fidelity** and seeded by us as backend reference data. No UI to create or edit rules; users only select from the dropdown. | Agreed | 2026-10-12 |
| D-10 | The four-eyes gate ships **behind a configuration flag** (`approval_required`, default off). The `calendar_change_request` table and every mutation path exist from the first migration either way, so enabling the gate changes one branch rather than a rewrite. Allows build to proceed while S-13 is open. | Agreed | 2026-10-12 |

> **Consequence of D-05:** the system outlives the engagement. Every item marked "deferred" or "TBD" in this record either gets closed inside the contracted year or transfers to Fidelity at handover. There is no third option. See sections 7 and 9.

---

## 2. Authentication design (follows D-01)

### 2.1 Password handling

- Hashing: **Argon2id** (fallback bcrypt, cost >= 12). No MD5 / SHA-1 / SHA-256, no plaintext, no reversible encryption.
- Salt is per-row, embedded in the hash string.
- TLS enforced end to end. Credentials never appear in query strings or logs.
- Account lockout: 5 consecutive failures -> 15 minute lock, plus per-IP rate limiting on the login endpoint.
- Password policy: minimum length 12, no composition rules, breached-password list check if available.
- Session: type (signed JWT vs server-side session) **TBD**, idle timeout **TBD**, absolute timeout **TBD**, explicit logout/revocation required.
- MFA: **not implemented** — accepted risk, see R-02.

**Implemented 2026-10-12:** Argon2id hashing, signed session cookie (`https_only`, `same_site=lax`),
configurable idle and absolute timeouts, lockout after repeated failures, identical responses for
unknown user and wrong password, and forced re-authentication after a password change. Outstanding
from this list: breached-password checking, and the reset flow (O-01).

### 2.2 `users` table additions

The current schema has no password column. Required additions:

```sql
password_hash        VARCHAR(255) NOT NULL,
password_algo        VARCHAR(20)  NOT NULL DEFAULT 'argon2id',
password_updated_at  TIMESTAMPTZ  NOT NULL,
failed_login_count   SMALLINT     NOT NULL DEFAULT 0,
locked_until         TIMESTAMPTZ,
must_change_password BOOLEAN      NOT NULL DEFAULT TRUE
```

### 2.3 Password reset

Open. An Admin-performed reset lets that Admin impersonate an Approver, which defeats the 4-eyes control. Either implement token-based self-service reset or formally accept the risk. See O-01.

---

## 3. Role management (follows D-02)

- Seed the four roles (Viewer, Admin, Create, Approver) as reference data via migration, not manually.
- First Admin bootstrap: one-time seeded account with `must_change_password = TRUE`. Mechanism **TBD**.
- Role assignment changes must be written to `audit_logs` — add `USER_ROLE` to the `Entity` enumeration.
- `user_roles` is many-to-many, so Create and Approver can currently land on the same user and silently defeat 4-eyes. Enforce mutual exclusion between Create and Approver (DB constraint or application rule).
- Joiner / mover / leaver is a **manual process**. Stated explicitly because deprovisioning is the primary audit exposure of D-01.

---

## 4. Control plane UI deferral (follows D-03)

Compensating controls to apply:

- Private ALB / VPC-internal ingress only, no public exposure; or corporate IP allowlist.
- Reuse the Calendar Service local login rather than shipping an anonymous UI, if effort allows.
- Recorded as a dated, owned deferral — owner **TBD**.

---

## 5. Static API key design (follows D-04)

### 5.1 Issuance

- One key per calling client (per BU Airflow instance). No single global key, so a single BU can be revoked without a system-wide outage.
- 32 bytes from a CSPRNG, base64url encoded, prefixed: `cal_live_<random>`. The prefix aids secret scanning and environment identification.
- Issued out of band by an Admin, not through the standard UI CRUD screens.

### 5.2 Storage

- **Consumer side (Airflow):** AWS Secrets Manager, injected as an environment variable into the plugin. Never in DAG source, never in Git, never in an Airflow Variable (visible in the Airflow UI).
- **Service side:** store a SHA-256 hash only. Equality comparison is all that is needed, so a DB leak yields nothing usable.

```sql
CREATE TABLE api_clients (
  client_id     BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  client_name   VARCHAR(100) NOT NULL UNIQUE,   -- e.g. 'airflow-bu-retail'
  key_prefix    VARCHAR(20)  NOT NULL,          -- first 8 chars, for lookup + display
  key_hash      CHAR(64)     NOT NULL,          -- sha256 hex
  bu_id         BIGINT,
  active_flag   BOOLEAN      NOT NULL DEFAULT TRUE,
  expires_at    TIMESTAMPTZ,
  last_used_at  TIMESTAMPTZ,
  created_by    VARCHAR(100) NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_api_clients_prefix ON api_clients (key_prefix) WHERE active_flag;
```

### 5.3 Transport and validation

- Header `X-API-Key`. Never a query parameter — query strings are captured in ALB access logs and CloudWatch.
- TLS required; plain HTTP rejected at the load balancer.
- Look up by `key_prefix`, then compare the full hash with a **constant-time** comparison (`hmac.compare_digest`) to avoid timing leaks.
- Reject when `active_flag` is false or `expires_at` has passed.
- `last_used_at` updated asynchronously or at low frequency to avoid row contention.
- Failures return a flat `401` with no diagnostic detail.

### 5.4 Scope separation

- `/api/v1/*` (machine) accepts **only** the API key, never a user session.
- `/api/ui/*` (human) accepts **only** a user session, never the API key.
- Two distinct middlewares, not one combined middleware with a flag. This is what keeps the later swap to mTLS / OAuth a single-file change.
- The API-key identity is limited to `NextRunDay()`. It must not reach create / update / delete.
- API versioned from day one.

### 5.5 Operations

- Two active keys per client supported simultaneously, for zero-downtime rotation: issue new -> redeploy plugin -> deactivate old.
- `expires_at` set to 12 months so rotation is forced rather than forgotten.
- Log `client_name` and `key_prefix` on every call. **Never log the key itself**, including on authentication failure.
- Rate limit per `client_id`.
- Issuance, rotation and revocation written to `audit_logs` with entity `API_CLIENT`.

---

## 6. Schema defects to correct

Carried from document review; not yet actioned in the source documents.

| ID | Table | Defect |
|----|-------|--------|
| S-01 | `Calendar` | `FOREIGN KEY (calendar_rule_id)` declared but the column is never defined. |
| S-02 | `Calendar` | `calendar_key` typed as "Big Interger". |
| S-03 | `calendar_dates` | `FOREIGN KEY (calendar_key)` declared but the column is never defined. |
| S-04 | `calendar_dates` | No `UNIQUE (calendar_key, calendar_date)` — duplicate dates possible. |
| S-05 | `calendar_dates` | No index supporting the hot path (lookup by calendar + date). |
| S-06 | `holiday_dates` | `holiday_calendar_id` has no FK, and nothing links a business calendar to the holiday calendar that applies to it. **Resolved for this phase by D-08 (single region).** Keep the linkage column and FK in place rather than hardcoding a single calendar — multi-region then stays additive. |
| S-07 | `Extended_rules` | `CREATE TABLE Extended_rules ()` has a stray empty parenthesis list and the FK column is missing. |
| S-08 | `Extended_rules` | Near-duplicate of `calendar_rule`; purpose of having both is unclear. |
| S-09 | all | Identifier `Calendar_rule _id` contains a space; `creted_by` typo; inconsistent casing. |
| S-10 | all | `TIMESTAMP` used instead of `TIMESTAMPTZ`. Material defect in a scheduling product. |
| S-11 | `audit_logs` | `old_value` / `new_value` typed `BLOB` (not a PostgreSQL type) — makes the audit trail unqueryable. Use `JSONB`. |
| S-12 | — | `BU_ID` / `App_ID` referenced throughout but no `business_unit` or `application` table exists. |
| S-13 | — | No approval / pending-change table exists, so the stated 4-eyes requirement has no implementation. `audit_logs` only records after the fact. |

---

## 7. Open items

| ID | Item | Owner | Status |
|----|------|-------|--------|
| O-01 | Password reset mechanism vs 4-eyes integrity (see 2.3). | TBD | Open |
| O-02 | Session token type, idle timeout, absolute timeout. | TBD | Open |
| O-03 | First-Admin bootstrap mechanism. | TBD | Open |
| O-04 | **2026/2027 date cliff** — dates are generated for 2026 and 2027 only. Per D-05 the SOW covers one year, so building beyond 2027 is out of contract. The cliff itself does not go away: every calendar returns nothing from 2028-01-01 unless Fidelity runs a rollover. Deliverable is a documented, tested rollover procedure plus the generation script, handed over — not a silent omission. See R-06. | TBD | Open — reframed as handover |
| O-05 | Calendar Service failure mode. It sits on the critical path of every DAG run; behaviour when unavailable (fail / skip / run) is undefined. No HA, SLA, latency target, caching or local fallback. | TBD | Open |
| O-06 | Skip-vs-shift contradiction: "Monday holiday -> run Tuesday" against a calendar that already includes Tuesday produces either a duplicate or a silently merged run. **Demonstrated against the preview API — see 12.1; for a Mon-Fri calendar the documented behaviour is indistinguishable from simply skipping the run.** | TBD | Open — evidence available |
| O-07 | Month-end / quarter-end rules can roll forward into the next period. Boundary behaviour undefined. | TBD | Open |
| O-08 | Business-days vs extended-rules mutual exclusivity is a UI behaviour only; the API can still create invalid calendars. Needs a DB constraint. | TBD | Open |
| O-09 | `NextRunDay()` contract undefined: input/output types, timezone, DST, catchup/backfill, idempotency, behaviour when today is already valid. Shape depends on D-06 — a Timetable needs `next_dagrun_info(after) -> DagRunInfo`, a short-circuit check needs `is_run_day(calendar, date) -> bool`. Not interchangeable. | TBD | Open |
| O-10 | Calendar delete has no protection against deletion while live DAGs reference it; no soft delete despite `active_flag` existing. | TBD | Open |
| O-11 | No volumetrics, retention/partitioning for `calendar_dates` and `audit_logs`, DR or backup requirements. | TBD | Open |
| O-12 | Migration: "migrated extended rules used as is" contradicts "dropdown is a fixed agreed list". Handling of unmappable AutoSys calendars undefined. No reconciliation beyond a CSV, no rollback plan, no parallel run against AutoSys before cutover. | TBD | Open |
| O-13 | Control plane listeners are fire-and-forget: no delivery guarantee, retry, DLQ or outbox. A synchronous listener can also slow the scheduler. Compounded by daily reconciliation being explicitly out of scope, so drift is undetectable by design. | TBD | Open |
| O-14 | "REST API needs to be built to expose the metadata" is listed under **Out Of Scope** in the control plane document — appears to be in the wrong section. | TBD | Open |
| O-15 | Schema-per-BU does not scale beyond the stated 3 BUs; no cross-BU `dag_id` collision handling; no timezone definition for "run date". | TBD | Open |
| O-16 | Airflow version not stated. Listener APIs and the `dag_tag` / `dag_owner_attributes` internals differ between Airflow 2 and 3, and those are internal tables with no stability guarantee. | TBD | Open |
| O-17 | 30-day retention vs "archival managed by Fidelity" — no owner for the purge job. | TBD | Open |
| O-18 | The calendar document references the control plane document, but the control plane document never mentions the Calendar Service. The integration contract between the two is missing. | TBD | Open |
| O-19 | Airflow version is now **blocking**, not informational. Timetable APIs and DAG parsing differ materially between Airflow 2 and Airflow 3 (separate dag-processor in 3). D-06 cannot be finalised without it. | TBD | Open — blocking |
| O-20 | Cache transport for the timetable snapshot: shared-volume file vs Airflow Variable vs local SQLite. Airflow Variables read from the metadata DB on every parse, so may not be suitable. | TBD | Open |
| O-21 | Cache refresh frequency and minimum look-ahead window. Must exceed the longest realistic Calendar Service outage **and** be covered by the coverage alert in section 9. | TBD | Open |
| O-22 | Behaviour of manually triggered DAG runs, which bypass the timetable entirely (`infer_manual_data_interval`). Should a manual run on a non-calendar day be permitted? | TBD | Open |
| O-23 | **Who writes and operates the cache-refresh DAG** (10.4)? Under D-07 it sits on Fidelity's side of the boundary. We should ship it as a reference DAG inside the plugin package, but operation is theirs. Must be stated explicitly. | TBD | Open |
| O-24 | **Supported Airflow version matrix** must be declared, not discovered. Under D-07 we cannot inspect the target environments. | TBD | Open |
| O-25 | Network path and egress approval from each BU Airflow environment to the Calendar Service (TLS, VPC peering/PrivateLink, firewall rules). Fidelity-owned but blocking for first use. | TBD | Open |
| O-26 | Support and escalation model after handover: how a BU raises a plugin defect, and what diagnostics they must supply. | TBD | Open |
| O-27 | Which region, and the authoritative source of its holiday dates for 2026 and 2027 (D-08). | TBD | Open |
| O-28 | **Delivery date for Fidelity's extended rule list** (D-09). Each distinct rule needs an evaluator implemented and tested in `calendar_core`; a rule row with no evaluator does nothing. Count and complexity drive the estimate, so this is needed before estimate lock. | TBD | Open — estimate-critical |
| O-29 | Behaviour when a supplied rule cannot be expressed by the engine (e.g. fiscal-calendar or nth-weekday-before-month-end variants). Escalation path and scope treatment. | TBD | Open |
| O-30 | Whether a user may hold both Create and Approver roles simultaneously (see 11.4). Needs a constraint or a written accepted risk. | TBD | Open |
| O-31 | **Surfaced during implementation.** When a calendar selects a weekend day (e.g. Saturday only) and that day is a holiday, does the run shift to the next non-weekend working day (currently Monday), or to the next *selected* day (the following Saturday)? Related to O-06 but distinct. | TBD | Open |
| O-32 | `POST /api/ui/preview` and `GET /api/ui/preview/rules` are **deliberately unauthenticated**: both are pure computation over request-supplied input and expose no stored data. Confirm this is acceptable, or close it when rate limiting lands. | TBD | Open — confirm |
| O-33 | Session secret management. An unset `CALENDAR_SESSION_SECRET` falls back to a per-process key, so sessions break across restarts and replicas. Must be set from Secrets Manager before deployment. | TBD | Open |

---

## 8. Accepted risks

| ID | Risk | Rationale |
|----|------|-----------|
| R-01 | No federated identity; local credential store diverges from Fidelity IAM. Joiner/mover/leaver is manual, so leavers may retain calendar-admin access. | D-01 — SSO descoped for this phase. |
| R-02 | No MFA on an application that controls enterprise job scheduling. | D-01 — descoped for this phase. |
| R-03 | 4-eyes approval evidence rests on a locally managed `created_by` string rather than a non-repudiable federated identity. May not satisfy change-control audit. | Consequence of D-01 / D-02. |
| R-04 | Control plane UI has no defined authentication. | D-03 — deliberate deferral, mitigated per section 4. Note: "deferred" has no meaning past the SOW year unless an owner is named — see R-07. |
| R-05 | Static API keys are shared secrets: no per-request proof of possession, and compromise is undetectable until the key is rotated. | D-04 — accepted for this phase, mitigated per section 5. |
| R-06 | **Date cliff past contract end.** The SOW year ends before 2028-01-01. If the rollover procedure is not handed over and rehearsed, the first failure is a silent one — DAGs stop firing with no error, and no party is contracted to respond. | D-05. Mitigation: ship the generation script as a deliverable, document the annual run, and rehearse it once before handover. |
| R-07 | **Deferred items outlive the engagement.** SSO (D-01), mTLS/OAuth migration (D-04), control plane access management (D-03), archival ownership (O-17) and API key rotation (5.5) all fall due after the contracted year. | D-05. Mitigation: name a Fidelity owner for each before sign-off; unowned deferrals default back to us informally. |
| R-08 | **API key expiry collides with contract end.** `expires_at` is set to 12 months (5.5), so the first forced rotation falls due at roughly the same time the engagement closes. If rotation is not handed over, every BU plugin fails authentication simultaneously. | D-04 + D-05. Mitigation: cover rotation explicitly in the runbook and rehearse once before handover. |
| R-09 | **Integration boundary defect triage.** With D-07, when DAGs fail to fire the cause may be our plugin or Fidelity's integration. Without structured diagnostics and a declared compatibility matrix, we absorb the investigation cost by default. | D-07. Mitigation: ship a self-check command, structured logging, and a documented support/escalation model. |
| R-10 | **No end-to-end test of the real integration.** We cannot test inside BU Airflow environments, so the first true end-to-end execution happens in Fidelity's hands. | D-07. Mitigation: maintain a reference Airflow environment per supported version and define acceptance criteria owned by Fidelity. |
| R-11 | ~~Temporary authentication bypass via a trusted `X-Dev-User` header.~~ **Closed 2026-10-12**: replaced by local session authentication with Argon2id, lockout, idle and absolute session timeouts. | Closed. |

---

## 9. Handover deliverables (driven by D-05)

Because the engagement is contracted for one year, these must exist as artefacts before close, not as tribal knowledge:

- **Calendar date generation script**, runnable standalone, parameterised by year — not a one-off migration script.
- **Annual rollover runbook**: when to run, how to verify, what a successful run looks like, how to detect the failure mode (calendars returning empty).
- **Monitoring/alert for the cliff**: an alert that fires when any active calendar has no dates beyond N days ahead. This is the single cheapest control against R-06, and it converts a silent failure into a visible one.
- **API key rotation runbook** (see R-08), including the dual-active-key procedure from 5.5.
- **First-Admin bootstrap and password reset procedures** (O-01, O-03).
- **Named Fidelity owner for every TBD** in sections 7 and 8.
- **Schema defect list** (section 6) either fixed or formally handed over as known issues.

---

## 10. Airflow integration model (D-06)

### 10.1 Provenance

The word "timetable" does **not** appear in either requirements document. The documents say only that a *plugin* receives calendar name and run time during a DAG run and returns the *next run date*. The Timetable approach comes from a prior meeting discussion and is recorded here so the design intent is not lost.

The "return the next run date" framing in the document is a direct AutoSys translation and does not map onto Airflow's scheduling model. It should be challenged with the client rather than implemented literally.

### 10.2 Chosen approach

A custom `Timetable` subclass, parameterised by calendar name and bound in the DAG definition:

```python
with DAG(dag_id="eod_positions", schedule=CalendarTimetable("US_Business_Days")):
```

Custom timetables can only be registered with Airflow through a plugin, which is why the meeting referred to a "plugin":

```python
class CalendarPlugin(AirflowPlugin):
    timetables = [CalendarTimetable]
```

### 10.3 Correction to the meeting wording

A timetable **cannot be created or changed while a DAG is running**. It is bound at DAG-definition time and evaluated by the scheduler before any run exists.

What is dynamic is the **calendar contents**, not the binding:

- The DAG author sets the calendar *name* once, in the DAG file.
- An admin editing that calendar in the UI changes the future schedule of every DAG bound to it, with no code change and no redeploy.

This delivers the intended AutoSys-like behaviour. The binding is static; the calendar behind it is live.

### 10.4 Constraints this imposes

- Airflow serialises DAGs into its metadata DB, so the timetable must implement `serialize()` / `deserialize()` and may carry **only JSON-serialisable state** — the calendar name and nothing more. No HTTP client, no resolved date list.
- `next_dagrun_info()` executes **inside the scheduler loop**. It must perform no network I/O and must return quickly.
- Therefore dates are read from a **local cached snapshot**, refreshed out-of-band by a per-BU housekeeping DAG that pulls materialised dates from the Calendar Service.
- Consequence for O-05: a Calendar Service outage leaves the cache valid, so DAGs continue to fire correctly rather than stalling the scheduler. The failure mode degrades gracefully.

### 10.5 Sharp edge

If the cached snapshot runs out of future dates, `next_dagrun_info()` returns `None` and **the DAG silently stops scheduling** — no error, no task failure, no alert.

This is the 2028 cliff (O-04 / R-06) expressed in code. It is the specific reason the coverage alert in section 9 is a required deliverable rather than a nice-to-have.

### 10.6 Rejected alternative

`ShortCircuitOperator` as the first task of a daily-scheduled DAG. Safe (runs in a worker, not the scheduler) and closest to the document's literal wording, but it creates a DAG run on every calendar day including non-run days. That noise lands directly in the Metadata Control Plane UI, which would then need a defined rendering for "skipped" alongside green/red — a cross-document change (O-18). Retained here as the fallback if D-06 is blocked by the Airflow version.

### 10.7 Delivery boundary (D-07)

We deliver a versioned, pip-installable plugin package. Fidelity installs it, wires it into DAGs, and operates it.

**In our scope**

- The plugin package: `CalendarTimetable`, `AirflowPlugin` registration, HTTP client, cache reader.
- A **reference cache-refresh DAG** shipped as an example inside the package (O-23).
- The declared **Airflow compatibility matrix** (O-24).
- Integration guide: installation, configuration, API key placement, network requirements.
- A **self-check / diagnostic command** so a BU can prove connectivity and cache freshness without our involvement.
- Structured logging with correlation IDs, so defect reports are actionable.

**Fidelity's scope**

- Installing the package into each BU Airflow environment.
- Editing DAG files to bind `schedule=CalendarTimetable("<calendar_name>")`.
- Deploying and operating the cache-refresh DAG.
- Network path, egress rules and TLS trust to the Calendar Service (O-25).
- Scheduler sizing and parse-interval tuning.
- End-to-end acceptance testing in their environments (R-10).

**Consequences**

- The plugin's public API becomes a **contract**, not an implementation detail. Breaking changes require versioning discipline; the 3 BUs will upgrade independently.
- Dependencies must stay minimal (`httpx` only) to avoid conflicts with Airflow's pins in environments we cannot inspect.
- We cannot execute a true end-to-end test (R-10); a reference Airflow environment per supported version is required to substitute.
- Defect triage crosses an organisational boundary (R-09).

---

## 11. Four-eyes approval (maker-checker)

### 11.1 Definition

A change does not take effect until a second, different person approves it. Stated in the requirements as: *"Approver: User with approver role can only verify 4 eye operations made on the calendar records."*

Rationale: a calendar controls when production jobs run firm-wide. A single person must not be able to unilaterally stop month-end processing or cause a job to fire on a prohibited day.

### 11.2 Flow

1. A Create-role user edits a calendar and submits.
2. The change is stored as a **pending change** with status `PENDING`. It is **not** applied.
3. A different user holding the Approver role reviews a before/after diff.
4. Approve → change applied; both identities and timestamps recorded. Reject → discarded with a reason.

### 11.3 Required model (closes S-13)

A `calendar_change_request` entity holding the proposed payload and a state machine:

```
DRAFT → PENDING → APPROVED | REJECTED
```

`audit_logs` is **not** sufficient — it records what already happened, which is history, not an approval gate. Modelling this as a boolean flag on `calendar` will require a rewrite.

### 11.4 Controls that are currently missing

Each of the following defeats the control and needs either a mechanism or a written accepted risk:

- **Admin holds both create and approve rights**, so an Admin can approve their own change.
- **`user_roles` is many-to-many**, so one person can hold Create and Approver at once (O-30).
- **Admin-performed password reset** (O-01) allows takeover of an Approver account.
- Self-approval is not blocked anywhere: the approver must be enforced as `!= maker` at the application level.

### 11.5 Scope questions still open

- Which entities are in scope for approval — calendars only, or also role assignment and API key issuance?
- Does approval apply to deletion as well as create/update?
- Is a maker permitted to withdraw their own pending change before approval?

---

## 12. Findings from the preview build

### 12.1 Holiday shifting is a no-op on contiguous weekday calendars (O-06)

Measured against `POST /api/ui/preview`: a Monday-to-Friday calendar for 2027 with three holidays
(1 January, 24 December, 27 December).

| Collision policy | Holiday policy | Run days | Shifted |
|---|---|---:|---:|
| merge | shift_forward | 258 | 0 |
| merge | skip | 258 | 0 |
| shift_again | shift_forward | 261 | 3 |
| shift_again | skip | 258 | 0 |

The first two rows are identical. Under the proposed defaults, "shift the run forward" and "drop
the run" produce the same calendar, because the next working day is already a scheduled run day
and the shifted run merges into it.

The requirements' own example — *"Monday is holiday then job will execute on Tuesday"* — therefore
only has observable meaning for **sparse** calendars such as Mondays-only. For the most common
calendar type it silently removes a run.

**What to ask the client:** on a Monday-to-Friday calendar, when a holiday falls on a working day,
should the firm's total run count for that year fall by one, or should the run be preserved and
executed on an additional day? The two readings of the requirement differ by three runs a year per
calendar in the example above, and the difference is invisible in the UI unless the shifted count
is displayed.

### 12.2 Selected weekend days (O-31)

Surfaced by a failing test rather than analysis: a Saturday-only calendar initially shifted every
run to Monday, because the engine treated Saturday as a non-working day even though the user had
selected it. Resolved by treating a selected weekday as a working day for its own calendar, but
the holiday case remains open — see O-31.

### 12.3 The no-self-approval constraint caught a real defect

The database constraint `ck_change_request_no_self_approval` rejected an insert during
development: with the approval gate off, the service was recording the maker as their own
approver.

That would have produced a four-eyes audit trail showing every change as approved, by the person
who made it. The gate being off is a legitimate configuration (D-10); claiming it was approved is
not.

Corrected so that in direct-apply mode the request is `APPROVED` with `checker` left **null** — a
truthful record that no second pair of eyes was involved. Worth noting that the control that
caught this was a database constraint, not a test.
