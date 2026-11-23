/**
 * Today as YYYY-MM-DD in the browser's local timezone. Which timezone a calendar's "today" means
 * is not defined by the spec (API-027), so the local date is the assumption.
 */
export function todayIso(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** ISO dates compare correctly as strings. Dates before `today` are history and read-only. */
export const isPastDate = (iso: string, today: string = todayIso()): boolean => iso < today;
