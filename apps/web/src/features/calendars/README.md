# Calendar management

- **Calendars** (`CalendarsPage`): browse every calendar, filter by type or status, and see its dates. EDITOR and ADMIN get **Amend dates**. ADMIN also gets **Activate / Deactivate**. An inactive calendar stays in the list but can't be amended or uploaded to.
- **Create** (`CreateCalendarPage`): upload a dates CSV as a **New calendar**, or **Upload dates** to an existing or migrated calendar.
- **Amend** (`AmendCalendarPage`, route `calendars/:name/amend`): the same editor as Create, pointed at one calendar. Click dates to include or exclude them, and optionally add dates from a file.

`UploadCalendarPanel` is the shared editor. Pass `amend={calendar}` to fix the calendar and make the file optional. For an existing calendar, dates before today are locked (API-027) and saves go through `PATCH …/update` with the calendar's other fields sent back unchanged (API-028).

Spec gaps and assumptions are tracked in `req-details/api-spec/API_SPEC_ISSUES.md`. Approval (four-eyes, `RECORD.md` section 11) is not built (API-011).
