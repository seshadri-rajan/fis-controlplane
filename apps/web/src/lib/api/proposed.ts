/**
 * Demo run-history response from the shared backend (API-029). The list endpoint returns the latest
 * record per source/type/DAG/task; `/v1/run-history/demo` returns all generated demo records.
 * Live ingestion and persistence are not implemented.
 */
export type RunRecord = {
  /** Business unit, for example "FFIO" or "AM". */
  source?: string | null;
  /** "DAG" or "Task". */
  type?: string | null;
  /** Airflow's names (see API-031), for example success, failed, running, up_for_retry. */
  state?: string | null;
  /** Mandatory. */
  dag_id?: string | null;
  /** The task name; null for a DAG run. */
  task_id?: string | null;
  /** ISO 8601 with a UTC offset, up to 6 fractional digits. */
  start_date?: string | null;
  end_date?: string | null;
  /** "HH:MM:SS.ffffff". */
  elapsed_time?: string | null;
  /** "YYMMDD" in the sample (dag_info.json uses "YYYY-MM-DD"). */
  business_date?: string | null;
};

/**
 * Calendar lifecycle status. `active` remains for compatibility with existing development mock
 * data; the calendar service returns `status`.
 *
 *   POST /v1/calendars/{calendar_name}/activate    -> 200 Calendar
 *   POST /v1/calendars/{calendar_name}/deactivate  -> 200 Calendar
 *
 * Amendments to inactive calendars answer 409 CONFLICT. Upload behavior is unchanged.
 */
export type CalendarStatusFields = {
  active?: boolean;
  status?: "ACTIVE" | "INACTIVE";
};

export const isActive = (calendar: CalendarStatusFields): boolean =>
  calendar.status ? calendar.status === "ACTIVE" : calendar.active !== false;
