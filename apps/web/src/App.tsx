import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router";

import { useAuth } from "./features/auth/AuthProvider";
import LoginPage from "./features/auth/LoginPage";
import CalendarSection from "./features/calendars/CalendarSection";
import HomePage from "./features/home/HomePage";
import MetadataPage from "./features/metadata/MetadataPage";
import Navbar from "./features/navigation/Navbar";
import {
  CALENDAR_PATH,
  CALENDARS_PATH,
  CREATE_PATH,
  HOME_PATH,
  METADATA_PATH,
} from "./features/navigation/paths";

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  return user ? <>{children}</> : <LoginPage />;
}

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />

      <main className="w-full max-w-none px-6 py-8">
        <RequireAuth>
          <Routes>
            <Route path={HOME_PATH} element={<HomePage />} />
            <Route path={METADATA_PATH} element={<MetadataPage />} />
            <Route path={`${CALENDAR_PATH}/*`} element={<CalendarSection />} />
            {/* Pre-prefix URLs, and the older /preview that the screenshots point at. */}
            <Route path="/calendars" element={<Navigate to={CALENDARS_PATH} replace />} />
            <Route path="/create" element={<Navigate to={CREATE_PATH} replace />} />
            <Route path="/preview" element={<Navigate to={CREATE_PATH} replace />} />
            <Route path="*" element={<Navigate to={HOME_PATH} replace />} />
          </Routes>
        </RequireAuth>
      </main>
    </div>
  );
}
