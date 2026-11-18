import { useMemo, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Navigate, Route, Routes } from "react-router";

import CalendarsPage from "./features/calendars/CalendarsPage";
import { createCalendarApi } from "./lib/api/client";

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
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-3">
          <span className="font-semibold">Calendar Platform</span>
          <form onSubmit={useToken} className="flex flex-wrap items-center gap-2 text-sm" autoComplete="off">
            <label htmlFor="access-token">OAuth access token</label>
            <input id="access-token" name="accessToken" type="password" autoComplete="off"
              placeholder={session.token ? "Token in use" : "Paste access token"} required
              className="rounded border border-slate-300 px-2 py-1" />
            <button type="submit" disabled={checking}
              className="rounded bg-slate-900 px-3 py-1 text-white disabled:opacity-50">
              {checking ? "Checking..." : "Use token"}
            </button>
            {session.token && (
              <button type="button" disabled={checking} onClick={() => switchToken()} className="underline">
                Clear token
              </button>
            )}
            {error && <span role="alert" className="text-rose-700">{error}</span>}
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Routes>
          <Route path="/calendars" element={<CalendarsPage key={session.revision} api={api} />} />
          <Route path="*" element={<Navigate to="/calendars" replace />} />
        </Routes>
      </main>
    </div>
  );
}
