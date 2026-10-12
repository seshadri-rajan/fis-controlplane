import type { ReactNode } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router";

import { useAuth } from "./features/auth/AuthProvider";
import LoginPage from "./features/auth/LoginPage";
import CalendarsPage from "./features/calendars/CalendarsPage";
import PreviewPage from "./features/preview/PreviewPage";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium ${
    isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-200"
  }`;

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  return user ? <>{children}</> : <LoginPage />;
}

function UserBadge() {
  const { user, signOut } = useAuth();
  if (!user) return null;

  return (
    <div className="ml-auto flex items-center gap-3 text-xs text-slate-600">
      <span>
        {user.user_name}
        <span className="ml-1 text-slate-400">{user.roles.join(", ")}</span>
      </span>
      <button
        type="button"
        onClick={() => signOut()}
        className="rounded-md border border-slate-300 px-2 py-1 hover:bg-slate-100"
      >
        Sign out
      </button>
    </div>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
          <span className="font-semibold">Calendar Platform</span>
          <nav className="flex gap-1">
            <NavLink to="/preview" className={linkClass}>
              Preview
            </NavLink>
            <NavLink to="/calendars" className={linkClass}>
              Calendars
            </NavLink>
          </nav>
          <UserBadge />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <Routes>
          <Route path="/" element={<Navigate to="/preview" replace />} />
          <Route path="/preview" element={<PreviewPage />} />
          <Route
            path="/calendars"
            element={
              <RequireAuth>
                <CalendarsPage />
              </RequireAuth>
            }
          />
        </Routes>
      </main>
    </div>
  );
}
