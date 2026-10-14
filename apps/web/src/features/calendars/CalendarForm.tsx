import type {
  BoundaryPolicy,
  CollisionPolicy,
  HolidayPolicy,
  RuleSummary,
  Weekday,
} from "../../lib/api/client";

export type CalendarKind = "business_days" | "extended_rule";

export type FormState = {
  name: string;
  description: string;
  kind: CalendarKind;
  year: number;
  weekdays: Weekday[];
  ruleName: string;
  ruleDay: number;
  holiday: HolidayPolicy;
  collision: CollisionPolicy;
  boundary: BoundaryPolicy;
  holidaysText: string;
};

const WEEKDAY_LABELS: Array<[Weekday, string]> = [
  [0, "Mon"],
  [1, "Tue"],
  [2, "Wed"],
  [3, "Thu"],
  [4, "Fri"],
  [5, "Sat"],
  [6, "Sun"],
];

const field = "w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm";
const label = "block text-xs font-medium text-slate-600 mb-1";

export default function CalendarForm({
  state,
  rules,
  onChange,
}: {
  state: FormState;
  rules: RuleSummary[];
  onChange: (next: FormState) => void;
}) {
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    onChange({ ...state, [key]: value });

  const toggleWeekday = (day: Weekday) =>
    set(
      "weekdays",
      state.weekdays.includes(day)
        ? state.weekdays.filter((d) => d !== day)
        : [...state.weekdays, day].sort((a, b) => a - b),
    );

  const selectedRule = rules.find((r) => r.rule_name === state.ruleName);

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
      </div>

      <div>
        <label className={label} htmlFor="calendarDesc">
          Description
        </label>
        <input
          id="calendarDesc"
          className={field}
          placeholder="Optional"
          value={state.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </div>

      <div>
        <span className={label}>Calendar type</span>
        <div className="flex gap-2">
          {(["business_days", "extended_rule"] as CalendarKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
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
        <p className="mt-1 text-xs text-slate-500">
          Mutually exclusive, enforced by the engine rather than only the UI.
        </p>
      </div>

      {state.kind === "business_days" ? (
        <div>
          <span className={label}>Business days</span>
          <div className="flex flex-wrap gap-1">
            {WEEKDAY_LABELS.map(([day, text]) => (
              <button
                key={day}
                type="button"
                onClick={() => toggleWeekday(day)}
                className={`rounded-md px-2.5 py-1 text-xs ${
                  state.weekdays.includes(day)
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
              value={state.ruleName}
              onChange={(e) => set("ruleName", e.target.value)}
            >
              {rules.map((rule) => (
                <option key={rule.rule_name} value={rule.rule_name}>
                  {rule.rule_name}
                </option>
              ))}
            </select>
            {selectedRule && (
              <p className="mt-1 text-xs text-slate-500">{selectedRule.description}</p>
            )}
          </div>

          {state.ruleName === "DAY_OF_MONTH" && (
            <div>
              <label className={label} htmlFor="ruleDay">
                Day of month
              </label>
              <input
                id="ruleDay"
                type="number"
                min={1}
                max={31}
                className={field}
                value={state.ruleDay}
                onChange={(e) => set("ruleDay", Number(e.target.value))}
              />
            </div>
          )}
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

      <fieldset className="space-y-2 rounded-md bg-slate-50 p-3">
        <legend className="px-1 text-xs font-semibold text-slate-600">
          Unresolved semantics
        </legend>

        <div>
          <label className={label} htmlFor="holidayPolicy">
            On a holiday
          </label>
          <select
            id="holidayPolicy"
            className={field}
            value={state.holiday}
            onChange={(e) => set("holiday", e.target.value as HolidayPolicy)}
          >
            <option value="shift_forward">Shift forward</option>
            <option value="shift_backward">Shift backward</option>
            <option value="skip">Skip the run</option>
          </select>
        </div>

        <div>
          <label className={label} htmlFor="collisionPolicy">
            O-06 — shifted onto an existing run
          </label>
          <select
            id="collisionPolicy"
            className={field}
            value={state.collision}
            onChange={(e) => set("collision", e.target.value as CollisionPolicy)}
          >
            <option value="merge">Merge into one run</option>
            <option value="shift_again">Shift again, keep both</option>
          </select>
        </div>

        <div>
          <label className={label} htmlFor="boundaryPolicy">
            O-07 — shift leaves the period
          </label>
          <select
            id="boundaryPolicy"
            className={field}
            value={state.boundary}
            onChange={(e) => set("boundary", e.target.value as BoundaryPolicy)}
          >
            <option value="clamp">Clamp inside the month</option>
            <option value="allow_overflow">Allow overflow</option>
          </select>
        </div>
      </fieldset>

      <div>
        <label className={label} htmlFor="holidays">
          Holidays — one per line, <code>YYYY-MM-DD[, name]</code>
        </label>
        <textarea
          id="holidays"
          rows={5}
          className={`${field} font-mono text-xs`}
          value={state.holidaysText}
          onChange={(e) => set("holidaysText", e.target.value)}
        />
        <p className="mt-1 text-xs text-slate-500">
          Supplied per request; the preview is stateless and needs no database.
        </p>
      </div>
    </div>
  );
}

export function parseHolidays(text: string): Array<{ day: string; name: string }> {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [day, ...rest] = line.split(",");
      return { day: day.trim(), name: rest.join(",").trim() };
    })
    .filter((h) => /^\d{4}-\d{2}-\d{2}$/.test(h.day));
}
