export function formatDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return "–";
  const seconds = Math.round(ms / 1000);
  if (seconds < 1) return "<1s";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${String(seconds % 60).padStart(2, "0")}s`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });
const dateFormat = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });

const sameDay = (a: number, b: number): boolean => new Date(a).toDateString() === new Date(b).toDateString();

/** "14:05" today, "17 Aug, 14:05" on any other day. */
export function formatClock(ms: number | null, now: number): string {
  if (ms === null) return "–";
  const time = timeFormat.format(ms);
  return sameDay(ms, now) ? time : `${dayFormat.format(ms)}, ${time}`;
}

/** "1 DAG", "14 DAGs". */
export const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? "" : "s"}`;

export function formatAgo(ms: number | null, now: number): string {
  if (ms === null) return "";
  const minutes = Math.floor((now - ms) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

/** "2026-08-17" to "17 Aug 2026". Falls back to the feed's own text. */
export function formatBusinessDate(iso: string | null, raw: string | null | undefined): string {
  if (iso) {
    const [year, month, day] = iso.split("-").map(Number);
    return dateFormat.format(new Date(year, month - 1, day));
  }
  return raw || "–";
}
