"""Calendar Management API under /v1."""

from datetime import UTC, date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response

from calendar_service.api.middlewares.oauth_auth import EditorDep, get_principal
from calendar_service.api.schemas.management import (
    CalendarDate,
    CalendarName,
    CalendarPage,
    CalendarResponse,
    CreateCalendar,
    ErrorResponse,
    UpdateCalendar,
    UploadedCalendar,
    format_date,
    parse_date,
)
from calendar_service.config.dependency import SessionDep, SettingsDep
from calendar_service.infra.database.management import ManagedCalendar, ManagedCalendarRepository

from .upload import read_upload

router = APIRouter(
    prefix="/v1/calendars",
    tags=["Calendars"],
    responses={
        400: {"model": ErrorResponse},
        401: {
            "model": ErrorResponse,
            "headers": {"WWW-Authenticate": {"schema": {"type": "string"}}},
        },
        403: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
)
NOT_FOUND = {404: {"model": ErrorResponse}}
READ_ACCESS = [Depends(get_principal)]
UPLOAD_BODY = {
    "requestBody": {
        "required": True,
        "content": {
            "multipart/form-data": {
                "schema": {
                    "type": "object",
                    "required": ["data", "file"],
                    "additionalProperties": False,
                    "properties": {
                        "data": {
                            "type": "object",
                            "required": ["year"],
                            "additionalProperties": False,
                            "properties": {"year": {"type": "string", "pattern": "^[0-9]{4}$"}},
                        },
                        "file": {"type": "string", "format": "binary"},
                    },
                },
                "encoding": {
                    "data": {"contentType": "application/json"},
                    "file": {"contentType": "text/csv"},
                },
            }
        },
    }
}


def calendar_response(
    row: ManagedCalendar, dates: list[date] | None = None
) -> CalendarResponse:
    return CalendarResponse(
        calendarName=row.calendar_name,
        dates=[format_date(day) for day in (
            dates if dates is not None else [entry.calendar_date for entry in row.dates]
        )],
        migrated=row.is_migrated == "Y",
        uploaded=row.is_uploaded == "Y",
        status="ACTIVE" if row.status == "A" else "INACTIVE",
        createdBy=row.created_by,
        createdAt=_utc(row.created_at),
        updatedAt=_utc(row.updated_at),
    )


def _utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def _check_name(name: str) -> None:
    if name == "uploadedCalendars":
        raise HTTPException(400, "The calendar name 'uploadedCalendars' is reserved.")


async def _find(
    repository: ManagedCalendarRepository, name: str, *, lock: bool = False
) -> ManagedCalendar:
    row = await repository.get(name, lock=lock)
    if row is None:
        raise HTTPException(404, "No calendar exists with the specified name.")
    return row


@router.post(
    "",
    operation_id="createCalendar",
    status_code=201,
    responses={201: {"headers": {"Location": {"schema": {"type": "string"}}}}},
)
async def create_calendar(
    body: CreateCalendar, response: Response, user: EditorDep, session: SessionDep
) -> CalendarResponse:
    _check_name(body.calendarName)
    repository = ManagedCalendarRepository(session)
    await repository.begin_write()
    row = await repository.add(body.calendarName, user.username)
    if row is None:
        raise HTTPException(400, "A calendar with the specified name already exists.")
    dates = await repository.replace_dates(row, [parse_date(day) for day in body.dates])
    await repository.commit(row, "CREATE", user.username)
    response.headers["Location"] = f"/v1/calendars/{row.calendar_name}"
    return calendar_response(row, dates)


@router.get("", operation_id="listCalendars", dependencies=READ_ACCESS)
async def list_calendars(
    session: SessionDep,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=1, le=2_147_483_647)] = 1,
    calendar_name: Annotated[str | None, Query(alias="calendarName", max_length=128)] = None,
    migrated: bool | None = None,
) -> CalendarPage:
    rows, total = await ManagedCalendarRepository(session).page(
        calendar_name, migrated, limit, offset
    )
    return CalendarPage(
        calendars=[calendar_response(row) for row in rows],
        page=offset,
        pageSize=limit,
        totalItems=total,
        totalPages=(total + limit - 1) // limit,
    )


@router.get("/uploadedCalendars", operation_id="getUploadedCalendars", dependencies=READ_ACCESS)
async def uploaded_calendars(session: SessionDep) -> list[UploadedCalendar]:
    return [
        UploadedCalendar(name=row.calendar_name, migrated=row.is_migrated == "Y")
        for row in await ManagedCalendarRepository(session).uploaded()
    ]


@router.get(
    "/{calendar_name}", operation_id="getCalendar", responses=NOT_FOUND, dependencies=READ_ACCESS
)
async def get_calendar(
    calendar_name: CalendarName, session: SessionDep
) -> CalendarResponse:
    return calendar_response(await _find(ManagedCalendarRepository(session), calendar_name))


@router.patch("/{calendar_name}/update", operation_id="updateCalendar", responses=NOT_FOUND)
async def update_calendar(
    calendar_name: CalendarName, body: UpdateCalendar, user: EditorDep, session: SessionDep
) -> CalendarResponse:
    if calendar_name != body.calendarName:
        raise HTTPException(400, "calendarName must match the path calendar_name.")
    _check_name(calendar_name)
    repository = ManagedCalendarRepository(session)
    await repository.begin_write()
    row = await _find(repository, calendar_name, lock=True)
    row.status = "A" if body.status == "ACTIVE" else "I"
    row.updated_at = datetime.now(UTC)
    dates = await repository.replace_dates(row, [parse_date(day) for day in body.dates])
    await repository.commit(row, "UPDATE", user.username)
    return calendar_response(row, dates)


@router.get(
    "/{calendar_name}/dates", operation_id="getCalendarDates", tags=["Airflow"],
    responses=NOT_FOUND, dependencies=READ_ACCESS,
)
async def get_dates(
    calendar_name: CalendarName,
    session: SessionDep,
    exclude_calendar: Annotated[CalendarName | None, Query(alias="excludeCalendar")] = None,
) -> list[CalendarDate]:
    repository = ManagedCalendarRepository(session)
    row = await _find(repository, calendar_name)
    dates = {entry.calendar_date for entry in row.dates}
    if exclude_calendar is not None:
        if exclude_calendar == calendar_name:
            return []
        excluded = await _find(repository, exclude_calendar)
        dates.difference_update(entry.calendar_date for entry in excluded.dates)
    return [format_date(day) for day in sorted(dates)]


@router.post(
    "/{calendar_name}/upload",
    operation_id="uploadCalendarDates",
    status_code=201,
    responses={413: {"model": ErrorResponse}, 415: {"model": ErrorResponse}},
    openapi_extra=UPLOAD_BODY,
)
async def upload_calendar(
    calendar_name: CalendarName,
    request: Request,
    user: EditorDep,
    session: SessionDep,
    settings: SettingsDep,
) -> CalendarResponse:
    _check_name(calendar_name)
    year, incoming = await read_upload(request, settings.upload_max_bytes)
    repository = ManagedCalendarRepository(session)
    await repository.begin_write()
    row = await repository.get(calendar_name, lock=True)
    created = False
    if row is None:
        row = await repository.add(calendar_name, user.username, uploaded=True)
        created = row is not None
    if row is None:  # Another transaction created the calendar between lookup and insert.
        row = await _find(repository, calendar_name, lock=True)
    if not created:
        row.updated_at = datetime.now(UTC)
    row.is_uploaded = "Y"
    dates = await repository.replace_dates(row, incoming, year=year)
    await repository.commit(row, "UPLOAD", user.username)
    return calendar_response(row, dates)
