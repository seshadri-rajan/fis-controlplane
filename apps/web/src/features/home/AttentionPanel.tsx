import { useState } from "react";

import { formatAgo, formatDuration } from "./format";
import StatusBadge, { STATE_META, StatusDot } from "./StatusBadge";
import { durationOf } from "./runModel";
import type { AttentionItem } from "./runModel";

const COLLAPSED = 5;

function headline(item: AttentionItem, now: number): string {
  const { latest } = item.row;
  const when = latest.endMs ?? latest.startMs;
  switch (latest.state) {
    case "failed":
      return `Failed ${formatAgo(when, now)}, after ${formatDuration(durationOf(latest, now))}`;
    case "up_for_retry":
      return `Attempt failed ${formatAgo(when, now)}, waiting to retry`;
    case "running":
      return `Running for ${formatDuration(durationOf(latest, now))}`;
    default:
      return item.row.latest.stateLabel;
  }
}

export default function AttentionPanel({
  items,
  now,
  onOpen,
}: {
  items: AttentionItem[];
  now: number;
  onOpen: (dagKey: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? items : items.slice(0, COLLAPSED);

  return (
    <section aria-labelledby="attention-heading" className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 id="attention-heading" className="text-sm font-semibold">
          Needs attention
        </h2>
        {items.length > 0 && (
          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800">
            {items.length}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <div aria-hidden="true" className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-lg text-emerald-700">
            ✓
          </div>
          <p className="text-sm font-medium">All clear</p>
          <p className="mt-1 text-xs text-slate-500">Nothing is failing or waiting to retry.</p>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-slate-100">
            {shown.map((item) => (
              <li key={item.row.key}>
                <button
                  type="button"
                  onClick={() => onOpen(item.row.key)}
                  className="w-full px-4 py-3 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-slate-900"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{item.row.dagId}</span>
                    <StatusBadge state={item.row.latest.state} label={item.row.latest.stateLabel} />
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {item.row.source && <span className="mr-1.5 rounded bg-slate-100 px-1 py-0.5 font-medium text-slate-600">{item.row.source}</span>}
                    {headline(item, now)}
                  </p>
                  {item.tasks.length > 0 && (
                    <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Tasks needing attention">
                      {item.tasks.slice(0, 3).map((task) => (
                        <li
                          key={task.taskId}
                          className="inline-flex items-center gap-1 rounded bg-slate-50 px-1.5 py-0.5 text-xs text-slate-700 ring-1 ring-inset ring-slate-200"
                        >
                          <StatusDot state={task.state} />
                          {task.taskId}
                          <span className="text-slate-500">· {task.state === "other" ? task.stateLabel : STATE_META[task.state].label.toLowerCase()}</span>
                        </li>
                      ))}
                      {item.tasks.length > 3 && (
                        <li className="px-1 py-0.5 text-xs text-slate-500">+{item.tasks.length - 3} more</li>
                      )}
                    </ul>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {items.length > COLLAPSED && (
            <button
              type="button"
              onClick={() => setShowAll((value) => !value)}
              className="w-full border-t border-slate-100 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              {showAll ? "Show fewer" : `Show all ${items.length}`}
            </button>
          )}
        </>
      )}
    </section>
  );
}
