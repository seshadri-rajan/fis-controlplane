import { useQuery } from "@tanstack/react-query";

import { listHolidayCalendars } from "../../lib/api/client";
import { field, label } from "./formStyles";

export default function HolidayCalendarSelect({
  id,
  value,
  onChange,
  disabled = false,
}: {
  id: string;
  value: string;
  onChange: (name: string) => void;
  disabled?: boolean;
}) {
  const holidayCalendars = useQuery({
    queryKey: ["holiday-calendars"],
    queryFn: listHolidayCalendars,
  });

  return (
    <div>
      <label htmlFor={id} className={label}>
        Holiday calendar
      </label>
      <select
        id={id}
        className={field}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">
          {holidayCalendars.isPending ? "Loading…" : "Select a holiday calendar…"}
        </option>
        {holidayCalendars.data?.map((calendar) => (
          <option key={calendar.name} value={calendar.name}>
            {calendar.name} — {calendar.description}
          </option>
        ))}
      </select>
      {holidayCalendars.isError && (
        <p role="alert" className="mt-1 text-xs text-rose-700">
          {(holidayCalendars.error as Error).message}
        </p>
      )}
    </div>
  );
}
