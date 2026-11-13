import type { StateKey } from "./runModel";

export type StateMeta = {
  label: string;
  /** Pill: background, text and ring. */
  chip: string;
  /** The small dot beside a label. */
  dot: string;
  /** Solid fill for bars and sparkline cells. */
  bar: string;
  /** Top border of a summary tile. */
  accent: string;
};

// Not-yet-started states share slate: queued is filled, scheduled is hollow. Skipped and other are
// deliberately muted. Every use pairs the colour with a text label, so colour is never the only cue.
export const STATE_META: Record<StateKey, StateMeta> = {
  success: {
    label: "Success",
    chip: "bg-emerald-50 text-emerald-800 ring-emerald-600/25",
    dot: "bg-emerald-500",
    bar: "bg-emerald-500",
    accent: "border-t-emerald-500",
  },
  failed: {
    label: "Failed",
    chip: "bg-rose-50 text-rose-800 ring-rose-600/25",
    dot: "bg-rose-500",
    bar: "bg-rose-500",
    accent: "border-t-rose-500",
  },
  running: {
    label: "Running",
    chip: "bg-sky-50 text-sky-800 ring-sky-600/25",
    dot: "bg-sky-500 animate-pulse",
    bar: "bg-sky-500",
    accent: "border-t-sky-500",
  },
  up_for_retry: {
    label: "Up for retry",
    chip: "bg-amber-50 text-amber-900 ring-amber-600/30",
    dot: "bg-amber-500",
    bar: "bg-amber-500",
    accent: "border-t-amber-500",
  },
  upstream_failed: {
    label: "Upstream failed",
    chip: "bg-orange-50 text-orange-800 ring-orange-600/25",
    dot: "bg-orange-400",
    bar: "bg-orange-400",
    accent: "border-t-orange-400",
  },
  restarting: {
    label: "Restarting",
    chip: "bg-cyan-50 text-cyan-800 ring-cyan-600/25",
    dot: "bg-cyan-500 animate-pulse",
    bar: "bg-cyan-500",
    accent: "border-t-cyan-500",
  },
  deferred: {
    label: "Deferred",
    chip: "bg-violet-50 text-violet-800 ring-violet-600/25",
    dot: "bg-violet-400",
    bar: "bg-violet-400",
    accent: "border-t-violet-400",
  },
  up_for_reschedule: {
    label: "Up for reschedule",
    chip: "bg-indigo-50 text-indigo-800 ring-indigo-600/25",
    dot: "bg-indigo-400",
    bar: "bg-indigo-400",
    accent: "border-t-indigo-400",
  },
  none: {
    label: "No state yet",
    chip: "bg-white text-slate-500 ring-slate-300/70",
    dot: "border-[1.5px] border-slate-300 bg-white",
    bar: "bg-slate-200",
    accent: "border-t-slate-200",
  },
  removed: {
    label: "Removed",
    chip: "bg-stone-50 text-stone-500 ring-stone-400/40",
    dot: "bg-stone-300",
    bar: "bg-stone-300",
    accent: "border-t-stone-300",
  },
  queued: {
    label: "Queued",
    chip: "bg-slate-100 text-slate-700 ring-slate-500/25",
    dot: "bg-slate-500",
    bar: "bg-slate-500",
    accent: "border-t-slate-500",
  },
  scheduled: {
    label: "Scheduled",
    chip: "bg-white text-slate-600 ring-slate-400/50",
    dot: "border-[1.5px] border-slate-400 bg-white",
    bar: "bg-slate-300",
    accent: "border-t-slate-300",
  },
  skipped: {
    label: "Skipped",
    chip: "bg-stone-100 text-stone-600 ring-stone-500/25",
    dot: "bg-stone-400",
    bar: "bg-stone-400",
    accent: "border-t-stone-400",
  },
  other: {
    label: "Other",
    chip: "bg-white text-zinc-600 ring-zinc-400/50",
    dot: "bg-zinc-400",
    bar: "bg-zinc-400",
    accent: "border-t-zinc-400",
  },
};

export function StatusDot({ state }: { state: StateKey }) {
  return <span aria-hidden="true" className={`inline-block h-2 w-2 shrink-0 rounded-full ${STATE_META[state].dot}`} />;
}

/** `label` overrides the name, so an unrecognised state shows what the feed actually said. */
export default function StatusBadge({ state, label }: { state: StateKey; label?: string }) {
  const meta = STATE_META[state];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${meta.chip}`}
    >
      <StatusDot state={state} />
      {state === "other" ? (label ?? meta.label) : meta.label}
    </span>
  );
}
