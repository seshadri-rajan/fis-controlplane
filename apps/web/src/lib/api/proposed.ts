/**
 * Contracts the UI needs that are NOT in CalendarManagementSpec.yml. They are our proposal to the
 * backend team and are mocked until it answers. See req-details/api-spec/API_SPEC_ISSUES.md:
 * API-026 (calendar status) and API-029 (run history).
 */

/**
 * Proposed (API-029): one row of run history, shaped like req-details/dag-history/run_history.json.
 * Every field is optional because the real feed is unspecified (API-030, API-031) and the dashboard
 * must survive gaps rather than blank the page.
 *
 *   GET /v1/run-history -> RunRecord[]
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
 * Proposed (API-026): calendar lifecycle status. The spec's `Calendar` has no status field, and the
 * write schemas forbid extra properties, so this is a read field changed only through the two
 * ADMIN-only endpoints below. A missing value means active.
 *
 *   POST /v1/calendars/{calendar_name}/activate    -> 200 Calendar
 *   POST /v1/calendars/{calendar_name}/deactivate  -> 200 Calendar
 *
 * While inactive, `update` and `upload` answer 409 CONFLICT. Reads and the list still work.
 */
export type CalendarStatusFields = { active?: boolean };

export const isActive = (calendar: CalendarStatusFields): boolean => calendar.active !== false;
