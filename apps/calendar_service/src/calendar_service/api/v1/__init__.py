"""Machine API consumed by the Airflow plugin.

API-key auth only. Read-only scheduling queries. A user session must never reach these routes.
This is a published cross-organisation contract (D-07): version it, do not break it.
"""
