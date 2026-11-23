import { useState } from "react";

import { formatAgo } from "./format";
import StatusBadge, { STATE_META, StatusDot } from "./StatusBadge";
import { SEVERITY, dagKey, needsAttention } from "./runModel";
import type { StateKey, TaskGroup } from "./runModel";

const COLLAPSED = 8;
// With only a few matches, open them straight away so the answer is already on screen.
const AUTO_OPEN_AT_MOST = 4;

const byInterest = (a: TaskGroup, b: TaskGroup): number =>
  Number(needsAttention(b.worst)) - Number(needsAttention(a.worst)) ||
  b.entries.length - a.entries.length ||
  a.taskId.localeCompare(b.taskId);

function CountDots({ counts }: { counts: Record<StateKey, number> }) {
  const states = (Object.keys(counts) as StateKey[])
    .filter((state) => counts[state] > 0)
    .sort((a, b) => SEVERITY[a] - SEVERITY[b]);
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
      {states.map((state) => (
        <span key={state} className="inline-flex items-center gap-1">
          <StatusDot state={state} />
          <span className="tabular-nums">
            {counts[state]} {STATE_META[state].label.toLowerCase()}
          </span>
        </span>
      ))}
    </span>
  );
}

export default function TaskFinder({
  groups,
  now,
  onOpenDag,
}: {
  groups: TaskGroup[];
  now: number;
  onOpenDag: (dagKey: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [toggled, setToggled] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const q = query.trim().toLowerCase();
  const matches = groups
    .filter((group) => !q || group.taskId.toLowerCase().includes(q) || group.entries.some((e) => e.dagId.toLowerCase().includes(q)))
    .sort(byInterest);
  const shown = showAll ? matches : matches.slice(0, COLLAPSED);
  const autoOpen = q !== "" && matches.length <= AUTO_OPEN_AT_MOST;
  const flip = (taskId: string) =>
    setToggled((previous) => {
      const next = new Set(previous);
      if (!next.delete(taskId)) next.add(taskId);
      return next;
    });

  return (
    <section aria-labelledby="tasks-heading" className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-100 px-4 py-3">
        <div className="mr-auto">
          <h2 id="tasks-heading" className="text-sm font-semibold">
            Task finder
          </h2>
          <p className="text-xs text-slate-500">
            A task name can belong to several DAGs. Search a task or DAG name to see every DAG it runs in, and how the latest run went in each.
          </p>
        </div>
        <label className="sr-only" htmlFor="task-search">
          Search tasks
        </label>
        <input
          id="task-search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setToggled(new Set());
          }}
          placeholder="Search task or DAG name, e.g. end"
          className="w-72 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
        />
      </div>

      {matches.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-500">
          {groups.length === 0 ? "No task runs have been reported yet." : `No task or DAG matches “${query.trim()}”.`}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {shown.map((group) => {
            const open = autoOpen !== toggled.has(group.taskId);
            const panelId = `task-${group.taskId.replace(/[^A-Za-z0-9_-]/g, "_")}`;
            return (
              <li key={group.taskId}>
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => flip(group.taskId)}
                  className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-left hover:bg-slate-50"
                >
                  <span aria-hidden="true" className={`text-xs text-slate-500 transition-transform ${open ? "rotate-90" : ""}`}>
                    ▶
                  </span>
                  <span className="font-mono text-sm font-medium">{group.taskId}</span>
                  <span className="text-xs text-slate-500">
                    in {group.entries.length} {group.entries.length === 1 ? "DAG" : "DAGs"}
                  </span>
                  <span className="ml-auto">
                    <CountDots counts={group.counts} />
                  </span>
                </button>

                {open && (
                  <ul id={panelId} className="grid gap-2 bg-slate-50 px-4 py-3 pl-10 sm:grid-cols-2 xl:grid-cols-3">
                    {group.entries.map((entry) => (
                      <li key={dagKey(entry)}>
                        <button
                          type="button"
                          onClick={() => onOpenDag(dagKey(entry))}
                          title="Open this DAG in the table above"
                          className="flex w-full items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-left text-xs hover:border-slate-400"
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-slate-800">{entry.dagId}</span>
                            <span className="text-slate-500">
                              {entry.source && `${entry.source} · `}
                              {entry.startMs === null ? "not started" : formatAgo(entry.startMs, now)}
                            </span>
                          </span>
                          <StatusBadge state={entry.state} label={entry.stateLabel} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {matches.length > COLLAPSED && (
        <button
          type="button"
          onClick={() => setShowAll((value) => !value)}
          className="w-full border-t border-slate-100 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          {showAll ? "Show fewer" : `Show all ${matches.length} task names`}
        </button>
      )}
    </section>
  );
}
