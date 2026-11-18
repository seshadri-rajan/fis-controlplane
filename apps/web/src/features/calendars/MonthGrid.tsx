const monthFormat = new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" });
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const pad = (value: number, length = 2) => String(value).padStart(length, "0");

function monthDay(year: number, month: number, day: number) {
  const date = new Date(0);
  date.setUTCFullYear(year, month, day);
  return date;
}

export default function MonthGrid({ year, dates }: { year: number; dates: string[] }) {
  const scheduled = new Set(dates);
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 12 }, (_, month) => {
        const first = monthDay(year, month, 1);
        const leading = (first.getUTCDay() + 6) % 7;
        const days = monthDay(year, month + 1, 0).getUTCDate();
        return (
          <section key={month} className="rounded-lg border border-slate-200 bg-white p-3">
            <h3 className="mb-2 text-sm font-semibold">{monthFormat.format(first)}</h3>
            <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
              {weekdays.map((day) => <span className="text-slate-500" key={day}>{day}</span>)}
              {Array.from({ length: leading }, (_, index) => <span key={`pad-${index}`} />)}
              {Array.from({ length: days }, (_, index) => {
                const day = index + 1;
                const date = `${pad(day)}-${pad(month + 1)}-${pad(year, 4)}`;
                const active = scheduled.has(date);
                return (
                  <span key={date} title={active ? `${date}: Scheduled` : date}
                    className={`rounded py-1 ${active ? "bg-emerald-700 text-white" : "text-slate-500"}`}>
                    {day}
                  </span>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
