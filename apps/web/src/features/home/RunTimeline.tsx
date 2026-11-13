import { useState } from "react";

import { formatAgo, formatClock, formatDuration } from "./format";
import { STATE_META } from "./StatusBadge";
import { durationOf, hasResultButNoStart } from "./runModel";
import type { DagRow } from "./runModel";

const HOUR = 3_600_000;
const HALF_HOUR = HOUR / 2;
const WINDOWS = [3, 12, 24] as const;
type WindowHours = (typeof WINDOWS)[number];
// Minutes between labelled ticks, so each window has a sensible number of them.
const TICK_MINUTES: Record<WindowHours, number> = { 3: 30, 12: 120, 24: 240 };

function tooltip(row: DagRow, now: number): string {
  const { latest } = row;
  return [
    `${row.dagId}${row.source ? ` (${row.source})` : ""}`,
    STATE_META[latest.state].label,
    latest.startMs === null
      ? hasResultButNoStart(latest)
        ? "No start time reported"
        : "Not started yet"
      : `Started ${formatClock(latest.startMs, now)}`,
    latest.startMs === null ? "" : `Ran ${formatDuration(durationOf(latest, now))}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Tick times on the user's own clock, so "08:00" means 08:00 where they are (not in UTC). */
function localTicks(from: number, to: number, everyMinutes: number): number[] {
  const cursor = new Date(from);
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() < 30 ? 0 : 30);
  const ticks: number[] = [];
  for (; cursor.getTime() <= to; cursor.setTime(cursor.getTime() + HALF_HOUR)) {
    const minuteOfDay = cursor.getHours() * 60 + cursor.getMinutes();
    if (cursor.getTime() >= from && minuteOfDay % everyMinutes === 0) ticks.push(cursor.getTime());
  }
  return ticks;
}

const tickFormat = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });

export default function RunTimeline({
  rows,
  now,
  onOpen,
}: {
  rows: DagRow[];
  now: number;
  onOpen: (dagKey: string) => void;
}) {
  const [hours, setHours] = useState<WindowHours>(12);

  const from = now - hours * HOUR;
  // A little room after "now" so the marker isn't glued to the edge.
  const lookahead = (hours / 24) * HOUR;
  const span = hours * HOUR + lookahead;
  const pct = (ms: number) => Math.min(100, Math.max(0, ((ms - from) / span) * 100));
  const ticks = localTicks(from, now + lookahead, TICK_MINUTES[hours]);

  return (
    <section aria-labelledby="timeline-heading" className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-100 px-4 py-3">
        <div className="mr-auto">
          <h2 id="timeline-heading" className="text-sm font-semibold">
            Last {hours} hours
          </h2>
          <p className="text-xs text-slate-500">The latest run of each DAG. Click a bar to open it below.</p>
        </div>
        <div role="group" aria-label="Time window" className="flex gap-1 rounded-lg bg-slate-100 p-0.5">
          {WINDOWS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={hours === value}
              onClick={() => setHours(value)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                hours === value ? "bg-white shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {value} h
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-500">No DAGs to show.</p>
      ) : (
        <div className="px-4 py-3">
          <div className="flex">
            <div className="w-40 shrink-0 sm:w-52" />
            <div className="relative h-5 flex-1 text-[10px] text-slate-400">
              {ticks.map((t) => (
                <span key={t} style={{ left: `${pct(t)}%` }} className="absolute -translate-x-1/2 whitespace-nowrap">
                  {tickFormat.format(t)}
                </span>
              ))}
            </div>
          </div>

          <ul className="space-y-1">
            {rows.map((row) => {
              const { latest } = row;
              const end = latest.endMs ?? now;
              const inWindow = latest.startMs !== null && end >= from;
              const barStyle =
                latest.startMs !== null && inWindow
                  ? {
                      left: `${pct(latest.startMs)}%`,
                      width: `${Math.max(0.8, pct(end) - pct(latest.startMs))}%`,
                    }
                  : null;
              const label = latest.state === "other" ? latest.stateLabel : STATE_META[latest.state].label;

              return (
                <li key={row.key} className="flex items-center">
                  <div className="w-40 shrink-0 truncate pr-3 text-xs text-slate-700 sm:w-52" title={row.dagId}>
                    {row.dagId}
                    {row.source && <span className="ml-1.5 text-[10px] text-slate-400">{row.source}</span>}
                  </div>
                  <div className="relative h-5 flex-1 rounded bg-slate-50">
                    {ticks.map((t) => (
                      <span key={t} style={{ left: `${pct(t)}%` }} aria-hidden="true" className="absolute top-0 h-full w-px bg-slate-200/70" />
                    ))}
                    <span style={{ left: `${pct(now)}%` }} aria-hidden="true" className="absolute top-0 h-full w-px bg-slate-800/60" />

                    {barStyle && (
                      <button
                        type="button"
                        title={tooltip(row, now)}
                        aria-label={tooltip(row, now)}
                        onClick={() => onOpen(row.key)}
                        style={barStyle}
                        className={`absolute top-0.5 h-4 rounded-sm ${STATE_META[latest.state].bar} ${
                          latest.state === "running" ? "animate-pulse" : ""
                        } hover:brightness-90 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900`}
                      />
                    )}

                    {latest.startMs === null && !hasResultButNoStart(latest) && (
                      <button
                        type="button"
                        title={tooltip(row, now)}
                        aria-label={tooltip(row, now)}
                        onClick={() => onOpen(row.key)}
                        style={{ left: `${pct(now)}%` }}
                        className={`absolute top-0.5 h-4 -translate-x-full whitespace-nowrap rounded-sm px-1.5 text-[10px] font-medium leading-4 text-white ${STATE_META[latest.state].bar}`}
                      >
                        {label}
                      </button>
                    )}

                    {hasResultButNoStart(latest) && (
                      <span className="absolute inset-y-0 left-2 flex items-center text-[10px] text-slate-400">
                        no time reported
                      </span>
                    )}

                    {latest.startMs !== null && !inWindow && (
                      <span className="absolute inset-y-0 left-2 flex items-center text-[10px] text-slate-400">
                        last ran {formatAgo(latest.startMs, now)}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <p className="mt-2 text-[10px] text-slate-400">The dark line is now. Times are in your local time.</p>
        </div>
      )}
    </section>
  );
}
