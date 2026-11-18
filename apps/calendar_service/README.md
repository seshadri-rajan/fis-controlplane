# Calendar service

The backend exposes the seven `/v1` operations in
[CalendarManagementSpec.yml](../../CalendarManagementSpec.yml). It stores explicit dates and
audits writes. `/health` is public. There is no backend login, session-cookie API, or API-key
fallback. The web app uses `/v1`; the Airflow client has not been ported.

## Run locally

From the repository root, with workspace dependencies installed (`uv sync`):

```powershell
$env:CALENDAR_AUTH_ENABLED = "false"
uv run uvicorn calendar_service.main:app --host 127.0.0.1 --port 8000
```

Open [interactive API docs](http://127.0.0.1:8000/docs). The default SQLite database is
`calendar.db`. The app creates the date-only schema automatically in development. Auth-off
mode permits **all** reads and writes and records `local-development` as the actor. Never
expose this mode to untrusted clients.

For deployment, set `CALENDAR_DB_URL` to a **fresh** PostgreSQL database and
`CALENDAR_AUTO_CREATE_SCHEMA=false`. From `apps\calendar_service`, run `uv run alembic upgrade head`
before starting the API. Alembic creates the layout in
[CalendarManagementSchema.sql](../../CalendarManagementSchema.sql); don't apply both.
The prototype rule-generation and bootstrap jobs use a different schema and must not be pointed
at the management database.

## Enable OAuth

Auth defaults to enabled and startup fails if required provider settings are missing. Clients
obtain an **access token** from the provider and send `Authorization: Bearer <token>`. Configure
the provider to issue tokens for this API, not ID tokens for a client application.

| Setting | Purpose |
|---|---|
| `CALENDAR_OAUTH_ISSUER` | Exact issuer identifier from the authorization server. |
| `CALENDAR_OAUTH_AUDIENCE` | This API's expected audience. For Keycloak, add it with an audience mapper if needed. |
| `CALENDAR_OAUTH_JWKS_URL` | HTTPS `jwks_uri` from provider metadata, for JWT mode. |
| `CALENDAR_OAUTH_ALGORITHM` | Expected asymmetric signing algorithm. Defaults to `RS256`. |
| `CALENDAR_OAUTH_ROLE_CLAIM` | Claim path containing a role or array. E.g. `realm_access.roles` for Keycloak realm roles, or `groups` for Okta if included in the access token. |
| `CALENDAR_OAUTH_ROLE_MAP` | JSON mapping of provider values to app roles. E.g. `{"Calendar Editors":"EDITOR","Calendar Admins":"ADMIN"}`. |
| `CALENDAR_OAUTH_USERNAME_CLAIM` | Audit actor claim; defaults to `preferred_username`, with `sub` as fallback. |

Any valid caller can read. Create, update, and upload require a mapped `EDITOR` or `ADMIN`
role. For Okta JWT validation, use a custom authorization server configured for this API,
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
  -F 'file=@calendar.csv;type=text/csv' `
  http://127.0.0.1:8000/v1/calendars/business-calendar/upload
```

Example for auth-off local development. When auth is enabled, include the bearer header.
The UTF-8 CSV must contain a `date` header and at least one `DD-MM-YYYY` date in the specified
year. The upload replaces that year's dates only. The default file limit is 2 MiB.
