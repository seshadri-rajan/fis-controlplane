"""Calendars, their materialised dates and their rule bindings.

Date computation itself lives in calendar_core, not here. This module owns persistence-facing
concerns: identity, lifecycle, activation, and which rule a calendar is bound to.
"""
