# Changelog

## Unreleased

### Calendar Management API and web cutover

The backend and web app now use all seven operations in the
[Calendar Management `/v1` contract](./CalendarManagementSpec.yml). The service starts with a
fresh date-only database; there is no migration from the previous schema. The `/api/ui` routes,
local login, and rule-preview screen were removed. The Airflow client was not migrated.

OAuth is disabled by default for local development. Before deployment, set
`CALENDAR_AUTH_ENABLED=true` and configure a provider for JWT validation via JWKS or opaque-token
validation via introspection. When enabled, create, update, and upload require `EDITOR` or `ADMIN`.
The web UI accepts an access token entered by the user and keeps it only in memory.

#### Added

Backend source paths below are relative to `apps/calendar_service/src/calendar_service/`.

| File | Change |
| --- | --- |
| `api/v1/calendars.py` | Implements the seven `/v1` calendar operations. |
| `api/v1/upload.py` | Validates multipart uploads, file size, CSV contents, and dates before writing. |
| `api/schemas/management.py` | Defines request and response models and validates calendar names and dates. |
| `api/middlewares/oauth_auth.py` | Enforces bearer authentication, the development auth switch, and write permissions. |
| `infra/security/oauth.py` | Validates access tokens and maps provider claims to application roles. |
| `infra/database/management.py` | Defines calendar, date, and audit tables and handles filtering and date replacement. |
| `infra/database/migrations/versions/20261118_management.py` | Creates the fresh date-only database schema. |
| `apps/calendar_service/tests/test_management_api.py` | Tests the calendar lifecycle, CSV uploads, exclusions, auditing, and OAuth modes. |
| `apps/web/src/features/calendars/MonthGrid.tsx` | Displays stored calendar dates without using the old preview API. |

#### Changed

| File | Change |
| --- | --- |
| `.env.example` | Shows the auth switch, OAuth provider configuration, and upload limit. |
| `CalendarManagementSpec.yml` | Clarifies bearer auth, date formats, exclusions, uploads, and response shapes. |
| `README.md` | Updates the quickstart and schema-generation steps and notes the Airflow limitation. |
| `apps/calendar_service/README.md` | Documents fresh database setup, OAuth configuration, and CSV uploads. |
| `apps/calendar_service/pyproject.toml` | Adds SQLite, HTTP, multipart, and JWT dependencies. |
| `apps/calendar_service/scripts/export_openapi.py` | Updates the export script description for `/v1`. |
| `api/middlewares/__init__.py` | Removes obsolete references to session and API-key middleware. |
| `config/dependency.py` | Keeps shared settings and database-session dependencies and removes old UI wiring. |
| `config/settings.py` | Adds OAuth and upload settings and removes obsolete UI auth settings. |
| `infra/database/migrations/env.py` | Points Alembic at the management schema. |
| `main.py` | Mounts `/v1`, initializes OAuth and the database, and standardizes API errors. |
| `apps/calendar_service/tests/test_migrations.py` | Verifies that the new migration matches the models and expected date-table key. |
| `docs/api/openapi.json` | Publishes the generated `/v1` contract. |
| `apps/web/README.md` | Documents startup, access-token entry, and type generation. |
| `apps/web/src/App.tsx` | Makes calendars the main screen and lets users supply or clear an access token. |
| `apps/web/src/features/calendars/CalendarsPage.tsx` | Connects browsing, filtering, details, exclusions, create/edit, and CSV upload to `/v1`. |
| `apps/web/src/lib/api/README.md` | Identifies the backend OpenAPI schema as the source for frontend types. |
| `apps/web/src/lib/api/client.ts` | Replaces the old API calls with typed `/v1` calls, including bearer headers and multipart uploads. |
| `apps/web/src/lib/api/schema.d.ts` | Regenerates frontend types from the `/v1` contract. |
| `apps/web/src/main.tsx` | Removes the retired session-auth provider. |
| `apps/web/vite.config.ts` | Proxies `/v1` instead of `/api`. |

#### Removed

| File | Change |
| --- | --- |
| `api/middlewares/api_key_auth.py` | Removes the unused API-key middleware. |
| `api/middlewares/session_auth.py` | Removes session-cookie authentication for the retired UI API. |
| `api/schemas/auth.py` | Removes the local login and account models. |
| `api/schemas/calendar.py` | Removes the previous calendar models, replaced by the management schemas. |
| `api/schemas/preview.py` | Removes the old rule-preview models. |
| `api/ui/__init__.py` | Removes the package marker for the retired UI routes. |
| `api/ui/approvals.py` | Removes the old approvals module; approval routes are not part of `/v1`. |
| `api/ui/auth.py` | Removes local login, logout, and account endpoints. |
| `api/ui/calendars.py` | Removes the previous calendar, history, and change-request handlers. |
| `api/ui/preview.py` | Removes the old rule-preview endpoints. |
| `infra/database/migrations/versions/77208b5b87ca_initial_schema.py` | Removes the previous initial migration in favor of the date-only schema. |
| `apps/calendar_service/tests/test_auth_api.py` | Removes tests for the retired local login and session routes. |
| `apps/calendar_service/tests/test_calendars_api.py` | Removes tests for the retired calendar and approval routes. |
| `apps/calendar_service/tests/test_preview_api.py` | Removes tests for the retired preview routes. |
| `apps/web/src/features/auth/AuthProvider.tsx` | Removes frontend session-login state and calls. |
| `apps/web/src/features/auth/LoginPage.tsx` | Removes the username/password form. |
| `apps/web/src/features/preview/CalendarForm.tsx` | Removes the form that submitted rules to the preview API. |
| `apps/web/src/features/preview/MonthGrid.tsx` | Replaces the preview-specific grid with the stored-date calendar grid. |
| `apps/web/src/features/preview/PreviewPage.tsx` | Removes the preview screen because `/v1` has no rule-preview endpoint. |

#### Verification

- 64 Python tests passed.
- The production frontend build passed.
- All seven frontend API calls worked through Vite against FastAPI.
