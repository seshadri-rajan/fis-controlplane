# UI Screenshots

Captured 2026-10-12 against the running application with demo data: four calendars, a US holiday
calendar for 2027, and an administrator account.

Build state at capture: preview, login and calendar views are implemented. Editing and the
approval queue are not — they are blocked on **S-13** (what a four-eyes approval approves).

| # | Screen | Shows |
|---|---|---|
| 01 | [Sign in](01-login.png) | Local login. Single sign-on is out of scope this phase (D-01). |
| 02 | [Preview — business days](02-preview-business-days.png) | Mon–Fri 2027 with three holidays. **258 run days, 0 shifted.** |
| 03 | [Preview — shift again](03-preview-shift-again-identical.png) | Same calendar, opposite collision policy. **Still 258 / 0 — an identical calendar.** |
| 04 | [Preview — sparse calendar](04-preview-sparse-shifts.png) | Mondays only. **52 run days, 5 shifted** — amber cells are runs that moved, rose are the dates they moved off. |
| 05 | [Preview — extended rule](05-preview-extended-rule.png) | `LAST_BUSINESS_DAY`, 12 run days. |
| 06 | [Calendars list](06-calendars-list.png) | Stored calendars, signed in as ADMIN. |
| 07 | [Calendar detail — weekly](07-calendar-detail-weekly.png) | `Monday_Batch` with real holiday shifts across the year. |
| 08 | [Calendar detail — rule based](08-calendar-detail-rule-based.png) | `Month_End_Close`, last working day of each month. |
| 09 | [Audit history](09-audit-history.png) | Who changed what, and when. |
| 10 | [No dates warning](10-no-dates-warning.png) | A year with no materialised dates, naming the command that fixes it. |

## The two worth talking through

**02 against 03.** Same calendar, same holidays, opposite answers to the open question O-06 — and
the output is identical. On a Monday-to-Friday calendar there is no free weekday to move a run
onto, so a holiday always costs a run whatever the policy. The question for the client is
therefore narrower than it first appears: *is losing the run acceptable, or must these calendars
be allowed to run on a non-business day?*

**04** shows what shifting looks like when it can actually happen. A Mondays-only calendar has
room to move, so Memorial Day's run lands on 1 June and the grid shows it in amber. This is the
behaviour the requirement describes, and it only applies to sparse calendars.

## Reproducing

```powershell
$env:CALENDAR_DB_URL = "sqlite+aiosqlite:///./demo.db"
$env:CALENDAR_SESSION_COOKIE_SECURE = "false"

.\.venv\Scripts\python.exe -m calendar_service.jobs.bootstrap --admin-user demo.admin --admin-email demo@example.invalid --holiday-calendar US --region US
.\.venv\Scripts\python.exe -m calendar_service.jobs.load_holidays us-holidays-2027.csv --calendar US
.\.venv\Scripts\python.exe -m uvicorn calendar_service.main:app --port 8000
npm run dev --prefix apps/web
```

Then create calendars through `POST /api/ui/calendars` and materialise 2027.
