# Plan: date include/exclude toggle on the Upload-file preview

Status: **Investigation complete, answers confirmed, awaiting go-ahead to implement.**

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
- Applying the toggle to "Upload dates" mode (uploading into an existing/migrated calendar) — the
  confirmed scope is "New calendar" only; that sub-mode's grid and save path are untouched.
- Showing the grid before a file is chosen (pure manual creation with no CSV at all).
- A separate "Added" stat/legend distinction for manually-included, non-file dates — they're
  visually and numerically folded into "Included"/"Selected" per the simplified two-state model
  product confirmed (§ Design decisions #4). Flag if this granularity turns out to be wanted later.
