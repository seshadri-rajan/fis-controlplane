import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createSpecCalendar,
  getCalendar,
  listMigratedCalendars,
  listUploadedCalendars,
  toWriteRequest,
  updateCalendar,
  uploadCalendarDates,
} from "../../lib/api/client";
import type { ApiError, SpecCalendar } from "../../lib/api/client";
import { MAX_UPLOAD_BYTES, datesCsv, parseDatesCsv, sampleCsv } from "../../lib/api/parseDatesCsv";
import type { ParsedDates } from "../../lib/api/parseDatesCsv";
import { isActive } from "../../lib/api/proposed";
import { isPastDate, todayIso } from "../../lib/dates";
import { useAuth } from "../auth/AuthProvider";
import { useTabs } from "../navigation/TabsProvider";
import { CALENDAR_NAME } from "./calendarFormModel";
import { field, label } from "./formStyles";
import MonthGrid, { Legend } from "./MonthGrid";

type Mode = "new" | "upload";

// The spec requires holidayCalendar on create, but uploaded calendars carry none by design
// (review decision). Sent empty until the backend answers (API-005 in req-details/api-spec).
const NO_HOLIDAY_CALENDAR = "";

function downloadSample(year: number) {
  const url = URL.createObjectURL(new Blob([sampleCsv(year)], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `sample-calendar-dates-${year}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function readFile(file: File): Promise<ParsedDates> {
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return {
      dates: [],
      errors: [
        "Only CSV files are supported. Export the sheet as CSV (UTF-8) with a single column headed date.",
      ],
    };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { dates: [], errors: ["The file exceeds the 5 MiB limit."] };
  }
  return parseDatesCsv(await file.text());
}

function RadioGroup<T extends string>({
  legend,
  name,
  options,
  value,
  disabled = false,
  onChange,
}: {
  legend: string;
  name: string;
  options: ReadonlyArray<readonly [T, string]>;
  value: T;
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className={label}>{legend}</legend>
      <div className="flex flex-wrap gap-4 text-sm">
        {options.map(([optionValue, text]) => (
          <label key={optionValue} className="flex items-center gap-1.5">
            <input
              type="radio"
              name={name}
              value={optionValue}
              checked={value === optionValue}
              disabled={disabled}
              onChange={() => onChange(optionValue)}
            />
            {text}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

type SaveResult = { calendar: SpecCalendar; added: number; removed: number };

/**
 * Shared by Create (New calendar / Upload dates) and Amend. With `amend` the calendar is fixed,
 * a file is optional, and the grid starts from the calendar's own dates.
 */
export default function UploadCalendarPanel({ amend }: { amend?: SpecCalendar }) {
  const { user, has } = useAuth();
  const { setTab } = useTabs();
  const queryClient = useQueryClient();
  const isAmend = amend !== undefined;

  const [mode, setMode] = useState<Mode>(isAmend ? "upload" : "new");
  const [name, setName] = useState("");
  const [selectedName, setSelectedName] = useState(amend?.calendarName ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedDates | null>(null);
  const thisYear = new Date().getFullYear();
  // Fixed when the page opens: a tab left open past midnight keeps one consistent "today".
  const [today] = useState(todayIso);
  // Amend can reach any year the calendar already holds, but history (before this year) is locked.
  const yearOptions = useMemo(() => {
    const held = (amend?.dates ?? []).map((d) => Number(d.slice(0, 4))).filter((y) => y >= thisYear);
    return [...new Set([thisYear, thisYear + 1, ...held])].sort();
  }, [amend, thisYear]);
  const [year, setYear] = useState(thisYear);
  // Set once the calendar exists, so a retry after a failed upload does not create it twice.
  const [createdName, setCreatedName] = useState<string | null>(null);
  const [saved, setSaved] = useState<SpecCalendar | null>(null);
  const [summary, setSummary] = useState<{ added: number; removed: number } | null>(null);
  // Bumped to remount the uncontrolled file input, which otherwise keeps showing the old file.
  const [fileInputKey, setFileInputKey] = useState(0);

  const canWrite = has("EDITOR");
  // An existing calendar's past dates are history; a brand-new calendar has none to protect.
  const lockedBefore = mode === "upload" ? today : undefined;

  // One list for "Upload dates": calendars created by upload, plus the migrated ones. Inactive
  // calendars can't be changed, so they are left out and only counted.
  const targets = useQuery({
    queryKey: ["calendars", "upload-targets"],
    queryFn: async () => {
      const [existing, migrated] = await Promise.all([
        listUploadedCalendars(),
        listMigratedCalendars(),
      ]);
      return {
        existing: existing.filter(isActive),
        migrated: migrated.filter(isActive),
        inactiveCount: [...existing, ...migrated].filter((c) => !isActive(c)).length,
      };
    },
    enabled: !!user && canWrite && mode === "upload" && !isAmend,
  });
  const selected = isAmend
    ? amend
    : [...(targets.data?.existing ?? []), ...(targets.data?.migrated ?? [])].find(
        (c) => c.calendarName === selectedName,
      );

  // Only the selected year is shown and saved; dates the file holds for other years are ignored.
  const yearDates = useMemo(
    () => (parsed?.dates ?? []).filter((d) => d.startsWith(`${year}-`)),
    [parsed, year],
  );
  const ignoredCount = (parsed?.dates.length ?? 0) - yearDates.length;

  // "Upload dates" only: the target calendar's own dates for the selected year — the set that
  // today's plain replace silently destroys, and what a merge-by-default needs to preserve.
  const existingYearDates = useMemo(
    () => (selected?.dates ?? []).filter((d) => d.startsWith(`${year}-`)),
    [selected, year],
  );
  const existingDates = useMemo(() => new Set(existingYearDates), [existingYearDates]);

  // The user-adjusted date set that actually gets saved. "New calendar" seeds from the file alone;
  // "Upload dates" and Amend seed from the target's own dates for the year plus the file's dates
  // that are still editable (merge by default), and re-seed whenever the file, year, mode, or
  // target changes. File dates in the past are dropped: history can't be added to.
  const [included, setIncluded] = useState<Set<string>>(new Set());
  useEffect(() => {
    const fileYearDates = (parsed?.dates ?? []).filter((d) => d.startsWith(`${year}-`));
    const base =
      mode === "upload"
        ? [
            ...fileYearDates.filter((d) => !isPastDate(d, today)),
            ...(selected?.dates ?? []).filter((d) => d.startsWith(`${year}-`)),
          ]
        : fileYearDates;
    setIncluded(new Set(base));
  }, [parsed, year, mode, selected, today]);
  const fileDates = useMemo(() => new Set(yearDates), [yearDates]);
  const excludedCount = yearDates.filter((d) => !included.has(d)).length;
  const ignoredPastCount =
    mode === "upload" ? yearDates.filter((d) => isPastDate(d, today)).length : 0;
  const atRiskCount = existingYearDates.filter((d) => !included.has(d)).length;
  const addedCount = [...included].filter((d) => !existingDates.has(d)).length;
  const isAtFileDefault = included.size === fileDates.size && yearDates.every((d) => included.has(d));
  const isAtExistingDefault =
    included.size === existingDates.size && existingYearDates.every((d) => included.has(d));

  function toggleDate(iso: string) {
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(iso)) next.delete(iso);
      else next.add(iso);
      return next;
    });
  }

  const save = useMutation({
    mutationFn: async (): Promise<SaveResult> => {
      if (mode === "upload") {
        // Read the calendar now, not a cached copy: the spec's update replaces every date and
        // field, so the other years, the past, and its rule fields must be sent back unchanged.
        const fresh = await getCalendar(selectedName);
        if (!isActive(fresh)) {
          throw new Error("This calendar is inactive. Ask an admin to activate it first.");
        }
        const freshYear = (fresh.dates ?? []).filter((d) => d.startsWith(`${year}-`));
        const editable = [...included].filter((d) => !isPastDate(d, today));
        const kept = (fresh.dates ?? []).filter(
          (d) => isPastDate(d, today) || !d.startsWith(`${year}-`),
        );
        const dates = [...new Set([...kept, ...editable])].sort();
        const calendar = await updateCalendar(selectedName, toWriteRequest(fresh, dates));
        return {
          calendar,
          added: editable.filter((d) => !freshYear.includes(d)).length,
          removed: freshYear.filter((d) => !isPastDate(d, today) && !included.has(d)).length,
        };
      }

      if (!file) throw new Error("No file selected");
      const newName = name.trim();
      if (createdName !== newName) {
        await createSpecCalendar({
          calendarName: newName,
          dates: [],
          holidayCalendar: NO_HOLIDAY_CALENDAR,
        });
        setCreatedName(newName);
      }
      const csv = new File([datesCsv([...included].sort())], `calendar-dates-${year}.csv`, {
        type: "text/csv",
      });
      return { calendar: await uploadCalendarDates(newName, csv), added: included.size, removed: 0 };
    },
    onSuccess: ({ calendar, added, removed }) => {
      setSaved(calendar);
      setSummary({ added, removed });
      queryClient.invalidateQueries({ queryKey: ["calendars"] });
    },
  });

  function resetOutcome() {
    setSaved(null);
    setSummary(null);
    save.reset();
  }

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    resetOutcome();
    const chosen = event.target.files?.[0] ?? null;
    setFile(chosen);
    setParsed(chosen ? await readFile(chosen) : null);
  }

  function clearFile() {
    setFile(null);
    setParsed(null);
    setFileInputKey((key) => key + 1);
    resetOutcome();
  }

  function startOver() {
    setName("");
    setSelectedName("");
    setCreatedName(null);
    clearFile();
  }

  const nameValid = CALENDAR_NAME.test(name.trim());
  const targetReady = mode === "new" ? nameValid : selectedName !== "";
  const fileValid = !!parsed && parsed.errors.length === 0;
  const fileReady = fileValid && included.size > 0;
  // Amend has no required file: it saves whatever changed, unless a chosen file is unusable.
  const showGrid = isAmend || fileValid;
  const ready = isAmend
    ? canWrite && !saved && !isAtExistingDefault && !(parsed && parsed.errors.length > 0)
    : canWrite && targetReady && fileReady && !saved;

  const existingInYear = selected?.dates?.filter((d) => d.startsWith(`${year}-`)).length ?? 0;
  const existingOther = (selected?.dates?.length ?? 0) - existingInYear;
  const otherYears = [
    ...new Set(
      (selected?.dates ?? []).filter((d) => !d.startsWith(`${year}-`)).map((d) => d.slice(0, 4)),
    ),
  ].sort();
  const keptAfterSave = (saved?.dates?.length ?? 0) - included.size;

  if (!canWrite) {
    return (
      <p className="max-w-xl rounded-md bg-slate-100 p-3 text-sm text-slate-700">
        Your roles ({user?.roles.join(", ")}) cannot upload calendars. Uploading requires EDITOR or
        ADMIN.
      </p>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="space-y-3">
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
          {isAmend && (
            <div>
              <span className={label}>Calendar</span>
              <p className="text-sm font-medium">{amend.calendarName}</p>
            </div>
          )}

          {!isAmend && (
            <RadioGroup
              legend="Calendar type"
              name="mode"
              options={[
                ["new", "New calendar"],
                ["upload", "Upload dates"],
              ]}
              value={mode}
              disabled={!!createdName}
              onChange={(value) => {
                setMode(value);
                setSelectedName("");
                resetOutcome();
              }}
            />
          )}

          {!isAmend && mode === "new" ? (
            <div>
              <label htmlFor="calendar-name" className={label}>
                Calendar name
              </label>
              <input
                id="calendar-name"
                className={field}
                value={name}
                disabled={!!createdName}
                onChange={(e) => {
                  setName(e.target.value);
                  resetOutcome();
                }}
              />
              {name !== "" && !nameValid && (
                <p className="mt-1 text-xs text-rose-700">
                  Start with a letter or digit; use only letters, digits, “_” and “-”.
                </p>
              )}
            </div>
          ) : !isAmend ? (
            <div>
              <label htmlFor="target-calendar" className={label}>
                Calendar
              </label>
              <select
                id="target-calendar"
                className={field}
                value={selectedName}
                onChange={(e) => {
                  setSelectedName(e.target.value);
                  resetOutcome();
                }}
              >
                <option value="">{targets.isPending ? "Loading…" : "Select a calendar…"}</option>
                {!!targets.data?.existing.length && (
                  <optgroup label="Existing calendars">
                    {targets.data.existing.map((c) => (
                      <option key={c.calendarName} value={c.calendarName}>
                        {c.calendarName}
                      </option>
                    ))}
                  </optgroup>
                )}
                {!!targets.data?.migrated.length && (
                  <optgroup label="Migrated calendars">
                    {targets.data.migrated.map((c) => (
                      <option key={c.calendarName} value={c.calendarName}>
                        {c.calendarName}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              {targets.isError && (
                <p role="alert" className="mt-1 text-xs text-rose-700">
                  {(targets.error as Error).message}
                </p>
              )}
              {targets.data && !targets.data.existing.length && !targets.data.migrated.length && (
                <p className="mt-1 text-xs text-slate-500">
                  No calendars to upload to yet. Create a new calendar first.
                </p>
              )}
              {!!targets.data?.inactiveCount && (
                <p className="mt-1 text-xs text-slate-500">
                  {targets.data.inactiveCount} inactive{" "}
                  {targets.data.inactiveCount === 1 ? "calendar isn't" : "calendars aren't"} listed.
                  An admin can activate {targets.data.inactiveCount === 1 ? "it" : "them"} from the
                  Calendars tab.
                </p>
              )}
              {selected && (existingInYear > 0 || existingOther > 0) && (
                <p className="mt-1 text-xs text-amber-700">
                  {existingInYear > 0 &&
                    `It already has ${existingInYear} dates in ${year}. By default they're kept alongside the file's dates — adjust the selection below if you want to drop any. `}
                  {existingOther > 0 &&
                    `Its ${existingOther} dates in ${otherYears.join(", ")} stay as they are.`}
                </p>
              )}
            </div>
          ) : null}

          <div>
            <label htmlFor="calendar-year" className={label}>
              Calendar year
            </label>
            <select
              id="calendar-year"
              className={field}
              value={year}
              disabled={!!saved}
              onChange={(e) => {
                setYear(Number(e.target.value));
                resetOutcome();
              }}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              {isAmend
                ? "Past dates are locked. Dates in other years stay as they are."
                : "Only dates in this year are shown and saved; other years in the file are ignored."}
              {!isAmend && lockedBefore && " Past dates on an existing calendar are locked."}
            </p>
          </div>

          <div>
            <label htmlFor="calendar-file" className={label}>
              {isAmend ? "Add dates from a file (optional)" : "Dates file (CSV)"}
            </label>
            <div className="rounded-md border-2 border-dashed border-slate-300 bg-slate-50 p-3 hover:border-slate-500">
              <input
                key={fileInputKey}
                id="calendar-file"
                type="file"
                accept=".csv,text/csv"
                className="block w-full cursor-pointer text-sm text-slate-600 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700"
                onChange={onFileChange}
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              UTF-8 CSV, one column headed <code>date</code>, values as YYYY-MM-DD. Max 5 MiB.
            </p>
            <button
              type="button"
              onClick={() => downloadSample(year)}
              className="mt-2 text-xs font-medium text-slate-700 underline"
            >
              Download sample CSV
            </button>
            <p className="mt-1 text-xs text-slate-500">
              Editing in Excel? Format the date column as <code>yyyy-mm-dd</code> before saving as
              CSV UTF-8, or Excel will rewrite the dates in your regional format.
            </p>
          </div>
        </div>

        <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
          <button
            type="button"
            disabled={!ready || save.isPending}
            onClick={() => save.mutate()}
            className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {save.isPending
              ? "Saving…"
              : isAmend
                ? "Save changes"
                : mode === "new"
                  ? "Create calendar"
                  : "Upload to calendar"}
          </button>
          {mode === "upload" && !saved && (addedCount > 0 || atRiskCount > 0) && (
            <p className="text-xs font-medium text-slate-700">
              Will add {addedCount} and remove {atRiskCount} dates in {year}.
            </p>
          )}
          <p className="text-xs text-slate-500">Nothing is saved until you click this.</p>

          {save.isError && (
            <p role="alert" className="rounded-md bg-rose-50 p-2 text-sm text-rose-800">
              {mode === "new" && (save.error as ApiError).status === 409
                ? `A calendar named "${name.trim()}" already exists.`
                : createdName
                  ? `Calendar "${createdName}" was created, but the upload failed: ${(save.error as Error).message} You can retry.`
                  : (save.error as Error).message}
            </p>
          )}

          {saved && (
            <div className="space-y-2 rounded-md bg-emerald-50 p-2 text-sm text-emerald-900">
              <p>
                {isAmend ? (
                  <>
                    Saved <strong>{saved.calendarName}</strong>: {summary?.added ?? 0} added,{" "}
                    {summary?.removed ?? 0} removed in {year}.
                  </>
                ) : (
                  <>
                    Saved <strong>{saved.calendarName}</strong> with {included.size} dates for {year}
                    {keptAfterSave > 0 && `; ${keptAfterSave} dates in other years kept`}.
                  </>
                )}{" "}
                <button type="button" onClick={() => setTab("calendars")} className="underline">
                  View calendars
                </button>
              </p>
              <button type="button" onClick={isAmend ? clearFile : startOver} className="underline">
                {isAmend ? "Keep editing" : "Upload another"}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {!file && !isAmend && (
          <p className="rounded-md bg-slate-100 p-3 text-sm text-slate-600">
            Choose a CSV file to see its dates on the calendar before saving.
          </p>
        )}

        {parsed && parsed.errors.length > 0 && (
          <div role="alert" className="rounded-md bg-rose-50 p-3 text-sm text-rose-800">
            <p className="font-medium">This file can’t be used:</p>
            <ul className="mt-1 list-disc pl-5">
              {parsed.errors.slice(0, 10).map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
            {parsed.errors.length > 10 && <p className="mt-1">…and {parsed.errors.length - 10} more.</p>}
          </div>
        )}

        {fileValid && yearDates.length === 0 && (
          <p role="alert" className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
            The file has no dates in {year}. It has {parsed.dates.length} in other years; choose
            the year they belong to.
            {mode === "new" && " You can still pick dates manually on the calendar below."}
          </p>
        )}

        {showGrid && (
          <>
            <div className="flex flex-wrap items-center gap-6 rounded-lg border border-slate-200 bg-white px-4 py-3">
              {isAmend ? (
                <>
                  <Stat label="On calendar" value={existingYearDates.length} />
                  <Stat label="Selected" value={included.size} />
                  <Stat label="Added" value={addedCount} />
                  <Stat label="Removed" value={atRiskCount} />
                </>
              ) : (
                <>
                  <Stat label="Dates in file" value={yearDates.length} />
                  <Stat label="Selected" value={included.size} />
                  <Stat label="Excluded" value={excludedCount} />
                  {mode === "upload" && <Stat label="On calendar" value={atRiskCount} />}
                </>
              )}
              <Stat label="Year" value={year} />
              {!saved && (
                <button
                  type="button"
                  disabled={mode === "upload" ? isAtExistingDefault : isAtFileDefault}
                  onClick={() => setIncluded(new Set(mode === "upload" ? existingDates : fileDates))}
                  className="ml-auto rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
                >
                  {mode === "upload" ? "Reset to calendar's current dates" : "Reset exclusions"}
                </button>
              )}
            </div>

            {ignoredCount > 0 && (
              <p className="rounded-md bg-slate-100 p-3 text-sm text-slate-600">
                {ignoredCount} {ignoredCount === 1 ? "date" : "dates"} in other years{" "}
                {ignoredCount === 1 ? "is" : "are"} ignored and will not be saved.
              </p>
            )}

            {ignoredPastCount > 0 && (
              <p className="rounded-md bg-slate-100 p-3 text-sm text-slate-600">
                {ignoredPastCount} {ignoredPastCount === 1 ? "date" : "dates"} in the file{" "}
                {ignoredPastCount === 1 ? "is" : "are"} before today. Past dates can’t be changed, so{" "}
                {ignoredPastCount === 1 ? "it was" : "they were"} left out.
              </p>
            )}

            {mode === "upload" ? (
              <div className="space-y-1">
                <Legend
                  items={
                    isAmend
                      ? [
                          ["bg-amber-500", "On calendar"],
                          ["bg-emerald-500", "Added"],
                          ["bg-violet-500", "In file and on calendar"],
                          ["bg-slate-300", "Past, locked"],
                        ]
                      : [
                          ["bg-emerald-500", "From file"],
                          ["bg-amber-500", "On calendar only"],
                          ["bg-violet-500", "In both"],
                          ["bg-slate-300", "Past, locked"],
                        ]
                  }
                />
                <p className="text-xs text-slate-500">Marked with ✕ = currently excluded</p>
              </div>
            ) : (
              <Legend
                items={[
                  ["bg-emerald-500", "Included"],
                  ["bg-slate-200", "Excluded"],
                ]}
              />
            )}

            <MonthGrid
              year={year}
              included={!saved ? included : undefined}
              fileDates={!saved ? fileDates : undefined}
              existingDates={!saved && mode === "upload" ? existingDates : undefined}
              onToggleDate={!saved ? toggleDate : undefined}
              lockedBefore={lockedBefore}
              dates={
                saved
                  ? (saved.dates ?? []).map((day) => ({ day, reason: "Saved", shifted_from: null }))
                  : undefined
              }
            />
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label: text, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{text}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
