import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { listRunHistory } from "../../lib/api/client";
import AttentionPanel from "./AttentionPanel";
import DagTable from "./DagTable";
import { formatClock, plural } from "./format";
import RunTimeline from "./RunTimeline";
import StatusSummary from "./StatusSummary";
import TaskFinder from "./TaskFinder";
import { attentionItems, buildDashboard, countStates, groupsForUnit, sortRows } from "./runModel";
import type { SortMode, StateKey } from "./runModel";
import { useNow } from "./useNow";

const REFRESH_MS = 30_000;

function greeting(now: number): string {
  const hour = new Date(now).getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

function Skeleton() {
  return (
    <div role="status" aria-label="Loading the latest runs" className="animate-pulse space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-[72px] rounded-lg bg-slate-200" />
        ))}
      </div>
      <div className="h-64 rounded-lg bg-slate-200" />
      <div className="h-80 rounded-lg bg-slate-200" />
    </div>
  );
}

export default function HomePage() {
  const now = useNow(REFRESH_MS);
  const history = useQuery({ queryKey: ["run-history"], queryFn: listRunHistory, refetchInterval: REFRESH_MS });

  const [unit, setUnit] = useState("");
  const [status, setStatus] = useState<StateKey | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("attention");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [scrollTo, setScrollTo] = useState<{ key: string; nonce: number } | null>(null);

  const dashboard = useMemo(() => (history.data ? buildDashboard(history.data) : null), [history.data]);
  // The business unit narrows everything. The status and search filters narrow only the table
  // and the timeline, so the summary and "needs attention" keep showing the whole picture.
  const unitRows = useMemo(
    () => (dashboard ? dashboard.dags.filter((row) => !unit || row.source === unit) : []),
    [dashboard, unit],
  );
  const counts = useMemo(() => countStates(unitRows.map((row) => row.latest)), [unitRows]);
  const attention = useMemo(() => attentionItems(unitRows), [unitRows]);
  const taskGroups = useMemo(() => (dashboard ? groupsForUnit(dashboard.taskGroups, unit) : []), [dashboard, unit]);
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return sortRows(
      unitRows.filter(
        (row) => (status === null || row.latest.state === status) && (!needle || row.dagId.toLowerCase().includes(needle)),
      ),
      sort,
    );
  }, [unitRows, status, search, sort]);

  const toggleRow = (key: string) =>
    setExpanded((previous) => {
      const next = new Set(previous);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  // Open a DAG in the table: clear any filter that would hide it, expand it and scroll to it.
  const openDag = (key: string) => {
    setStatus(null);
    setSearch("");
    setExpanded((previous) => new Set(previous).add(key));
    setScrollTo({ key, nonce: Date.now() });
  };

  const clearFilters = () => {
    setStatus(null);
    setSearch("");
  };

  const updatedAt = history.dataUpdatedAt ? formatClock(history.dataUpdatedAt, now) : null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="mr-auto">
          <h1 className="text-2xl font-semibold">{greeting(now)}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Here is the latest run of every DAG and task
            {dashboard && ` · ${plural(dashboard.dags.length, "DAG")}, ${plural(dashboard.taskCount, "task")}`}
            {updatedAt && ` · updated ${updatedAt}`}
          </p>
        </div>

        {dashboard && dashboard.businessUnits.length > 1 && (
          <div>
            <label htmlFor="unit" className="mb-1 block text-xs font-medium text-slate-600">
              Business unit
            </label>
            <select
              id="unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              <option value="">All business units</option>
              {dashboard.businessUnits.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          type="button"
          onClick={() => history.refetch()}
          disabled={history.isFetching}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          {history.isFetching ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      {history.isPending && <Skeleton />}

      {history.isError && !history.data && (
        <div role="alert" className="max-w-xl rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          <p className="font-medium">The latest runs couldn’t be loaded.</p>
          <p className="mt-1">{(history.error as Error).message}</p>
          <button
            type="button"
            onClick={() => history.refetch()}
            className="mt-3 rounded-md bg-rose-900 px-3 py-1.5 text-sm font-medium text-white"
          >
            Try again
          </button>
        </div>
      )}

      {history.isError && history.data && (
        <p role="alert" className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          Couldn’t refresh just now, so this is the data from {updatedAt}.
        </p>
      )}

      {dashboard && dashboard.dags.length === 0 && dashboard.taskGroups.length === 0 && (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-12 text-center shadow-sm">
          <p className="font-medium">No runs have been reported yet.</p>
          <p className="mt-1 text-sm text-slate-500">DAGs and tasks appear here as soon as they run.</p>
        </div>
      )}

      {dashboard && (dashboard.dags.length > 0 || dashboard.taskGroups.length > 0) && (
        <>
          <StatusSummary counts={counts} total={unitRows.length} active={status} onSelect={setStatus} />

          <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <AttentionPanel items={attention} now={now} onOpen={openDag} />
            <RunTimeline rows={visible} now={now} onOpen={openDag} />
          </div>

          <DagTable
            rows={visible}
            total={unitRows.length}
            now={now}
            expanded={expanded}
            onToggle={toggleRow}
            scrollTo={scrollTo}
            search={search}
            onSearch={setSearch}
            sort={sort}
            onSort={setSort}
            status={status}
            onClearStatus={() => setStatus(null)}
            onClearAll={clearFilters}
          />

          <TaskFinder groups={taskGroups} now={now} onOpenDag={openDag} />

          <footer className="space-y-1 pb-4 text-xs text-slate-500">
            <p>
              Reported by each business unit’s Airflow listeners and refreshed every {REFRESH_MS / 1000} seconds. A
              dropped event isn’t detected, so treat this view as a guide rather than the source of truth.
            </p>
            {(dashboard.duplicates > 0 || dashboard.ignored > 0) && (
              <p>
                {dashboard.duplicates > 0 &&
                  `${dashboard.duplicates} repeated ${dashboard.duplicates === 1 ? "record was" : "records were"} collapsed. `}
                {dashboard.ignored > 0 &&
                  `${dashboard.ignored} ${dashboard.ignored === 1 ? "record" : "records"} without a DAG name ${dashboard.ignored === 1 ? "was" : "were"} ignored.`}
              </p>
            )}
          </footer>
        </>
      )}
    </div>
  );
}
