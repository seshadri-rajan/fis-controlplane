import type { CalendarStatusFields } from "../proposed";
import type { components } from "../spec";

type Calendar = components["schemas"]["Calendar"] & CalendarStatusFields;

// Bumped when the demo data changes, so a tab that kept an older copy picks up the new seed.
const STORE_KEY = "msw-mock-calendars-v4";

const thisYear = new Date().getFullYear();
// The same two years the Upload screen offers.
const YEARS = [thisYear, thisYear + 1];
const MONTHS = Array.from({ length: 12 }, (_, index) => index);

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (date: Date) => date.toISOString().slice(0, 10);
const utc = (year: number, month: number, day: number) => new Date(Date.UTC(year, month, day));
const isWeekday = (date: Date) => date.getUTCDay() !== 0 && date.getUTCDay() !== 6;

/** Every Monday to Friday in the year. No holidays are removed: these are demo dates. */
function weekdays(year: number): string[] {
  const result: string[] = [];
  for (let day = utc(year, 0, 1); day.getUTCFullYear() === year; day = utc(year, day.getUTCMonth(), day.getUTCDate() + 1)) {
    if (isWeekday(day)) result.push(iso(day));
  }
  return result;
}

const workingDays = (year: number, month: number): string[] =>
  weekdays(year).filter((date) => date.startsWith(`${year}-${pad(month + 1)}`));

/** The nth working day of every month. */
const nthWorkingDay = (n: number) => (year: number) =>
  MONTHS.map((month) => workingDays(year, month)[n - 1]);

/** The last working day of every month. */
const monthEnds = (year: number) => MONTHS.map((month) => workingDays(year, month).at(-1)!);

/** A calendar day each month, moved back to the Friday when it falls on a weekend. */
const dayOfMonth = (day: number) => (year: number) =>
  MONTHS.map((month) => {
    const date = utc(year, month, day);
    const back = date.getUTCDay() === 6 ? 1 : date.getUTCDay() === 0 ? 2 : 0;
    return iso(utc(year, month, day - back));
  });

/** The last working day of March, June, September and December, and the first of January, April, July and October. */
const quarterEnds = (year: number) => [2, 5, 8, 11].map((month) => monthEnds(year)[month]);
const quarterStarts = (year: number) => [0, 3, 6, 9].map((month) => workingDays(year, month)[0]);

const datesFor = (perYear: (year: number) => string[]) => YEARS.flatMap(perYear);

// Always in the past, whatever today's date is.
const at = (monthsAgo: number, day: number) =>
  new Date(Date.UTC(thisYear - 1, 11 - monthsAgo, day, 9, 30)).toISOString();

type Origin = { createdBy: string; createdAt: string; updatedAt?: string };

/** Created by uploading a file: dates only. */
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
const fromAutosys = (calendarName: string, dates: string[], holidayCalendar: string): Calendar => ({
  calendarName,
  dates,
  holidayCalendar,
  migrated: true,
  uploaded: false,
  createdBy: "migration",
  createdAt: at(8, 15),
  updatedAt: at(8, 15),
});

const SEED: Calendar[] = [
  fromUpload("NYSE-Trading-Days", datesFor(weekdays), { createdBy: "admin", createdAt: at(7, 12) }),
  fromUpload("Payroll-10th-Working-Day", datesFor(nthWorkingDay(10)), {
    createdBy: "admin",
    createdAt: at(6, 3),
    updatedAt: at(2, 18),
  }),
  fromUpload("Quarter-Start-Reporting", datesFor(quarterStarts), { createdBy: "editor1", createdAt: at(5, 21) }),
  fromUpload("Quarter-End-Close", datesFor(quarterEnds), {
    createdBy: "editor1",
    createdAt: at(4, 9),
    updatedAt: at(1, 27),
  }),
  fromUpload("Statement-Day-8", datesFor(dayOfMonth(8)), { createdBy: "editor1", createdAt: at(4, 30) }),
  fromUpload("Fiscal-Year-Start", YEARS.map((year) => dayOfMonth(1)(year)[3]), {
    createdBy: "admin",
    createdAt: at(3, 5),
  }),
  fromUpload("Vendor-Payment-Dates", datesFor(dayOfMonth(15)), {
    createdBy: "editor1",
    createdAt: at(3, 17),
    updatedAt: at(0, 4),
  }),
  fromUpload("Regional-Cutoff-Dates", datesFor(nthWorkingDay(5)), { createdBy: "admin", createdAt: at(2, 8) }),
  // Inactive on purpose: shows the badge, and that it cannot be amended or uploaded to.
  {
    ...fromUpload("Legacy-Month-End", datesFor(monthEnds), {
      createdBy: "admin",
      createdAt: at(7, 20),
      updatedAt: at(1, 12),
    }),
    active: false,
  },
  fromAutosys("AUTOSYS_US_BUSINESS", datesFor(weekdays), "NYSE"),
  fromAutosys("AUTOSYS_UK_BUSINESS", datesFor(weekdays), "UK_LSE"),
  fromAutosys("AUTOSYS_MONTH_END", datesFor(monthEnds), "NYSE"),
  // Left empty on purpose: shows a migrated calendar still waiting for its dates.
  fromAutosys("AUTOSYS_QUARTER_START", [], "NYSE"),
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
