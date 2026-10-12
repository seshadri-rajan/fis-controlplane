"""Domain exceptions. Mapped to HTTP status codes in api/; never raised as HTTP here."""


class CalendarError(Exception):
    pass


class CalendarNotFoundError(CalendarError):
    pass


class DuplicateCalendarError(CalendarError):
    pass


class CalendarInUseError(CalendarError):
    pass
