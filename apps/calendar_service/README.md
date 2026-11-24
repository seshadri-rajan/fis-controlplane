# Calendar service

The backend exposes the calendar operations in
[CalendarManagementSpec.yml](../../CalendarManagementSpec.yml). It stores explicit dates and
records create, upload, amendment, activation, and deactivation actions in the backend audit log.
There is no audit-history endpoint. `/health` is public. There is no backend login, session-cookie
API, or API-key fallback. The web app uses `/v1`; the Airflow client has not been ported.

This is the single backend application for calendar and run-history APIs. Run history is
generated demo data only; no separate Control Plane server is required.

## Run locally

From the repository root, install dependencies with either `uv sync` or:

```powershell
py -3.14 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Then start the service using the command for your setup:

```powershell
$env:CALENDAR_AUTH_ENABLED = "false"
# For uv:
uv run uvicorn calendar_service.main:app --host 127.0.0.1 --port 8000
# Or, for the pip-installed virtual environment:
.\.venv\Scripts\python.exe -m uvicorn calendar_service.main:app --host 127.0.0.1 --port 8000
```

Open [interactive API docs](http://127.0.0.1:8000/docs). The default SQLite database is
`calendar.db`. The app creates the date-only schema automatically in development. Auth-off
mode permits **all** reads and writes and records `local-development` as the actor. Never
expose this mode to untrusted clients.

### Run history demo

The same application on port 8000 serves:

- `GET /v1/run-history`: latest generated record per source/type/DAG/task.
- `GET /v1/run-history/demo`: the complete generated feed, including older and duplicate rows.

These demo endpoints remain unauthenticated and are for local development only. They do not read
persisted data or ingest live Airflow events; do not expose them as production APIs.

For deployment, set `CALENDAR_DB_URL` to a **fresh** PostgreSQL database and
`CALENDAR_AUTO_CREATE_SCHEMA=false`. From `apps\calendar_service`, run `uv run alembic upgrade head`
before starting the API. Alembic creates the layout in
[CalendarManagementSchema.sql](../../CalendarManagementSchema.sql); don't apply both.
The prototype rule-generation and bootstrap jobs use a different schema and must not be pointed
at the management database.

## Enable OAuth

Auth defaults to disabled for local development. Before deployment, set
`CALENDAR_AUTH_ENABLED=true` and configure the provider below. With auth enabled, startup fails
if required provider settings are missing. Clients obtain an **access token** from the provider
and send `Authorization: Bearer <token>`. Configure the provider to issue tokens for this API,
not ID tokens for a client application.

| Setting | Purpose |
|---|---|
| `CALENDAR_OAUTH_ISSUER` | Exact issuer identifier from the authorization server. |
| `CALENDAR_OAUTH_AUDIENCE` | This API's expected audience. For Keycloak, add it with an audience mapper if needed. |
| `CALENDAR_OAUTH_JWKS_URL` | HTTPS `jwks_uri` from provider metadata, for JWT mode. |
| `CALENDAR_OAUTH_ALGORITHM` | Expected asymmetric signing algorithm. Defaults to `RS256`. |
| `CALENDAR_OAUTH_ROLE_CLAIM` | Claim path containing a role or array. E.g. `realm_access.roles` for Keycloak realm roles, or `groups` for Okta if included in the access token. |
| `CALENDAR_OAUTH_ROLE_MAP` | JSON mapping of provider values to app roles. E.g. `{"Calendar Editors":"EDITOR","Calendar Admins":"ADMIN"}`. |
| `CALENDAR_OAUTH_USERNAME_CLAIM` | Audit actor claim; defaults to `preferred_username`, with `sub` as fallback. |

Any valid caller can read. Create and upload require a mapped `EDITOR` or `ADMIN` role.
Amending, activating, and deactivating uploaded or migrated calendars require `ADMIN`.
For Okta JWT validation, use a custom authorization server configured for this API,
not the org authorization server's Okta API tokens. Keycloak, Okta, and other compatible
providers use the same settings; no provider SDK is required.

For opaque tokens, set `CALENDAR_OAUTH_MODE=introspection` and configure
`CALENDAR_OAUTH_INTROSPECTION_URL`, `CALENDAR_OAUTH_CLIENT_ID`, and
`CALENDAR_OAUTH_CLIENT_SECRET`. The endpoint must support RFC 7662 with HTTP Basic client
authentication and return `active`, `aud`, and `sub`; include role claims if those tokens
should be allowed to write. Configure a new provider and restart the service to switch.

## Upload dates

```powershell
curl.exe -F 'data={"year":"2027"};type=application/json' `
  -F 'file=@calendar.xlsx;type=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' `
  http://127.0.0.1:8000/v1/calendars/business-calendar/upload
```

Example for auth-off local development. When auth is enabled, include the bearer header.
The `.xlsx` workbook must contain one worksheet, a single `Calendar date` column, and 1–366
dates formatted as `YYYY-MM-DD`. The supplied year must be the current or next year, and every
date must be in that year. The upload replaces that year's dates only. The default file limit is
5 MiB.
For create-from-file, add `?createOnly=true`; the service creates the calendar and uploads its
dates in one request, and returns a conflict if that name already exists.

Before saving, the UI calls `POST /v1/calendars/upload/verify`. The response reports each row's
original value, normalized date when valid, `valid` flag, and any row errors. The upload endpoint
repeats validation before writing, so a client cannot bypass the checks.

`GET /v1/calendars/{calendar_name}/export` downloads all stored dates as an Excel workbook with
`YYYY-MM-DD` values.
