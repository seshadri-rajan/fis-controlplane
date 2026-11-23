import type { RunRecord } from "../../lib/api/proposed";

/*
 * The states are Airflow's. A DAG run is queued, running, success or failed; a task run can be any
 * of them.
 */
export type KnownState =
  | "success"
  | "failed"
  | "running"
  | "queued"
  | "scheduled"
  | "up_for_retry"
  | "up_for_reschedule"
  | "upstream_failed"
  | "skipped"
  | "deferred"
  | "restarting"
  | "removed"
  | "none";

/** Anything the feed sends that isn't a known state is "other", shown with its own label. */
export type StateKey = KnownState | "other";
export type RunKind = "DAG" | "Task";

/** Worst first. Lower is worse: drives sorting, "worst state" roll-ups and the order of tiles. */
export const ALL_STATES: readonly StateKey[] = [
  "failed",
  "up_for_retry",
  "upstream_failed",
  "restarting",
  "running",
  "deferred",
  "up_for_reschedule",
  "queued",
  "scheduled",
  "none",
  "other",
  "skipped",
  "removed",
  "success",
];

export const SEVERITY = Object.fromEntries(ALL_STATES.map((state, index) => [state, index])) as Record<
  StateKey,
  number
>;

// Words the feed might use for a state the list above names differently.
const STATE_ALIASES: Record<string, KnownState> = { retry: "up_for_retry" };

/** Needs a person to look: failed, or failed and about to be retried. Upstream failures are a knock-on. */
export const needsAttention = (state: StateKey): boolean => state === "failed" || state === "up_for_retry";

/** Runs that have a final result. A run waiting to retry, reschedule or resume is not finished. */
export const isFinished = (state: StateKey): boolean =>
  state === "success" ||
  state === "failed" ||
  state === "skipped" ||
  state === "upstream_failed" ||
  state === "removed";

export type Run = {
  kind: RunKind;
  /** Business unit; "" when the feed omits it. */
  source: string;
  dagId: string;
  taskId: string | null;
  state: StateKey;
  /** The state as reported, shown for "other" states. */
  stateLabel: string;
  startMs: number | null;
  endMs: number | null;
  elapsedMs: number | null;
  /** YYYY-MM-DD, or null when missing or unrecognised. */
  businessDate: string | null;
  raw: RunRecord;
};

/**
 * A run that has a result but no start time. The feed is incomplete here: it did start, we just
 * can't say when. (A queued, scheduled, skipped or upstream-failed run with no start really hasn't started.)
 */
export const hasResultButNoStart = (run: Run): boolean =>
  run.startMs === null && (run.state === "success" || run.state === "failed");

export type DagRow = {
  /** Business unit + DAG name: the same dag_id can exist in two business units (O-15). */
  key: string;
  source: string;
  dagId: string;
  latest: Run;
  /** The last finished run before `latest`, only when `latest` hasn't finished yet. */
  previous: Run | null;
  /** How many distinct runs share the latest run's business date. */
  runsOnDate: number;
  /** Up to 10 runs, oldest first, ending with `latest`. */
  recent: Run[];
  /** The latest run of each task in this DAG, in execution order. */
  tasks: Run[];
};

export type TaskGroup = {
  taskId: string;
  /** The latest run of this task in each DAG that has it. */
  entries: Run[];
  counts: Record<StateKey, number>;
  worst: StateKey;
};

export type Dashboard = {
  dags: DagRow[];
  taskGroups: TaskGroup[];
  businessUnits: string[];
  /** Distinct (DAG, task) pairs. */
  taskCount: number;
  /** Exact repeats that were collapsed. */
  duplicates: number;
  /** Records with no usable DAG name. */
  ignored: number;
};

// ---------------------------------------------------------------- parsing

/**
 * Engines emit 5-6 fractional digits but JavaScript only guarantees 3, so trim or pad to 3
 * before parsing.
 */
export function parseTimestamp(value: unknown): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const normalised = value
    .trim()
    .replace(/(\.\d+)(?=Z$|[+-]\d{2}:?\d{2}$|$)/, (fraction) => fraction.slice(0, 4).padEnd(4, "0"));
  const ms = Date.parse(normalised);
  return Number.isNaN(ms) ? null : ms;
}

/** "HH:MM:SS.ffffff" to milliseconds. */
export function parseElapsed(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /^(\d+):(\d{2}):(\d{2})(?:\.(\d+))?$/.exec(value.trim());
  if (!match) return null;
  const seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  const fraction = match[4] ? Number(`0.${match[4]}`) : 0;
  return Math.round((seconds + fraction) * 1000);
}

/** "260817" and "20260817" and "2026-08-17" all become "2026-08-17". */
export function parseBusinessDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  let year: number;
  let month: number;
  let day: number;
  let match = /^(\d{2})(\d{2})(\d{2})$/.exec(text);
  if (match) {
    year = 2000 + Number(match[1]);
    [month, day] = [Number(match[2]), Number(match[3])];
  } else if ((match = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(text))) {
    [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    return null;
  }
  const probe = new Date(Date.UTC(year, month - 1, day));
  const real =
    probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
  return real ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` : null;
}

export function stateOf(value: unknown): { key: StateKey; label: string } {
  const text = typeof value === "string" ? value.trim() : "";
  const lower = text.toLowerCase().replace(/[\s-]+/g, "_");
  const key: string = STATE_ALIASES[lower] ?? lower;
  if (key !== "other" && (ALL_STATES as readonly string[]).includes(key)) return { key: key as KnownState, label: key };
  return { key: "other", label: text || "unknown" };
}

/** Returns null for a record that can't be placed: DAG name is mandatory, and so is a task's name. */
export function toRun(record: RunRecord): Run | null {
  const dagId = typeof record.dag_id === "string" ? record.dag_id.trim() : "";
  if (!dagId) return null;

  const taskName = typeof record.task_id === "string" ? record.task_id.trim() : "";
  const type = typeof record.type === "string" ? record.type.trim().toLowerCase() : "";
  // `type` wins when it says so; otherwise a task name means a task run.
  const kind: RunKind = type === "task" ? "Task" : type === "dag" ? "DAG" : taskName ? "Task" : "DAG";
  if (kind === "Task" && !taskName) return null;

  const { key, label } = stateOf(record.state);
  const startMs = parseTimestamp(record.start_date);
  const endMs = parseTimestamp(record.end_date);
  let elapsedMs = parseElapsed(record.elapsed_time);
  if (elapsedMs === null && startMs !== null && endMs !== null) elapsedMs = Math.max(0, endMs - startMs);

  return {
    kind,
    source: typeof record.source === "string" ? record.source.trim() : "",
    dagId,
    taskId: kind === "Task" ? taskName : null,
    state: key,
    stateLabel: label,
    startMs,
    endMs,
    elapsedMs,
    businessDate: parseBusinessDate(record.business_date),
    raw: record,
  };
}

// ---------------------------------------------------------------- ordering

export const dagKey = (run: Pick<Run, "source" | "dagId">): string => `${run.source}\u0000${run.dagId}`;
const taskKey = (run: Run): string => `${dagKey(run)}\u0000${run.taskId}`;

/**
 * Whether `a` is a later run than `b`. A run with no start yet (queued, scheduled) is the
 * newest thing that DAG has. For the same start, the record that has an end is the later
 * snapshot of that run.
 */
function isNewer(a: Run, b: Run): boolean {
  const aStart = a.startMs ?? Infinity;
  const bStart = b.startMs ?? Infinity;
  if (aStart !== bStart) return aStart > bStart;
  return (a.endMs ?? -Infinity) > (b.endMs ?? -Infinity);
}

const oldestFirst = (a: Run, b: Run): number => (isNewer(a, b) ? 1 : isNewer(b, a) ? -1 : 0);
const newestOf = (runs: readonly Run[]): Run => runs.reduce((best, run) => (isNewer(run, best) ? run : best));

const localDay = (ms: number): string => {
  const date = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const dayOf = (run: Run): string | null =>
  run.businessDate ?? (run.startMs === null ? null : localDay(run.startMs));

/** A record identical in every field is the same run reported twice. */
const identity = (run: Run): string =>
  JSON.stringify([run.kind, run.source, run.dagId, run.taskId, run.stateLabel, run.startMs, run.endMs, run.businessDate]);

const bySeverityThenName = (a: Run, b: Run): number =>
  SEVERITY[a.state] - SEVERITY[b.state] || a.dagId.localeCompare(b.dagId) || a.source.localeCompare(b.source);

const executionOrder = (a: Run, b: Run): number => {
  const aStart = a.startMs ?? Infinity;
  const bStart = b.startMs ?? Infinity;
  return aStart === bStart ? (a.taskId ?? "").localeCompare(b.taskId ?? "") : aStart - bStart;
};

export function countStates(runs: readonly Pick<Run, "state">[]): Record<StateKey, number> {
  const counts = Object.fromEntries(ALL_STATES.map((state) => [state, 0])) as Record<StateKey, number>;
  for (const run of runs) counts[run.state] += 1;
  return counts;
}

// ---------------------------------------------------------------- dashboard

export function buildDashboard(records: readonly RunRecord[]): Dashboard {
  const seen = new Set<string>();
  const dagRuns = new Map<string, Run[]>();
  const taskRuns = new Map<string, Run[]>();
  let duplicates = 0;
  let ignored = 0;

  for (const record of records) {
    const run = toRun(record);
    if (!run) {
      ignored += 1;
      continue;
    }
    const id = identity(run);
    if (seen.has(id)) {
      duplicates += 1;
      continue;
    }
    seen.add(id);
    const bucket = run.kind === "DAG" ? dagRuns : taskRuns;
    const key = run.kind === "DAG" ? dagKey(run) : taskKey(run);
    bucket.set(key, [...(bucket.get(key) ?? []), run]);
  }

  // The latest run of each task, per DAG. Task records carry no run id (API-030), so they can't be
  // tied to a particular DAG run.
  const latestTasks = [...taskRuns.values()].map(newestOf);
  const tasksByDag = new Map<string, Run[]>();
  for (const task of latestTasks) {
    tasksByDag.set(dagKey(task), [...(tasksByDag.get(dagKey(task)) ?? []), task]);
  }

  const dags: DagRow[] = [...dagRuns.entries()].map(([key, runs]) => {
    const sorted = [...runs].sort(oldestFirst);
    const latest = sorted[sorted.length - 1];
    const latestDay = dayOf(latest);
    const previous = isFinished(latest.state)
      ? null
      : ([...sorted].reverse().find((run) => run !== latest && isFinished(run.state)) ?? null);
    return {
      key,
      source: latest.source,
      dagId: latest.dagId,
      latest,
      previous,
      runsOnDate: latestDay === null ? 1 : runs.filter((run) => dayOf(run) === latestDay).length,
      recent: sorted.slice(-10),
      tasks: [...(tasksByDag.get(key) ?? [])].sort(executionOrder),
    };
  });

  const byTaskName = new Map<string, Run[]>();
  for (const task of latestTasks) {
    byTaskName.set(task.taskId ?? "", [...(byTaskName.get(task.taskId ?? "") ?? []), task]);
  }
  const taskGroups: TaskGroup[] = [...byTaskName.entries()].map(([taskId, entries]) => {
    const sorted = [...entries].sort(bySeverityThenName);
    return { taskId, entries: sorted, counts: countStates(sorted), worst: sorted[0].state };
  });

  return {
    dags,
    taskGroups,
    businessUnits: [...new Set(dags.map((row) => row.source).concat(latestTasks.map((t) => t.source)))]
      .filter(Boolean)
      .sort(),
    taskCount: latestTasks.length,
    duplicates,
    ignored,
  };
}

// ---------------------------------------------------------------- views

export type SortMode = "attention" | "recent" | "name";

export function sortRows(rows: readonly DagRow[], mode: SortMode): DagRow[] {
  const recency = (row: DagRow) => row.latest.startMs ?? Infinity;
  const compare: Record<SortMode, (a: DagRow, b: DagRow) => number> = {
    attention: (a, b) =>
      SEVERITY[a.latest.state] - SEVERITY[b.latest.state] || recency(b) - recency(a) || a.dagId.localeCompare(b.dagId),
    recent: (a, b) => recency(b) - recency(a) || a.dagId.localeCompare(b.dagId),
    name: (a, b) => a.dagId.localeCompare(b.dagId) || a.source.localeCompare(b.source),
  };
  return [...rows].sort(compare[mode]);
}

/**
 * A task counts for the current picture only if it started at or after the DAG's latest run: an
 * older failure may belong to a previous run that has since been fixed.
 */
export function isCurrentTask(row: DagRow, task: Run): boolean {
  const dagStart = row.latest.startMs;
  return task.startMs === null || dagStart === null || task.startMs >= dagStart - 1000;
}

export type AttentionItem = { row: DagRow; tasks: Run[] };

/** DAGs that are failing, or that have a task failing or waiting to retry right now. */
export function attentionItems(rows: readonly DagRow[]): AttentionItem[] {
  const severity = (item: AttentionItem): number =>
    Math.min(
      needsAttention(item.row.latest.state) ? SEVERITY[item.row.latest.state] : Infinity,
      ...item.tasks.map((task) => SEVERITY[task.state]),
    );
  const recency = (item: AttentionItem): number => item.row.latest.endMs ?? item.row.latest.startMs ?? 0;

  return rows
    .map((row) => ({
      row,
      tasks: row.tasks.filter((task) => needsAttention(task.state) && isCurrentTask(row, task)),
    }))
    .filter((item) => needsAttention(item.row.latest.state) || item.tasks.length > 0)
    .sort((a, b) => severity(a) - severity(b) || recency(b) - recency(a) || a.row.dagId.localeCompare(b.row.dagId));
}

/** Task groups limited to one business unit, with their counts recomputed. */
export function groupsForUnit(groups: readonly TaskGroup[], unit: string): TaskGroup[] {
  if (!unit) return [...groups];
  const result: TaskGroup[] = [];
  for (const group of groups) {
    const entries = group.entries.filter((entry) => entry.source === unit);
    // Entries are already worst first, so the first one is the worst.
    if (entries.length > 0) result.push({ taskId: group.taskId, entries, counts: countStates(entries), worst: entries[0].state });
  }
  return result;
}

/** Live for a run still going, otherwise what the feed reported. */
export function durationOf(run: Run, now: number): number | null {
  if (run.state === "running" && run.endMs === null && run.startMs !== null) {
    return Math.max(0, now - run.startMs);
  }
  if (run.elapsedMs !== null) return run.elapsedMs;
  if (run.startMs !== null && run.endMs !== null) return Math.max(0, run.endMs - run.startMs);
  return null;
}
