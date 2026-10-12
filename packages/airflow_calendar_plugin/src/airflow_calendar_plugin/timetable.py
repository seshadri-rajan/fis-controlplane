"""CalendarTimetable.

Runs inside the scheduler loop, so: no network I/O, read from cache only.
Carries only JSON-serialisable state (the calendar name) because Airflow serialises DAGs.
"""
