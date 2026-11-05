import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";

import { createSpecCalendar, listRuleCatalog, previewCalendar } from "../../lib/api/client";
import type { ApiError, SpecCalendar } from "../../lib/api/client";
import { useAuth } from "../auth/AuthProvider";
import CalendarForm from "./CalendarForm";
import {
  CALENDAR_NAME,
  INITIAL,
  createRequestOf,
  defaultParams,
  paramError,
  previewRequestOf,
} from "./calendarFormModel";
import type { FormState } from "./calendarFormModel";
import MonthGrid, { Legend } from "./MonthGrid";
import UploadCalendarPanel from "./UploadCalendarPanel";

export default function CreateCalendarPage() {
  const [mode, setMode] = useState<"rules" | "upload">("rules");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Create a calendar</h1>
        <div role="group" aria-label="Creation method" className="flex gap-1 rounded-lg bg-slate-200 p-1">
          {(
            [
              ["rules", "Define by rules"],
              ["upload", "Upload file"],
            ] as const
          ).map(([value, text]) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                mode === value ? "bg-white shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {text}
            </button>
          ))}
        </div>
      </div>

      {mode === "rules" ? <RuleBasedCreate /> : <UploadCalendarPanel />}
    </div>
  );
}

function RuleBasedCreate() {
  const [state, setState] = useState<FormState>(INITIAL);
  const [saved, setSaved] = useState<SpecCalendar | null>(null);
  const { user, has } = useAuth();
  const queryClient = useQueryClient();

  const catalog = useQuery({ queryKey: ["rule-catalog"], queryFn: listRuleCatalog });
  const rule = catalog.data?.find((r) => r.ruleType === state.ruleType) ?? catalog.data?.[0];
  const params = { ...defaultParams(rule), ...state.params };

  const problems =
    state.kind === "extended_rule"
      ? (rule?.parameters ?? []).flatMap((p) => paramError(p, params[p.name]) ?? [])
      : [];
  const inputsReady =
    state.kind === "business_days" ? state.weekdays.length > 0 : !!rule && problems.length === 0;
  const yearValid = Number.isInteger(state.year) && state.year >= 2000 && state.year <= 2100;
  const enabled = inputsReady && state.holidayCalendar !== "" && yearValid;

  const request = previewRequestOf(state, rule, params);
  const preview = useQuery({
    queryKey: ["calendar-preview", request],
    queryFn: () => previewCalendar(request),
    enabled,
  });

  const save = useMutation({
    mutationFn: () => createSpecCalendar(createRequestOf(state, rule, params, preview.data!.dates)),
    onSuccess: (created) => {
      setSaved(created);
      queryClient.invalidateQueries({ queryKey: ["calendars"] });
    },
  });

  const holidayNames = new Map((preview.data?.holidays ?? []).map((h) => [h.date, h.name]));
  const gridDates = (preview.data?.dates ?? []).map((day) => ({
    day,
    reason: "",
    shifted_from: null,
  }));

  const canCreate = has("EDITOR");
  const named = CALENDAR_NAME.test(state.name.trim());
  const ready = canCreate && named && !!preview.data && !preview.isFetching && !saved;

  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm text-slate-600">
        Pick a rule and a holiday calendar to see the dates it generates. Nothing is saved until you
        create it, and only the selected year is generated.
      </p>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-3">
          <CalendarForm
            state={state}
            rules={catalog.data ?? []}
            rule={rule}
            params={params}
            onChange={(next) => {
              setState(next);
              setSaved(null);
              save.reset();
            }}
          />

          <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
            {user && !canCreate && (
              <p className="text-sm text-slate-600">
                Your roles ({user.roles.join(", ")}) do not include EDITOR, so this cannot be
                saved.
              </p>
            )}

            {canCreate && (
              <>
                <button
                  type="button"
                  disabled={!ready || save.isPending}
                  onClick={() => save.mutate()}
                  className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
                >
                  {save.isPending ? "Creating…" : "Create calendar"}
                </button>
                {!named && (
                  <p className="text-xs text-slate-500">
                    {state.name.trim() === ""
                      ? "Give the calendar a name first."
                      : "Fix the calendar name first."}
                  </p>
                )}
              </>
            )}

            {save.isError && (
              <p role="alert" className="rounded-md bg-rose-50 p-2 text-sm text-rose-800">
                {(save.error as ApiError).status === 409
                  ? `A calendar named "${state.name.trim()}" already exists.`
                  : (save.error as Error).message}
              </p>
            )}

            {saved && (
              <p className="rounded-md bg-emerald-50 p-2 text-sm text-emerald-900">
                Created <strong>{saved.calendarName}</strong> with {saved.dates?.length ?? 0} dates.{" "}
                <Link to="/calendars" className="underline">
                  View calendars
                </Link>
              </p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {state.kind === "business_days" && state.weekdays.length === 0 && (
            <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
              Select at least one business day.
            </p>
          )}

          {problems.length > 0 && (
            <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">{problems[0]}</p>
          )}

          {inputsReady && state.holidayCalendar === "" && (
            <p className="rounded-md bg-slate-100 p-3 text-sm text-slate-600">
              Choose a holiday calendar to see the preview.
            </p>
          )}

          {!yearValid && (
            <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
              Year must be between 2000 and 2100.
            </p>
          )}

          {preview.isError && (
            <p role="alert" className="rounded-md bg-rose-50 p-3 text-sm text-rose-800">
              {(preview.error as Error).message}
            </p>
          )}

          {preview.data && (
            <>
              <div className="flex flex-wrap items-center gap-6 rounded-lg border border-slate-200 bg-white px-4 py-3">
                <Stat label="Run days" value={preview.data.dates.length} />
                <Stat label="Holidays" value={preview.data.holidays.length} />
                <Stat label="Year" value={preview.data.year} />
                <div className="ml-auto">
                  <Legend
                    items={[
                      ["bg-emerald-500", "Scheduled run"],
                      ["bg-rose-100 border border-rose-300", "Holiday"],
                    ]}
                  />
                </div>
              </div>

              <MonthGrid year={preview.data.year} dates={gridDates} holidays={holidayNames} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
