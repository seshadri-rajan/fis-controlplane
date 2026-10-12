import { useState, type FormEvent } from "react";

import { ApiError } from "../../lib/api/client";
import { useAuth } from "./AuthProvider";

const field = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm";
const label = "block text-xs font-medium text-slate-600 mb-1";

export default function LoginPage() {
  const { signIn } = useAuth();
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(userName, password);
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.status === 423
          ? cause.message
          : "Invalid credentials.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <form onSubmit={submit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <div>
          <h1 className="text-lg font-semibold">Sign in</h1>
          <p className="mt-1 text-xs text-slate-500">
            Local account. Single sign-on is out of scope for this phase.
          </p>
        </div>

        <div>
          <label className={label} htmlFor="user">
            User name
          </label>
          <input
            id="user"
            className={field}
            autoComplete="username"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            required
          />
        </div>

        <div>
          <label className={label} htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            className={field}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && (
          <p role="alert" className="rounded-md bg-rose-50 p-2 text-sm text-rose-800">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
