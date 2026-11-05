import type { components } from "./spec";

type Schemas = components["schemas"];

/**
 * Contracts the UI needs that are NOT in CalendarManagementSpec.yml. They are our proposal to the
 * backend team and are mocked until it answers. See req-details/api-spec/API_SPEC_ISSUES.md:
 * API-005 (holiday calendars), API-010 (preview), API-020 (rule catalog).
 */

export const DAY_NAMES = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

export const MONTH_CODES = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

/** GET /v1/holiday-calendars */
export type HolidayCalendarOption = { name: Schemas["HolidayCalendar"]; description: string };

export type RuleParameter =
  | { name: string; label: string; type: "INTEGER"; min: number; max: number; default: number }
  | { name: string; label: string; type: "ENUM"; options: string[]; default: string };

/** GET /v1/rules: the defined list of extended rules and the inputs each one takes. */
export type RuleDefinition = {
  ruleType: Schemas["DateRuleType"];
  frequency: "MONTHLY" | "QUARTERLY" | "YEARLY";
  description: string;
  parameters: RuleParameter[];
};

/** POST /v1/calendars/preview: stateless, writes nothing. Mirrors the calendar write fields. */
export type CalendarPreviewRequest = {
  year: number;
  holidayCalendar: Schemas["HolidayCalendar"];
  holidayRun?: Schemas["HolidayRun"];
  holidayOffset?: Schemas["HolidayOffset"];
  dateRuleType?: Schemas["DateRuleType"];
  dayOfWeek?: Schemas["DayOfWeek"][];
  runDate?: Schemas["RunDate"];
  runDay?: Schemas["RunDay"];
};

export type CalendarPreviewResponse = {
  year: number;
  dates: string[];
  holidays: Array<{ date: string; name: string }>;
};
