"""The annual rollover and the date-cliff alert.

These are handover deliverables (D-05): Fidelity runs them after the engagement ends, so their
behaviour needs to be pinned down rather than assumed.
"""

from collections.abc import AsyncIterator
from datetime import date

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from calendar_service.domain.modules.calendar.entity import (
    Calendar,
    CalendarKind,
)
from calendar_service.infra.database.models import Base, CalendarRule, HolidayCalendar
from calendar_service.infra.database.repositories.audit import AuditRepository
from calendar_service.infra.database.repositories.calendar import CalendarRepository
from calendar_service.jobs.check_coverage import check
from calendar_service.jobs.generate_year import generate

MON_TO_FRI = [0, 1, 2, 3, 4]


@pytest_asyncio.fixture
async def session() -> AsyncIterator:
    engine = create_async_engine("sqlite+aiosqlite://")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        session.add(HolidayCalendar(holiday_calendar_nm="DEFAULT", created_by="seed"))
        session.add(CalendarRule(calendar_rule_nm="LAST_BUSINESS_DAY", created_by="seed"))
        await session.flush()

        repository = CalendarRepository(session)
        await repository.create(
            Calendar(
                calendar_nm="mon-fri",
                kind=CalendarKind.BUSINESS_DAYS,
                weekdays=MON_TO_FRI,
                created_by="seed",
            )
        )
        await repository.create(
            Calendar(
                calendar_nm="mondays",
                kind=CalendarKind.BUSINESS_DAYS,
                weekdays=[0],
                created_by="seed",
            )
        )
        await session.commit()
        yield session

    await engine.dispose()


# --- generate_year ---


@pytest.mark.asyncio
async def test_generate_materialises_every_active_calendar(session):
    results = await generate(session, 2028)

    assert {r.calendar_nm for r in results} == {"mon-fri", "mondays"}
    assert all(r.dates_written > 0 for r in results)
    assert all(r.year == 2028 for r in results)


@pytest.mark.asyncio
async def test_generate_can_target_one_calendar(session):
    results = await generate(session, 2028, only="mondays")

    assert len(results) == 1
    assert results[0].calendar_nm == "mondays"


@pytest.mark.asyncio
async def test_generate_is_idempotent(session):
    first = await generate(session, 2028)
    second = await generate(session, 2028)

    assert [r.dates_written for r in first] == [r.dates_written for r in second]

    dates = await CalendarRepository(session).list_dates(first[0].calendar_key, 2028)
    assert len({d.calendar_date for d in dates}) == len(dates)


@pytest.mark.asyncio
async def test_generate_records_an_audit_entry(session):
    await generate(session, 2028)
    entries = await AuditRepository(session).list_for("CALENDAR")

    materialisations = [e for e in entries if e.action == "MATERIALISE"]
    assert len(materialisations) == 2
    assert materialisations[0].new_value["year"] == 2028
    assert materialisations[0].updated_by == "generate_year"


@pytest.mark.asyncio
async def test_generate_does_not_disturb_other_years(session):
    await generate(session, 2027)
    await generate(session, 2028)

    repository = CalendarRepository(session)
    key = (await repository.list())[0].calendar_key
    assert await repository.list_dates(key, 2027)
    assert await repository.list_dates(key, 2028)


# --- check_coverage ---


@pytest.mark.asyncio
async def test_coverage_reports_no_dates_before_any_generation(session):
    report = await check(session, min_days_ahead=90, today=date(2028, 1, 1))

    assert all(not c.ok for c in report)
    assert all(c.last_date is None for c in report)
    assert all(c.status == "NO DATES" for c in report)


@pytest.mark.asyncio
async def test_coverage_is_ok_well_before_the_year_end(session):
    await generate(session, 2028)
    report = await check(session, min_days_ahead=90, today=date(2028, 1, 1))

    assert all(c.ok for c in report)
    assert all(c.status == "ok" for c in report)


@pytest.mark.asyncio
async def test_coverage_turns_short_as_the_cliff_approaches(session):
    """The cliff is silent in production; this is the control that makes it visible."""
    await generate(session, 2028)
    report = await check(session, min_days_ahead=90, today=date(2028, 11, 1))

    assert all(not c.ok for c in report)
    assert all(c.status == "SHORT" for c in report)
    assert all(0 < c.days_ahead < 90 for c in report)


@pytest.mark.asyncio
async def test_generating_the_next_year_clears_the_warning(session):
    await generate(session, 2028)
    assert not all(c.ok for c in await check(session, min_days_ahead=90, today=date(2028, 11, 1)))

    await generate(session, 2029)
    assert all(c.ok for c in await check(session, min_days_ahead=90, today=date(2028, 11, 1)))
