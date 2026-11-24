import { NavLink, useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useApiMode, type ApiMode } from "../api-mode/ApiModeProvider";
import { useAuth } from "../auth/AuthProvider";
import { CALENDAR_PATH, HOME_PATH, METADATA_PATH } from "./paths";

const ITEMS = [
  { to: HOME_PATH, label: "Home", end: true },
  { to: METADATA_PATH, label: "Metadata", end: false },
  { to: CALENDAR_PATH, label: "Calendar", end: false },
];

const itemClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3.5 py-1.5 text-sm leading-[18px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
    isActive ? "bg-indigo-500 text-white" : "text-slate-200 hover:bg-white/10"
  }`;

function UserBadge() {
  const { user, signOut } = useAuth();
  const { isLocalBackend } = useApiMode();
  const navigate = useNavigate();
  if (!user) return null;

  const handleSignOut = async () => {
    await signOut();
    navigate(HOME_PATH, { replace: true });
  };

  return (
    <div className="flex items-center gap-3 sm:border-l sm:border-white/20 sm:pl-4 text-xs text-slate-300">
      <span>
        {user.user_name}
        <span className="ml-1 text-slate-400">{user.roles.join(", ")}</span>
      </span>
      {!isLocalBackend && (
        <button
          type="button"
          onClick={handleSignOut}
          className="rounded-lg border border-white/25 px-2.5 py-1 text-slate-200 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Sign out
        </button>
      )}
    </div>
  );
}

function ApiModeSelector() {
  const { mode, setMode, isLocalBackend } = useApiMode();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [isChanging, setIsChanging] = useState(false);

  const changeMode = async (nextMode: ApiMode) => {
    setError(null);
    setIsChanging(true);
    try {
      await setMode(nextMode);
      queryClient.clear();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not change API mode.");
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="api-mode" className="text-xs font-medium text-slate-200">
        API mode
      </label>
      <select
        id="api-mode"
        value={mode}
        disabled={isChanging}
        onChange={(event) => {
          const value = event.target.value;
          if (value === "mock" || value === "backend") void changeMode(value);
        }}
        className="rounded-md border border-white/25 bg-slate-800 px-2 py-1.5 text-xs text-white disabled:opacity-60"
      >
        <option value="mock">Mock</option>
        <option value="backend">Local backend (auth off)</option>
      </select>
      {isLocalBackend && <span className="sr-only">Authentication is disabled</span>}
      {error && (
        <span role="alert" className="text-xs text-rose-200">
          {error}
        </span>
      )}
    </div>
  );
}

export default function Navbar() {
  const { user } = useAuth();

  return (
    <header className="bg-linear-to-r from-slate-900 to-slate-700 shadow-md">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4 sm:px-8">
        <span className="text-xl font-bold text-white">
          Control <span className="text-indigo-400">Plane</span>
        </span>
        {user && (
          <nav aria-label="Main" className="flex flex-wrap items-center gap-1.5">
            {ITEMS.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} className={itemClass}>
                {label}
              </NavLink>
            ))}
          </nav>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-3">
          {import.meta.env.DEV && <ApiModeSelector />}
          {user && <UserBadge />}
        </div>
      </div>
    </header>
  );
}
