"""Reference DAG shipped as an example.

Fidelity deploys and operates this (O-23). It pulls materialised dates from the Calendar Service
and writes the local snapshot that CalendarTimetable reads.

Look-ahead window must exceed the longest plausible Calendar Service outage (O-21).
"""
