import type { RunRecord } from "../proposed";

/*
 * Mock run history in the shape of req-details/dag-history/run_history.json, generated relative to
 * "now" so the dashboard always looks current. States are Airflow's: DAG runs are queued, running,
 * success or failed, and tasks use the full list. It includes the awkward cases the real feed is
 * expected to have (API-029 to API-031): rows repeated exactly, several runs a day, runs that
 * haven't started (no start_date), and a DAG name used by two business units.
 */

const MIN = 60_000;
const DAY_MIN = 1_440;
const HISTORY_DAYS = 8;
const TASK_HISTORY_DAYS = 2;

type Step = {
  /** Minutes ago the run started; null when it hasn't started (queued). */
  ago: number | null;
  /** How long it ran, in minutes; leave out for a run still going or not started. */
  mins?: number;
  state: string;
};

type Scenario = {
  source: string;
  dag: string;
  /** Today's runs. The one that started most recently is the latest. */
  today: Step[];
  /** The latest run's tasks, in execution order, with each task's state. */
  tasks?: Array<[string, string]>;
  /** Where yesterday's run sits when today has nothing started yet. */
  pastAgo?: number;
  typicalMins: number;
  /** Report every DAG record twice, as the sample file does. */
  duplicated?: boolean;
};

const SCENARIOS: Scenario[] = [
  {
    source: "FFIO",
    dag: "amt_ap139412_exit_code_downstream",
    // Three runs today: the latest only is shown.
    today: [
      { ago: 420, mins: 1.02, state: "failed" },
      { ago: 300, mins: 1.05, state: "failed" },
      { ago: 95, mins: 2.07, state: "success" },
    ],
    tasks: [["start", "success"], ["run_exit_code", "success"], ["end", "success"]],
    typicalMins: 2,
    duplicated: true,
  },
  {
    source: "FFIO",
    dag: "parent_dag",
    today: [{ ago: 52, mins: 6.2, state: "failed" }],
    tasks: [
      ["start", "success"],
      ["trigger_child_1", "success"],
      ["trigger_child_2", "failed"],
      ["end", "upstream_failed"],
    ],
    typicalMins: 6,
  },
  {
    source: "FFIO",
    dag: "child_dag_1",
    today: [{ ago: 50, mins: 1.4, state: "success" }],
    tasks: [["start", "success"], ["end", "success"]],
    typicalMins: 1.5,
  },
  {
    source: "AM",
    dag: "child_dag_2",
    today: [{ ago: 14, state: "running" }],
    tasks: [["start", "success"], ["load", "running"], ["end", "queued"]],
    typicalMins: 15,
  },
  {
    source: "FFIO",
    dag: "parent_dag1",
    // The DAG is still running while its task waits to retry.
    today: [{ ago: 33, state: "running" }],
    tasks: [["parent_hello_world", "success"], ["trigger_child1", "up_for_retry"], ["trigger_child2", "none"]],
    typicalMins: 4,
  },
  { source: "AM", dag: "child1", today: [{ ago: null, state: "queued" }], pastAgo: 75, typicalMins: 3 },
  {
    source: "AM",
    dag: "child2",
    today: [{ ago: 18, state: "running" }],
    tasks: [["start", "success"], ["wait_for_file", "up_for_reschedule"], ["load", "scheduled"], ["end", "none"]],
    typicalMins: 3,
  },
  {
    source: "AM",
    dag: "eod_pricing_extract",
    today: [{ ago: 55, state: "running" }],
    tasks: [
      ["start", "success"],
      ["wait_for_market_close", "deferred"],
      ["extract", "scheduled"],
      ["end", "none"],
    ],
    typicalMins: 22,
  },
  {
    source: "FFIO",
    dag: "cash_forecast_refresh",
    today: [{ ago: 180, mins: 12.7, state: "success" }],
    tasks: [
      ["start", "success"],
      ["extract", "success"],
      ["publish", "success"],
      ["legacy_cleanup", "removed"],
      ["end", "success"],
    ],
    typicalMins: 12,
  },
  {
    source: "FFIO",
    dag: "ap_gl_posting_nightly",
    today: [{ ago: 610, mins: 41, state: "failed" }],
    tasks: [["start", "success"], ["post_gl", "failed"], ["end", "skipped"]],
    typicalMins: 40,
  },
  {
    source: "AM",
    dag: "fmtwrp_hourly_reconcile",
    today: [
      { ago: 242, mins: 4.4, state: "success" },
      { ago: 182, mins: 4.6, state: "success" },
      { ago: 122, mins: 4.5, state: "success" },
      { ago: 62, mins: 4.5, state: "success" },
    ],
    tasks: [["start", "success"], ["reconcile", "success"], ["end", "success"]],
    typicalMins: 4.5,
  },
  {
    source: "FFIO",
    dag: "amt_ap139412_load_positions",
    today: [{ ago: 165, state: "running" }],
    tasks: [["start", "success"], ["extract", "success"], ["transform", "restarting"], ["end", "queued"]],
    typicalMins: 38,
  },
  // The same DAG name in two business units: they are different DAGs.
  {
    source: "FFIO",
    dag: "daily_reconcile",
    today: [{ ago: 25, mins: 3, state: "success" }],
    tasks: [["start", "success"], ["compare", "success"], ["end", "success"]],
    typicalMins: 3,
  },
  {
    source: "AM",
    dag: "daily_reconcile",
    today: [{ ago: 28, mins: 2.1, state: "failed" }],
    tasks: [["start", "success"], ["compare", "failed"], ["end", "upstream_failed"]],
    typicalMins: 3,
  },
];

// Task states that have no start or end time yet.
const NOT_STARTED = new Set(["queued", "scheduled", "none", "upstream_failed", "skipped", "removed"]);
// Started, not finished: no end_date yet.
const IN_PROGRESS = new Set(["running", "restarting", "deferred", "up_for_reschedule"]);

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

/** UTC-04:00 with 6 fractional digits, like the sample feed. */
function stamp(ms: number): string {
  return `${new Date(ms - 4 * 60 * MIN).toISOString().slice(0, 23)}457-04:00`;
}

function elapsedText(ms: number): string {
  const total = Math.max(0, ms);
  const seconds = Math.floor(total / 1000);
  const micros = Math.round((total % 1000) * 1000);
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}.${pad(micros, 6)}`;
}

/** YYMMDD of the machine's local date, as in the sample. */
function businessDate(ms: number): string {
  const date = new Date(ms);
  return `${pad(date.getFullYear() % 100)}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

const hash = (text: string): number => [...text].reduce((total, ch) => (total * 31 + ch.charCodeAt(0)) % 9973, 7);

function record(
  scenario: Scenario,
  task: string | null,
  state: string,
  start: number | null,
  end: number | null,
  businessMs: number,
): RunRecord {
  return {
    source: scenario.source,
    type: task === null ? "DAG" : "Task",
    state,
    dag_id: scenario.dag,
    task_id: task,
    end_date: end === null ? null : stamp(end),
    start_date: start === null ? null : stamp(start),
    elapsed_time: start !== null && end !== null ? elapsedText(end - start) : null,
    business_date: businessDate(businessMs),
  };
}

/** Spreads a DAG run's tasks evenly across it. */
function taskRecords(
  scenario: Scenario,
  tasks: Array<[string, string]>,
  runStart: number,
  runMins: number,
  now: number,
  override?: string,
): RunRecord[] {
  const slot = (runMins * MIN) / tasks.length;
  return tasks.map(([name, declared], index) => {
    const state = override ?? declared;
    if (NOT_STARTED.has(state)) return record(scenario, name, state, null, null, runStart);
    const start = runStart + index * slot;
    const end = IN_PROGRESS.has(state) ? null : start + slot * 0.9;
    return record(scenario, name, state, start, end, runStart > now ? now : runStart);
  });
}

export function buildRunHistory(now: number = Date.now()): RunRecord[] {
  const at = (ago: number) => now - ago * MIN;
  const out: RunRecord[] = [];

  for (const scenario of SCENARIOS) {
    const dagRecords: RunRecord[] = [];
    const started = scenario.today.filter((step) => step.ago !== null);

    for (const step of scenario.today) {
      const start = step.ago === null ? null : at(step.ago);
      const end = start !== null && step.mins !== undefined ? start + step.mins * MIN : null;
      dagRecords.push(record(scenario, null, step.state, start, end, now));
    }

    // Earlier days: one run a day, mostly successful, with the odd failure.
    const base = started.length > 0 ? Math.max(...started.map((step) => step.ago ?? 0)) : (scenario.pastAgo ?? 90);
    for (let day = 1; day <= HISTORY_DAYS; day += 1) {
      const start = at(base + day * DAY_MIN);
      const mins = scenario.typicalMins * (0.9 + ((hash(scenario.dag) + day) % 5) * 0.06);
      const failed = (hash(scenario.dag + scenario.source) + day) % 7 === 0;
      dagRecords.push(record(scenario, null, failed ? "failed" : "success", start, start + mins * MIN, start));

      if (scenario.tasks && day <= TASK_HISTORY_DAYS) {
        out.push(...taskRecords(scenario, scenario.tasks, start, mins, now, "success"));
      }
    }

    // Today's tasks belong to the run that started most recently.
    const latest = [...started].sort((a, b) => (a.ago ?? 0) - (b.ago ?? 0))[0];
    if (latest && scenario.tasks) {
      const runStart = at(latest.ago ?? 0);
      const runMins = latest.mins ?? Math.max(3, (now - runStart) / MIN);
      out.push(...taskRecords(scenario, scenario.tasks, runStart, runMins, now));
    }

    out.push(...dagRecords);
    if (scenario.duplicated) out.push(...dagRecords.map((r) => ({ ...r })));
  }

  return out;
}

let cached: RunRecord[] | null = null;

/** Built once per page load, so a running DAG's duration keeps growing instead of resetting. */
export function runHistory(): RunRecord[] {
  cached ??= buildRunHistory();
  return cached;
}
