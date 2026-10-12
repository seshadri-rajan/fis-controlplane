# calendar_core

The date-rule engine. Given a rule, a year and a set of holidays, produce the dates a job should
run on.

This is the correctness heart of the platform. A bug here silently misfires production jobs across
the firm, which is why it is isolated, dependency-free and tested exhaustively.

## Hard constraint

**Zero runtime dependencies.** No FastAPI, no SQLAlchemy, no Airflow, no HTTP, no database, no
reads of the system clock. Every input arrives as a function argument.

This is not stylistic. It means:

- The package can be tested with plain tables of inputs and expected outputs, no fixtures or
  containers.
- It can be imported by anything without dragging in a framework.
- It is handed to Fidelity at the end of the engagement as the artefact behind the annual date
  rollover (RECORD.md section 9).

If you need a date "now", pass it in. If you need holidays, pass them in.

## Layout

```
src/calendar_core/
├── types.py            Value types: CalendarSpec, RuleSpec, Holiday, GeneratedDate
├── rules/
│   ├── registry.py     rule name -> evaluator lookup
│   ├── business_day.py Weekday-based calendars (Mon/Tue/.../Sun selections)
│   ├── extended.py     Named rules: LAST_BUSINESS_DAY, QUARTER_END, ...
│   └── holiday.py      Holiday resolution and roll-forward
└── generation.py       Materialise a full year of dates for a calendar
```

## The registry pattern

Fidelity supplies the extended rule list and we seed it as reference data (D-09), but the list has
not arrived yet (O-28). `registry.py` maps a rule name to an evaluator function so that each new
rule is an additive function plus a test table, never a redesign.

A rule row in the database with no evaluator registered here does nothing. Both are required.

## Open semantics

Two behaviours are genuinely undecided and must not be guessed. Encode them as explicit, named
test cases so the client can rule on them by looking at output:

- **O-06** Holiday collision. A weekly calendar includes Monday and Tuesday; Monday is a holiday.
  Does the Monday run shift onto Tuesday (merging with Tuesday's run, or duplicating it), or is it
  dropped?
- **O-07** Period boundary. A month-end rule whose resolved date rolls forward past the end of the
  month. Does it stay in the month, or move?

## Testing

Table-driven, one table per rule, with the awkward years included deliberately: leap years,
holidays landing on a weekend, consecutive holidays, and year boundaries.

```powershell
uv run pytest packages/calendar_core
```
