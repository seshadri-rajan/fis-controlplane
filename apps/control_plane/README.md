# control_plane

Central, read-only view of DAG runs across Business Units. Airflow listeners in each BU push
metadata here.

Deliberately a **separate application** from `calendar_service`. Different data model, different
write path, different failure profile. A noisy listener firehose must not be able to degrade the
service that decides whether DAGs run.

## Layered structure

Same clean-architecture layering and the same dependency rule as `calendar_service`:

```
src/control_plane/
├── api/
│   ├── ingest/     Listener endpoint. Write path from BU Airflow.
│   └── ui/         Read path for the React SPA.
├── domain/
├── infra/
│   └── database/   Schema per BU (O-15)
└── config/
```

## The decision that must be made before this is built

**O-13 — ingestion delivery guarantee.** The requirements describe fire-and-forget Airflow
listeners with no queue, outbox, retry or dead-letter path, *and* daily reconciliation is
explicitly out of scope.

Together those mean the central view **cannot be guaranteed accurate**: any dropped event is
permanently and undetectably lost. If anyone downstream treats this dashboard as authoritative,
that is a correctness problem shipped by design.

The fix is cheap at design time — an outbox table or a queue between listener and central database
— and expensive to retrofit. **Decide this before writing the ingestion path**, even though this
app is scheduled to be built last.

## Other open items

- **O-14** The requirements list "REST API needs to be built to expose the metadata" under *Out Of
  Scope*. Appears to be in the wrong section; needs clarification.
- **O-15** Schema-per-BU does not scale past the three BUs in this phase. No cross-BU `dag_id`
  collision handling. Timezone for "run date" undefined.
- **O-16** Airflow version. `dag_tag` and `dag_owner_attributes` are internal Airflow tables with
  no stability guarantee across versions.
- **O-17** Thirty-day retention versus "archival managed by Fidelity" — no owner for the purge job.
- **R-04** No authentication is currently defined for this UI. Mitigated by serving it from the
  single React app so it inherits the Calendar Service session.
