# Plan: date include/exclude toggle on the Upload-file preview

Status: **Phase 1 ("New calendar" mode) implemented, tested, and shipped (2026-11-06).**
**Phase 2 ("Upload dates" mode, Option B merge-by-default with provenance colours) implemented,
tested, and shipped (2026-11-06).**
**Phase 3 (removal of "Define by rules" creation): implemented and tested (2026-11-06).** See the
note at the end of this file.

> **Supersedes the previous version of this file** (toggle on the rule-based "Define by rules"
> preview). After a 2026-11-06 call with the product team, the toggle is now wanted on the
> **"Upload file" → "New calendar"** screen's date preview instead, with a broader requirement:
> the user must be able to select dates that are **not** in the uploaded CSV at all, not only
> deselect dates that are.
>
> The 5 open design questions from the very first version of this plan have now been answered
> directly by product, confirmed below (§ Design decisions). A follow-up browser investigation
> (same day) replayed the current, unmodified upload flow end to end and confirmed it works as
> described here — CSV in, year-filtered read-only preview, save, calendar created with exactly
> the file's dates — so this plan's "current behaviour" section is verified, not just inferred
> from source.
>
> **2026-11-06, later the same day:** product asked for the identical toggle inside **"Upload
> dates"** (the sub-mode that adds/replaces a year on an *existing* calendar) — previously called
> out as explicitly out of scope for Phase 1. See **§ Phase 2** at the end of this file for the
> investigation and plan for that extension; everything above describes Phase 1, which is done.

## Request

On `/create` → "Upload file" tab, when a CSV is chosen for a **new** calendar, the right-hand
preview currently renders the parsed file's dates on a read-only month grid for the selected year.
Make every day in that grid clickable: click an included day to drop it, click any other day
(including ones absent from the file) to add it. The calendar is created from this final,
user-adjusted set of dates, not the raw file contents.

## Codebase findings

### Current data flow (`UploadCalendarPanel.tsx`, "New calendar" mode)

```
<input type=file> ──► parseDatesCsv(text) ──► parsed: { dates: string[], errors: string[] }
                                                      │
yearDates = parsed.dates.filter(startsWith `${year}-`)   (useMemo, year-boundary filter only)
                                                      │
gridDates = yearDates.map(day => ({ day, reason: "Uploaded", shifted_from: null }))
                                                      │
                                                      ▼
                          <MonthGrid year dates={gridDates} holidays={new Map()} />  (read-only)

on "Create calendar":
  createSpecCalendar({ calendarName: name, dates: [], holidayCalendar: "" })   // empty shell
  uploadCalendarDates(name, csvFile(yearDates))                               // raw file dates
```

For "Upload dates" mode (adding to an existing/migrated calendar), the same `yearDates` is merged
with the target's other-year dates and re-uploaded as one CSV — the toggle applies identically
there; only the final array that gets merged changes, from `yearDates` to the adjusted selection.

### Relevant to this feature

- `MonthGrid.tsx` is shared with `CalendarsPage.tsx`'s **read-only** stored-calendar viewer and with
  the rule-based create preview. New props must be optional/opt-in so neither of those call sites
  changes behaviour.
- `MonthGrid`'s current cell logic (`indexDates`, `DayInfo`, `cellClass`, `titleFor`) is built
  around *server-reported* state (`scheduled`, `shiftedFrom`, `holidayName`, `vacated`) — concepts
  that don't apply here. This screen has no holidays (`holidays={new Map()}` already) and no
  shift metadata. Rather than force this screen's "included / not included, anything clickable"
  model through that machinery, `Month`/`MonthGrid` gets a **second, simpler rendering path**
  used only when a new `onToggleDate` prop is supplied: every day in the month becomes a button
  styled purely by membership in a `selected: Set<string>`, bypassing `indexDates` entirely. The
  existing read-only path (`CalendarsPage`, rule-based preview) is untouched.
- `yearDates` (file-derived, per-year) stays as the **initial seed** for the selection, and as the
  reference point for "from file" vs "added manually" bookkeeping — it does not disappear, it just
  stops being the thing that gets saved directly.
- The actual save calls (`uploadCalendarDates`, both modes) already take a plain `dates: string[]`
  (wrapped into a CSV blob by `csvFile()`) — swapping in the adjusted selection instead of
  `yearDates` is a local change, no API/mock/type changes needed.
- No test harness exists in `apps/web` — verification is manual (browser tool) plus `tsc -b` /
  `npm run lint`.

## Design decisions (confirmed by product, 2026-11-06)

The original plan posed 5 open questions; product has now answered all of them directly. Answers
below, reframed for the upload screen, with the scope correction they imply.

1. **All dates in the grid are toggleable, including dates already in the CSV.** Confirmed as
   drafted: clicking toggles membership for any day in the displayed year, file-sourced or not.
2. **The "does exclusion survive a live re-preview" nuance from the rule-based plan does not
   apply here.** Confirmed explicitly — there is no refetching preview query on this screen, only
   a one-shot CSV parse (`onFileChange`) and a year filter. The working selection simply re-seeds
   from `yearDates` whenever a new file is chosen or the year changes; no pruning/intersection
   logic is needed.
3. **Empty-selection guard**: if the user excludes every date and adds none, "Create calendar"
   stays disabled.
4. **New legend state "Excluded"**, a stats-row **Excluded** counter, and a **Reset exclusions**
   button. Note the terminology is deliberately the simple two-state model from the original plan
   (*Included* / *Excluded*), not a four-way Selected/Added/Removed/Year breakdown — see the data
   model below for how "a day not in the file, now added" is represented without a separate
   "Added" stat (not asked for; flagging so it's a visible decision, not a silent one).
5. **Scope is the Upload-file preview grid only** — and more precisely, only the **"New calendar"**
   sub-mode of that screen (the original ask was explicitly "when user is importing the .csv file
   as a new calendar"). The **"Upload dates"** sub-mode (adding/replacing a year on an existing or
   migrated calendar) keeps today's read-only grid and unmodified save path. This is a scope
   narrowing worth double-checking: if product later wants the same toggle there too, it's a small
   extension (the `MonthGrid` changes already support it), not a redesign.

### Data model: one set, two derived views

Rather than tracking "selected / added / removed" as three separate concerns, there is a single
piece of state:

```ts
const [included, setIncluded] = useState<Set<string>>(new Set());
// seeded/reset by: useEffect(() => setIncluded(new Set(yearDates)), [parsed, year])
```

Everything else is derived from it and from `yearDates` (the file's dates for the selected year,
unchanged from today):

- **Included** (green, clickable to exclude): `included.has(iso)` — true for file dates not yet
  excluded, *and* for any manually-added date.
- **Excluded** (muted/struck, clickable to re-include): `!included.has(iso) && yearDates.includes(iso)`
  — a file date the user turned off. This is what the **Excluded** stat counts and what **Reset
  exclusions** restores.
- **Untouched** (plain/blank, clickable to include): everything else — a day never in the file and
  not added. Not called out in the legend, same as today's non-run days.
- **Reset exclusions** sets `included` back to `new Set(yearDates)`, which also drops any
  manually-added dates — the simplest single-button "start over" behaviour, and the literal
  reverse of "exclude". Shown whenever `included` differs from the file's set.
- The final payload sent on save is `[...included].sort()`.

## Implementation steps

1. **`MonthGrid.tsx`**
   - Give `dates` and `holidays` default values (`[]` / `new Map()`) so a caller using only the new
     selectable mode doesn't have to pass dummy data.
   - Add optional props to `MonthGrid`/`Month`: `included?: Set<string>`, `onToggleDate?: (iso:
     string) => void`.
   - In `Month`, when `onToggleDate` is provided, render every day in the month as a `<button>`:
     - `included.has(iso)` → included style (emerald, same family as today's "Date in the file").
     - `!included.has(iso)` and the day is in the original file set (passed separately, see below)
       → excluded style (muted, struck-through).
     - otherwise → today's plain/blank style.
     This bypasses `cellClass`/`titleFor`/`indexDates` for this mode entirely. Without
     `onToggleDate`, rendering is pixel-identical to today — `CalendarsPage`'s read-only viewer and
     the rule-based preview (if it's ever revisited) are unaffected.
   - `Month`/`MonthGrid` need one more small optional prop, `fileDates?: Set<string>` (or reuse the
     existing `dates` prop for this purpose, converted to a Set once in `UploadCalendarPanel`), so
     the "excluded" style can be distinguished from "untouched" — both are simply "not in
     `included`" otherwise.
2. **`UploadCalendarPanel.tsx`**
   - Add `const [included, setIncluded] = useState<Set<string>>(new Set())`.
   - Add `useEffect(() => setIncluded(new Set(yearDates)), [parsed, year])`.
   - Gate the new interactive props to `mode === "new" && !saved`: only "New calendar" gets
     `onToggleDate`/`included`/`fileDates`; "Upload dates" keeps calling `<MonthGrid>` exactly as
     today (its own `gridDates`, no toggle props), preserving the existing merge-with-other-years
     behaviour untouched.
   - Add the toggle callback: add/remove `iso` from `included`.
   - Stats row (only for `mode === "new"`): keep **Dates in file** (`yearDates.length`, unchanged
     meaning), add **Selected** (`included.size` — what will be saved), add **Excluded**
     (`yearDates.filter(d => !included.has(d)).length`); keep **Year**. Drop the **First**/**Last**
     stats or recompute them from `[...included].sort()` — recomputing is more useful and is a
     one-line change, so do that.
   - Add the **Legend** entries: "Included" (existing green swatch, relabelled from "Date in the
     file") and "Excluded" (new muted swatch). Add a **Reset exclusions** button next to the stats,
     visible only when `included` differs from `new Set(yearDates)`, calling
     `setIncluded(new Set(yearDates))`.
   - Update `fileReady`/`ready` (for `mode === "new"` only) to require `included.size > 0` instead
     of `yearDates.length > 0`; relax the section-visible condition from `fileReady` to `fileValid`
     so a file with zero matching-year dates still shows the (now all-manual) grid for that mode.
   - Change the **"new" mode's save path only** to `uploadCalendarDates(newName,
     csvFile([...included].sort()))`. The **"upload" mode's** merge path
     (`[...otherYears, ...yearDates]`) is explicitly left using `yearDates`, per the scope decision
     above.
   - Reword the zero-matches warning for `mode === "new"` to mention manual selection is still
     possible; leave the "upload" mode's equivalent messaging as-is.
3. No changes needed to `calendarFormModel.ts`, `client.ts`, the spec types, or the mock handlers.

## Verification plan

- Manual walkthrough via the browser tool, **"New calendar" mode only**: upload the sample CSV,
  confirm the grid pre-includes its 5 dates; click one of them to exclude it and confirm the
  Excluded stat/legend/style update; click a date not in the file to include it and confirm
  Selected increases; change the year dropdown and confirm the selection re-seeds from that year's
  file dates (manual changes from the previous year are not carried over); click **Reset
  exclusions** and confirm it returns to exactly the file's dates; exclude every date and confirm
  "Create calendar" disables; save and confirm (via `/calendars`) the saved date set matches the
  on-screen selection, not the raw file.
- Separately confirm **"Upload dates" (existing calendar) mode is unchanged**: its grid stays
  read-only and its save still uses the raw file dates merged with other years.
- `npm run lint` and `tsc -b` (via `npm run build`) in `apps/web`.
- Note from the baseline investigation: the dev environment can occasionally hit a transient MSW
  service-worker startup race on a fresh page load (save calls 404 until the page is reloaded).
  If a save appears to fail for no reason during verification, reload and retry once before
  treating it as a regression from this change.


## Out of scope (unless requested)

- Applying the same toggle to the rule-based "Define by rules" preview (the original ask) — not
  part of this pivot unless asked for again.
- ~~Applying the toggle to "Upload dates" mode~~ — **now in scope, see § Phase 2 below**
  (2026-11-06, later the same day).
- Showing the grid before a file is chosen (pure manual creation with no CSV at all).
- A separate "Added" stat/legend distinction for manually-included, non-file dates — they're
  visually and numerically folded into "Included"/"Selected" per the simplified two-state model
  product confirmed (§ Design decisions #4). Flag if this granularity turns out to be wanted later.

---

# Phase 2: extend the toggle to "Upload dates" mode

Status: **Implemented and tested (2026-11-06).**

## Request

Add the same include/exclude toggle to `/create` → "Upload file" → **"Upload dates"** (the
sub-mode that adds or replaces a year of dates on an existing/migrated calendar) — currently
read-only, deliberately left out of Phase 1.

## Investigation (browser-verified, 2026-11-06)

I exercised the current "Upload dates" flow end to end against `Toggle-Test-Calendar` (a calendar
holding 5 custom 2026 dates — 1, 5, 6, 7, 15 — from Phase 1 testing, including one date, the 15th,
that only exists because a user manually added it, not because it was ever in any file):

1. Selected it as the upload target, chose 2026, uploaded the same 5-date sample CSV (1, 2, 5, 6,
   7). The pre-existing amber warning correctly read *"It already has 5 dates in 2026; the dates
   in your file replace them."*
2. The grid is confirmed **fully read-only today** — `0` clickable buttons found in the DOM,
   identical plain `<div>` cells to before Phase 1, single "Date in the file" legend, no
   Selected/Excluded/Reset UI. This confirms Phase 1's scope boundary held exactly as designed.
3. Clicked "Upload to calendar". Result: **"Saved Toggle-Test-Calendar with 5 dates for 2026."**
   Checking the Calendars page detail view confirmed the final dates are exactly **1, 2, 5, 6,
   7** — the calendar's previous custom set (1, 5, 6, 7, **15**) was **silently and completely
   overwritten** by the raw file, losing the manually-added 15th with no warning beyond the
   generic amber notice.

This last point is the important finding: **"Upload dates" is a full, blind replace of the
selected year today.** This is exactly the gap a toggle here would fix — not just "let the user
pick extra dates" (Phase 1's framing), but "let the user see and rescue what's about to be wiped."

## Codebase findings specific to this mode

- The data flow is nearly identical to "New calendar": same `parsed`/`yearDates`/`fileDates`
  machinery, same `MonthGrid` component (extended below for the new provenance-colour states).
- The target calendar's own current dates for the selected year aren't currently kept as a date
  list, only a count (`existingInYear`) — need the actual array to build `existingDates`.
- The save path's `otherYears` logic (preserving years outside the selected one) is untouched —
  only the selected year's handling changes.
- `included`'s seeding effect now needs the target calendar's dates too, so for "upload" mode it
  must depend on `selected` (or `selectedName`) in addition to `[parsed, year]` — switching the
  upload target is now a meaningful reseed trigger.

## Design decision: CONFIRMED — Option B (merge by default)

Product chose **Option B**: `included` seeds as the **union** of the target calendar's existing
year-dates and the file's year-dates. Saving with no clicks is a **merge**, not a replace — this
is a deliberate behaviour change from today's silent-overwrite default. Three further requirements
came with the confirmation, all folded into the design below:

1. A reset control that returns the selection to **the calendar's original dates for that year**
   (not the file's dates, and not back to the union) — i.e. "discard this file's influence
   entirely, keep the calendar as it already was."
2. **Provenance markers that show where a day came from — the uploaded file, the existing
   calendar, or both (an overlap) — immediately on load, not only once a date is excluded.**
   Corrected from an earlier draft of this plan: since the union is included by default, amber
   (existing-only) and violet (overlap) must be visible **the moment the file loads**, on cells
   that are currently included, not held back until the user excludes something.

### Provenance colour is primary; included/excluded is a secondary treatment on top of it

Rather than "green = included, grey = excluded" with provenance only surfacing once excluded, the
colour always reflects **where the day came from**, and whether it's currently selected is shown
by *how* that colour renders (solid/filled vs muted/struck-through):

For a given day, let `inFile = fileDates.has(iso)` and `inExisting = existingDates.has(iso)` (both
false unless `mode === "upload"` — "New calendar" has no `existingDates`, so every day is either
`inFile` or neither, and the table collapses to Phase 1's original two states: solid emerald when
included, muted grey-strikethrough when excluded).

| Origin | Included (in `included`) | Excluded (not in `included`) |
|---|---|---|
| Overlap — `inFile && inExisting` | solid **violet** | muted violet, struck-through |
| Existing-only — `inExisting && !inFile` | solid **amber** | muted amber, struck-through |
| File-only — `inFile && !inExisting` | solid **emerald** (today's look) | muted grey, struck-through (today's look) |
| Neither (manually added beyond file/calendar) | solid **emerald** | n/a — not in `included` and no origin just means an untouched, unclicked day (plain/blank, as today) |

Title text follows the same split, e.g. for an included overlap day: *"In the file and already on
the calendar — included (click to exclude)"*; for an excluded existing-only day: *"On the
calendar, not in the file — will be removed (click to keep)"*.

**Legend** for "upload" mode: three colour swatches — **From file** (emerald), **On calendar
only** (amber), **In both** (violet) — plus one line of text noting *"struck-through = excluded"*,
rather than six separate swatches for every included/excluded combination. "New calendar" mode
keeps its existing two-swatch legend (Included, Excluded) unchanged, since `existingDates` is
always empty there.

### Reset control

Two distinct reset semantics now exist, so the button's target and label are mode-aware (same
button, same position, same color scheme as "Create calendar" from the earlier styling request):

- **"New calendar" mode** (unchanged from Phase 1): label "Reset exclusions", resets `included` to
  `new Set(fileDates)`, disabled when already there.
- **"Upload dates" mode** (new): label **"Reset to calendar's current dates"**, resets `included`
  to `new Set(existingDates)` — i.e. discards the file's influence entirely and keeps the
  calendar exactly as it already is for that year. Disabled when `included` already equals
  `existingDates`.

## Implementation steps

1. **`MonthGrid.tsx`**: generalize the toggle-mode styling so colour encodes provenance
   (file / existing / both) and included/excluded is a secondary solid-vs-muted treatment, per the
   table above.
   - Replace the single `fileDates`-only meaning with two explicit provenance sets:
     `fileDates: Set<string>` (unchanged name/purpose) and a new optional
     `existingDates?: Set<string>` (defaults to empty, so "New calendar" callers need no changes).
   - Rewrite `toggleCellClass`/`toggleTitleFor` to take `(isIncluded, inFile, inExisting)`, resolve
     the origin first (overlap / existing-only / file-only / neither), then apply the
     solid-vs-muted treatment based on `isIncluded`, per the table above.
   - No prop renames needed beyond adding `existingDates` — `included`/`onToggleDate` stay as-is.
2. **`UploadCalendarPanel.tsx`**:
   - Compute `existingYearDates = (selected?.dates ?? []).filter(d => d.startsWith(`${year}-`))`
     and `existingDates = useMemo(() => new Set(existingYearDates), [existingYearDates])`.
   - Update the `included` seeding effect: for `mode === "upload"`, initialize to the union of
     `yearDates` and `existingYearDates`; for `mode === "new"`, unchanged (file dates only). Effect
     dependencies become `[parsed, year, mode, selected]` (re-seeds if the user picks a different
     upload target).
   - Gate the toggle props to `(mode === "new" || mode === "upload") && !saved`; pass
     `existingDates` only for `mode === "upload"` (omit/empty for "new", preserving Phase 1 exactly).
   - Stats row for "upload" mode: **Dates in file**, **Selected**, **Excluded**, and **On
     calendar** (`existingYearDates.filter(d => !included.has(d)).length` — the "will be removed"
     count, covering both the overlap and on-calendar-only excluded cells), **Year**.
   - Reset button: mode-aware label and target as described above —
     `onClick={() => setIncluded(new Set(mode === "upload" ? existingDates : fileDates))}`,
     `disabled={mode === "upload" ? isAtExistingDefault : isAtFileDefault}`, where
     `isAtExistingDefault` is the `included`/`existingDates` set-equality check (parallel to the
     existing `isAtFileDefault`).
   - Reword the amber pre-upload warning for "upload" mode to reflect the merge default, e.g.:
     *"It already has N dates in {year}. By default all of them are kept alongside the file's
     dates — adjust the selection below if you want to drop any."* (only shown when
     `existingInYear > 0`; keep the existing `existingOther` sentence about other years as-is).
   - Change the "upload" branch of the save mutation from `csvFile([...otherYears,
     ...yearDates].sort())` to `csvFile([...otherYears, ...included].sort())`.
   - `fileReady`/`ready`: drop the mode branch — both modes require `fileValid && included.size >
     0`. `showGrid` simplifies to `fileValid` for both modes.
3. No changes to `calendarFormModel.ts`, `client.ts`, the spec types, or the mock handlers.

## Verification plan

- Repeat the investigation scenario (`Toggle-Test-Calendar`, existing dates 1/5/6/7/15, upload a
  file with 1/2/5/6/7) and confirm the **default selection is the 6-date union** (1, 2, 5, 6, 7,
  15) immediately on load, with **no clicks needed to see colour**: day 1 (overlap) solid violet,
  day 15 (existing-only) solid amber, days 2/5/6/7 (file-only) solid emerald — all simultaneously,
  right after the file is chosen.
- Exclude day 1 (overlap) and confirm it switches to muted violet + strikethrough, title updates
  to the "will be removed" / overlap wording.
- Exclude day 15 (existing-only) and confirm it switches to muted amber + strikethrough.
- Exclude day 2 (file-only) and confirm it uses the original muted-grey strikethrough style
  (unchanged from Phase 1 — no provenance ambiguity there).
- Click **"Reset to calendar's current dates"** and confirm the selection returns to exactly
  1/5/6/7/15 (discarding the file entirely, not the union) — and that the button is disabled at
  that point.
- Re-upload the file (don't touch anything else) and confirm the selection re-seeds back to the
  6-date union, not the pre-reset state.
- Save with the default (untouched) union selection and confirm (via `/calendars`) the final dates
  are all 6 — proving the headline fix: nothing is silently lost anymore.
- Confirm **"New calendar" mode is unaffected** — re-run Phase 1's verification steps, including
  that its Reset button still says "Reset exclusions", targets the file's dates, and its cells
  never show amber/violet (no `existingDates` there).
- `tsc -b` in `apps/web` (`eslint` still isn't installed in this project, per earlier note).

## Implementation notes (post-build)

- All of the above verified live via the browser tool, using a constructed overlap scenario
  (existing calendar dates 1/2/5/6/7, a 3-date file with 1/2/20) to exercise every origin
  combination at once — confirmed solid violet (1, 2 — overlap), solid amber (5, 6, 7 —
  existing-only), solid emerald (20 — file-only) immediately on file load, muted/struck versions
  after excluding one of each, correct stat counts throughout, "Reset to calendar's current dates"
  returning to exactly the pre-upload set, and the final persisted dates (checked via `/calendars`)
  matching the on-screen selection exactly.
- **Found and fixed one real bug while testing** (pre-existing since Phase 1, just masked by a
  coincidental count match in earlier tests): the post-save success message and `keptAfterSave`
  used `yearDates.length` (the raw file's year-date count) instead of `included.size` (what was
  actually saved). This only produced a visibly wrong number once Phase 2's merge logic made the
  two counts genuinely diverge (file had 3 dates, 5 were actually saved). The *save itself* was
  always correct — this was a display-only bug, confirmed by checking the real persisted dates on
  `/calendars` independently of the on-screen message. Fixed in `UploadCalendarPanel.tsx`.

---

# Phase 3: remove "Define by rules" calendar creation entirely

Status: **Implemented and tested (2026-11-06).** Product decided the Upload-file flow should be
the only (and default) way to create a calendar; the rule-based tab is removed, not just hidden.

## Investigation

Traced every consumer of the rule-based creation code to separate "UI-only, safe to delete" from
"also used by the mock backend's seed data, must stay":

- **UI-only, deleted**: `CalendarForm.tsx` (the rule/weekday/holiday-offset form) and
  `HolidayCalendarSelect.tsx` (only ever used by `CalendarForm`). Neither is referenced from
  `CalendarsPage.tsx` or anywhere else.
- **`CreateCalendarPage.tsx`**: previously held a `"rules" | "upload"` mode toggle and an inline
  `RuleBasedCreate` component (preview query, save mutation, its own `MonthGrid`/`Legend`/`Stat`
  usage). Replaced with a page that renders only `<UploadCalendarPanel />` — no toggle, no rule
  code left in the file.
- **`calendarFormModel.ts`**: trimmed to just the `CALENDAR_NAME` regex, which
  `UploadCalendarPanel.tsx` also imports and still needs. Everything else in that file
  (`FormState`, `INITIAL`, `defaultParams`, `paramError`, `previewRequestOf`, `createRequestOf`,
  `CalendarKind`) had no other consumers once `CalendarForm.tsx`/`CreateCalendarPage.tsx`'s rule
  path were gone, so it was deleted rather than left as dead code.
- **Deliberately left alone** (minimal-impact — these are not UI and are still load-bearing):
  - `client.ts`'s `listRuleCatalog`/`previewCalendar`/`listHolidayCalendars` and the mock's
    matching `/v1/rules`, `/v1/calendars/preview`, `/v1/holiday-calendars` handlers — these
    represent proposed backend-contract surface (tracked in
    `req-details/api-spec/API_SPEC_ISSUES.md`, API-005/API-010/API-020), independent of whether
    this app's UI currently calls them.
  - `mocks/ruleEngine.ts` (`RULES`, `HOLIDAY_CALENDARS`, `generatePreview`, `validatePreview`) —
    **not dead code**: `mocks/store.ts` calls `generatePreview` directly to compute realistic
    dates for the seeded demo calendars (`NYSE-Trading-Days`, `Payroll-10th-Working-Day`, the
    `AUTOSYS_*` migrated calendars, etc.), entirely independent of the creation UI.
  - `proposed.ts`'s `RuleDefinition`/`RuleParameter`/`CalendarPreviewRequest`/
    `CalendarPreviewResponse`/`HolidayCalendarOption` types — still used by the above.
  - `CalendarsPage.tsx`'s `scheduleOf()`/`holidayHandlingOf()` — these *display* a stored
    calendar's `dateRuleType`/`runDate`/`runDay`/`holidayCalendar` fields in the browse/detail
    view; existing rule-based calendars (seeded or created before this change) still need to show
    correctly. Untouched.

## Verification

- `tsc -b` in `apps/web`: clean, both immediately after the edit and after a full dev-server
  reload (Vite's HMR briefly tried to hot-reload the deleted files mid-edit and logged transient
  404s — resolved by a normal page reload, not a real issue).
- Browser: `/create` now loads straight into the Upload-file screen, no tab/mode toggle visible;
  the unrelated inner "New calendar"/"Upload dates" radio group (a different, still-needed
  toggle) is untouched.
- Confirmed existing rule-based calendars (e.g. `NYSE-Trading-Days`) still browse and render
  correctly on `/calendars`, proving the seed-data/display path was unaffected.
