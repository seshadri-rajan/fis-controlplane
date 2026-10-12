"""SQLAlchemy implementations of the calendar and holiday repository interfaces."""

from __future__ import annotations

from dataclasses import asdict
from datetime import date

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ....domain.modules.calendar.entity import (
    Calendar,
    CalendarDate,
    CalendarKind,
    CalendarPolicies,
)
from ....domain.modules.calendar.repository import ICalendarRepository, IHolidayRepository
from ..models import CalendarDate as CalendarDateModel
from ..models import CalendarRule as CalendarRuleModel
from ..models import HolidayCalendar as HolidayCalendarModel
from ..models import HolidayDate as HolidayDateModel
from ..models import Calendar as CalendarModel


def _to_entity(row: CalendarModel, rule_name: str | None) -> Calendar:
    return Calendar(
        calendar_key=row.calendar_key,
        calendar_nm=row.calendar_nm,
        calendar_desc=row.calendar_desc,
        kind=CalendarKind(row.kind),
        weekdays=row.weekdays,
        calendar_rule_id=row.calendar_rule_id,
        rule_name=rule_name,
        rule_params=row.rule_params or {},
        policies=CalendarPolicies(**(row.policies or {})),
        holiday_calendar_id=row.holiday_calendar_id,
        bu_id=row.bu_id,
        app_id=row.app_id,
        active_flag=row.active_flag,
        created_by=row.created_by,
    )


class CalendarRepository(ICalendarRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list(self, *, include_inactive: bool = False) -> list[Calendar]:
        stmt = select(CalendarModel, CalendarRuleModel.calendar_rule_nm).outerjoin(
            CalendarRuleModel, CalendarModel.calendar_rule_id == CalendarRuleModel.calendar_rule_id
        )
        if not include_inactive:
            stmt = stmt.where(CalendarModel.active_flag.is_(True))
        stmt = stmt.order_by(CalendarModel.calendar_nm)

        rows = (await self._session.execute(stmt)).all()
        return [_to_entity(row[0], row[1]) for row in rows]

    async def _fetch(self, clause) -> Calendar | None:
        stmt = (
            select(CalendarModel, CalendarRuleModel.calendar_rule_nm)
            .outerjoin(
                CalendarRuleModel,
                CalendarModel.calendar_rule_id == CalendarRuleModel.calendar_rule_id,
            )
            .where(clause)
        )
        row = (await self._session.execute(stmt)).first()
        return _to_entity(row[0], row[1]) if row else None

    async def get(self, calendar_key: int) -> Calendar | None:
        return await self._fetch(CalendarModel.calendar_key == calendar_key)

    async def get_by_name(self, calendar_nm: str) -> Calendar | None:
        return await self._fetch(CalendarModel.calendar_nm == calendar_nm)

    async def create(self, calendar: Calendar) -> Calendar:
        row = CalendarModel(
            calendar_nm=calendar.calendar_nm,
            calendar_desc=calendar.calendar_desc,
            kind=calendar.kind.value,
            weekdays=calendar.weekdays,
            calendar_rule_id=calendar.calendar_rule_id,
            rule_params=calendar.rule_params or None,
            policies=asdict(calendar.policies),
            holiday_calendar_id=calendar.holiday_calendar_id,
            bu_id=calendar.bu_id,
            app_id=calendar.app_id,
            active_flag=calendar.active_flag,
            created_by=calendar.created_by,
        )
        self._session.add(row)
        await self._session.flush()
        calendar.calendar_key = row.calendar_key
        return calendar

    async def update(self, calendar: Calendar) -> Calendar:
        assert calendar.calendar_key is not None
        row = await self._session.get(CalendarModel, calendar.calendar_key)
        if row is None:
            raise LookupError(calendar.calendar_key)

        row.calendar_desc = calendar.calendar_desc
        row.kind = calendar.kind.value
        row.weekdays = calendar.weekdays
        row.calendar_rule_id = calendar.calendar_rule_id
        row.rule_params = calendar.rule_params or None
        row.policies = asdict(calendar.policies)
        row.holiday_calendar_id = calendar.holiday_calendar_id
        row.active_flag = calendar.active_flag
        await self._session.flush()
        return calendar

    async def deactivate(self, calendar_key: int) -> None:
        row = await self._session.get(CalendarModel, calendar_key)
        if row is None:
            raise LookupError(calendar_key)
        row.active_flag = False
        await self._session.flush()

    async def replace_dates(self, calendar_key: int, year: int, dates: list[CalendarDate]) -> None:
        await self._session.execute(
            delete(CalendarDateModel).where(
                CalendarDateModel.calendar_key == calendar_key,
                CalendarDateModel.calendar_date >= date(year, 1, 1),
                CalendarDateModel.calendar_date <= date(year, 12, 31),
            )
        )
        self._session.add_all(
            [
                CalendarDateModel(
                    calendar_key=calendar_key,
                    calendar_date=d.calendar_date,
                    shifted_from=d.shifted_from,
                    remarks=d.remarks,
                )
                for d in dates
            ]
        )
        await self._session.flush()

    async def list_dates(self, calendar_key: int, year: int | None = None) -> list[CalendarDate]:
        stmt = select(CalendarDateModel).where(CalendarDateModel.calendar_key == calendar_key)
        if year is not None:
            stmt = stmt.where(
                CalendarDateModel.calendar_date >= date(year, 1, 1),
                CalendarDateModel.calendar_date <= date(year, 12, 31),
            )
        rows = (await self._session.scalars(stmt.order_by(CalendarDateModel.calendar_date))).all()
        return [
            CalendarDate(
                calendar_date=r.calendar_date, shifted_from=r.shifted_from, remarks=r.remarks
            )
            for r in rows
        ]

    async def max_date(self, calendar_key: int) -> date | None:
        stmt = select(func.max(CalendarDateModel.calendar_date)).where(
            CalendarDateModel.calendar_key == calendar_key
        )
        return (await self._session.execute(stmt)).scalar_one_or_none()


class HolidayRepository(IHolidayRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def default_calendar_id(self) -> int | None:
        """Single region for this phase (D-08): the one active holiday calendar."""
        stmt = (
            select(HolidayCalendarModel.holiday_calendar_id)
            .where(HolidayCalendarModel.active_flag.is_(True))
            .order_by(HolidayCalendarModel.holiday_calendar_id)
            .limit(1)
        )
        return (await self._session.execute(stmt)).scalar_one_or_none()

    async def holidays_for(
        self, holiday_calendar_id: int | None, year: int
    ) -> list[tuple[date, str]]:
        if holiday_calendar_id is None:
            holiday_calendar_id = await self.default_calendar_id()
        if holiday_calendar_id is None:
            return []

        stmt = select(HolidayDateModel.holiday_date, HolidayDateModel.holiday_name).where(
            HolidayDateModel.holiday_calendar_id == holiday_calendar_id,
            HolidayDateModel.holiday_date >= date(year, 1, 1),
            HolidayDateModel.holiday_date <= date(year, 12, 31),
        )
        return [(row[0], row[1]) for row in (await self._session.execute(stmt)).all()]

    async def rule_name(self, calendar_rule_id: int) -> str | None:
        stmt = select(CalendarRuleModel.calendar_rule_nm).where(
            CalendarRuleModel.calendar_rule_id == calendar_rule_id
        )
        return (await self._session.execute(stmt)).scalar_one_or_none()

    async def rule_id(self, rule_name: str) -> int | None:
        stmt = select(CalendarRuleModel.calendar_rule_id).where(
            CalendarRuleModel.calendar_rule_nm == rule_name,
            CalendarRuleModel.active_flag.is_(True),
        )
        return (await self._session.execute(stmt)).scalar_one_or_none()
