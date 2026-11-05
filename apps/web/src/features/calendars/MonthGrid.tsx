export type GridDate = { day: string; shifted_from?: string | null; reason: string };

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAY_INITIALS = ["M", "T", "W", "T", "F", "S", "S"];

export type DayInfo = {
  scheduled: boolean;
  shiftedFrom: string | null;
  reason: string;
  holidayName: string | null;
  vacated: boolean;
};

export function indexDates(dates: GridDate[], holidays: Map<string, string>) {
  const index = new Map<string, DayInfo>();

  for (const [iso, name] of holidays) {
    index.set(iso, {
      scheduled: false,
      shiftedFrom: null,
      reason: "",
      holidayName: name,
      vacated: false,
    });
  }

  for (const date of dates) {
    const existing = index.get(date.day);
    index.set(date.day, {
      scheduled: true,
      shiftedFrom: date.shifted_from ?? null,
      reason: date.reason,
      holidayName: existing?.holidayName ?? null,
      vacated: false,
    });

    if (date.shifted_from) {
      const origin = index.get(date.shifted_from);
      index.set(date.shifted_from, {
        scheduled: false,
        shiftedFrom: null,
        reason: date.reason,
        holidayName: origin?.holidayName ?? null,
        vacated: true,
      });
    }
  }

  return index;
}

function isoFor(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function cellClass(info: DayInfo | undefined) {
  if (info?.scheduled && info.shiftedFrom) return "bg-amber-400 text-amber-950 font-semibold";
  if (info?.scheduled) return "bg-emerald-500 text-white font-medium";
  if (info?.vacated) return "bg-rose-100 text-rose-700 line-through";
  if (info?.holidayName) return "bg-rose-100 text-rose-700";
  return "text-slate-400";
}

function titleFor(iso: string, info: DayInfo | undefined) {
  const parts = [iso];
  if (info?.holidayName) parts.push(`Holiday: ${info.holidayName || "unnamed"}`);
  if (info?.shiftedFrom) parts.push(`Shifted from ${info.shiftedFrom} (${info.reason})`);
  if (info?.vacated) parts.push("Run moved off this date");
  else if (info?.scheduled) parts.push("Scheduled run");
  return parts.join(" — ");
}

function Month({
  year,
  month,
  index,
}: {
  year: number;
  month: number;
  index: Map<string, DayInfo>;
}) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // getDay() is Sunday-first; the grid is Monday-first.
  const leading = (new Date(year, month, 1).getDay() + 6) % 7;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <h3 className="mb-2 text-sm font-semibold text-slate-700">{MONTHS[month]}</h3>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] text-slate-400">
        {WEEKDAY_INITIALS.map((initial, i) => (
          <div key={i}>{initial}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-0.5 text-center text-xs">
        {Array.from({ length: leading }, (_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const iso = isoFor(year, month, i + 1);
          const info = index.get(iso);
          return (
            <div
              key={iso}
              title={titleFor(iso, info)}
              className={`rounded py-1 ${cellClass(info)}`}
            >
              {i + 1}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function MonthGrid({
  year,
  dates,
  holidays,
}: {
  year: number;
  dates: GridDate[];
  holidays: Map<string, string>;
}) {
  const index = indexDates(dates, holidays);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 12 }, (_, month) => (
        <Month key={month} year={year} month={month} index={index} />
      ))}
    </div>
  );
}

const DEFAULT_LEGEND: Array<[string, string]> = [
  ["bg-emerald-500", "Scheduled run"],
  ["bg-amber-400", "Shifted run"],
  ["bg-rose-100 border border-rose-300", "Holiday / vacated"],
];

export function Legend({ items = DEFAULT_LEGEND }: { items?: Array<[string, string]> }) {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-slate-600">
      {items.map(([swatch, label]) => (
        <span key={label} className="flex items-center gap-1.5">
          <span className={`inline-block h-3 w-3 rounded ${swatch}`} />
          {label}
        </span>
      ))}
    </div>
  );
}
