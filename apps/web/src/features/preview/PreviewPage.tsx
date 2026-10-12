import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchPreview, listRules } from "../../lib/api/client";
import type { PreviewRequest } from "../../lib/api/client";
import CalendarForm, { parseHolidays } from "./CalendarForm";
import type { FormState } from "./CalendarForm";
import MonthGrid, { Legend } from "./MonthGrid";

const INITIAL: FormState = {
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

function toRequest(state: FormState): PreviewRequest {
  return {
    name: state.kind === "business_days" ? "business-days" : state.ruleName,
    year: state.year,
    business_days: state.kind === "business_days" ? state.weekdays : null,
    extended_rule:
      state.kind === "extended_rule"
        ? {
            rule_name: state.ruleName,
            params: state.ruleName === "DAY_OF_MONTH" ? { day: state.ruleDay } : {},
          }
        : null,
    policies: {
      holiday: state.holiday,
      collision: state.collision,
      boundary: state.boundary,
    },
    holidays: parseHolidays(state.holidaysText),
  };
}

export default function PreviewPage() {
  const [state, setState] = useState<FormState>(INITIAL);

  const rules = useQuery({ queryKey: ["rules"], queryFn: listRules });

  const request = useMemo(() => toRequest(state), [state]);
  const enabled = state.kind === "extended_rule" || state.weekdays.length > 0;

  const preview = useQuery({
    queryKey: ["preview", request],
    queryFn: () => fetchPreview(request),
    enabled,
  });

  const holidayNames = useMemo(
    () => new Map(parseHolidays(state.holidaysText).map((h) => [h.day, h.name])),
    [state.holidaysText],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Calendar preview</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Generated dates for a calendar, before anything is saved. Change a policy below and the
          grid updates — the point is to make the undecided rule semantics visible so they can be
          ruled on from output rather than prose.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div>
          <CalendarForm state={state} rules={rules.data ?? []} onChange={setState} />
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
