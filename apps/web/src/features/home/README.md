# Home dashboard

The landing page: the latest run of every DAG and task, so you can see at a glance what needs attention.

- **Status tiles** count each DAG's latest run by state. Click one to filter the table.
- **Needs attention** lists DAGs that are failing, or that have a task failing or waiting to retry right now.
- **Timeline** places each DAG's latest run on a 3, 12 or 24 hour clock.
- **Latest DAG runs** has one row per DAG with its latest run, a recent-runs strip, and its tasks when expanded.
- **Task finder** answers "which DAGs does this task run in?", because a task name can belong to several DAGs.

`runModel.ts` holds the rules and has no React in it: it parses the feed, collapses repeated rows, picks each DAG's and task's latest run, and builds everything above. The same business unit + DAG name is one DAG; a task is a DAG plus a task name. Unknown states show as "Other" with the feed's own text.

States are Airflow's: a DAG run is queued, running, success or failed, and a task run can also be scheduled, up for retry, up for reschedule, upstream failed, skipped, deferred, restarting, removed or none. To add one, give it a colour and label in `StatusBadge.tsx` and a place in `ALL_STATES` in `runModel.ts` (worst first).

Mock mode uses the generated feed in `lib/api/mocks/runHistory.ts`. Local Backend mode calls `GET /v1/run-history` on the same backend as calendars (port 8000), which currently returns generated demo data only; `/v1/run-history/demo` exposes the full fixture. There is no live ingestion or persistence, so the page isn't authoritative. Production feed gaps and assumptions remain tracked in `req-details/api-spec/API_SPEC_ISSUES.md`, API-029 to API-032.
