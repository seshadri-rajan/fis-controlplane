import { DAY_NAMES } from "../../lib/api/proposed";
import type { RuleDefinition } from "../../lib/api/proposed";
import { CALENDAR_NAME, defaultParams, paramError } from "./calendarFormModel";
import type { CalendarKind, FormState } from "./calendarFormModel";
import { field, label } from "./formStyles";
import HolidayCalendarSelect from "./HolidayCalendarSelect";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const FREQUENCY_LABEL = { MONTHLY: "Monthly", QUARTERLY: "Quarterly", YEARLY: "Yearly" };

export default function CalendarForm({
  state,
  rules,
  rule,
  params,
  onChange,
}: {
  state: FormState;
  rules: RuleDefinition[];
  /** The rule in effect: the user's pick, or the first catalog entry until they choose. */
  rule: RuleDefinition | undefined;
  /** Parameter values in effect: the user's edits over the rule's defaults. */
  params: Record<string, string>;
  onChange: (next: FormState) => void;
}) {
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    onChange({ ...state, [key]: value });

  const toggleWeekday = (index: number) =>
    set(
      "weekdays",
      state.weekdays.includes(index)
        ? state.weekdays.filter((d) => d !== index)
        : [...state.weekdays, index].sort((a, b) => a - b),
    );

  const selectRule = (ruleType: string) =>
    onChange({ ...state, ruleType, params: defaultParams(rules.find((r) => r.ruleType === ruleType)) });

  // Pin the rule in effect too, so an edit made before choosing one is not lost to a later default.
  const setParam = (name: string, value: string) =>
    onChange({ ...state, ruleType: rule?.ruleType ?? "", params: { ...params, [name]: value } });

  const nameInvalid = state.name !== "" && !CALENDAR_NAME.test(state.name.trim());

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div>
        <label className={label} htmlFor="calendarName">
          Calendar name
        </label>
        <input
          id="calendarName"
          className={field}
          placeholder="US_Business_Days"
          value={state.name}
          onChange={(e) => set("name", e.target.value)}
        />
        {nameInvalid && (
          <p className="mt-1 text-xs text-rose-700">
            Start with a letter or digit; use only letters, digits, “_” and “-”.
          </p>
        )}
      </div>

      <div>
        <span className={label}>Calendar type</span>
        <div className="flex gap-2">
          {(["business_days", "extended_rule"] as CalendarKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              aria-pressed={state.kind === kind}
              onClick={() => set("kind", kind)}
              className={`rounded-md px-3 py-1.5 text-sm ${
                state.kind === kind
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 text-slate-700"
              }`}
            >
              {kind === "business_days" ? "Business days" : "Extended rule"}
            </button>
          ))}
        </div>
      </div>

      {state.kind === "business_days" ? (
        <div>
          <span className={label}>Business days</span>
          <div className="flex flex-wrap gap-1">
            {WEEKDAY_LABELS.map((text, index) => (
              <button
                key={DAY_NAMES[index]}
                type="button"
                aria-pressed={state.weekdays.includes(index)}
                onClick={() => toggleWeekday(index)}
                className={`rounded-md px-2.5 py-1 text-xs ${
                  state.weekdays.includes(index)
                    ? "bg-emerald-600 text-white"
                    : "border border-slate-300 text-slate-600"
                }`}
              >
                {text}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div>
            <label className={label} htmlFor="rule">
              Extended rule
            </label>
            <select
              id="rule"
              className={field}
              value={rule?.ruleType ?? ""}
              onChange={(e) => selectRule(e.target.value)}
            >
              {rules.length === 0 && <option value="">Loading…</option>}
              {rules.map((item) => (
                <option key={item.ruleType} value={item.ruleType}>
                  {item.ruleType} · {FREQUENCY_LABEL[item.frequency]}
                </option>
              ))}
            </select>
            {rule && <p className="mt-1 text-xs text-slate-500">{rule.description}</p>}
          </div>

          {rule?.parameters.map((parameter) => {
            const id = `param-${parameter.name}`;
            const problem = paramError(parameter, params[parameter.name]);
            return (
              <div key={parameter.name}>
                <label className={label} htmlFor={id}>
                  {parameter.label}
                </label>
                {parameter.type === "ENUM" ? (
                  <select
                    id={id}
                    className={field}
                    value={params[parameter.name] ?? ""}
                    onChange={(e) => setParam(parameter.name, e.target.value)}
                  >
                    {parameter.options.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={id}
                    type="number"
                    min={parameter.min}
                    max={parameter.max}
                    className={field}
                    value={params[parameter.name] ?? ""}
                    onChange={(e) => setParam(parameter.name, e.target.value)}
                  />
                )}
                {problem && <p className="mt-1 text-xs text-rose-700">{problem}</p>}
              </div>
            );
          })}
        </div>
      )}

      <div>
        <label className={label} htmlFor="year">
          Year
        </label>
        <input
          id="year"
          type="number"
          min={2000}
          max={2100}
          className={field}
          value={state.year}
          onChange={(e) => set("year", Number(e.target.value))}
        />
      </div>

      <div className="space-y-2 rounded-md bg-slate-50 p-3">
        <HolidayCalendarSelect
          id="holidayCalendar"
          value={state.holidayCalendar}
          onChange={(name) => set("holidayCalendar", name)}
        />

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={state.holidayRun}
            onChange={(e) => set("holidayRun", e.target.checked)}
          />
          Take holidays into account
        </label>

        {state.holidayRun && (
          <div>
            <label className={label} htmlFor="holidayOffset">
              When a run falls on a holiday, move it by (days)
            </label>
            <input
              id="holidayOffset"
              type="number"
              className={field}
              value={state.holidayOffset}
              onChange={(e) =>
                set("holidayOffset", e.target.value === "" ? 0 : Math.trunc(Number(e.target.value)))
              }
            />
            <p className="mt-1 text-xs text-slate-500">
              −1 moves it back a day, +1 forward; 0 skips the run. Working-day rules already skip
              holidays when counting.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
