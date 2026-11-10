import type { ReactNode } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router";

import { useAuth } from "./features/auth/AuthProvider";
import LoginPage from "./features/auth/LoginPage";
import CalendarsPage from "./features/calendars/CalendarsPage";
import CreateCalendarPage from "./features/calendars/CreateCalendarPage";
import { TabsProvider, useTabs, type TabId } from "./features/navigation/TabsProvider";

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

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  return user ? <>{children}</> : <LoginPage />;
}

function UserBadge() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  const handleSignOut = async () => {
    await signOut();
    // Signing back in should start from the Calendars tab, not wherever the user left off.
    navigate("/calendars", { replace: true });
  };

  return (
    <div className="ml-auto flex items-center gap-3 text-xs text-slate-600">
      <span>
        {user.user_name}
        <span className="ml-1 text-slate-400">{user.roles.join(", ")}</span>
      </span>
      <button
        type="button"
        onClick={handleSignOut}
        className="rounded-md border border-slate-300 px-2 py-1 hover:bg-slate-100"
      >
        Sign out
      </button>
    </div>
  );
}

function TabbedPages() {
  const { tab, setTab } = useTabs();

  return (
    <>
      <div role="tablist" aria-label="Calendar Platform" className="flex gap-1 border-b border-slate-200">
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
        <Routes>
          <Route path="/" element={<Navigate to="/calendars" replace />} />
          <Route path="/calendars" element={<CalendarsPage />} />
          <Route path="/create" element={<CreateCalendarPage />} />
          {/* Older links and the screenshots point at /preview. */}
          <Route path="/preview" element={<Navigate to="/create" replace />} />
          <Route path="*" element={<Navigate to="/calendars" replace />} />
        </Routes>
      </div>
    </>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
          <span className="font-semibold">Calendar Platform</span>
          <UserBadge />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pt-6 pb-8">
        <RequireAuth>
          <TabsProvider>
            <TabbedPages />
          </TabsProvider>
        </RequireAuth>
      </main>
    </div>
  );
}
