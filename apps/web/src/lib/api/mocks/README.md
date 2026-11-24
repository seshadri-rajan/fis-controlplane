# API mocks (MSW)

Mock Service Worker intercepts `fetch()` in development so the UI can be built before the new backend exists. Mocks follow `req-details/api-spec/CalendarManagementSpec.yml` (server root `/v1`), **not** the Calendar Service's current implementation.

Mock mode is the development default and can be selected in the navbar. **Local backend** mode stops MSW and proxies `/v1` to `http://127.0.0.1:8000`; it requires the Calendar Service to run with authentication disabled. The mode is saved in browser local storage. The worker script lives in `public/mockServiceWorker.js`; regenerate it with `npx msw init public --no-save`. Regenerate spec types with `npm run generate:spec`.

## Mock users

All accept the password `password123`.

| Username | Role | Notes |
|----------|------|-------|
| `admin` | ADMIN | |
| `editor1` | EDITOR | |
| `approver1` | APPROVER | |
| `viewer1` | VIEWER | |
| `uploader1` | UPLOADER | |
| `disabled1` | VIEWER | inactive; login returns 403 |

## What's mocked

Calendar data lives in `sessionStorage` (`msw-mock-calendars-v4`) so it survives reloads. It is seeded in `store.ts` with 13 demo calendars holding dates for the current and next year: nine uploaded (trading days, 10th working day, quarter start/end, the 8th, 1 April, the 15th, 5th working day, and `Legacy-Month-End`, which is **inactive**) and four `AUTOSYS_*` migrated (one left empty on purpose). The dates are plain weekday arithmetic with no holidays removed. Closing the tab resets it; bump the key in `store.ts` when the demo data changes. All endpoints below require the bearer token; writes require EDITOR or ADMIN.

- `POST /v1/login` — `{username, password}` returns the spec's `User` plus an `Authorization: Bearer <token>` response header. Errors use the spec's `{code, message, requestId}` shape (400 / 401 / 403).
- `GET /v1/calendars` — paginated; supports `limit`, `offset` (page number), `calendarName`, `migrated`. (No `uploaded` filter in the spec; the UI filters on the client, API-024.)
- `GET /v1/calendars/{name}` — one calendar. `GET /v1/calendars/{name}/dates` — its dates, sorted.
- `PATCH /v1/calendars/{name}/update` — replaces every writable field (anything omitted is cleared), so the UI sends the calendar's other fields back. 404 if unknown, 409 if the calendar is inactive, 400 on an invalid body, a `calendarName` that doesn't match the path, or any change to a date before today (proposed rule, API-027).
- `POST /v1/calendars` — 201 with `Location`; 400 on invalid body (an empty `holidayCalendar` is accepted: uploaded calendars carry none, API-005); 409 on duplicate name.
- `POST /v1/calendars/upload/verify` — validates `.xlsx` rows before save and returns each source row with its normalized date, `valid` flag, and errors. The mock parser in `calendarWorkbook.ts` stands in for backend validation; the UI itself does not parse workbooks.
- `POST /v1/calendars/{name}/upload` — multipart `.xlsx` (≤ 5 MiB, one `Calendar date` column, `YYYY-MM-DD`, current/next year, no duplicates); creates a missing calendar or replaces dates for the requested year and sets `uploaded: true`. `?createOnly=true` returns 409 if the name already exists. 409 (duplicate or inactive) / 413 / 415 / 400. The backend validates again before saving.
- `GET /v1/calendars/{name}/export` — downloads all calendar dates as `.xlsx` using `YYYY-MM-DD`.

- `POST /v1/calendars/{name}/activate` and `/deactivate` — **ADMIN only** (403 otherwise); return the calendar with `active` set (API-026). While inactive, `update` and `upload` answer 409.

The same backend also exposes the demo run-history API:

- `GET /v1/run-history` — latest generated record for each source/type/DAG/task, used by the Home dashboard.
- `GET /v1/run-history/demo` — all generated records, including previous runs and an exact duplicate. Live ingestion and persistence are not implemented.

The spec has no `/me` or `/logout`, so there are no handlers for them. The session is client-side (`src/lib/api/client.ts`): sign-in stores `{token, user}` in `sessionStorage` (`calendar-session`), a reload restores it, and sign-out clears it.

Every screen now uses `/v1` endpoints, so unhandled requests are a bug to fix by adding a handler.

## Open assumptions

Every assumption below is tracked, with a backend question and status, in `req-details/api-spec/API_SPEC_ISSUES.md`. Update it when you add or change an assumption.

- **Token delivery** is not defined in the spec (the 200 schema is only `User`). The `Authorization` response header is an assumption, confined to `login()` in `client.ts` and `handlers.ts`.
- The spec says login itself requires a bearer token; the mock does not enforce this.
- Calendars are made by uploading a file or migrated from Autosys; there is no rule-based creation, so the holiday-calendar list, rule catalog and preview endpoints (API-005, API-010, API-020) are no longer mocked. The spec's rule fields (`dateRuleType`, `dayOfWeek`, …) are still sent back unchanged on `update`, which replaces every field.
- The spec has no endpoint listing Autosys calendars. The UI uses `GET /v1/calendars?migrated=true`, assuming migrated calendars already exist (the upload endpoint requires an existing calendar).
- The UI generates its Excel upload template locally; it does not require a separate template API endpoint.

## Switching to the real backend

Use **Local backend** in the navbar during development. Calendar APIs and the generated demo run-history API use the same `calendar_service.main:app` backend on port 8000. `/v1/login` and metadata endpoints are not available. Backend mode bypasses UI login only for local development and must not be used as production authentication.

The final phase is expected to add SSO through the Control Plane and map AD groups to Admin/View roles. Application-level user management is out of scope.

## Adding endpoints

Add handlers to `handlers.ts` using spec paths and the types from `../spec`. MSW hot-reloads them.
