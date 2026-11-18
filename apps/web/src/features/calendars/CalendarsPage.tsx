import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, type Calendar, type CalendarApi } from "../../lib/api/client";
import MonthGrid from "./MonthGrid";

const field = "rounded border border-slate-300 bg-white px-2 py-1 text-sm";
const button = "rounded bg-slate-900 px-3 py-1 text-sm text-white disabled:opacity-50";
const panel = "space-y-3 rounded-lg border border-slate-200 bg-white p-4";
const namePattern = "[A-Za-z0-9][A-Za-z0-9_\\-]{0,127}";

function Failure({ error }: { error: Error | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded bg-rose-50 p-2 text-sm text-rose-800">
      {error instanceof ApiError && error.status === 401
        ? "Paste a valid OAuth access token above to continue."
        : error.message}
    </p>
  );
}

function CalendarEditor({
  api, calendar, onSaved,
}: {
  api: CalendarApi;
  calendar?: Calendar;
  onSaved: (calendar: Calendar) => void;
}) {
  const save = useMutation({
    mutationFn: (data: FormData) => {
      const calendarName = calendar?.calendarName ?? String(data.get("name")).trim();
      const dates = String(data.get("dates")).split(/[\s,]+/).filter(Boolean);
      if (!calendar) return api.create({ calendarName, dates });
      const status = data.get("status") === "INACTIVE" ? "INACTIVE" : "ACTIVE";
      return api.update(calendarName, { calendarName, dates, status });
    },
    onSuccess: onSaved,
  });
  return (
    <form className={panel} onSubmit={(event) => {
      event.preventDefault();
      save.mutate(new FormData(event.currentTarget));
    }}>
      <h2 className="font-semibold">{calendar ? "Edit calendar" : "Create calendar"}</h2>
      {calendar ? (
        <label className="flex items-center gap-2 text-sm">
          Status
          <select className={field} name="status" defaultValue={calendar.status}>
            <option>ACTIVE</option>
            <option>INACTIVE</option>
          </select>
        </label>
      ) : (
        <label className="flex flex-col gap-1 text-sm">
          Calendar name
          <input className={field} name="name" pattern={namePattern} required />
        </label>
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

function CalendarUpload({
  api, onSaved,
}: {
  api: CalendarApi;
  onSaved: (calendar: Calendar) => void;
}) {
  const upload = useMutation({
    mutationFn: (data: FormData) => {
      const file = data.get("file");
      if (!(file instanceof File) || !file.name) throw new Error("Choose a CSV file.");
      return api.upload(String(data.get("name")).trim(), { year: String(data.get("year")) }, file);
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    upload.mutate(new FormData(form), { onSuccess: (calendar) => {
      form.reset();
      onSaved(calendar);
    } });
  }
  return (
    <form className={panel} onSubmit={submit}>
      <h2 className="font-semibold">Upload dates</h2>
      <p className="text-sm text-slate-600">Replaces dates for one year, or creates a new calendar.</p>
      <label className="flex flex-col gap-1 text-sm">
        Upload calendar name
        <input className={field} name="name" pattern={namePattern} required />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Upload year
        <input className={field} name="year" inputMode="numeric" pattern="[0-9]{4}"
          defaultValue={new Date().getFullYear()} required />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        CSV file (single column named date)
        <input className={field} name="file" type="file" accept=".csv,text/csv" required />
      </label>
      <Failure error={upload.error} />
      <button className={button} disabled={upload.isPending}>Upload CSV</button>
    </form>
  );
}

function CalendarDetail({
  api, name, onSaved,
}: {
  api: CalendarApi;
  name: string;
  onSaved: (calendar: Calendar) => void;
}) {
  const [exclude, setExclude] = useState("");
  const [year, setYear] = useState<string>();
  const detail = useQuery({ queryKey: ["calendars", "detail", name], queryFn: () => api.get(name) });
  const dates = useQuery({
    queryKey: ["calendars", "dates", name, exclude],
    queryFn: () => api.dates(name, exclude || undefined),
  });
  const current = detail.data;
  const years = [...new Set((current?.dates ?? []).map((date) => date.slice(6)))];
  const selectedYear = year && years.includes(year) ? year : years[0];
  const visibleDates = dates.data?.filter((date) => date.slice(6) === selectedYear) ?? [];
  return (
    <section className="space-y-4">
      <Failure error={detail.error} />
      {detail.isPending && <p>Loading calendar...</p>}
      {current && (
        <>
          <div className={panel}>
            <h2 className="text-lg font-semibold">{current.calendarName}</h2>
            <p className="text-sm text-slate-600">
              {current.status} · {current.migrated ? "Migrated" : "Not migrated"} ·{" "}
              {current.uploaded ? "Uploaded" : "Manually created"} · Created by {current.createdBy}
            </p>
            <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => {
              event.preventDefault();
              setExclude(String(new FormData(event.currentTarget).get("exclude")).trim());
            }}>
              <label className="flex flex-col gap-1 text-sm">
                Exclude calendar (optional)
                <input className={field} name="exclude" pattern={namePattern} />
              </label>
              <button className={button}>Apply exclusion</button>
              {selectedYear && (
                <label className="flex flex-col gap-1 text-sm">
                  View year
                  <select className={field} value={selectedYear} onChange={(event) => setYear(event.target.value)}>
                    {years.map((value) => <option key={value}>{value}</option>)}
                  </select>
                </label>
              )}
            </form>
            <Failure error={dates.error} />
            {dates.isPending && <p>Loading dates...</p>}
            {dates.isSuccess && visibleDates.length === 0 && <p>No dates to display.</p>}
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
