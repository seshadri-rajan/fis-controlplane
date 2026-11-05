# API spec issues tracker

Living list of problems, gaps and open questions in `CalendarManagementSpec.yml` that block or affect the UI. Send open items to the backend team and update this file as answers arrive.

**How to maintain**
- Add new items at the end with the next `API-nnn` ID. Never renumber; IDs are referenced from code comments.
- Move an item's **Status** as it progresses: `Open` → `Sent` → `Answered` → `Resolved` (UI updated to match) or `Won't fix`.
- Record the backend's answer in the item and note it in the [Change log](#change-log).
- **Severity:** `Blocker` = a UI feature cannot be built correctly without an answer; `High` = built on an assumption that is likely to change; `Medium` = workaround is cheap; `Low` = polish or cleanup.

Requirement references (`RECORD.md`, v2 requirements) point at this repo.

## Summary

| ID | Severity | Status | Issue | UI assumption in place |
|----|----------|--------|-------|------------------------|
| [API-001](#api-001-login-token-delivery-is-undefined) | High | Open | Login token delivery undefined | `Authorization` response header |
| [API-002](#api-002-login-requires-a-bearer-token-to-obtain-a-bearer-token) | Medium | Open | Login itself requires a bearer token | Not sent |
| [API-003](#api-003-no-logout-session-restore-or-expiry-contract) | Medium | Open | No logout, `/me` or expiry contract | Client-side session |
| [API-004](#api-004-date-format-contradicts-itself) | High | Open | `DD-MM-YYYY` vs `YYYY-MM-DD` | `YYYY-MM-DD` |
| [API-005](#api-005-holidaycalendar-is-required-but-has-no-source) | High | Open | `holidayCalendar` required, no list/default | Proposed `GET /v1/holiday-calendars` (mocked); uploads send `""` |
| [API-006](#api-006-no-way-to-list-or-create-autosys-migrated-calendars) | High | Open | Autosys migration flow undefined | `GET /calendars?migrated=true` |
| [API-007](#api-007-new-calendar-from-a-file-takes-two-non-atomic-calls) | Medium | Open | Create-from-file is two calls | `POST` with `dates: []`, then upload |
| [API-008](#api-008-upload-accepts-csv-only) | Medium | Open | No Excel upload | CSV only, UI rejects `.xlsx` |
| [API-009](#api-009-rule-fields-are-underspecified-and-adjustment-action-is-missing) | Blocker | Open | Rule composition + adjustment action | Rule fields mapped; no adjustment action |
| [API-010](#api-010-no-way-to-preview-or-generate-dates-from-rules) | Blocker | Open | No preview / date generation | Proposed `POST /v1/calendars/preview` (mocked) |
| [API-011](#api-011-approval-workflow-is-absent) | Blocker | Open | Approval (four-eyes) workflow absent | Not built |
| [API-012](#api-012-role-permissions-are-undefined-for-approver-and-uploader) | High | Open | APPROVER / UPLOADER permissions | UPLOADER and APPROVER are read-only |
| [API-013](#api-013-who-may-delete-a-calendar-contradicts-itself) | Medium | Open | Delete permission contradiction | Not built |
| [API-014](#api-014-business-unit-and-application-are-missing) | Medium | Open | No BU / Application | Not built |
| [API-015](#api-015-pagination-offset-is-really-a-page-number) | Low | Open | `offset` means page number | Treated as page number |
| [API-016](#api-016-list-and-upload-responses-embed-all-dates) | Low | Open | Payload size | None |
| [API-017](#api-017-no-first-login-forced-password-change-or-lockout-signal) | Medium | Open | Forced password change / lockout | Not handled |
| [API-018](#api-018-spec-typos-and-inconsistencies) | Low | Open | Typos and inconsistencies | None |
| [API-019](#api-019-deployment-origin-and-cors) | Low | Open | Same-origin or CORS? | Relative `/v1` |
| [API-020](#api-020-extended-rule-catalog-endpoint-is-missing-and-the-rule-table-is-ambiguous) | Blocker | Open | No rule-catalog endpoint; rule table ambiguous | Proposed `GET /v1/rules` (mocked) |
| [API-021](#api-021-how-many-years-of-dates-a-calendar-holds-and-who-extends-them) | Medium | Open | Date horizon / who extends | One year per calendar |
| [API-022](#api-022-calendar-has-no-description-and-no-way-to-rename) | Low | Open | No description field | Field removed from the form |
| [API-023](#api-023-upload-replaces-all-dates-so-a-calendar-cannot-be-built-up-one-year-at-a-time) | High | Open | Upload replaces all dates | UI merges other years client-side (to confirm with team) |
| [API-024](#api-024-no-way-to-list-calendars-created-by-upload-and-the-uploaded-flag-is-ambiguous) | Medium | Open | No `uploaded` filter; flag ambiguous | Filtered on the client |
| [API-025](#api-025-no-change-history-or-updated-by-for-a-calendar) | Medium | Open | No change history / `updatedBy` | Audit table dropped |

---

## Authentication

### API-001: Login token delivery is undefined
- **Severity / status:** High · Open · raised 2026-11-04
- **Spec:** `POST /login` description says it returns "an access token", but the 200 response schema is only `User` (no token field). No response header for a token is declared either (only `Cache-Control`).
- **Impact:** The UI cannot authenticate any later call until it knows where the token is.
- **Ask:** Where is the token delivered: response body field, `Authorization` response header, or `Set-Cookie`? What is its format (JWT?) and lifetime?
- **UI assumption:** `Authorization: Bearer <token>` response header. Isolated to `login()` in `apps/web/src/lib/api/client.ts` and the login handler in `apps/web/src/lib/api/mocks/handlers.ts`.

### API-002: Login requires a bearer token to obtain a bearer token
- **Severity / status:** Medium · Open · raised 2026-11-04
- **Spec:** `info.description` says every operation "including login" needs `Authorization`; `securitySchemes.bearerAuth` says the same; the `login` description repeats "A bearer token is also required for this operation". The root `security` applies bearer auth to `/login`.
- **Impact:** Unusable as written: there is no way to get the first token.
- **Ask:** Confirm `/login` should have `security: []` (no token required). If not, what credential does a signed-out client send?
- **UI assumption:** No token is sent on login.

### API-003: No logout, session restore, or expiry contract
- **Severity / status:** Medium · Open · raised 2026-11-04
- **Spec:** No `/logout`, no `/me` (current user). `DELETE /users/{id}` says it "invalidates its sessions", implying server-side sessions or revocable tokens. Session type and timeouts are TBD in `RECORD.md` (line 45).
- **Impact:** Sign-out cannot revoke a token, a reload cannot validate the stored session, and the UI cannot tell when to re-prompt.
- **Ask:**
  1. Add `POST /logout` (revoke token)?
  2. Add `GET /me` (or similar) to validate a stored token?
  3. What are the idle and absolute timeouts, and how does expiry surface (401 on next call? a `refresh` flow)?
- **UI assumption:** Session `{token, user}` lives in `sessionStorage`; sign-out only clears it. A 401 from a later call is not yet handled globally.

### API-017: No first-login forced password change or lockout signal
- **Severity / status:** Medium · Open · raised 2026-11-05
- **Spec:** `User` has no `mustChangePassword` flag. `login` returns 403 for "account policy" but defines no distinct code for locked or password-expired accounts.
- **Impact:** The previous backend exposed `must_change_password` and a 423 lock status; the UI relied on them. Admin-created users with temporary passwords have no signalling path.
- **Ask:** How should the UI detect (a) a forced password change and (b) a locked account? Suggest a field on `User` and distinct `code` values in `ErrorResponse`.
- **UI assumption:** Not handled. The 403 message is shown as-is.

---

## Calendar data and creation

### API-004: Date format contradicts itself
- **Severity / status:** High · Open · raised 2026-11-04
- **Spec:**
  - `CalendarDate`: `description: "...DD-MM-YYYY format"`, `example: '25-12-2027'`, but `pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'` (YYYY-MM-DD).
  - `CalendarDates` examples are `DD-MM-YYYY`; the `getCalendarDates` response example and `ValidationError` example use `YYYY-MM-DD`.
  - `info.description` says `DD-MM-YYYY`; the `upload` endpoint says ISO 8601 `YYYY-MM-DD`.
- **Impact:** The same field has two incompatible formats; every date read or written is at risk.
- **Ask:** Confirm the wire format (we assume `YYYY-MM-DD`) for JSON bodies, responses and CSV, and correct the descriptions and examples.
- **UI assumption:** Strict `YYYY-MM-DD` everywhere (`apps/web/src/lib/api/parseDatesCsv.ts`).

### API-005: `holidayCalendar` is required but has no source
- **Severity / status:** High · Open · raised 2026-11-05
- **Spec:** `CalendarWriteRequest.required` includes `holidayCalendar` (free string, example `holiday-calendar`). No endpoint lists holiday calendars (e.g. NYSE, Canadian), no default, no validation rule. `holidayRun` and `holidayOffset` semantics are undescribed beyond one line each.
- **Impact:** A new calendar cannot be created correctly, and the selector (a list of NYSE / Canadian / … options) has no data source.
- **Proposed contract (not in the spec):** `GET /v1/holiday-calendars` returns `[{ "name": "NYSE", "description": "New York Stock Exchange" }, …]`. `name` is the value to send as `holidayCalendar`. Readable by every authenticated role. The same data should expose each calendar's holiday dates and names (the preview in API-010 returns them for the selected year).
- **Ask:**
  1. Confirm the endpoint (or give the real one) and its response shape.
  2. What happens when `holidayCalendar` does not exist (400? auto-create?) or the referenced calendar is deleted?
  3. Can it be optional or defaulted for uploaded calendars, or for migrated ones?
  4. Define `holidayRun` and `holidayOffset` precisely (see API-009).
- **UI assumption:** A required "Holiday calendar" dropdown filled from the proposed endpoint, on the **rules form only** (`HolidayCalendarSelect.tsx`). Mocked with NYSE, CANADA, UK_LSE and US_FEDERAL; the mock holiday dates are illustrative (no "observed" shifting).
- **Review decision (2026-11-05):** the Upload file screen has no holiday calendar at all. The spec still requires `holidayCalendar` on `POST /v1/calendars`, so for a new uploaded calendar the UI sends an empty string (`NO_HOLIDAY_CALENDAR` in `UploadCalendarPanel.tsx`) and the mock accepts it. **Ask (5):** make `holidayCalendar` optional for calendars with no rule, or tell us what to send. A real backend will probably reject the empty string.

### API-006: No way to list or create Autosys-migrated calendars
- **Severity / status:** High · Open · raised 2026-11-05
- **Spec:** `Calendar.migrated` is read-only in effect (`CalendarWriteRequest` has no `migrated`). `GET /calendars?migrated=true` can filter, but nothing says how migrated calendars come into existence or whether an upload keeps `migrated: true`.
- **Impact:** The "Upload dates" option (previously labelled "Migrated from Autosys", renamed for now) depends on pre-existing calendars.
- **Ask:**
  1. Who creates migrated calendars (a batch import outside this API?) and are they created empty?
  2. After uploading dates to one, do `migrated` and `uploaded` both read `true`?
  3. Should the UI be able to create a migrated calendar (e.g. `migrated` on the create request)?
- **UI assumption:** Migrated calendars already exist; Upload dates has one combined "Calendar" dropdown whose "Migrated calendars" group is filled from `GET /v1/calendars?migrated=true`.

### API-007: New calendar from a file takes two non-atomic calls
- **Severity / status:** Medium · Open · raised 2026-11-05
- **Spec:** `POST /calendars` takes JSON with required `dates`; `POST /calendars/{name}/upload` needs an existing calendar.
- **Impact:** Creating from a file needs create then upload. If the second call fails, an empty calendar is left behind. It is also unclear whether `dates: []` is valid on create.
- **Ask:** Confirm `dates: []` is accepted, or offer a single multipart create-from-file operation.
- **UI assumption:** `POST` with `dates: []`, then upload. A failed upload keeps the created name so a retry only re-uploads.

### API-008: Upload accepts CSV only
- **Severity / status:** Medium · Open · raised 2026-11-05
- **Spec:** `upload` takes UTF-8 `text/csv`, single `date` column, max 5 MiB. Users expect "CSV/Excel".
- **Ask:** Is `.xlsx` required? If so, should the server parse it, or is client-side conversion acceptable?
- **UI assumption:** CSV only; `.xlsx` is rejected with an explanatory message. A "Download sample CSV" link gives users a valid file for the selected year to edit. The screen also warns that Excel rewrites dates in the regional format unless the column is formatted `yyyy-mm-dd`.

### API-009: Rule fields are underspecified and adjustment action is missing
- **Severity / status:** Blocker · Open · raised 2026-11-04
- **Spec:** `dateRuleType` (enum), `dayOfWeek` (free strings), `runDate` (`'01-01'`, no pattern), `runDay` (**string**, example `'10'`), `holidayRun`, `holidayOffset` are all optional, with no stated combinations. Nothing carries the adjustment action.
- **Requirements:** v2 13.3 / `RECORD.md` O-06: the user chooses `NEXT`, `PREV`, `SKIP` or `NONE` per calendar (Extended calendars only, O-38).
- **Impact:** The rule builder cannot be built; users cannot choose how holidays are handled.
- **Ask:**
  1. Which fields are required or forbidden for each `dateRuleType`? (The rule table is in API-020.)
  2. Where does the adjustment action go (new field and enum)?
  3. Valid values for `dayOfWeek` (`MONDAY`…?), `runDate` format, and `runDay` (why a string?).
  4. Standard vs Extended: flag, separate type, or implied by `dateRuleType`?
  5. `listCalendars` filters by `ruleType` but the field is `dateRuleType`: same thing?
  6. How is a plain weekday calendar (no rule) represented: `dayOfWeek` with no `dateRuleType`? Does `dayOfWeek` also apply to the rule types (which days count as working days)?
  7. Exact meaning of `holidayRun` ("consider holidays for the run"?) and `holidayOffset` (a one-off shift, or step until a non-holiday? what does 0 mean? what if the shift crosses a year boundary?).
- **UI assumption:** The rules form maps onto the spec's fields: `dateRuleType`, `runDay` / `runDate`, `dayOfWeek` (Business days), `holidayCalendar`, `holidayRun`, `holidayOffset` (sent only when `holidayRun` is true) (`calendarFormModel.ts`). Adjustment action is not sent. The `holidayRun` / `holidayOffset` reading in the mock (`ruleEngine.ts`): `holidayRun` = take holidays into account; on a calendar-day or fixed-date run that lands on a holiday, move by `holidayOffset` days until clear, `0` skips the run.

### API-010: No way to preview or generate dates from rules
- **Severity / status:** Blocker · Open · raised 2026-11-05
- **Spec:** `getCalendarDates` states rules and offsets are "metadata and do not transform the stored dates". `CalendarWriteRequest.dates` is required. There is no preview or generate operation.
- **Impact:** The rule-based Create screen shows a live grid. With this spec the client would have to generate dates itself, duplicating the rule engine, or the backend must provide it. Also, `RECORD.md` O-32 had preview working without an account; the spec requires a token on every operation, so the Create page now requires sign-in. Confirm that is intended.
- **Proposed contract (not in the spec):** `POST /v1/calendars/preview`, stateless, writes nothing, readable by every authenticated role. Request: the calendar write fields plus `year` (`dateRuleType`, `runDay` / `runDate`, `dayOfWeek`, `holidayCalendar`, `holidayRun`, `holidayOffset`). Response: `{ "year": 2027, "dates": ["2027-01-15", …], "holidays": [{ "date": "2027-01-01", "name": "New Year's Day" }, …] }`. The UI then creates the calendar with `POST /v1/calendars`, sending those `dates` plus the same rule fields.
- **Ask:** Who produces `dates` from a rule: the client, or the backend? If the backend, confirm or replace this endpoint; alternatively make `dates` optional on create when rules are supplied (then a preview is still needed for the grid).
- **UI assumption:** The proposed endpoint above, mocked with our reading of the rules (`apps/web/src/lib/api/mocks/ruleEngine.ts`). The old `/api/ui/preview` calls are gone.

### API-014: Business Unit and Application are missing
- **Severity / status:** Medium · Open · raised 2026-11-04
- **Requirements:** v2 13.4 (BU calendar list: BU name / calendar / application); `RECORD.md` S-12 (no BU or Application model exists).
- **Spec:** `Calendar` has no BU or Application fields; `listCalendars` has no such filters.
- **Ask:** Add BU/Application identifiers to `Calendar` and filters to `listCalendars`, and define the relationship (1:1, 1:many, many:many).
- **UI assumption:** Not built.

### API-015: Pagination `offset` is really a page number
- **Severity / status:** Low · Open · raised 2026-11-04
- **Spec:** Query `offset` is described as "The page number to return", default `1`, while the responses use `page`/`pageSize`. The name suggests a row offset.
- **Ask:** Confirm it is a 1-based page number, or rename it to `page`.
- **UI assumption:** 1-based page number.

### API-016: List and upload responses embed all dates
- **Severity / status:** Low · Open · raised 2026-11-04
- **Spec:** `Calendar` includes `dates`, so `listCalendars` (up to 100 per page) and `upload` return every date of every calendar.
- **Ask:** Omit `dates` from list items (use `GET /calendars/{name}/dates`), or confirm the size is acceptable. For upload, confirm returning all dates is intended.
- **UI assumption:** The Calendars page lists every calendar with `GET /v1/calendars` (all pages) and shows each card's date count from the embedded `dates`. The detail view reads dates separately with `GET /v1/calendars/{name}/dates`. A calendar with business days carries about 500 dates, so the list payload for a real account will be large.

---

## Authorization

### API-011: Approval workflow is absent
- **Severity / status:** Blocker · Open · raised 2026-11-04
- **Requirements:** `RECORD.md` D-10: four-eyes gate behind `approval_required`, with a `calendar_change_request` table.
- **Spec:** Role `APPROVER` exists, but there is no approval queue, detail, approve or reject operation. Mutations return 201/200, with no 202 "pending" outcome. (The previous backend returned 202 plus a change request.)
- **Ask:** Provide the endpoints and contracts: list pending, change detail/diff, approve, reject (with reason). Say how create, update, upload and delete signal "pending approval", and how the UI learns whether the gate is on.
- **UI assumption:** Not built. Saves are treated as applied immediately.

### API-012: Role permissions are undefined for APPROVER and UPLOADER
- **Severity / status:** High · Open · raised 2026-11-04
- **Spec:** `UserRole` documents only ADMIN, EDITOR, VIEWER. `UserRole` is an array, so a user can hold several roles, with no rule for combining them. Calendar create/update/upload say "EDITOR or ADMIN", so it is unclear whether UPLOADER may upload.
- **Requirements:** `RECORD.md` lists different roles (Viewer, Admin, Create, Approver).
- **Ask:** State the exact permissions of APPROVER and UPLOADER. Are multiple roles a union? Can one person both edit and approve the same change?
- **UI assumption:** `has(role)` passes for the exact role or ADMIN. Upload and create need EDITOR or ADMIN. UPLOADER and APPROVER get read-only screens.

### API-013: Who may delete a calendar contradicts itself
- **Severity / status:** Medium · Open · raised 2026-11-05
- **Spec:** `info.description` says "Deletion requires ADMIN or EDITOR". `deleteCalendar` says "Requires ADMIN".
- **Ask:** Which is correct?
- **UI assumption:** Delete UI not built.

---

## Spec hygiene

### API-018: Spec typos and inconsistencies
- **Severity / status:** Low · Open · raised 2026-11-05
- `POST /calendars` 201 `Location` example is `/v1/calendar/calendars/business-calendar` (path is `/v1/calendars/{name}`).
- `getCalendar` has an empty `parameters:` key (null).
- `getUsers` 200 description reads "User created successfully"; it also lists a 409 response, which does not apply to a read.
- `getUsers` filter `status` is a free string ("active/inactvie"), and `id` is `string` while `UserId` is a `uuid`.
- `info.description` and several descriptions repeat "******" in place of the header example.
- `UserRole` description omits APPROVER and UPLOADER (see API-012).
- `CalendarDate`: `format: date` and a pattern together with a `DD-MM-YYYY` description (see API-004).

### API-019: Deployment origin and CORS
- **Severity / status:** Low · Open · raised 2026-11-05
- **Spec:** `servers: - url: /v1` (relative), so the UI is assumed to be served from the same origin as the API.
- **Ask:** Is the API served from the same origin as the UI, or on a separate host? If separate, CORS (including the `Authorization` header) and the base URL configuration are needed.
- **UI assumption:** Relative `/v1`. In dev a proxy is needed if the API is on another origin.

### API-020: Extended-rule catalog endpoint is missing, and the rule table is ambiguous
- **Severity / status:** Blocker · Open · raised 2026-11-05
- **Source:** The rule table shared on 2026-11-05 (rule type / frequency / Nth date), which the UI must show as a defined list from the backend:

  | Rule type | Frequency | Nth date |
  |-----------|-----------|----------|
  | `WORKING_DAY` | MONTHLY | `DAY=10` |
  | `QUARTER_START_WORKING_DAY` | Quarter | `DAY=10` |
  | `CALENDAR_DAY` | MONTHLY | `DAY=8` |
  | `FIXED_DATE_Yearly` | YEARLY | `MONTH=MAR; DAY=1` |
  | `QUARTER_END_WORKING_DAY` | Quarter | `Day 30` |

- **Spec:** `DateRuleType` is a fixed enum of the same five names. There is no endpoint for the list, and no frequency or parameter definitions.
- **Proposed contract (not in the spec):** `GET /v1/rules` returns `[{ "ruleType": "WORKING_DAY", "frequency": "MONTHLY", "description": "…", "parameters": [{ "name": "DAY", "label": "Working day of month", "type": "INTEGER", "min": 1, "max": 23, "default": 10 }] }, …]`. A parameter of `type` `ENUM` carries `options` (e.g. `FIXED_DATE_YEARLY` has `MONTH: JAN…DEC` and `DAY`). The UI renders the inputs from this list. Readable by every authenticated role.
- **Ask:**
  1. Confirm the endpoint and shape, or give the real contract.
  2. The table is inconsistent: `FIXED_DATE_Yearly` vs the enum `FIXED_DATE_YEARLY`; frequencies `MONTHLY` / `Quarter` / `YEARLY`; Nth-date notation `DAY=10`, `Day 30` and `MONTH=MAR; DAY=1`. Give the canonical values.
  3. Meaning of the quarter rules. UI assumption: `QUARTER_START_WORKING_DAY DAY=10` is the 10th working day counted from the first day of the quarter; `QUARTER_END_WORKING_DAY DAY=30` is the 30th working day counted back from the last day of the quarter (confirmed with the product owner as a working interpretation, not by the backend).
  4. How do the parameters map to the calendar fields? UI assumption: `DAY` → `runDay` (string), `MONTH` + `DAY` → `runDate`, written as `DD-MM` (for example `01-03`). The spec only gives example `'01-01'`, so `MM-DD` is possible too.
  5. Valid ranges, and behaviour when a month has no such day (the 31st; the 23rd working day). The mock clamps calendar days to the month end and skips a missing Nth working day.
- **UI assumption:** The rules form is driven by the proposed catalog (`CalendarForm.tsx`), mocked in `apps/web/src/lib/api/mocks/ruleEngine.ts`.

### API-021: How many years of dates a calendar holds, and who extends them
- **Severity / status:** Medium · Open · raised 2026-11-05
- **Spec:** `dates` is a flat list with no horizon. Rules are "metadata" that do not generate dates (`getCalendarDates`), so nothing says who adds next year's dates.
- **Requirements:** `RECORD.md` warns that a calendar with no future dates silently stops scheduling.
- **Impact:** A calendar created from a rule holds only the year the user previews. A run shifted across a year boundary (for example Jan 1 moved back one day) is dropped.
- **Ask:** Is a calendar expected to cover several years at creation? Who extends it as time passes (a scheduled job on the backend, or the user re-saving)? Should preview and create accept a year range?
- **UI assumption:** Rules flow: one year, chosen by the user (2000–2100), is generated and saved; the screen says so. Upload flow (review decision 2026-11-05): a "Calendar year" dropdown offers the current year and the next. The file may span years (for example 1 Apr 2026 to 1 Mar 2027), but only dates in the selected year are shown and saved. The UI filters them and uploads a new CSV containing just those dates.

### API-023: Upload replaces all dates, so a calendar cannot be built up one year at a time
- **Severity / status:** High · Open · raised 2026-11-05
- **Spec:** `uploadCalendarDates` "atomically replaces the stored dates". There is no append or per-year upload, and `updateCalendar` also replaces everything.
- **Impact:** With year-scoped uploads (API-021), uploading 2027 dates to a calendar that already holds 2026 dates deletes the 2026 dates. A calendar covering two years needs one file with both years, but the UI saves a single selected year.
- **Ask:** Confirm replace-all is intended. If calendars should hold several years, add an append / merge mode (or a `year` parameter that replaces only that year).
- **Question to confirm with the team:** when a user uploads dates for one year to a calendar that already has dates, should the upload replace only that year's dates and keep the other years, or replace the whole calendar? We assumed the former for now (decided in review 2026-11-05), but the backend team has not confirmed it, and the spec's replace-all behaviour says otherwise.
- **UI assumption:** For "Upload dates" (existing or migrated calendar) the UI works around replace-all on the client. At save time it reads the calendar's current dates with `GET /v1/calendars/{name}/dates`, drops the selected year's dates, adds the file's dates for that year, and uploads the combined set as a CSV. The screen says so: "Uploading replaces its N dates in 2026. Its M dates in other years are kept." This read-modify-write is not atomic: two people uploading at once can overwrite each other, which is the reason to ask the backend for a per-year or append mode. A new calendar just uploads the selected year.

### API-022: Calendar has no description (and no way to rename)
- **Severity / status:** Low · Open · raised 2026-11-05
- **Spec:** `Calendar` and `CalendarWriteRequest` have no description field. The previous backend and the previous Create screen had one.
- **Ask:** Is a description wanted? If so, add it as an optional field. Renaming is explicitly unsupported by `updateCalendar`; confirm that is intended.
- **UI assumption:** The description input was removed from the Create form.

### API-024: No way to list calendars created by upload, and the `uploaded` flag is ambiguous
- **Severity / status:** Medium · Open · raised 2026-11-05
- **Spec:** `listCalendars` filters by `migrated` but not by `uploaded`. `Calendar.uploaded` is described as "uploaded via file or created from UI", with no rule for a calendar that is created in the UI and later has its dates replaced by an upload.
- **Impact:** The "Existing calendars" group of the Upload dates dropdown must list only calendars created by upload, not by rules. The UI has to fetch every non-migrated calendar, with all their dates (API-016), and filter on `uploaded` itself. If `uploaded` flips to `true` when a rule-based calendar gets an upload, rule-based calendars leak into the list.
- **Ask:** (1) Add an `uploaded` filter to `listCalendars`. (2) Define when `uploaded` becomes true, and whether it stays false for a calendar created by rules and later re-uploaded. (3) Consider a `createdVia` / `source` field (`RULES` or `UPLOAD`) instead of two booleans.
- **UI assumption:** "Existing calendar" = `migrated=false` and `uploaded === true`, filtered on the client (`listUploadedCalendars` in `client.ts`).

### API-025: No change history or "updated by" for a calendar
- **Severity / status:** Medium · Open · raised 2026-11-05
- **Spec:** `Calendar` has `createdBy`, `createdAt` and `updatedAt`, but no `updatedBy` and no history endpoint. The previous backend had `GET /calendars/{key}/history` (who changed what, and when), and the previous Calendars screen showed it as an "Audit history" table.
- **Requirements:** `RECORD.md` section 11 (four-eyes) relies on an audit trail of each change and who made it.
- **Ask:** Add `updatedBy` to `Calendar`, and a history endpoint (action, user, time, optionally the changed fields). Say whether approvals (API-011) appear in it.
- **UI assumption:** The audit-history table was dropped from the Calendars page. The detail shows "Created: user · date" and "Last updated: date" only.

---

## Change log

| Date | Change |
|------|--------|
| 2026-11-04 | Initial analysis of `CalendarManagementSpec.yml` (login, user, calendar endpoints against the UI needs). |
| 2026-11-05 | Re-verified every item against the spec text; corrected `runDay` (string, not integer) and removed an incorrect "calendar mutation endpoints missing" claim (`PATCH /update` and `DELETE` exist). Added API-005 to API-008, API-010, API-013, API-017 to API-019. Consolidated the earlier analysis document into this tracker. |
| 2026-11-05 | UI work for holiday-calendar list, extended-rule list (screenshot) and sample CSV. API-005, API-009, API-010 and API-008 updated with the proposed contracts and what the UI now assumes. Added API-020 (rule catalog and ambiguous rule table), API-021 (date horizon), API-022 (no description field). |
| 2026-11-05 | Review changes: no holiday calendar on Upload file (API-005: uploads send an empty string against a required field); year dropdown, current plus next, saving only that year's dates (API-021); "Migrated from Autosys" renamed "Upload dates" (API-006). Added API-023 (upload replaces all dates). |
| 2026-11-05 | Upload dates now has Existing calendar / Migrated calendar sub-options (API-006). Uploading to an existing or migrated calendar replaces only the selected year and keeps the others, merged on the client; written up as a question for the team (API-023). Added API-024 (no `uploaded` filter, ambiguous flag). |
| 2026-11-05 | Review change: the two sub-options under Upload dates were replaced by one combined "Calendar" dropdown with "Existing calendars" and "Migrated calendars" groups. No new spec issue; API-006 and API-024 reworded. |
| 2026-11-05 | Calendars page moved onto the new spec with demo data (API-016 updated). Added API-025 (no change history or `updatedBy`; the audit table was dropped). |
