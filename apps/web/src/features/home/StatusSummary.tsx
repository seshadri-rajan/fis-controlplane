import { STATE_META } from "./StatusBadge";
import { ALL_STATES, SEVERITY } from "./runModel";
import type { StateKey } from "./runModel";

type Counts = Record<StateKey, number>;

// Worst first, so what needs attention sits at the left.
const TILE_ORDER = ALL_STATES;
// A DAG run is only ever queued, running, success or failed, so those are always shown. The rest
// (task-only states, or anything unexpected) appear only when the feed actually has some.
const ALWAYS_SHOWN = new Set<StateKey>(["failed", "running", "queued", "success"]);

export default function StatusSummary({
  counts,
  total,
  active,
  onSelect,
}: {
  counts: Counts;
  total: number;
  /** The state the table is filtered to, or null for all. */
  active: StateKey | null;
  onSelect: (state: StateKey | null) => void;
}) {
  const tiles = TILE_ORDER.filter((state) => ALWAYS_SHOWN.has(state) || counts[state] > 0);
  const healthy = total === 0 ? 0 : Math.round((counts.success / total) * 100);
  // Green on the left, red on the right.
  const barOrder = [...TILE_ORDER].sort((a, b) => SEVERITY[b] - SEVERITY[a]);

  return (
    <section aria-label="DAG status summary" className="space-y-3">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))] gap-3">
        <button
          type="button"
          aria-pressed={active === null}
          onClick={() => onSelect(null)}
          className={`rounded-lg border border-t-4 border-slate-200 border-t-slate-800 bg-white p-3 text-left shadow-sm hover:shadow ${
            active === null ? "ring-2 ring-slate-900" : ""
          }`}
        >
          <div className="text-2xl font-semibold tabular-nums">{total}</div>
          <div className="text-xs font-medium text-slate-600">All DAGs</div>
        </button>

        {tiles.map((state) => {
          const meta = STATE_META[state];
          const count = counts[state];
          const selected = active === state;
          return (
            <button
              key={state}
              type="button"
              aria-pressed={selected}
              disabled={count === 0 && !selected}
              onClick={() => onSelect(selected ? null : state)}
              className={`rounded-lg border border-t-4 border-slate-200 bg-white p-3 text-left shadow-sm enabled:hover:shadow disabled:opacity-50 ${meta.accent} ${
                selected ? "ring-2 ring-slate-900" : ""
              }`}
            >
              <div className="text-2xl font-semibold tabular-nums">{count}</div>
              <div className="text-xs font-medium text-slate-600">{meta.label}</div>
            </button>
          );
        })}
      </div>

      {total > 0 && (
        <div className="space-y-1">
          <div
            role="img"
            aria-label={`${healthy}% of DAGs succeeded on their latest run`}
            className="flex h-2 overflow-hidden rounded-full bg-slate-200"
          >
            {barOrder.map((state) =>
              counts[state] > 0 ? (
                <div
                  key={state}
                  title={`${STATE_META[state].label}: ${counts[state]}`}
                  style={{ width: `${(counts[state] / total) * 100}%` }}
                  className={STATE_META[state].bar}
                />
              ) : null,
            )}
          </div>
          <p className="text-xs text-slate-500">
            {healthy}% of DAGs succeeded on their latest run.
          </p>
        </div>
      )}
    </section>
  );
}
