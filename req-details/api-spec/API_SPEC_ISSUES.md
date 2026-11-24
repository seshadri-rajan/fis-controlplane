# API spec issues tracker

Living list of problems, gaps and open questions in `CalendarManagementSpec.yml`, and in the run-history sample files under `req-details/dag-history/`, that block or affect the UI. Send open items to the backend team and update this file as answers arrive.

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
| [API-005](#api-005-holidaycalendar-is-required-but-has-no-source) | High | Open | `holidayCalendar` required, no list/default | Uploads send `""`; the holiday dropdown is unused since rule-based create was removed (2026-11-06) |
| [API-006](#api-006-no-way-to-list-or-create-autosys-migrated-calendars) | High | Open | Autosys migration flow undefined | `GET /calendars?migrated=true` |
| [API-007](#api-007-new-calendar-from-a-file-takes-two-non-atomic-calls) | Medium | Resolved | Create-from-file is two calls | One create-only multipart upload |
| [API-008](#api-008-upload-flow-has-requirement-gaps) | Medium | Open | Existing uploaded calendars are also upload targets | UI supports new, migrated, and already-uploaded calendars |
| [API-009](#api-009-rule-fields-are-underspecified-and-adjustment-action-is-missing) | Blocker | On hold | Rule composition + adjustment action | Unused: rule-based create was removed (2026-11-06) |
| [API-010](#api-010-no-way-to-preview-or-generate-dates-from-rules) | Blocker | On hold | No preview / date generation | Unused: rule-based create was removed (2026-11-06) |
| [API-011](#api-011-four-eyes-approval-scope-conflicts-across-sources) | Blocker | Open | Four-eyes approval scope conflicts across sources | No approval flow for upload/amend/activate/deactivate; other mutation scope unresolved |
| [API-012](#api-012-role-permissions-are-undefined-for-approver-and-uploader) | High | Open | APPROVER / UPLOADER permissions | UPLOADER and APPROVER are read-only |
| [API-013](#api-013-who-may-delete-a-calendar-contradicts-itself) | Medium | Open | Delete permission contradiction | Not built |
| [API-014](#api-014-business-unit-and-application-are-missing) | Medium | Open | No BU / Application | Not built |
| [API-015](#api-015-pagination-offset-is-really-a-page-number) | Low | Open | `offset` means page number | Treated as page number |
| [API-016](#api-016-list-and-upload-responses-embed-all-dates) | Low | Open | Payload size | None |
| [API-017](#api-017-no-first-login-forced-password-change-or-lockout-signal) | Medium | Open | Forced password change / lockout | Not handled |
| [API-018](#api-018-spec-typos-and-inconsistencies) | Low | Open | Typos and inconsistencies | None |
| [API-019](#api-019-deployment-origin-and-cors) | Low | Open | Same-origin or CORS? | Relative `/v1` |
| [API-020](#api-020-extended-rule-catalog-endpoint-is-missing-and-the-rule-table-is-ambiguous) | Blocker | On hold | No rule-catalog endpoint; rule table ambiguous | Unused: rule-based create was removed (2026-11-06) |
| [API-021](#api-021-how-many-years-of-dates-a-calendar-holds-and-who-extends-them) | Medium | Open | Date horizon / who extends | One year per calendar |
| [API-022](#api-022-calendar-has-no-description-and-no-way-to-rename) | Low | Open | No description field | Field removed from the form |
| [API-023](#api-023-upload-replaces-all-dates-so-a-calendar-cannot-be-built-up-one-year-at-a-time) | High | Open | Upload replaces all dates | UI merges other years client-side (to confirm with team) |
| [API-024](#api-024-no-way-to-list-calendars-created-by-upload-and-the-uploaded-flag-is-ambiguous) | Medium | Open | No `uploaded` filter; flag ambiguous | Filtered on the client |
| [API-025](#api-025-backend-audit-is-internal-no-ui-history-by-design) | Low | Resolved | No user-facing audit history | Actions logged server-side; no audit view |
| [API-026](#api-026-calendar-lifecycle-and-inactive-upload-enforcement) | High | Open | Inactive upload enforcement and lifecycle semantics | `status` + ADMIN-only lifecycle endpoints implemented; upload enforcement pending |
| [API-027](#api-027-dates-before-today-must-be-read-only-but-nothing-enforces-it) | High | Open | Past dates must be read-only | Locked in the UI; mock enforces; browser-local "today" |
| [API-028](#api-028-update-is-replace-all-and-its-contract-contradicts-itself) | Medium | Open | `update` is replace-all, `calendarName` contradiction | Read-modify-write with every field echoed |
| [API-029](#api-029-no-live-run-history-contract-and-sample-files-are-invalid-json) | High | Open | No live run-history contract; sample files aren't valid JSON | Local demo API serves generated fixture data |
| [API-030](#api-030-run-identity-and-live-feed-semantics-remain-undefined) | High | Open | No run id or live-feed identity semantics | Demo latest selection by source/type/DAG/task |
| [API-031](#api-031-run-states-confirm-the-airflow-list-is-what-the-feed-sends) | Low | Open | Confirm the Airflow state list is what the feed sends | Airflow names; unknown states shown as "Other" with the feed's text |
| [API-032](#api-032-nothing-tells-a-stale-dashboard-from-a-quiet-one) | Medium | Open | No freshness signal per business unit | "Updated" time + a non-authoritative note |
| [API-033](#api-033-calendar-yaml-contracts-have-drifted) | High | Open | Runtime and frontend calendar YAML contracts differ | Backend/root YAML vs frontend `req-details` YAML |
| [API-034](#api-034-execution-report-csv-contract-is-undefined) | High | Open | Execution-report CSV contract is undefined | Calendar Excel export exists; report fields/trigger unknown |

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
- **Severity / status:** Medium · Resolved · raised 2026-11-05
- **Spec:** `POST /calendars` takes JSON with required `dates`; `POST /calendars/{name}/upload` needs an existing calendar.
- **Impact:** Creating from a file needs create then upload. If the second call fails, an empty calendar is left behind. It is also unclear whether `dates: []` is valid on create.
- **Ask:** Confirm `dates: []` is accepted, or offer a single multipart create-from-file operation.
- **Resolution:** `POST /calendars/{name}/upload?createOnly=true` now validates and creates a new calendar in one request, returning 409 for a duplicate name. The UI uses this path for create-from-file; the mock handler follows the same behavior.

### API-008: Upload flow has requirement gaps
- **Severity / status:** Medium · Open · raised 2026-11-05; requirement confirmed in pasted text section 8.2.2
- **Requirement / decision:** The requirements document specifies `DD-MM-YYYY` for upload workbooks, while the later explicit rule requires `YYYY-MM-DD` for all Excel exports. To keep downloaded workbooks consistent, the upload template and its corresponding upload input now use `YYYY-MM-DD`.
- **Runtime behavior:** The UI calls `POST /calendars/upload/verify` before saving. The backend returns each row's original value, normalized date when valid, `valid` flag, and errors. The UI displays those results without parsing the workbook. The final upload endpoint repeats validation, accepts `.xlsx` only, and rejects past, malformed, duplicate, or out-of-horizon dates. Backend upload-created names use the same 70-character alphanumeric rule as calendar creation. The upload template and all-dates Excel export use `YYYY-MM-DD`.
- **YAML:** Both YAML copies document `verifyDates`, `YYYY-MM-DD` workbook uploads, and ISO-formatted all-dates export.
- **Remaining gap:** The UI also offers already-uploaded calendars as targets under “Upload dates,” beyond the new and migrated options named by the requirement.
- **Next step:** Confirm whether already-uploaded calendars should remain a separate upload target or be managed only through Amend.

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
- **UI assumption:** The rules form maps onto the spec's fields: `dateRuleType`, `runDay` / `runDate`, `dayOfWeek` (Business days), `holidayCalendar`, `holidayRun`, `holidayOffset` (sent only when `holidayRun` is true) (`calendarFormModel.ts`). Adjustment action is not sent. The `holidayRun` / `holidayOffset` reading below was encoded in the mock rule engine, which was deleted on 2026-11-12 (nothing uses it now): `holidayRun` = take holidays into account; on a calendar-day or fixed-date run that lands on a holiday, move by `holidayOffset` days until clear, `0` skips the run.

### API-010: No way to preview or generate dates from rules
- **Severity / status:** Blocker · Open · raised 2026-11-05
- **Spec:** `getCalendarDates` states rules and offsets are "metadata and do not transform the stored dates". `CalendarWriteRequest.dates` is required. There is no preview or generate operation.
- **Impact:** The rule-based Create screen shows a live grid. With this spec the client would have to generate dates itself, duplicating the rule engine, or the backend must provide it. Also, `RECORD.md` O-32 had preview working without an account; the spec requires a token on every operation, so the Create page now requires sign-in. Confirm that is intended.
- **Proposed contract (not in the spec):** `POST /v1/calendars/preview`, stateless, writes nothing, readable by every authenticated role. Request: the calendar write fields plus `year` (`dateRuleType`, `runDay` / `runDate`, `dayOfWeek`, `holidayCalendar`, `holidayRun`, `holidayOffset`). Response: `{ "year": 2027, "dates": ["2027-01-15", …], "holidays": [{ "date": "2027-01-01", "name": "New Year's Day" }, …] }`. The UI then creates the calendar with `POST /v1/calendars`, sending those `dates` plus the same rule fields.
- **Ask:** Who produces `dates` from a rule: the client, or the backend? If the backend, confirm or replace this endpoint; alternatively make `dates` optional on create when rules are supplied (then a preview is still needed for the grid).
- **UI assumption:** The proposed endpoint above. Its mock (`ruleEngine.ts`) was deleted on 2026-11-12 along with the rule-based flow; the item stays on hold in case rules return. The old `/api/ui/preview` calls are gone.

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

### API-011: Four-eyes approval scope conflicts across sources
- **Severity / status:** Blocker · Open · raised 2026-11-04
- **Requirements:** Pasted requirement sections 8.2.2–8.2.4 require upload, amend, activate, and deactivate. Section 8.5 says the **four-eyes operation for those actions** is out of scope. This excludes approval, not the underlying calendar actions.
- **Conflicting internal decision:** `RECORD.md` D-10 says a four-eyes gate should exist behind `approval_required` for every mutation path.
- **Spec:** There is no approval queue, detail/diff, approve, or reject operation. Mutations are applied directly.
- **Ask:** Confirm whether four-eyes applies to calendar create/delete or other entities. Do not treat approval for upload/amend/activate/deactivate as required by the pasted requirement.
- **UI assumption:** Those four actions are direct operations with no approval UI; their audit logging remains required by section 8.2.2. Scope for any other approval workflow remains unresolved.

### API-012: Role permissions are undefined for APPROVER and UPLOADER
- **Severity / status:** High · Open · raised 2026-11-04
- **Spec:** `UserRole` documents only ADMIN, EDITOR, VIEWER. `UserRole` is an array, so a user can hold several roles, with no rule for combining them. Calendar create/update/upload say "EDITOR or ADMIN", so it is unclear whether UPLOADER may upload.
- **Requirements:** `RECORD.md` lists different roles (Viewer, Admin, Create, Approver).
- **Ask:** State the exact permissions of APPROVER and UPLOADER. Are multiple roles a union? Can one person both edit and approve the same change?
- **UI assumption:** `has(role)` passes for the exact role or ADMIN. Upload and create need EDITOR or ADMIN. Amendment, activation, and deactivation of uploaded/migrated calendars need ADMIN. UPLOADER and APPROVER get read-only screens.

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
- **UI assumption:** None now: the rule form and its mock catalog (`ruleEngine.ts`) were deleted on 2026-11-12. The item stays on hold in case rules return.

### API-021: How many years of dates a calendar holds, and who extends them
- **Severity / status:** Medium · Open · raised 2026-11-05
- **Spec:** `dates` is a flat list with no horizon. Rules are "metadata" that do not generate dates (`getCalendarDates`), so nothing says who adds next year's dates.
- **Requirements:** `RECORD.md` warns that a calendar with no future dates silently stops scheduling.
- **Impact:** A calendar created from a rule holds only the year the user previews. A run shifted across a year boundary (for example Jan 1 moved back one day) is dropped.
- **Ask:** Is a calendar expected to cover several years at creation? Who extends it as time passes (a scheduled job on the backend, or the user re-saving)? Should preview and create accept a year range?
- **UI assumption:** Rules flow: one year, chosen by the user (2000–2100), is generated and saved; the screen says so. Upload flow (review decision 2026-11-05): a "Calendar year" dropdown offers the current year and the next. The file may span years (for example 1 Apr 2026 to 1 Mar 2027), but only dates in the selected year are shown and saved. The UI filters them and uploads a new CSV containing just those dates.
- **Upload enforcement:** The UI and backend now both restrict new uploads to the current or next calendar year and require every API upload date to match its metadata year. The broader question of how calendars are extended beyond that window remains open.

### API-023: Upload replaces all dates, so a calendar cannot be built up one year at a time
- **Severity / status:** High · Open · raised 2026-11-05
- **Spec:** `uploadCalendarDates` "atomically replaces the stored dates". There is no append or per-year upload, and `updateCalendar` also replaces everything.
- **Impact:** With year-scoped uploads (API-021), uploading 2027 dates to a calendar that already holds 2026 dates deletes the 2026 dates. A calendar covering two years needs one file with both years, but the UI saves a single selected year.
- **Ask:** Confirm replace-all is intended. If calendars should hold several years, add an append / merge mode (or a `year` parameter that replaces only that year).
- **Question to confirm with the team:** when a user uploads dates for one year to a calendar that already has dates, should the upload replace only that year's dates and keep the other years, or replace the whole calendar? We assumed the former for now (decided in review 2026-11-05), but the backend team has not confirmed it, and the spec's replace-all behaviour says otherwise.
- **UI assumption:** For "Upload dates" (existing or migrated calendar) and Amend, the UI works around replace-all on the client. Since 2026-11-11 it does this through `update` (API-028) instead of a CSV upload: it reads the calendar fresh, keeps the past and the other years, replaces the selected year's editable dates with the user's selection, and sends the whole calendar back. This read-modify-write is not atomic: two people saving at once can overwrite each other, which is the reason to ask the backend for a per-year or append mode. A new calendar just uploads the selected year.

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

### API-025: Backend audit is internal; no UI history by design
- **Severity / status:** Low · Resolved · raised 2026-11-05; clarified 2026-11-24
- **Requirement:** Pasted requirement section 8.2.2 says calendar actions are logged in the backend for audit purposes and are not visible in the UI.
- **Backend:** The audit log records the calendar resource, action, actor, and time for create, upload, amendment, activation, and deactivation. Tests verify the upload, amendment, and lifecycle action records.
- **Spec:** The API documents backend audit logging and exposes no audit-history operation. `updatedBy` and a user-facing history endpoint are not required.
- **UI:** No audit history or audit details are displayed. This is intentional and matches the requirement.

### API-026: Calendar lifecycle and inactive upload enforcement
- **Severity / status:** High · Open · raised 2026-11-11
- **Requirement (product, 2026-11-11):** An admin can deactivate a calendar and activate it again. An inactive calendar still appears in the Calendars list, but its dates cannot be amended or uploaded to until it is activated.
- **Spec / implementation:** `Calendar.status` and ADMIN-only `activate`/`deactivate` endpoints are now documented and implemented. Amendment and lifecycle operations reject calendars that are neither uploaded nor migrated. The upload endpoint's inactive-calendar enforcement is unchanged and remains unimplemented.
- **Implemented behavior:** Status changes are audited as `ACTIVATE` or `DEACTIVATE`; amendments require ADMIN and are audited as `UPDATE`. The UI displays inactive status and hides lifecycle actions from non-admins.
- **Ask:**
  1. What does inactive mean for scheduling: do DAGs that reference the calendar fail, skip, or keep running on the stored dates? (`RECORD.md` warns a calendar with no future dates silently stops scheduling; an inactive one must not be a silent surprise.)
  2. Should upload to an inactive calendar be rejected, and should the requirement be enforced server-side?
  3. **Resolved:** Section 8.5 excludes four-eyes approval for upload/amend/activate/deactivate. Status changes are backend-audited; audit history is not shown in the UI (API-025).
  4. Can an inactive calendar be deleted?
- **UI assumption:** Calendars list: an "Inactive" badge and filter chip, Amend disabled, and Activate/Deactivate (ADMIN only, with a confirmation) in the detail. Upload dates leaves inactive calendars out of its dropdown and says how many were left out. Mocked in `apps/web/src/lib/api/mocks/handlers.ts`.

### API-027: Dates before today must be read-only, but nothing enforces it
- **Severity / status:** High · Open · raised 2026-11-11
- **Requirement (product, 2026-11-11):** Past dates cannot be edited.
- **Spec:** Silent. `update` and `upload` replace every date, so any client can add or remove history.
- **Ask:**
  1. Enforce it on the server: reject an update or upload that adds or removes a date before today (suggest 400 or 409 with a clear message), so the rule doesn't depend on this UI.
  2. Which timezone is "today"? The UI uses the browser's local date, which can disagree with the server near midnight or across regions.
  3. Is today itself editable? (The UI assumes yes: only dates strictly before today are locked.)
  4. Does the rule apply to new calendars? (The UI does not lock them: a new calendar can be created from a file with past dates.)
  5. How does a backend load or migrate historical dates if it can't write them?
- **UI assumption:** For an existing calendar (Amend, and Upload dates onto an existing or migrated calendar) dates before today are shown but not clickable, and past dates in an uploaded file are left out with a note. A new calendar has no lock. The mock rejects changes to past dates on `update` with 400.

### API-028: `update` is replace-all, and its contract contradicts itself
- **Severity / status:** Medium · Open · raised 2026-11-11
- **Spec:** `PATCH /calendars/{calendar_name}/update` "replaces all writable calendar fields" and its description says "the request body's calendarName must match the path calendar_name". But `CalendarWriteRequest` has no `calendarName` and sets `additionalProperties: false`, so sending it should fail validation and omitting it breaks the description. `PATCH` normally means a partial update, yet this one replaces everything.
- **Impact:**
  - Changing only the dates means sending the calendar's other fields back unchanged. Omitting one clears it (`dateRuleType`, `dayOfWeek`, `runDate`, `runDay`, `holidayRun`, `holidayOffset`).
  - `holidayCalendar` is required, and calendars made by upload hold an empty one (API-005), so the call can fail for them.
  - There is no version or ETag, so two people amending the same calendar overwrite each other without a warning (see API-023).
  - It is unclear whether `uploaded` or `migrated` change after an update.
- **Ask:** Make `calendarName` consistent (allowed and checked, or dropped from the description). Allow `holidayCalendar` to be empty or omitted. Add optimistic concurrency (`If-Match` with an ETag, or a `version` field, answering 412 or 409). Say what an update does to `uploaded`.
- **UI assumption:** Amend and Upload dates onto an existing calendar read the calendar fresh, rebuild its dates (keeping the past and the other years), and send `calendarName`, the dates, and the unchanged active status through `update` (`toWriteRequest` in `client.ts`). New calendar creation uses create plus upload. The browser translates dates between its ISO display form and the API's `DD-MM-YYYY` wire format.

---

## Run history (home dashboard)

The home page shows the latest run of every DAG and task. The supplied `run_history.json` is invalid JSON and is not used by the app. A local demo API now generates run-history rows; a production feed and `dag_info.json` API remain undefined.

### API-029: No live run-history contract, and sample files are invalid JSON
- **Severity / status:** High · Open · raised 2026-11-11
- **Source:** `run_history.json` and `dag_info.json`, plus the annotated screenshot (`source` = business unit, `type` = DAG or Task, `dag_id` mandatory, `task_id` = task name).
- **Spec:** `CalendarManagementSpec.yml` is calendar-only. There is still no production run-history endpoint or live data source.
- **Sample files:** both are invalid JSON, so nothing can parse them as delivered.
  - A comma is missing after every `"source": "FFIO"` / `"AM"` line.
  - In `dag_info.json`, `"upstream": [ "source": "AM" "dag_id": null, … ]` puts object members directly inside an array, with no braces.
  - `source` appears at several levels of `dag_info.json` (DAG, task, downstream, upstream) with no stated meaning at each.
- **Local demo API (not a production contract):** `GET /v1/run-history` returns the latest generated demo row per source/type/DAG/task. `GET /v1/run-history/demo` returns all generated demo rows. Both return `source`, `type`, `state`, `dag_id`, `task_id`, `start_date`, `end_date`, `elapsed_time`, and `business_date`; no live ingestion, persistence, or authentication is implemented.
- **Ask:**
  1. Define the production data source, endpoint/OpenAPI contract, and authentication; fix the sample files.
  2. Define any required filters or pagination for the live feed.
  3. Is `dag_info.json` served by the same API? Its `slo`, `category`, `severity`, `critical_path`, `support_group` and `application_id` are all null in the sample.
- **UI assumption:** Mock mode uses generated mock rows. Local Backend mode gets generated demo rows from the single `calendar_service.main:app` backend on port 8000, which also serves calendar APIs; the page still derives its dashboard view from the response. `dag_info.json` is not used yet.

### API-030: Run identity and live-feed semantics remain undefined
- **Severity / status:** High · Open · raised 2026-11-11
- **Requirement (product, 2026-11-11):** a DAG can run several times a day and only the latest run is shown; a task name can belong to several DAGs.
- **Sample data:**
  - `run_history.json` rows have no `run_id` (`dag_info.json` has one under `dag_run`), so a task row can't be tied to a DAG run.
  - Every row is repeated exactly: 6 rows are 3 runs.
  - `business_date` is `"260817"` (YYMMDD) here and `"2026-10-02"` in `dag_info.json`.
  - Timestamps carry `-04:00` and 5 or 6 fractional digits; `elapsed_time` is an `HH:MM:SS.ffffff` string.
  - Queued and scheduled runs presumably have no `start_date`, but the sample has none to show.
- **Ask:**
  1. Add `run_id` (and the try number) to every row, and say what identifies a run.
  2. Why are rows repeated? If it is the same event delivered twice (`RECORD.md` O-13), de-duplicate on the server.
  3. Define "latest": the greatest `start_date` per DAG? per business date? What is the latest of a DAG that has a queued run with no start?
  4. Put the DAG run's `run_id` on every task row, so the tasks of the latest run can be shown.
  5. Use one `business_date` format (suggest `YYYY-MM-DD`) and state the timezone (`RECORD.md` O-15 says it is undefined).
  6. What does a running row look like: `end_date` null? `elapsed_time` null, or a snapshot?
  7. DAG names are not unique across business units (O-15), and task names are not unique across DAGs (`start` and `end` are everywhere). Confirm the key is business unit + DAG (+ task).
- **UI assumptions:**
  - A DAG is its business unit + `dag_id`; a task is that + `task_id`.
  - Rows identical in every field are collapsed.
  - Latest = the greatest `start_date`. A run with no start counts as the newest (it is what the DAG is doing now), and the finished run before it is shown as "Previous run". For the same start, the row with an end wins.
  - The local demo API applies the latest-row grouping by source, type, DAG, and task (task rows include `task_id`); this behavior does not define the eventual live-feed identity contract.
  - A DAG's tasks are the latest row of each task name in that DAG. A failing task counts toward "Needs attention" only if it started at or after the DAG's latest run, so an old failure from a fixed run doesn't raise an alarm.
  - A running run's duration is worked out from the clock, not from `elapsed_time`.
  - Times show in the viewer's local time. `business_date` is read as `YYMMDD`, `YYYYMMDD` or `YYYY-MM-DD`.
  - A DAG that only has task rows is not listed as a DAG; its tasks still appear in the Task finder. Rows with no `dag_id` are ignored and counted in the page footer.

### API-031: Run states: confirm the Airflow list is what the feed sends
- **Severity / status:** Low · Open · raised 2026-11-11, list received 2026-11-12
- **Source:** the annotated screenshot listed `success, failed, running, retry, hold, scheduled, queued` and said the full list would follow. The list that followed is Airflow's: DAG run states `queued, running, success, failed`; task states `scheduled, queued, running, success, failed, up_for_retry, up_for_reschedule, upstream_failed, skipped, deferred, restarting, removed, none`.
- **Issue:** The screenshot and the new list disagree: `retry` vs `up_for_retry`, and `hold` and a DAG-level `scheduled` appear only in the screenshot. Nothing says how `none` is sent (the string `"none"`, or a null `state`?), what casing is used, or what a DAG run in a state outside the four looks like.
- **Ask:** Confirm the feed sends exactly these Airflow names (lowercase, snake_case) and drop `hold`. Is `none` sent as a string or as a null? Should `removed` tasks be in the feed at all? Which states need attention in the business's eyes, especially `upstream_failed`?
- **UI assumption:** Names match case-insensitively and `retry` is read as `up_for_retry`. Anything else (including `hold`) shows as "Other" in the feed's own words, so nothing is hidden. Needs attention = failed, up_for_retry. `upstream_failed` is a knock-on of a failed task, so it is shown but not raised on its own. Finished = success, failed, skipped, upstream_failed, removed; up_for_retry, up_for_reschedule, deferred and restarting are not. The status tiles always show the four DAG states; task-only states get a tile only when present. A new state only needs a colour and a label in `StatusBadge.tsx` and a place in `ALL_STATES` in `runModel.ts`.

### API-032: Nothing tells a stale dashboard from a quiet one
- **Severity / status:** Medium · Open · raised 2026-11-11
- **Requirement:** `RECORD.md` O-13 and section 13.6: the listeners are fire-and-forget with no retry, so a dropped event is lost and undetectable, and the dashboard must not be treated as authoritative.
- **Issue:** The feed has no "last event received" time per business unit, so the page can't tell a business unit that has nothing to report from one whose listener has stopped. A run reported as running for hours may have finished while its end event was dropped.
- **Ask:** A heartbeat or last-event time per business unit, and ideally the age of each row's last update. Is a "running for longer than expected" signal available (typical duration or SLO)?
- **UI assumption:** The page shows when it last refreshed (every 30 seconds) and a note that it is a guide, not the source of truth. It can't flag stale business units or runs that look stuck.

### API-033: Calendar YAML contracts have drifted
- **Severity / status:** High · Open · raised 2026-11-24
- **Spec sources:** The backend README points to the repository-root `CalendarManagementSpec.yml`. The web `generate:spec` script and mock documentation use `req-details/api-spec/CalendarManagementSpec.yml`.
- **Differences:** The root contract documents admin-only amendments and lifecycle endpoints, selected-year replacement, and creates a missing calendar on upload. The `req-details` copy still lacks lifecycle/status coverage and differs in other calendar operation details. The upload and Excel-export date formats now match in both copies.
- **Impact:** Generated frontend types and mocks are based on a different contract from the running backend, which can still produce incompatible behavior.
- **Ask:** Choose one canonical YAML, sync/remove the duplicate, and generate frontend types and mocks from the same contract.
- **UI assumption:** The API client converts backend JSON dates for the UI; workbook upload values and Excel exports use `YYYY-MM-DD`.

### API-034: Execution-report CSV contract is undefined
- **Severity / status:** High · Open · raised 2026-11-24
- **Requirements / decision:** Section 8.2.2 specifies `DD-MM-YYYY` for upload workbooks, but the later explicit rule requires `YYYY-MM-DD` for all Excel exports. The implementation uses `YYYY-MM-DD` for the template, upload validation, and all-dates export; the source requirement's upload-format statement remains contradictory.
- **Frontend:** The UI generates the downloadable `.xlsx` upload template in `YYYY-MM-DD` and offers an all-dates calendar export.
- **Backend / YAML:** Upload verification and saving require `YYYY-MM-DD`; `GET /calendars/{calendar_name}/export` returns `YYYY-MM-DD`. Both YAML copies document the upload and export formats.
- **Remaining gap:** Section 8.4’s CSV execution report is still absent. Its report columns and delivery trigger are not defined in the available contract.
- **Next step:** Define the execution-report fields and delivery trigger, then implement the required CSV report; keep its CSV format distinct from the ISO-formatted Excel workbooks.

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
| 2026-11-11 | Amend and activate/deactivate. Added API-026 (no calendar status; activate/deactivate proposed, ADMIN only), API-027 (past dates must be read-only; no server rule), API-028 (`update` is replace-all and its `calendarName` text contradicts the schema). API-011, API-012, API-023 and API-025 updated. API-005, API-009, API-010 and API-020 put on hold: rule-based create was removed on 2026-11-06, so the UI no longer uses the holiday-calendar list, rule catalog or preview. |
| 2026-11-11 | Home dashboard (latest DAG and task runs). Added a "Run history" section: API-029 (no API; both sample files are invalid JSON), API-030 (no run id, repeated rows, "latest" undefined), API-031 (state list not final), API-032 (no freshness signal). The intro now covers `req-details/dag-history/`. |
| 2026-11-12 | Run states: the Airflow list arrived. API-031 rewritten from "list not final" to "confirm the feed sends these names". The dashboard now uses Airflow's states (`hold` dropped, `retry` read as `up_for_retry`). |
| 2026-11-12 | Removed the last rule-based leftovers from the UI: the "Rule-based" filter and badge on the Calendars list, the rule engine and the `holiday-calendars`, `rules` and `preview` mocks, and the matching client functions and types. Demo calendars are now uploaded or migrated. API-005, API-009, API-010 and API-020 stay on hold. |
| 2026-11-24 | Version 2 sections 8.2.2–8.2.4 keep upload, amend, activate, and deactivate in scope; section 8.5 excludes four-eyes approval for those actions only. Corrected API-011 and the changelog scope note. Added API-033 for drift between the backend and frontend calendar YAML sources. |
| 2026-11-24 | Synchronized the audit requirement: calendar actions are logged backend-side, no audit-history API or UI view is provided. Updated both YAML descriptions and marked API-025 resolved. |
| 2026-11-24 | Rechecked calendar file transfer against Version 2: confirmed Excel upload is unsupported, the frontend/backend CSV date formats disagree, the backend does not restrict upload year to current/next, and the required Excel template/execution-report downloads are absent. Updated API-008/API-021 and added API-034. |
| 2026-11-24 | Added a read-only Control Plane demo run-history API: latest generated rows at `GET /v1/run-history`, full fixture at `/v1/run-history/demo`. No live ingestion, persistence, or authentication; API-029/API-030 remain open for the production contract. |
| 2026-11-24 | Consolidated the demo run-history routes into `calendar_service.main:app`. Calendar and run-history APIs now share port 8000 and one startup command; the separate Control Plane server and port-8001 proxy are no longer used. Demo-only scope and open production questions are unchanged. |
| 2026-11-24 | Replaced CSV upload with validated `.xlsx` workbooks, added row-level `verifyDates` preflight, the Excel template, and all-dates Excel export (`YYYY-MM-DD`); enforced past-date, upload-year, and name rules on the API and aligned both YAML copies. API-008 now tracks only the extra uploaded-calendar target; API-034 remains open for the undefined CSV execution-report flow. |
| 2026-11-24 | Standardized the upload template, upload validator, UI guidance, and both API spec copies on `YYYY-MM-DD` to follow the later all-Excel-exports rule; documented the remaining conflict with section 8.2.2's `DD-MM-YYYY` wording. |
