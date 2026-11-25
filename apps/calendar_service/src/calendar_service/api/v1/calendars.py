"""Calendar Management API under /v1."""

from datetime import UTC, date, datetime
from io import BytesIO
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from openpyxl import Workbook
from pydantic import ValidationError

from calendar_service.api.middlewares.oauth_auth import AdminDep, EditorDep, get_principal
from calendar_service.api.schemas.management import (
    CalendarDate,
    CalendarName,
    CalendarPage,
    CalendarResponse,
    CreateCalendar,
    ErrorResponse,
    UpdateCalendar,
    UploadedCalendar,
    UploadVerificationResponse,
    format_date,
    parse_date,
)
from calendar_service.config.dependency import SessionDep, SettingsDep
from calendar_service.infra.database.management import ManagedCalendar, ManagedCalendarRepository

from .upload import XLSX_MEDIA_TYPE, read_upload, verify_upload

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
                        "file": {
                            "type": "string",
                            "format": "binary",
                            "description": (
                                "Single-column .xlsx workbook with YYYY-MM-DD date values."
                            ),
                        },
                    },
                },
                "encoding": {
                    "data": {"contentType": "application/json"},
                    "file": {"contentType": XLSX_MEDIA_TYPE},
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


def _require_uploaded_or_migrated(calendar: ManagedCalendar) -> None:
    if calendar.is_uploaded != "Y" and calendar.is_migrated != "Y":
        raise HTTPException(409, "Only uploaded or migrated calendars can be amended or managed.")


async def _change_status(
    calendar_name: str,
    *,
    active: bool,
    user: AdminDep,
    session: SessionDep,
) -> CalendarResponse:
    _check_name(calendar_name)
    repository = ManagedCalendarRepository(session)
    await repository.begin_write()
    row = await _find(repository, calendar_name, lock=True)
    _require_uploaded_or_migrated(row)
    dates = [entry.calendar_date for entry in row.dates]
    row.status = "A" if active else "I"
    row.updated_at = datetime.now(UTC)
    action = "ACTIVATE" if active else "DEACTIVATE"
    await repository.commit(row, action, user.username)
    return calendar_response(row, dates)


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


@router.patch(
    "/{calendar_name}/update",
    operation_id="updateCalendar",
    responses={**NOT_FOUND, 409: {"model": ErrorResponse}},
)
async def update_calendar(
    calendar_name: CalendarName, body: UpdateCalendar, user: AdminDep, session: SessionDep
) -> CalendarResponse:
    if calendar_name != body.calendarName:
        raise HTTPException(400, "calendarName must match the path calendar_name.")
    _check_name(calendar_name)
    repository = ManagedCalendarRepository(session)
    await repository.begin_write()
    row = await _find(repository, calendar_name, lock=True)
    _require_uploaded_or_migrated(row)
    if row.status != "A":
        raise HTTPException(409, "This calendar is inactive. Activate it before amending dates.")
    if body.status != "ACTIVE":
        raise HTTPException(400, "Use the deactivate endpoint to change calendar status.")
    row.updated_at = datetime.now(UTC)
    dates = await repository.replace_dates(row, [parse_date(day) for day in body.dates])
    await repository.commit(row, "UPDATE", user.username)
    return calendar_response(row, dates)


@router.post(
    "/{calendar_name}/activate",
    responses={**NOT_FOUND, 409: {"model": ErrorResponse}},
)
async def activate_calendar(
    calendar_name: CalendarName, user: AdminDep, session: SessionDep
) -> CalendarResponse:
    return await _change_status(calendar_name, active=True, user=user, session=session)


@router.post(
    "/{calendar_name}/deactivate",
    responses={**NOT_FOUND, 409: {"model": ErrorResponse}},
)
async def deactivate_calendar(
    calendar_name: CalendarName, user: AdminDep, session: SessionDep
) -> CalendarResponse:
    return await _change_status(calendar_name, active=False, user=user, session=session)


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


@router.get(
    "/{calendar_name}/export",
    operation_id="exportCalendarDates",
    responses={
        **NOT_FOUND,
        200: {
            "content": {
                XLSX_MEDIA_TYPE: {
                    "schema": {"type": "string", "format": "binary"},
                },
            },
        },
    },
    dependencies=READ_ACCESS,
)
async def export_calendar_dates(calendar_name: CalendarName, session: SessionDep) -> Response:
    row = await _find(ManagedCalendarRepository(session), calendar_name)
    workbook = Workbook(write_only=True)
    sheet = workbook.create_sheet("Calendar dates")
    sheet.append(["Calendar date"])
    for entry in sorted(row.dates, key=lambda item: item.calendar_date):
        sheet.append([entry.calendar_date.isoformat()])
    output = BytesIO()
    workbook.save(output)
    return Response(
        content=output.getvalue(),
        media_type=XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": f'attachment; filename="{calendar_name}.xlsx"'},
    )


@router.post(
    "/upload/verify",
    operation_id="verifyDates",
    responses={
        413: {"model": ErrorResponse},
        415: {"model": ErrorResponse},
    },
    openapi_extra=UPLOAD_BODY,
)
async def verify_calendar_upload(
    request: Request,
    user: EditorDep,
    settings: SettingsDep,
    amend: Annotated[bool, Query()] = False,
) -> UploadVerificationResponse:
    if amend and "ADMIN" not in user.roles:
        raise HTTPException(403, "Verifying amendment files requires ADMIN.")
    return await verify_upload(request, settings.upload_max_bytes, amend=amend)


@router.post(
    "/{calendar_name}/upload",
    operation_id="uploadCalendarDates",
    status_code=201,
    responses={
        409: {"model": ErrorResponse},
        413: {"model": ErrorResponse},
        415: {"model": ErrorResponse},
    },
    openapi_extra=UPLOAD_BODY,
)
async def upload_calendar(
    calendar_name: CalendarName,
    request: Request,
    user: EditorDep,
    session: SessionDep,
    settings: SettingsDep,
    create_only: Annotated[bool, Query(alias="createOnly")] = False,
) -> CalendarResponse:
    _check_name(calendar_name)
    year, incoming = await read_upload(request, settings.upload_max_bytes)
    repository = ManagedCalendarRepository(session)
    await repository.begin_write()
    row = await repository.get(calendar_name, lock=True)
    created = False
    if row is not None and create_only:
        raise HTTPException(409, "A calendar with the specified name already exists.")
    if row is None:
        try:
            CreateCalendar(calendarName=calendar_name)
        except ValidationError as exc:
            raise HTTPException(
                400, "New calendar names must contain 1 to 70 letters or digits."
            ) from exc
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
