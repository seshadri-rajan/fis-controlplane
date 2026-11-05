import { DAY_NAMES, MONTH_CODES } from "../../lib/api/proposed";
import type {
  CalendarPreviewRequest,
  RuleDefinition,
  RuleParameter,
} from "../../lib/api/proposed";
import type { SpecCalendarCreate } from "../../lib/api/client";

export const CALENDAR_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export type CalendarKind = "business_days" | "extended_rule";

export type FormState = {
  name: string;
  kind: CalendarKind;
  year: number;
  /** Monday = 0 … Sunday = 6. */
  weekdays: number[];
  /** Empty until the user picks; the first rule in the catalog applies meanwhile. */
  ruleType: string;
  /** Values by parameter name (DAY, MONTH); missing entries fall back to the rule's defaults. */
  params: Record<string, string>;
  holidayCalendar: string;
  holidayRun: boolean;
  holidayOffset: number;
};

export const INITIAL: FormState = {
  name: "",
  kind: "business_days",
  year: 2027,
  weekdays: [0, 1, 2, 3, 4],
  ruleType: "",
  params: {},
  holidayCalendar: "",
  holidayRun: true,
  holidayOffset: 1,
};

export function defaultParams(rule: RuleDefinition | undefined): Record<string, string> {
  return Object.fromEntries((rule?.parameters ?? []).map((p) => [p.name, String(p.default)]));
}

export function paramError(parameter: RuleParameter, value: string | undefined): string | null {
  if (parameter.type === "ENUM") {
    return parameter.options.includes(value ?? "") ? null : `${parameter.label} is required.`;
  }
  const number = Number(value);
  const valid = !!value?.trim() && Number.isInteger(number);
  return valid && number >= parameter.min && number <= parameter.max
    ? null
    : `${parameter.label} must be a whole number from ${parameter.min} to ${parameter.max}.`;
}

const twoDigits = (value: string | number) => String(Number(value)).padStart(2, "0");

/** Maps the form onto the calendar write fields the spec defines (plus the proposed `year`). */
export function previewRequestOf(
  state: FormState,
  rule: RuleDefinition | undefined,
  params: Record<string, string>,
): CalendarPreviewRequest {
  const request: CalendarPreviewRequest = {
    year: state.year,
    holidayCalendar: state.holidayCalendar,
    holidayRun: state.holidayRun,
    ...(state.holidayRun ? { holidayOffset: state.holidayOffset } : {}),
  };

  if (state.kind === "business_days" || !rule) {
    return { ...request, dayOfWeek: state.weekdays.map((index) => DAY_NAMES[index]) };
  }

  request.dateRuleType = rule.ruleType;
  if (rule.parameters.some((p) => p.name === "MONTH")) {
    // The spec describes runDate only as "fixed day and month" with example '01-01': DD-MM assumed.
    request.runDate = `${twoDigits(params.DAY)}-${twoDigits(MONTH_CODES.indexOf(params.MONTH) + 1)}`;
  } else {
    request.runDay = String(Number(params.DAY));
  }
  return request;
}

export function createRequestOf(
  state: FormState,
  rule: RuleDefinition | undefined,
  params: Record<string, string>,
  dates: string[],
): SpecCalendarCreate {
  const { year, ...fields } = previewRequestOf(state, rule, params);
  void year;
  return { calendarName: state.name.trim(), dates, ...fields };
}
