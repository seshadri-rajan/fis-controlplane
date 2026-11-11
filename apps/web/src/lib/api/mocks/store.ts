import { DAY_NAMES } from "../proposed";
import type { CalendarPreviewRequest, CalendarStatusFields } from "../proposed";
import type { components } from "../spec";
import { generatePreview } from "./ruleEngine";

type Calendar = components["schemas"]["Calendar"] & CalendarStatusFields;
type Rule = Omit<CalendarPreviewRequest, "year">;

// Bumped when the demo data changes, so a tab that kept an older copy picks up the new seed.
const STORE_KEY = "msw-mock-calendars-v3";

const thisYear = new Date().getFullYear();
const WEEKDAYS = DAY_NAMES.slice(0, 5);

/** Dates for the current and next year, the same two years the Upload screen offers. */
const datesFor = (rule: Rule) =>
  [thisYear, thisYear + 1].flatMap((year) => generatePreview({ ...rule, year }).dates);

/** The last date in each month, for a month-end style calendar. */
function lastOfEachMonth(dates: string[]): string[] {
  const byMonth = new Map<string, string>();
  for (const date of [...dates].sort()) byMonth.set(date.slice(0, 7), date);
  return [...byMonth.values()];
}

// Always in the past, whatever today's date is.
const at = (monthsAgo: number, day: number) =>
  new Date(Date.UTC(thisYear - 1, 11 - monthsAgo, day, 9, 30)).toISOString();

type Origin = { createdBy: string; createdAt: string; updatedAt?: string };

/** Created in the UI from a rule or weekdays. */
const fromRule = (calendarName: string, rule: Rule, origin: Origin): Calendar => ({
  calendarName,
  dates: datesFor(rule),
  ...rule,
  migrated: false,
  uploaded: false,
  createdBy: origin.createdBy,
  createdAt: origin.createdAt,
  updatedAt: origin.updatedAt ?? origin.createdAt,
});

/** Created by uploading a file: dates only, no rule and no holiday calendar. */
const fromUpload = (calendarName: string, dates: string[], origin: Origin): Calendar => ({
  calendarName,
  dates,
  holidayCalendar: "",
  migrated: false,
  uploaded: true,
  createdBy: origin.createdBy,
  createdAt: origin.createdAt,
  updatedAt: origin.updatedAt ?? origin.createdAt,
});

/** Imported from Autosys. */
const fromAutosys = (calendarName: string, dates: string[], rule: Rule): Calendar => ({
  calendarName,
  dates,
  ...rule,
  migrated: true,
  uploaded: false,
  createdBy: "migration",
  createdAt: at(8, 15),
  updatedAt: at(8, 15),
});

const nyseWeekdays: Rule = {
  dayOfWeek: WEEKDAYS,
  holidayCalendar: "NYSE",
  holidayRun: true,
  holidayOffset: 1,
};
const ukWeekdays: Rule = { ...nyseWeekdays, holidayCalendar: "UK_LSE" };
// Month-end dates follow no rule the spec can express, so this calendar carries dates only.
const monthEnd: Rule = { holidayCalendar: "NYSE", holidayRun: true, holidayOffset: -1 };

const SEED: Calendar[] = [
  fromRule("NYSE-Trading-Days", nyseWeekdays, {
    createdBy: "admin",
    createdAt: at(7, 12),
  }),
  fromRule(
    "Payroll-10th-Working-Day",
    {
      dateRuleType: "WORKING_DAY",
      runDay: "10",
      holidayCalendar: "NYSE",
      holidayRun: true,
      holidayOffset: 1,
    },
    { createdBy: "admin", createdAt: at(6, 3), updatedAt: at(2, 18) },
  ),
  fromRule(
    "Quarter-Start-Reporting",
    {
      dateRuleType: "QUARTER_START_WORKING_DAY",
      runDay: "10",
      holidayCalendar: "NYSE",
      holidayRun: true,
      holidayOffset: 1,
    },
    { createdBy: "editor1", createdAt: at(5, 21) },
  ),
  fromRule(
    "Quarter-End-Close",
    {
      dateRuleType: "QUARTER_END_WORKING_DAY",
      runDay: "3",
      holidayCalendar: "NYSE",
      holidayRun: true,
      holidayOffset: -1,
    },
    { createdBy: "editor1", createdAt: at(4, 9), updatedAt: at(1, 27) },
  ),
  fromRule(
    "Statement-Day-8",
    {
      dateRuleType: "CALENDAR_DAY",
      runDay: "8",
      holidayCalendar: "CANADA",
      holidayRun: true,
      holidayOffset: 1,
    },
    { createdBy: "editor1", createdAt: at(4, 30) },
  ),
  fromRule(
    "Fiscal-Year-Start",
    {
      dateRuleType: "FIXED_DATE_YEARLY",
      runDate: "01-04",
      holidayCalendar: "UK_LSE",
      holidayRun: true,
      holidayOffset: 1,
    },
    { createdBy: "admin", createdAt: at(3, 5) },
  ),
  fromUpload(
    "Vendor-Payment-Dates",
    datesFor({ dateRuleType: "CALENDAR_DAY", runDay: "15", holidayCalendar: "NYSE" }),
    { createdBy: "editor1", createdAt: at(3, 17), updatedAt: at(0, 4) },
  ),
  fromUpload(
    "Regional-Cutoff-Dates",
    datesFor({ ...nyseWeekdays, dateRuleType: "WORKING_DAY", runDay: "5", dayOfWeek: undefined }),
    { createdBy: "admin", createdAt: at(2, 8) },
  ),
  // Inactive on purpose: shows the badge, and that it cannot be amended or uploaded to.
  {
    ...fromUpload("Legacy-Month-End", lastOfEachMonth(datesFor(nyseWeekdays)), {
      createdBy: "admin",
      createdAt: at(7, 20),
      updatedAt: at(1, 12),
    }),
    active: false,
  },
  fromAutosys("AUTOSYS_US_BUSINESS", datesFor(nyseWeekdays), nyseWeekdays),
  fromAutosys("AUTOSYS_UK_BUSINESS", datesFor(ukWeekdays), ukWeekdays),
  fromAutosys("AUTOSYS_MONTH_END", lastOfEachMonth(datesFor(nyseWeekdays)), monthEnd),
  // Left empty on purpose: shows a migrated calendar still waiting for its dates.
  fromAutosys("AUTOSYS_QUARTER_START", [], nyseWeekdays),
];

/**
 * Calendars live in sessionStorage so created/uploaded data survives a reload,
 * like a real backend would. Falls back to the seed outside a browser.
 */
export function loadCalendars(): Calendar[] {
  const raw = globalThis.sessionStorage?.getItem(STORE_KEY);
  return raw ? (JSON.parse(raw) as Calendar[]) : structuredClone(SEED);
}

export function saveCalendars(calendars: Calendar[]): void {
  globalThis.sessionStorage?.setItem(STORE_KEY, JSON.stringify(calendars));
}
