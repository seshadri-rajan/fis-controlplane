"""Local calendar snapshot.

The only source timetable.py may read. Keeps DAG scheduling working through a Calendar Service
outage, which is what turns O-05 into a graceful degradation.
"""
