"""Persistence for the date-only management contract."""

from __future__ import annotations

from datetime import UTC, date, datetime

from sqlalchemy import (
    CHAR,
    DateTime,
    ForeignKey,
    Identity,
    String,
    delete,
    func,
    insert,
    select,
    text,
)
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, selectinload
from sqlalchemy.sql import Select

from .models import PkType


class ManagementBase(DeclarativeBase):
    pass


class ManagedCalendar(ManagementBase):
    __tablename__ = "calendar"

    calendar_id: Mapped[int] = mapped_column(PkType, Identity(always=True), primary_key=True)
    calendar_name: Mapped[str] = mapped_column(String(256), unique=True)
    is_migrated: Mapped[str] = mapped_column(CHAR(1), server_default="N")
    is_uploaded: Mapped[str] = mapped_column(CHAR(1), server_default="N")
    status: Mapped[str] = mapped_column(CHAR(1), server_default="A")
    created_by: Mapped[str] = mapped_column(String(256))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    dates: Mapped[list[ManagedDate]] = relationship(order_by="ManagedDate.calendar_date")


class ManagedDate(ManagementBase):
    __tablename__ = "calendar_date"

    calendar_id: Mapped[int] = mapped_column(
        ForeignKey("calendar.calendar_id", ondelete="CASCADE"), primary_key=True
    )
    calendar_date: Mapped[date] = mapped_column(primary_key=True)


class ManagementAudit(ManagementBase):
    __tablename__ = "audit_log"

    audit_log_id: Mapped[int] = mapped_column(PkType, Identity(always=True), primary_key=True)
    resource_type: Mapped[str | None] = mapped_column(String(256))
    resource_name: Mapped[str | None] = mapped_column(String(256))
    action: Mapped[str] = mapped_column(String(256))
    performed_by: Mapped[str] = mapped_column(String(256))
    performed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class ManagedCalendarRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.sqlite = session.get_bind().dialect.name == "sqlite"

    async def begin_write(self) -> None:
        if self.sqlite:
            # SQLite has no row locks. Serialize writes before the initial lookup.
            await self.session.execute(text("BEGIN IMMEDIATE"))

    async def get(self, name: str, *, lock: bool = False) -> ManagedCalendar | None:
        query = (
            select(ManagedCalendar)
            .where(ManagedCalendar.calendar_name == name)
            .options(selectinload(ManagedCalendar.dates))
        )
        if lock:
            query = query.with_for_update()
        return await self.session.scalar(query)

    def _ordered(self, query: Select[tuple[ManagedCalendar]]) -> Select[tuple[ManagedCalendar]]:
        collation = "BINARY" if self.sqlite else "C"
        return query.order_by(ManagedCalendar.calendar_name.collate(collation))

    async def page(
        self, name: str | None, migrated: bool | None, limit: int, page: int
    ) -> tuple[list[ManagedCalendar], int]:
        query = select(ManagedCalendar)
        if name is not None:
            find = func.instr if self.sqlite else func.strpos
            query = query.where(find(ManagedCalendar.calendar_name, name) > 0)
        if migrated is not None:
            query = query.where(ManagedCalendar.is_migrated == ("Y" if migrated else "N"))
        total = await self.session.scalar(select(func.count()).select_from(query.subquery())) or 0
        if (page - 1) * limit >= total:
            return [], total
        rows = await self.session.scalars(
            self._ordered(query)
            .options(selectinload(ManagedCalendar.dates))
            .offset((page - 1) * limit)
            .limit(limit)
        )
        return list(rows), total

    async def uploaded(self) -> list[ManagedCalendar]:
        rows = await self.session.scalars(
            self._ordered(select(ManagedCalendar).where(ManagedCalendar.is_uploaded == "Y"))
        )
        return list(rows)

    async def replace_dates(
        self, calendar: ManagedCalendar, dates: list[date], *, year: int | None = None
    ) -> list[date]:
        where = ManagedDate.calendar_id == calendar.calendar_id
        removed = delete(ManagedDate).where(where)
        if year is not None:
            removed = removed.where(
                ManagedDate.calendar_date.between(date(year, 1, 1), date(year, 12, 31))
            )
        await self.session.execute(removed)
        if dates:
            await self.session.execute(
                insert(ManagedDate),
                [{"calendar_id": calendar.calendar_id, "calendar_date": day} for day in dates],
            )
        rows = await self.session.scalars(
            select(ManagedDate.calendar_date).where(where).order_by(ManagedDate.calendar_date)
        )
        return list(rows)

    async def add(
        self, name: str, actor: str, *, uploaded: bool = False
    ) -> ManagedCalendar | None:
        now = datetime.now(UTC)
        insert_row = sqlite_insert if self.sqlite else pg_insert
        query = (
            insert_row(ManagedCalendar)
            .values(
                calendar_name=name,
                created_by=actor,
                created_at=now,
                updated_at=now,
                is_uploaded="Y" if uploaded else "N",
            )
            .on_conflict_do_nothing(index_elements=[ManagedCalendar.calendar_name])
            .returning(ManagedCalendar)
        )
        return await self.session.scalar(query)

    async def commit(self, calendar: ManagedCalendar, action: str, actor: str) -> None:
        self.session.add(
            ManagementAudit(
                resource_type="CALENDAR",
                resource_name=calendar.calendar_name,
                action=action,
                performed_by=actor,
            )
        )
        await self.session.commit()
