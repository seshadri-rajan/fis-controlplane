import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  fetchCalendarDates,
  fetchCalendarHistory,
  listCalendars,
} from "../../lib/api/client";
import type { CalendarRead } from "../../lib/api/client";
import MonthGrid, { Legend } from "../preview/MonthGrid";

const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const YEARS = [2026, 2027, 2028];

function describe(calendar: CalendarRead): string {
  if (calendar.kind === "BUSINESS_DAYS") {
    return (calendar.weekdays ?? []).map((d) => WEEKDAY_NAMES[d]).join(", ");
  }
  const params = Object.entries(calendar.rule_params ?? {})
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
  return params ? `${calendar.rule_name} (${params})` : (calendar.rule_name ?? "");
}

export default function CalendarsPage() {
  const [selected, setSelected] = useState<number | null>(null);
  const [year, setYear] = useState(2027);

  const calendars = useQuery({ queryKey: ["calendars"], queryFn: () => listCalendars() });

  const dates = useQuery({
    queryKey: ["calendar-dates", selected, year],
    queryFn: () => fetchCalendarDates(selected!, year),
    enabled: selected !== null,
  });

  const history = useQuery({
    queryKey: ["calendar-history", selected],
    queryFn: () => fetchCalendarHistory(selected!),
    enabled: selected !== null,
  });

  const current = calendars.data?.find((c) => c.calendar_key === selected) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Calendars</h1>
        <p className="mt-1 text-sm text-slate-600">
          Stored calendars and their materialised dates. Editing is not available until the
          approval workflow is confirmed.
        </p>
      </div>

      {calendars.isError && (
        <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-800">
          {(calendars.error as Error).message}
        </p>
      )}

      {calendars.data?.length === 0 && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          No calendars yet. Create one via <code>POST /api/ui/calendars</code>.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <ul className="space-y-2">
          {calendars.data?.map((calendar) => (
            <li key={calendar.calendar_key}>
              <button
                type="button"
                onClick={() => setSelected(calendar.calendar_key)}
                className={`w-full rounded-lg border p-3 text-left ${
                  calendar.calendar_key === selected
                    ? "border-slate-900 bg-white"
                    : "border-slate-200 bg-white hover:border-slate-400"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{calendar.calendar_nm}</span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                    {calendar.kind === "BUSINESS_DAYS" ? "business days" : "rule"}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-500">{describe(calendar)}</div>
              </button>
            </li>
          ))}
        </ul>

        {current && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-6 rounded-lg border border-slate-200 bg-white px-4 py-3">
              <div>
                <div className="text-xs text-slate-500">Holiday policy</div>
                <div className="text-sm font-medium">{current.policies.holiday}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Collision</div>
                <div className="text-sm font-medium">{current.policies.collision}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Run days {year}</div>
                <div className="text-sm font-medium tabular-nums">
                  {dates.data?.length ?? "–"}
                </div>
              </div>
              <label className="ml-auto text-xs text-slate-500">
                Year{" "}
                <select
                  className="ml-1 rounded-md border border-slate-300 px-2 py-1 text-sm"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                >
                  {YEARS.map((y) => (
                    <option key={y}>{y}</option>
                  ))}
                </select>
              </label>
            </div>

            {dates.data?.length === 0 && (
              <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                No dates materialised for {year}. Run{" "}
                <code>jobs.generate_year --year {year}</code>. A calendar with no future dates
                stops scheduling silently.
              </p>
            )}

            {!!dates.data?.length && (
              <>
                <Legend />
                <MonthGrid
                  year={year}
                  dates={dates.data.map((d) => ({
                    day: d.calendar_date,
                    shifted_from: d.shifted_from,
                    reason: d.remarks,
                  }))}
                  holidays={new Map()}
                />
              </>
            )}

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold">Audit history</h2>
              <table className="w-full text-left text-xs">
                <thead className="text-slate-500">
                  <tr>
                    <th className="py-1">When</th>
                    <th>Action</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {history.data?.map((entry) => (
                    <tr key={entry.audit_key} className="border-t border-slate-100">
                      <td className="py-1 tabular-nums">
                        {entry.updated_at?.replace("T", " ").slice(0, 19)}
                      </td>
                      <td>{entry.action}</td>
                      <td>{entry.updated_by}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {history.data?.length === 0 && (
                <p className="text-xs text-slate-500">No recorded changes.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
