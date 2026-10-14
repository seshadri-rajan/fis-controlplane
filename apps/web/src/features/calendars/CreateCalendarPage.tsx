import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";

import { createCalendar, fetchPreview, listRules } from "../../lib/api/client";
import type {
  ApiError,
  CalendarWrite,
  MutationResult,
  PreviewRequest,
} from "../../lib/api/client";
import { useAuth } from "../auth/AuthProvider";
import CalendarForm, { parseHolidays } from "./CalendarForm";
import type { FormState } from "./CalendarForm";
import MonthGrid, { Legend } from "./MonthGrid";

const INITIAL: FormState = {
  name: "",
  description: "",
  kind: "business_days",
  year: 2027,
  weekdays: [0, 1, 2, 3, 4],
  ruleName: "LAST_BUSINESS_DAY",
  ruleDay: 15,
  holiday: "shift_forward",
  collision: "merge",
  boundary: "clamp",
  holidaysText: "2027-01-01, New Year\n2027-12-24, Christmas Eve\n2027-12-27, Christmas observed",
};

function policiesOf(state: FormState) {
  return { holiday: state.holiday, collision: state.collision, boundary: state.boundary };
}

function ruleParams(state: FormState): Record<string, number> {
  return state.ruleName === "DAY_OF_MONTH" ? { day: state.ruleDay } : {};
}

function toRequest(state: FormState): PreviewRequest {
  return {
    name: state.name.trim() || "preview",
    year: state.year,
    business_days: state.kind === "business_days" ? state.weekdays : null,
    extended_rule:
      state.kind === "extended_rule"
        ? { rule_name: state.ruleName, params: ruleParams(state) }
        : null,
    policies: policiesOf(state),
    holidays: parseHolidays(state.holidaysText),
  };
}

function toCalendarWrite(state: FormState): CalendarWrite {
  return {
    calendar_nm: state.name.trim(),
    calendar_desc: state.description.trim() || null,
    weekdays: state.kind === "business_days" ? state.weekdays : null,
    rule_name: state.kind === "extended_rule" ? state.ruleName : null,
    rule_params: state.kind === "extended_rule" ? ruleParams(state) : {},
    policies: policiesOf(state),
    // Left null on purpose: a saved calendar resolves holidays from the managed holiday
    // calendar, not from the list typed into this form.
    holiday_calendar_id: null,
    bu_id: null,
    app_id: null,
  };
}

export default function CreateCalendarPage() {
  const [state, setState] = useState<FormState>(INITIAL);
  const [result, setResult] = useState<MutationResult | null>(null);
  const { user, has } = useAuth();
  const queryClient = useQueryClient();

  const rules = useQuery({ queryKey: ["rules"], queryFn: listRules });

  const request = useMemo(() => toRequest(state), [state]);
  const enabled = state.kind === "extended_rule" || state.weekdays.length > 0;

  const preview = useQuery({
    queryKey: ["preview", request],
    queryFn: () => fetchPreview(request),
    enabled,
  });

  const save = useMutation({
    mutationFn: () => createCalendar(toCalendarWrite(state)),
    onSuccess: (created) => {
      setResult(created);
      queryClient.invalidateQueries({ queryKey: ["calendars"] });
    },
  });

  const holidayNames = useMemo(
    () => new Map(parseHolidays(state.holidaysText).map((h) => [h.day, h.name])),
    [state.holidaysText],
  );

  const canCreate = has("CREATE");
  const named = state.name.trim().length > 0;
  const ready = canCreate && named && enabled && !preview.isError;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Create a calendar</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          The grid previews the dates your definition generates. Nothing is saved until you create
          it, so this doubles as a way to settle how a rule should behave before committing to it.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-3">
          <CalendarForm
            state={state}
            rules={rules.data ?? []}
            onChange={(next) => {
              setState(next);
              setResult(null);
              save.reset();
            }}
          />

          <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
            {!user && (
              <p className="text-sm text-slate-600">
                <Link to="/calendars" className="font-medium underline">
                  Sign in
                </Link>{" "}
                to save this as a calendar. Previewing needs no account.
              </p>
            )}

            {user && !canCreate && (
              <p className="text-sm text-slate-600">
                Your roles ({user.roles.join(", ")}) do not include Create, so this cannot be
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
                {!named && <p className="text-xs text-slate-500">Give the calendar a name first.</p>}
                <p className="text-xs text-slate-500">
                  Holidays above apply to the preview only. A saved calendar resolves holidays
                  from the managed holiday calendar.
                </p>
              </>
            )}

            {save.isError && (
              <p role="alert" className="rounded-md bg-rose-50 p-2 text-sm text-rose-800">
                {(save.error as ApiError).status === 409
                  ? `A calendar named "${state.name.trim()}" already exists.`
                  : (save.error as Error).message}
              </p>
            )}

            {result && (
              <p className="rounded-md bg-emerald-50 p-2 text-sm text-emerald-900">
                {result.applied ? (
                  <>
                    Created <strong>{result.applied.calendar_nm}</strong>, dates generated.{" "}
                    <Link to="/calendars" className="underline">
                      View calendars
                    </Link>
                  </>
                ) : (
                  <>
                    Submitted for approval as change request #
                    {result.change_request.change_request_id}. It takes effect once a second
                    person approves it.
                  </>
                )}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {!enabled && (
            <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
              Select at least one business day.
            </p>
          )}

          {preview.isError && (
            <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-800">
              {(preview.error as Error).message}
            </p>
          )}

          {preview.data && (
            <>
              <div className="flex flex-wrap items-center gap-6 rounded-lg border border-slate-200 bg-white px-4 py-3">
                <Stat label="Run days" value={preview.data.total} />
                <Stat label="Shifted" value={preview.data.shifted_count} />
                <Stat label="Year" value={preview.data.year} />
                <div className="ml-auto">
                  <Legend />
                </div>
              </div>

              <MonthGrid
                year={preview.data.year}
                dates={preview.data.dates}
                holidays={holidayNames}
              />
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
