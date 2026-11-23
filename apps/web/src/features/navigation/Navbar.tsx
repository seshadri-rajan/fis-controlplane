import { NavLink, useNavigate } from "react-router";

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
      <button
        type="button"
        onClick={handleSignOut}
        className="rounded-lg border border-white/25 px-2.5 py-1 text-slate-200 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        Sign out
      </button>
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
      <>
        {/* Navigation beside Control Plane */}
        <nav
          aria-label="Main"
          className="flex flex-wrap items-center gap-1.5"
        >
          {ITEMS.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={itemClass}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User badge stays on the right */}
        <div className="ml-auto">
          <UserBadge />
        </div>
      </>
    )}
      </div>
    </header>
  );
}
