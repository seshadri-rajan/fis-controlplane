import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";

import { getCalendarDates, listCalendars, setCalendarActive } from "../../lib/api/client";
import type { ApiError, SpecCalendar } from "../../lib/api/client";
import { isActive } from "../../lib/api/proposed";
import { useAuth } from "../auth/AuthProvider";
import { amendPath } from "../navigation/paths";
import { useTabs } from "../navigation/TabsProvider";
import { field, label } from "./formStyles";
import MonthGrid, { Legend } from "./MonthGrid";

// Every calendar is made by uploading a file or migrated from Autosys. One that is neither (the
// real backend may hold older ones) gets no badge and is only listed under All.
type Kind = "uploaded" | "migrated";
type Filter = "all" | Kind | "inactive";

const KIND_LABEL: Record<Kind, string> = {
  uploaded: "Uploaded",
  migrated: "Migrated",
};

const KIND_STYLE: Record<Kind, string> = {
  uploaded: "bg-violet-100 text-violet-800",
  migrated: "bg-amber-100 text-amber-800",
};

const FILTERS: Array<[Filter, string]> = [
  ["all", "All"],
  ["uploaded", KIND_LABEL.uploaded],
  ["migrated", KIND_LABEL.migrated],
  ["inactive", "Inactive"],
];

const kindOf = (calendar: SpecCalendar): Kind | null =>
  calendar.migrated ? "migrated" : calendar.uploaded ? "uploaded" : null;

/** "2026", "2026 – 2027" or "No dates yet". */
function coverageOf(calendar: SpecCalendar): string {
  const years = (calendar.dates ?? []).map((date) => date.slice(0, 4)).sort();
  if (years.length === 0) return "No dates yet";
  const first = years[0];
  const last = years[years.length - 1];
  return first === last ? first : `${first} – ${last}`;
}

function holidayCalendarOf(calendar: SpecCalendar): string {
  return calendar.holidayCalendar || "None";
}

const formatDate = (iso: string | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : "–";

export default function CalendarsPage() {
  const { setTab } = useTabs();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { has } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);
  const [yearChoice, setYearChoice] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [confirming, setConfirming] = useState(false);

  const calendars = useQuery({ queryKey: ["calendars", "all"], queryFn: listCalendars });

  const dates = useQuery({
    queryKey: ["calendars", "dates", selected],
    queryFn: () => getCalendarDates(selected!),
    enabled: selected !== null,
  });

  const toggleActive = useMutation({
    mutationFn: ({ name, active }: { name: string; active: boolean }) =>
      setCalendarActive(name, active),
    onSuccess: () => {
      setConfirming(false);
      queryClient.invalidateQueries({ queryKey: ["calendars"] });
    },
  });

  const current = calendars.data?.find((c) => c.calendarName === selected) ?? null;
  // Amending needs EDITOR; changing a calendar's status is ADMIN only (has() treats ADMIN as a superset).
  const canAmend = has("EDITOR");
  const canToggle = has("ADMIN");

  const counts = useMemo(() => {
    const result: Record<Filter, number> = {
      all: 0,
      uploaded: 0,
      migrated: 0,
      inactive: 0,
    };
    for (const calendar of calendars.data ?? []) {
      result.all += 1;
      const kind = kindOf(calendar);
      if (kind) result[kind] += 1;
      if (!isActive(calendar)) result.inactive += 1;
    }
    return result;
  }, [calendars.data]);

  const visible = (calendars.data ?? []).filter(
    (calendar) =>
      (filter === "all" ||
        (filter === "inactive" ? !isActive(calendar) : kindOf(calendar) === filter)) &&
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
          Browse stored calendars and the dates they run on. Select one to amend its dates.
        </p>
      </div>

      {calendars.isError && (
        <p role="alert" className="rounded-md bg-rose-50 p-3 text-sm text-rose-800">
          {(calendars.error as Error).message}
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm">
        Dates (DD-MM-YYYY, one per line)
        <textarea className={field} name="dates" rows={4} defaultValue={calendar?.dates.join("\n")} />
      </label>
      <Failure error={save.error} />
      <button className={button} disabled={save.isPending}>
        {calendar ? "Save changes" : "Create calendar"}
      </button>
    </form>
  );
}

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
                      setConfirming(false);
                      toggleActive.reset();
                    }}
                    className={`w-full rounded-lg border p-3 text-left ${
                      name === selected
                        ? "border-slate-900 bg-white"
                        : "border-slate-200 hover:border-slate-400"
                    } ${isActive(calendar) ? "bg-white" : "bg-slate-50"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`truncate font-medium ${isActive(calendar) ? "" : "text-slate-500"}`}
                      >
                        {name}
                      </span>
                      <span className="flex shrink-0 gap-1">
                        {!isActive(calendar) && (
                          <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                            Inactive
                          </span>
                        )}
                        {kind && (
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${KIND_STYLE[kind]}`}>
                            {KIND_LABEL[kind]}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-500">
                      <span className="truncate">{coverageOf(calendar)}</span>
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
                {kindOf(current) && (
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${KIND_STYLE[kindOf(current)!]}`}>
                    {KIND_LABEL[kindOf(current)!]}
                  </span>
                )}
                {!isActive(current) && (
                  <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                    Inactive
                  </span>
                )}

                {(canAmend || canToggle) && (
                  <div className="ml-auto flex flex-wrap gap-2">
                    {canAmend && (
                      <button
                        type="button"
                        disabled={!isActive(current)}
                        title={isActive(current) ? undefined : "Activate this calendar to amend it"}
                        onClick={() => navigate(amendPath(current.calendarName ?? ""))}
                        className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                      >
                        Amend dates
                      </button>
                    )}
                    {canToggle && (
                      <button
                        type="button"
                        onClick={() => setConfirming(true)}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                      >
                        {isActive(current) ? "Deactivate" : "Activate"}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {!isActive(current) && (
                <p className="mt-2 text-xs text-slate-500">
                  Inactive: its dates can’t be amended or uploaded to until it is activated again.
                  {!canToggle && " Only an admin can activate it."}
                </p>
              )}

              {confirming && (
                <div role="group" aria-label="Confirm status change" className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                  <p>
                    {isActive(current)
                      ? `Deactivate ${current.calendarName}? Its dates can't be amended or uploaded to until it is activated again. It stays in this list.`
                      : `Activate ${current.calendarName}? Its dates can be amended and uploaded to again.`}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={toggleActive.isPending}
                      onClick={() =>
                        toggleActive.mutate({
                          name: current.calendarName ?? "",
                          active: !isActive(current),
                        })
                      }
                      className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                    >
                      {toggleActive.isPending
                        ? "Saving…"
                        : isActive(current)
                          ? "Yes, deactivate"
                          : "Yes, activate"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(false)}
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {toggleActive.isError && (
                <p role="alert" className="mt-3 rounded-md bg-rose-50 p-2 text-sm text-rose-800">
                  {(toggleActive.error as ApiError).message}
                </p>
              )}

              <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <Detail term="Status" value={isActive(current) ? "Active" : "Inactive"} />
                <Detail term="Years covered" value={coverageOf(current)} />
                <Detail term="Holiday calendar" value={holidayCalendarOf(current)} />
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
          {selectedYear && visibleDates.length > 0 && (
            <MonthGrid year={Number(selectedYear)} dates={visibleDates} />
          )}
          <CalendarEditor key={`${name}:${current.updatedAt}`} api={api} calendar={current} onSaved={onSaved} />
        </>
      )}
    </section>
  );
}

export default function CalendarsPage({ api }: { api: CalendarApi }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string>();
  const [search, setSearch] = useState("");
  const [migrated, setMigrated] = useState("");
  const [page, setPage] = useState(1);
  const list = useQuery({
    queryKey: ["calendars", "list", page, search, migrated],
    queryFn: () => api.list({
      offset: page,
      calendarName: search || undefined,
      migrated: migrated ? migrated === "yes" : undefined,
    }),
  });
  const uploaded = useQuery({
    queryKey: ["calendars", "uploaded"],
    queryFn: api.uploaded,
    enabled: list.isSuccess,
  });
  const [saved, setSaved] = useState("");
  function onSaved(calendar: Calendar) {
    setSelected(calendar.calendarName);
    setSaved(`Saved ${calendar.calendarName}.`);
    void queryClient.invalidateQueries({ queryKey: ["calendars"] });
  }
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Calendars</h1>
      <Failure error={list.error} />
      {list.isPending && <p>Loading calendars...</p>}
      {list.isSuccess && (
        <>
          {saved && <p role="status" className="text-sm text-emerald-800">{saved}</p>}
          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <aside className="space-y-4">
              <section className={panel}>
                <label className="flex flex-col gap-1 text-sm">
                  Search by name
                  <input className={field} value={search} maxLength={128} onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }} />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Migration status
                  <select className={field} value={migrated} onChange={(event) => {
                    setMigrated(event.target.value);
                    setPage(1);
                  }}>
                    <option value="">All</option>
                    <option value="yes">Migrated</option>
                    <option value="no">Not migrated</option>
                  </select>
                </label>
                {!list.data.calendars.length && <p className="text-sm">No matching calendars.</p>}
                <ul className="space-y-1">
                  {list.data.calendars.map((calendar) => (
                    <li key={calendar.calendarName}>
                      <button type="button" onClick={() => setSelected(calendar.calendarName)}
                        aria-pressed={selected === calendar.calendarName}
                        className="w-full rounded border border-slate-200 p-2 text-left text-sm aria-pressed:bg-slate-100">
                        {calendar.calendarName} <span className="text-slate-500">({calendar.status})</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <button className={button} disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
                  <span>{page} / {Math.max(list.data.totalPages, 1)}</span>
                  <button className={button} disabled={page >= list.data.totalPages} onClick={() => setPage(page + 1)}>Next</button>
                </div>
              </section>
              <section className={panel}>
                <h2 className="font-semibold">Uploaded calendars</h2>
                <Failure error={uploaded.error} />
                {uploaded.data?.length === 0 && <p className="text-sm">No uploads yet.</p>}
                <ul className="space-y-1 text-sm">
                  {uploaded.data?.map(({ name, migrated }) => (
                    <li key={name}>
                      <button type="button" className="underline" onClick={() => setSelected(name)}>
                        {name}{migrated ? " (migrated)" : ""}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
              <CalendarEditor api={api} onSaved={onSaved} />
              <CalendarUpload api={api} onSaved={onSaved} />
            </aside>
            {selected && <CalendarDetail key={selected} api={api} name={selected} onSaved={onSaved} />}
          </div>
        </>
      )}
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
