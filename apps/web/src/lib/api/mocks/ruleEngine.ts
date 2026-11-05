import { DAY_NAMES, MONTH_CODES } from "../proposed";
import type {
  CalendarPreviewRequest,
  CalendarPreviewResponse,
  HolidayCalendarOption,
  RuleDefinition,
} from "../proposed";

/*
 * Mock stand-in for the backend's rule and holiday logic. The semantics below are our best
 * reading of the rule table we were given and are listed as open questions in API-020.
 * Holiday dates are illustrative: no "observed" shifting when one falls on a weekend.
 */

export const HOLIDAY_CALENDARS: HolidayCalendarOption[] = [
  { name: "NYSE", description: "New York Stock Exchange" },
  { name: "CANADA", description: "Canadian (TSX) market" },
  { name: "UK_LSE", description: "London Stock Exchange" },
  { name: "US_FEDERAL", description: "US federal holidays" },
];

export const RULES: RuleDefinition[] = [
  {
    ruleType: "WORKING_DAY",
    frequency: "MONTHLY",
    description: "The Nth working day of every month.",
    parameters: [{ name: "DAY", label: "Working day of month", type: "INTEGER", min: 1, max: 23, default: 10 }],
  },
  {
    ruleType: "QUARTER_START_WORKING_DAY",
    frequency: "QUARTERLY",
    description: "The Nth working day counted from the first day of each quarter.",
    parameters: [{ name: "DAY", label: "Working day of quarter", type: "INTEGER", min: 1, max: 60, default: 10 }],
  },
  {
    ruleType: "CALENDAR_DAY",
    frequency: "MONTHLY",
    description: "The Nth calendar day of every month, weekends included.",
    parameters: [{ name: "DAY", label: "Day of month", type: "INTEGER", min: 1, max: 31, default: 8 }],
  },
  {
    ruleType: "FIXED_DATE_YEARLY",
    frequency: "YEARLY",
    description: "The same day and month every year.",
    parameters: [
      { name: "MONTH", label: "Month", type: "ENUM", options: MONTH_CODES, default: "MAR" },
      { name: "DAY", label: "Day of month", type: "INTEGER", min: 1, max: 31, default: 1 },
    ],
  },
  {
    ruleType: "QUARTER_END_WORKING_DAY",
    frequency: "QUARTERLY",
    description: "The Nth working day counted back from the last day of each quarter.",
    parameters: [{ name: "DAY", label: "Working day from quarter end", type: "INTEGER", min: 1, max: 60, default: 30 }],
  },
];

// UTC throughout so the machine's timezone cannot shift a date. Months are 0-based; weekdays Mon=0.
const utc = (year: number, month: number, day: number) => new Date(Date.UTC(year, month, day));
const toIso = (date: Date) => date.toISOString().slice(0, 10);
const weekdayOf = (date: Date) => (date.getUTCDay() + 6) % 7;
const addDays = (date: Date, days: number) =>
  utc(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days);
const daysInMonth = (year: number, month: number) => utc(year, month + 1, 0).getUTCDate();

const nthWeekday = (year: number, month: number, weekday: number, n: number) => {
  const first = utc(year, month, 1);
  return addDays(first, ((weekday - weekdayOf(first) + 7) % 7) + 7 * (n - 1));
};
const lastWeekday = (year: number, month: number, weekday: number) => {
  const last = utc(year, month + 1, 0);
  return addDays(last, -((weekdayOf(last) - weekday + 7) % 7));
};

function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(year, month - 1, day);
}

const MON = 0;
const THU = 3;

function holidaysFor(calendar: string, year: number): Array<{ date: string; name: string }> {
  const goodFriday = addDays(easterSunday(year), -2);
  const christmas = utc(year, 11, 25);
  const newYear = utc(year, 0, 1);
  const juneteenth = utc(year, 5, 19);
  const independence = utc(year, 6, 4);

  const byCalendar: Record<string, Array<[string, Date]>> = {
    NYSE: [
      ["New Year's Day", newYear],
      ["Martin Luther King Jr. Day", nthWeekday(year, 0, MON, 3)],
      ["Presidents' Day", nthWeekday(year, 1, MON, 3)],
      ["Good Friday", goodFriday],
      ["Memorial Day", lastWeekday(year, 4, MON)],
      ["Juneteenth", juneteenth],
      ["Independence Day", independence],
      ["Labor Day", nthWeekday(year, 8, MON, 1)],
      ["Thanksgiving Day", nthWeekday(year, 10, THU, 4)],
      ["Christmas Day", christmas],
    ],
    CANADA: [
      ["New Year's Day", newYear],
      ["Family Day", nthWeekday(year, 1, MON, 3)],
      ["Good Friday", goodFriday],
      ["Victoria Day", addDays(utc(year, 4, 24), -weekdayOf(utc(year, 4, 24)))],
      ["Canada Day", utc(year, 6, 1)],
      ["Civic Holiday", nthWeekday(year, 7, MON, 1)],
      ["Labour Day", nthWeekday(year, 8, MON, 1)],
      ["Thanksgiving", nthWeekday(year, 9, MON, 2)],
      ["Christmas Day", christmas],
      ["Boxing Day", utc(year, 11, 26)],
    ],
    UK_LSE: [
      ["New Year's Day", newYear],
      ["Good Friday", goodFriday],
      ["Easter Monday", addDays(easterSunday(year), 1)],
      ["Early May bank holiday", nthWeekday(year, 4, MON, 1)],
      ["Spring bank holiday", lastWeekday(year, 4, MON)],
      ["Summer bank holiday", lastWeekday(year, 7, MON)],
      ["Christmas Day", christmas],
      ["Boxing Day", utc(year, 11, 26)],
    ],
    US_FEDERAL: [
      ["New Year's Day", newYear],
      ["Martin Luther King Jr. Day", nthWeekday(year, 0, MON, 3)],
      ["Presidents' Day", nthWeekday(year, 1, MON, 3)],
      ["Memorial Day", lastWeekday(year, 4, MON)],
      ["Juneteenth", juneteenth],
      ["Independence Day", independence],
      ["Labor Day", nthWeekday(year, 8, MON, 1)],
      ["Columbus Day", nthWeekday(year, 9, MON, 2)],
      ["Veterans Day", utc(year, 10, 11)],
      ["Thanksgiving Day", nthWeekday(year, 10, THU, 4)],
      ["Christmas Day", christmas],
    ],
  };

  return (byCalendar[calendar] ?? [])
    .map(([name, date]) => ({ date: toIso(date), name }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Returns a message for the first problem found, or null when the request is acceptable. */
export function validatePreview(req: Partial<CalendarPreviewRequest> | null): string | null {
  if (!req) return "A JSON body is required";
  if (!Number.isInteger(req.year) || req.year! < 2000 || req.year! > 2100) {
    return "year must be a whole number from 2000 to 2100";
  }
  if (!HOLIDAY_CALENDARS.some((h) => h.name === req.holidayCalendar)) {
    return "holidayCalendar is missing or unknown";
  }
  if (req.holidayOffset !== undefined && !Number.isInteger(req.holidayOffset)) {
    return "holidayOffset must be a whole number";
  }
  if (req.dayOfWeek?.some((d) => !DAY_NAMES.includes(d))) return "dayOfWeek has an unknown day";

  if (!req.dateRuleType) {
    return req.dayOfWeek?.length ? null : "Provide dateRuleType, or at least one dayOfWeek";
  }
  const rule = RULES.find((r) => r.ruleType === req.dateRuleType);
  if (!rule) return "dateRuleType is unknown";

  if (rule.parameters.some((p) => p.name === "MONTH")) {
    const match = /^(\d{2})-(\d{2})$/.exec(req.runDate ?? "");
    const [day, month] = [Number(match?.[1]), Number(match?.[2])];
    if (!match || month < 1 || month > 12 || day < 1 || day > 31) {
      return "runDate must be DD-MM for this rule";
    }
    return null;
  }

  const dayParameter = rule.parameters.find((p) => p.name === "DAY");
  const day = Number(req.runDay);
  if (dayParameter?.type === "INTEGER" && (!Number.isInteger(day) || day < dayParameter.min || day > dayParameter.max)) {
    return `runDay must be a whole number from ${dayParameter.min} to ${dayParameter.max}`;
  }
  return null;
}

export function generatePreview(req: CalendarPreviewRequest): CalendarPreviewResponse {
  const { year } = req;
  const holidayList = holidaysFor(req.holidayCalendar, year);
  const holidayDates = new Set(holidayList.map((h) => h.date));
  const considerHolidays = req.holidayRun ?? false;
  const weekdays = new Set(
    (req.dayOfWeek?.length ? req.dayOfWeek : DAY_NAMES.slice(0, 5)).map((d) => DAY_NAMES.indexOf(d)),
  );

  const isRunnable = (date: Date) =>
    weekdays.has(weekdayOf(date)) && !(considerHolidays && holidayDates.has(toIso(date)));

  const daysBetween = (firstMonth: number, lastMonth: number) => {
    const days: Date[] = [];
    for (let d = utc(year, firstMonth, 1); d <= utc(year, lastMonth + 1, 0); d = addDays(d, 1)) {
      days.push(d);
    }
    return days;
  };

  // A fixed or calendar-day run that lands on a holiday moves by holidayOffset; 0 drops it.
  const adjust = (date: Date): Date | null => {
    if (!considerHolidays || !holidayDates.has(toIso(date))) return date;
    const offset = req.holidayOffset ?? 0;
    if (offset === 0) return null;
    let moved = date;
    for (let i = 0; i < 31 && holidayDates.has(toIso(moved)); i++) moved = addDays(moved, offset);
    return holidayDates.has(toIso(moved)) ? null : moved;
  };

  const n = Number(req.runDay);
  const picked: Array<Date | null | undefined> = [];

  switch (req.dateRuleType) {
    case undefined:
      picked.push(...daysBetween(0, 11).filter(isRunnable));
      break;
    case "WORKING_DAY":
      for (let m = 0; m < 12; m++) picked.push(daysBetween(m, m).filter(isRunnable)[n - 1]);
      break;
    case "QUARTER_START_WORKING_DAY":
      for (let q = 0; q < 4; q++) picked.push(daysBetween(q * 3, q * 3 + 2).filter(isRunnable)[n - 1]);
      break;
    case "QUARTER_END_WORKING_DAY":
      for (let q = 0; q < 4; q++) {
        const days = daysBetween(q * 3, q * 3 + 2).filter(isRunnable);
        picked.push(days[days.length - n]);
      }
      break;
    case "CALENDAR_DAY":
      for (let m = 0; m < 12; m++) {
        picked.push(adjust(utc(year, m, Math.min(n, daysInMonth(year, m)))));
      }
      break;
    case "FIXED_DATE_YEARLY": {
      const [day, month] = (req.runDate ?? "").split("-").map(Number);
      picked.push(adjust(utc(year, month - 1, Math.min(day, daysInMonth(year, month - 1)))));
      break;
    }
  }

  const dates = [
    ...new Set(
      picked
        .filter((d): d is Date => !!d && d.getUTCFullYear() === year)
        .map(toIso),
    ),
  ].sort();

  return { year, dates, holidays: holidayList };
}
