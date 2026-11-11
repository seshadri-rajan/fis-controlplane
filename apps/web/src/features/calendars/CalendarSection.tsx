import { Navigate, Route, Routes } from "react-router";

import { CALENDARS_PATH } from "../navigation/paths";
import { TabsProvider, useTabs, type TabId } from "../navigation/TabsProvider";
import AmendCalendarPage from "./AmendCalendarPage";
import CalendarsPage from "./CalendarsPage";
import CreateCalendarPage from "./CreateCalendarPage";

const TABS: { id: TabId; label: string }[] = [
  { id: "calendars", label: "Calendars" },
  { id: "create", label: "Create" },
];

const tabClass = (selected: boolean) =>
  `-mb-px rounded-t-lg border border-b-0 px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
    selected
      ? "border-slate-900 bg-slate-900 text-white"
      : "border-transparent bg-slate-100 text-slate-600 hover:bg-slate-200"
  }`;

function CalendarTabs() {
  const { tab, setTab } = useTabs();

  return (
    <>
      <div role="tablist" aria-label="Calendar sections" className="flex gap-1 border-b border-slate-200">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`tabpanel-${id}`}
            onClick={() => setTab(id)}
            className={tabClass(tab === id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`tabpanel-${tab}`} aria-labelledby={`tab-${tab}`} className="pt-8">
        {/* Mounted under CALENDAR_PATH/*, so these paths are relative to it. */}
        <Routes>
          <Route index element={<Navigate to={CALENDARS_PATH} replace />} />
          <Route path="calendars" element={<CalendarsPage />} />
          <Route path="calendars/:name/amend" element={<AmendCalendarPage />} />
          <Route path="create" element={<CreateCalendarPage />} />
          <Route path="*" element={<Navigate to={CALENDARS_PATH} replace />} />
        </Routes>
      </div>
    </>
  );
}

// The sub-tabs exist only inside the Calendar section of the main menu.
export default function CalendarSection() {
  return (
    <TabsProvider>
      <CalendarTabs />
    </TabsProvider>
  );
}
