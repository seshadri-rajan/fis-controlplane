import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getCalendarDates, listCalendars } from "../../lib/api/client";
import type { SpecCalendar } from "../../lib/api/client";
import { useTabs } from "../navigation/TabsProvider";
import { field, label } from "./formStyles";
import MonthGrid, { Legend } from "./MonthGrid";

type Kind = "rules" | "uploaded" | "migrated";
type Filter = "all" | Kind;

const KIND_LABEL: Record<Kind, string> = {
  rules: "Rule-based",
  uploaded: "Uploaded",
  migrated: "Migrated",
};

const KIND_STYLE: Record<Kind, string> = {
  rules: "bg-sky-100 text-sky-800",
  uploaded: "bg-violet-100 text-violet-800",
  migrated: "bg-amber-100 text-amber-800",
};

const FILTERS: Array<[Filter, string]> = [
  ["all", "All"],
  ["rules", KIND_LABEL.rules],
  ["uploaded", KIND_LABEL.uploaded],
  ["migrated", KIND_LABEL.migrated],
];

const kindOf = (calendar: SpecCalendar): Kind =>
  calendar.migrated ? "migrated" : calendar.uploaded ? "uploaded" : "rules";

const titleCase = (value: string) => value.charAt(0) + value.slice(1).toLowerCase();

function scheduleOf(calendar: SpecCalendar): string {
  if (calendar.dateRuleType) {
    const parameter = calendar.runDate
      ? `date ${calendar.runDate}`
      : calendar.runDay
        ? `day ${calendar.runDay}`
        : "";
    return parameter ? `${calendar.dateRuleType} · ${parameter}` : calendar.dateRuleType;
  }
  if (calendar.dayOfWeek?.length) {
    return calendar.dayOfWeek.map((day) => titleCase(day).slice(0, 3)).join(", ");
  }
  return "Dates only";
}

function holidayHandlingOf(calendar: SpecCalendar): string {
  if (!calendar.holidayCalendar) return "None";
  if (!calendar.holidayRun) return `${calendar.holidayCalendar}, not applied`;
  const offset = calendar.holidayOffset;
  if (offset === undefined) return calendar.holidayCalendar;
  const move = offset === 0 ? "skipped" : `moved ${offset > 0 ? "+" : ""}${offset} day${Math.abs(offset) === 1 ? "" : "s"}`;
  return `${calendar.holidayCalendar}, run on a holiday is ${move}`;
}

const formatDate = (iso: string | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : "–";

export default function CalendarsPage() {
  const { setTab } = useTabs();
  const [selected, setSelected] = useState<string | null>(null);
  const [yearChoice, setYearChoice] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const calendars = useQuery({ queryKey: ["calendars", "all"], queryFn: listCalendars });

  const dates = useQuery({
    queryKey: ["calendars", "dates", selected],
    queryFn: () => getCalendarDates(selected!),
    enabled: selected !== null,
  });

  const current = calendars.data?.find((c) => c.calendarName === selected) ?? null;

  const counts = useMemo(() => {
    const result: Record<Filter, number> = { all: 0, rules: 0, uploaded: 0, migrated: 0 };
    for (const calendar of calendars.data ?? []) {
      result.all += 1;
      result[kindOf(calendar)] += 1;
    }
    return result;
  }, [calendars.data]);

  const visible = (calendars.data ?? []).filter(
    (calendar) =>
      (filter === "all" || kindOf(calendar) === filter) &&
      (calendar.calendarName ?? "").toLowerCase().includes(search.trim().toLowerCase()),
  );

  const years = useMemo(
    () => [...new Set((dates.data ?? []).map((d) => Number(d.slice(0, 4))))].sort(),
    [dates.data],
  );
  const thisYear = new Date().getFullYear();
  const year =
    yearChoice !== null && years.includes(yearChoice)
      ? yearChoice
      : years.includes(thisYear)
        ? thisYear
        : years[0];
  const yearDates = (dates.data ?? []).filter((d) => d.startsWith(`${year}-`));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Calendars</h1>
        <p className="mt-1 text-sm text-slate-600">
          Browse stored calendars and the dates they run on. Editing is not available yet.
        </p>
      </div>

      {calendars.isError && (
        <p role="alert" className="rounded-md bg-rose-50 p-3 text-sm text-rose-800">
          {(calendars.error as Error).message}
        </p>
      )}

      {calendars.data?.length === 0 && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          No calendars yet.{" "}
          <button type="button" onClick={() => setTab("create")} className="font-medium underline">
            Create one
          </button>
          .
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="space-y-3">
          <div>
            <label htmlFor="calendar-search" className={label}>
              Search
            </label>
            <input
              id="calendar-search"
              className={field}
              placeholder="Calendar name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div role="group" aria-label="Calendar type" className="flex flex-wrap gap-1.5">
            {FILTERS.map(([value, text]) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  filter === value
                    ? "bg-slate-900 text-white"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                {text} <span className="opacity-70">{counts[value]}</span>
              </button>
            ))}
          </div>

          <ul className="space-y-2">
            {visible.map((calendar) => {
              const kind = kindOf(calendar);
              const name = calendar.calendarName ?? "";
              return (
                <li key={name}>
                  <button
                    type="button"
                    aria-pressed={name === selected}
                    onClick={() => {
                      setSelected(name);
                      setYearChoice(null);
                    }}
                    className={`w-full rounded-lg border p-3 text-left ${
                      name === selected
                        ? "border-slate-900 bg-white"
                        : "border-slate-200 bg-white hover:border-slate-400"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{name}</span>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${KIND_STYLE[kind]}`}>
                        {KIND_LABEL[kind]}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-500">
                      <span className="truncate">{scheduleOf(calendar)}</span>
                      <span className="shrink-0 tabular-nums">
                        {calendar.dates?.length ?? 0} dates
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          {calendars.data && calendars.data.length > 0 && visible.length === 0 && (
            <p className="rounded-md bg-slate-100 p-3 text-sm text-slate-600">
              No calendars match your search.
            </p>
          )}
        </div>

        {!current && calendars.data && calendars.data.length > 0 && (
          <p className="h-fit rounded-md bg-slate-100 p-3 text-sm text-slate-600">
            Select a calendar to see its dates.
          </p>
        )}

        {current && (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">{current.calendarName}</h2>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${KIND_STYLE[kindOf(current)]}`}>
                  {KIND_LABEL[kindOf(current)]}
                </span>
              </div>

              <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <Detail term="Schedule" value={scheduleOf(current)} />
                <Detail term="Holidays" value={holidayHandlingOf(current)} />
                <Detail
                  term="Created"
                  value={`${current.createdBy ?? "–"} · ${formatDate(current.createdAt)}`}
                />
                <Detail term="Last updated" value={formatDate(current.updatedAt)} />
              </dl>
            </div>

            {dates.isError && (
              <p role="alert" className="rounded-md bg-rose-50 p-3 text-sm text-rose-800">
                {(dates.error as Error).message}
              </p>
            )}

            {dates.data?.length === 0 && (
              <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                This calendar has no dates yet.{" "}
                <button type="button" onClick={() => setTab("create")} className="font-medium underline">
                  Upload a file
                </button>{" "}
                to add some.
              </p>
            )}

            {!!dates.data?.length && year !== undefined && (
              <>
                <div className="flex flex-wrap items-center gap-6 rounded-lg border border-slate-200 bg-white px-4 py-3">
                  <Stat label={`Run dates ${year}`} value={yearDates.length} />
                  <Stat label="Total dates" value={dates.data.length} />
                  <div className="ml-auto flex items-end gap-4">
                    <Legend items={[["bg-emerald-500", "Run date"]]} />
                    <div>
                      <label htmlFor="calendar-year" className={label}>
                        Year
                      </label>
                      <select
                        id="calendar-year"
                        className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
                        value={year}
                        onChange={(e) => setYearChoice(Number(e.target.value))}
                      >
                        {years.map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <MonthGrid
                  year={year}
                  dates={yearDates.map((day) => ({ day, reason: "" }))}
                  holidays={new Map()}
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Detail({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{term}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function Stat({ label: text, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{text}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
