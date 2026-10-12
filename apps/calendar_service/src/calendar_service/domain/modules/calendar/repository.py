"""ICalendarRepository: abstract persistence contract.

Implemented in infra/database/repositories.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import date

from .entity import Calendar, CalendarDate


class ICalendarRepository(ABC):
    @abstractmethod
    async def list(self, *, include_inactive: bool = False) -> list[Calendar]: ...

    @abstractmethod
    async def get(self, calendar_key: int) -> Calendar | None: ...

    @abstractmethod
    async def get_by_name(self, calendar_nm: str) -> Calendar | None: ...

    @abstractmethod
    async def create(self, calendar: Calendar) -> Calendar: ...

    @abstractmethod
    async def update(self, calendar: Calendar) -> Calendar: ...

    @abstractmethod
    async def deactivate(self, calendar_key: int) -> None: ...

    @abstractmethod
    async def replace_dates(
        self, calendar_key: int, year: int, dates: list[CalendarDate]
    ) -> None: ...

    @abstractmethod
    async def list_dates(
        self, calendar_key: int, year: int | None = None
    ) -> list[CalendarDate]: ...

    @abstractmethod
    async def max_date(self, calendar_key: int) -> date | None: ...


class IHolidayRepository(ABC):
    @abstractmethod
    async def default_calendar_id(self) -> int | None: ...

    @abstractmethod
    async def holidays_for(self, holiday_calendar_id: int | None, year: int) -> list[tuple]: ...

    @abstractmethod
    async def rule_name(self, calendar_rule_id: int) -> str | None: ...

    @abstractmethod
    async def rule_id(self, rule_name: str) -> int | None: ...
