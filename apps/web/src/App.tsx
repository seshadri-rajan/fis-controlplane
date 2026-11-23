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
  const queryClient = useQueryClient();
  const [session, setSession] = useState<{ token?: string; revision: number }>({ revision: 0 });
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const api = useMemo(() => createCalendarApi(session.token), [session.token]);

  function switchToken(token?: string) {
    queryClient.clear();
    setSession((current) => ({ token, revision: current.revision + 1 }));
    setError("");
  }

  async function useToken(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const token = String(new FormData(form).get("accessToken")).trim();
    if (!token || /\s/.test(token)) {
      setError("Enter the access token without the Bearer prefix.");
      return;
    }
    setChecking(true);
    setError("");
    try {
      await createCalendarApi(token).list({ limit: 1 });
      form.reset();
      switchToken(token);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not verify the access token.");
    } finally {
      setChecking(false);
    }
  }

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
