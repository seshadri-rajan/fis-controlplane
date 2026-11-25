# Calendar management

- **Calendars** (`CalendarsPage`): browse every calendar, filter by type or status, and see its dates. ADMIN gets **Amend dates** and **Activate / Deactivate** for uploaded or migrated calendars. An inactive calendar stays in the list but can't be amended.
- **Create** (`CreateCalendarPage`): upload an Excel workbook as a **New calendar**, or **Upload dates** to an existing or migrated calendar.
- **Amend** (`AmendCalendarPage`, route `calendars/:name/amend`): the same editor as Create, pointed at one calendar. Click dates to include or exclude them, and optionally add dates from a file.

`UploadCalendarPanel` is the shared editor. Pass `amend={calendar}` to fix the calendar and make the file optional. Amend access is ADMIN-only. For an existing calendar, dates before today are locked (API-027) and saves go through `PATCH …/update` with its name, dates, and active status.

Uploads accept `.xlsx` workbooks with one worksheet, a single `Calendar date` column, and `YYYY-MM-DD` dates. Before saving, the UI calls `verifyDates` and displays each row's valid/error result from the backend; the upload endpoint repeats validation before writing. The UI provides a matching Excel template. Calendar details can be exported as `.xlsx`; exported dates use `YYYY-MM-DD`.

Calendar actions are recorded in the backend audit log. Audit details and history are not shown in the UI.

Spec gaps and assumptions are tracked in `req-details/api-spec/API_SPEC_ISSUES.md`. Approval (four-eyes, `RECORD.md` section 11) is not built (API-011).
