import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";

import { getCalendar } from "../../lib/api/client";
import type { ApiError } from "../../lib/api/client";
import { isActive } from "../../lib/api/proposed";
import { useTabs } from "../navigation/TabsProvider";
import UploadCalendarPanel from "./UploadCalendarPanel";

export default function AmendCalendarPage() {
  const { name = "" } = useParams();
  const { setTab } = useTabs();

  const calendar = useQuery({
    queryKey: ["calendars", "one", name],
    queryFn: () => getCalendar(name),
  });

  const back = (
    <button
      type="button"
      onClick={() => setTab("calendars")}
      className="text-sm font-medium text-slate-700 underline"
    >
      ← Back to calendars
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        {back}
        <h1 className="text-xl font-semibold">Amend {name}</h1>
        <p className="max-w-3xl text-sm text-slate-600">
          Click a date to include or exclude it, or add dates from an Excel workbook. Dates before today are
          history and can’t be changed. Nothing is saved until you click Save changes.
        </p>
      </div>

      {calendar.isPending && <p className="text-sm text-slate-500">Loading…</p>}

      {calendar.isError && (
        <p role="alert" className="max-w-xl rounded-md bg-rose-50 p-3 text-sm text-rose-800">
          {(calendar.error as ApiError).status === 404
            ? `No calendar named "${name}".`
            : (calendar.error as Error).message}
        </p>
      )}

      {calendar.data && !isActive(calendar.data) && (
        <p role="alert" className="max-w-xl rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          <strong>{name}</strong> is inactive, so its dates can’t be changed. An admin can activate
          it from the Calendars list.
        </p>
      )}

      {calendar.data && isActive(calendar.data) && <UploadCalendarPanel amend={calendar.data} />}
    </div>
  );
}
