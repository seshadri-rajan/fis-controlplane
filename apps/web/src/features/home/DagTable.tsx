import { Fragment, useEffect, useRef, useState } from "react";

import { formatAgo, formatBusinessDate, formatClock, formatDuration } from "./format";
import StatusBadge, { STATE_META } from "./StatusBadge";
import { durationOf, hasResultButNoStart, isCurrentTask } from "./runModel";
import type { DagRow, Run, SortMode, StateKey } from "./runModel";

const PAGE = 25;
const COLUMNS = 8;

const SORTS: Array<[SortMode, string]> = [
  ["attention", "Needs attention first"],
  ["recent", "Most recent"],
  ["name", "Name"],
];

/** The last few runs as small coloured cells, oldest to newest. */
function Sparkline({ runs, now }: { runs: Run[]; now: number }) {
  const failures = runs.filter((run) => run.state === "failed").length;
  return (
    <div
      role="img"
      aria-label={`Last ${runs.length} runs: ${runs.length - failures} not failed, ${failures} failed`}
      className="flex items-end gap-0.5"
    >
      {runs.map((run, index) => (
        <span
          key={`${run.startMs ?? "none"}-${index}`}
          title={`${STATE_META[run.state].label} · ${formatClock(run.startMs, now)}`}
          className={`h-4 w-1.5 rounded-sm ${STATE_META[run.state].bar}`}
        />
      ))}
    </div>
  );
}

function TaskLines({ row, now }: { row: DagRow; now: number }) {
  if (row.tasks.length === 0) {
    return <p className="px-2 py-3 text-sm text-slate-500">No task runs have been reported for this DAG.</p>;
  }
  return (
    <div className="px-2 py-3">
      <p className="mb-2 text-xs text-slate-500">The latest run of each task in {row.dagId}.</p>
      <table className="w-full max-w-3xl text-left text-xs">
        <thead className="text-slate-500">
          <tr>
            <th className="py-1 pr-4 font-medium">Task</th>
            <th className="py-1 pr-4 font-medium">Status</th>
            <th className="py-1 pr-4 font-medium">Started</th>
            <th className="py-1 font-medium">Duration</th>
          </tr>
        </thead>
        <tbody>
          {row.tasks.map((task) => (
            <tr key={task.taskId} className="border-t border-slate-100">
              <td className="py-1.5 pr-4 font-mono text-slate-800">{task.taskId}</td>
              <td className="py-1.5 pr-4">
                <StatusBadge state={task.state} label={task.stateLabel} />
              </td>
              <td className="py-1.5 pr-4 tabular-nums text-slate-600">
                {task.startMs === null ? (hasResultButNoStart(task) ? "No time reported" : "Not started") : formatClock(task.startMs, now)}
                {!isCurrentTask(row, task) && (
                  <span className="ml-1.5 text-slate-400" title="This task hasn't run since an earlier DAG run">
                    (earlier run)
                  </span>
                )}
              </td>
              <td className="py-1.5 tabular-nums text-slate-600">{formatDuration(durationOf(task, now))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DagTable({
  rows,
  total,
  now,
  expanded,
  onToggle,
  scrollTo,
  search,
  onSearch,
  sort,
  onSort,
  status,
  onClearStatus,
  onClearAll,
}: {
  /** Already filtered and sorted. */
  rows: DagRow[];
  /** Every DAG in the selected business unit, before the status and search filters. */
  total: number;
  now: number;
  expanded: Set<string>;
  onToggle: (dagKey: string) => void;
  scrollTo: { key: string; nonce: number } | null;
  search: string;
  onSearch: (value: string) => void;
  sort: SortMode;
  onSort: (value: SortMode) => void;
  status: StateKey | null;
  onClearStatus: () => void;
  onClearAll: () => void;
}) {
  const refs = useRef(new Map<string, HTMLElement>());
  const [showAll, setShowAll] = useState(false);
  const target = scrollTo ? rows.findIndex((row) => row.key === scrollTo.key) : -1;
  // A row opened from elsewhere on the page is always rendered, even beyond the first page.
  const shown = showAll ? rows : rows.slice(0, Math.max(PAGE, target + 1));

  useEffect(() => {
    if (scrollTo) refs.current.get(scrollTo.key)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [scrollTo]);

  return (
    <section aria-labelledby="dags-heading" className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-100 px-4 py-3">
        <div className="mr-auto">
          <h2 id="dags-heading" className="text-sm font-semibold">
            Latest DAG runs
          </h2>
          <p className="text-xs text-slate-500">
            One row per DAG, showing its most recent run. Select a DAG to see its tasks.
          </p>
        </div>

        {status && (
          <button
            type="button"
            onClick={onClearStatus}
            className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white"
          >
            {STATE_META[status].label} ✕
          </button>
        )}

        <label className="sr-only" htmlFor="dag-search">
          Filter DAGs by name
        </label>
        <input
          id="dag-search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Filter by DAG name"
          className="w-56 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
        />

        <label className="sr-only" htmlFor="dag-sort">
          Sort DAGs
        </label>
        <select
          id="dag-sort"
          value={sort}
          onChange={(e) => onSort(e.target.value as SortMode)}
          className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
        >
          {SORTS.map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-sm font-medium">{total === 0 ? "No DAGs reported yet." : "No DAGs match your filters."}</p>
          {total > 0 && (
            <button type="button" onClick={onClearAll} className="mt-2 text-sm font-medium text-slate-700 underline">
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 text-xs text-slate-500">
              <tr>
                <th className="w-8 py-2 pl-4" />
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">DAG</th>
                <th className="px-3 py-2 font-medium">Business unit</th>
                <th className="px-3 py-2 font-medium">Business date</th>
                <th className="px-3 py-2 font-medium">Started</th>
                <th className="px-3 py-2 font-medium">Duration</th>
                <th className="px-3 py-2 font-medium">Recent runs</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => {
                const open = expanded.has(row.key);
                const { latest } = row;
                return (
                  <Fragment key={row.key}>
                    <tr
                      ref={(el) => {
                        if (el) refs.current.set(row.key, el);
                        else refs.current.delete(row.key);
                      }}
                      className={`border-t border-slate-100 ${open ? "bg-slate-50" : "hover:bg-slate-50"}`}
                    >
                      <td className="py-2.5 pl-4">
                        <button
                          type="button"
                          aria-expanded={open}
                          aria-label={`${open ? "Hide" : "Show"} tasks for ${row.dagId}`}
                          onClick={() => onToggle(row.key)}
                          className="flex h-5 w-5 items-center justify-center rounded text-slate-500 hover:bg-slate-200"
                        >
                          <span aria-hidden="true" className={`text-xs transition-transform ${open ? "rotate-90" : ""}`}>
                            ▶
                          </span>
                        </button>
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge state={latest.state} label={latest.stateLabel} />
                      </td>
                      <td className="px-3 py-2.5">
                        <button type="button" onClick={() => onToggle(row.key)} className="text-left font-medium hover:underline">
                          {row.dagId}
                        </button>
                        {row.previous && (
                          <div className="text-xs text-slate-500">
                            Previous run: {STATE_META[row.previous.state].label.toLowerCase()},{" "}
                            {formatAgo(row.previous.startMs, now)}
                          </div>
                        )}
                        {row.runsOnDate > 1 && (
                          <div
                            className="text-xs text-slate-500"
                            title={`This DAG ran ${row.runsOnDate} times for this business date. Only the latest is shown.`}
                          >
                            {row.runsOnDate} runs on this date, latest shown
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {row.source ? (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-700">{row.source}</span>
                        ) : (
                          "–"
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-700">
                        {formatBusinessDate(latest.businessDate, latest.raw.business_date)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 tabular-nums" title={latest.raw.start_date ?? undefined}>
                        {latest.startMs === null ? (
                          <span className="text-slate-500">
                            {hasResultButNoStart(latest) ? "No time reported" : "Not started"}
                          </span>
                        ) : (
                          <>
                            {formatClock(latest.startMs, now)}
                            <div className="text-xs text-slate-500">{formatAgo(latest.startMs, now)}</div>
                          </>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">
                        {formatDuration(durationOf(latest, now))}
                      </td>
                      <td className="px-3 py-2.5">
                        <Sparkline runs={row.recent} now={now} />
                      </td>
                    </tr>
                    {open && (
                      <tr className="bg-slate-50">
                        <td colSpan={COLUMNS} className="border-t border-slate-100 pl-12">
                          <TaskLines row={row} now={now} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
        <span>
          Showing {shown.length} of {rows.length}
          {rows.length !== total ? ` matching DAGs (${total} in total)` : " DAGs"}
        </span>
        {rows.length > PAGE && (
          <button
            type="button"
            onClick={() => setShowAll((value) => !value)}
            className="font-medium text-slate-700 underline"
          >
            {showAll ? `Show the first ${PAGE}` : `Show all ${rows.length}`}
          </button>
        )}
      </div>
    </section>
  );
}
