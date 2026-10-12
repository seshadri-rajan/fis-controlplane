"""Calendar read and write endpoints.

Writes do not apply directly; they raise a change request for approval (11.3). While
`approval_required` is off the request is auto-approved and applied in the same call.
"""

from dataclasses import asdict

from fastapi import APIRouter, HTTPException, Response, status

from calendar_core import UnknownRuleError

from ...config.dependency import (
    CalendarServiceDep,
    CanApproveDep,
    CanWriteDep,
    CurrentUserDep,
    SessionDep,
)
from ...domain.modules.approval.state_machine import (
    AlreadyResolvedError,
    ApprovalError,
    SelfApprovalError,
)
from ...domain.modules.calendar.exceptions import (
    CalendarNotFoundError,
    DuplicateCalendarError,
)
from ..schemas.calendar import (
    AuditEntryRead,
    CalendarDateRead,
    CalendarRead,
    CalendarWrite,
    ChangeRequestRead,
    MaterialiseRequest,
    MutationResult,
    RejectRequest,
)

router = APIRouter(prefix="/api/ui", tags=["calendars"])


def _result(applied, request) -> MutationResult:
    return MutationResult(
        applied=CalendarRead.of(applied) if applied else None,
        change_request=ChangeRequestRead(**asdict(request)),
    )


@router.get("/calendars")
async def list_calendars(
    service: CalendarServiceDep, _: CurrentUserDep, include_inactive: bool = False
) -> list[CalendarRead]:
    return [CalendarRead.of(c) for c in await service.list(include_inactive=include_inactive)]


@router.get("/calendars/{calendar_key}")
async def get_calendar(
    calendar_key: int, service: CalendarServiceDep, _: CurrentUserDep
) -> CalendarRead:
    try:
        return CalendarRead.of(await service.get(calendar_key))
    except CalendarNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


@router.get("/calendars/{calendar_key}/dates")
async def list_calendar_dates(
    calendar_key: int,
    service: CalendarServiceDep,
    _: CurrentUserDep,
    year: int | None = None,
) -> list[CalendarDateRead]:
    try:
        dates = await service.dates(calendar_key, year)
    except CalendarNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    return [CalendarDateRead(**asdict(d)) for d in dates]


@router.get("/calendars/{calendar_key}/history")
async def calendar_history(
    calendar_key: int, service: CalendarServiceDep, _: CurrentUserDep
) -> list[AuditEntryRead]:
    try:
        await service.get(calendar_key)
    except CalendarNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    return [AuditEntryRead(**asdict(entry)) for entry in await service.history(calendar_key)]


@router.post("/calendars", status_code=status.HTTP_201_CREATED)
async def create_calendar(
    body: CalendarWrite,
    service: CalendarServiceDep,
    user: CanWriteDep,
    session: SessionDep,
    response: Response,
) -> MutationResult:
    actor = user.user_name
    try:
        applied, request = await service.create(body.to_entity(actor), actor)
    except DuplicateCalendarError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    except UnknownRuleError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc

    await session.commit()
    if applied is None:
        response.status_code = status.HTTP_202_ACCEPTED
    return _result(applied, request)


@router.put("/calendars/{calendar_key}")
async def update_calendar(
    calendar_key: int,
    body: CalendarWrite,
    service: CalendarServiceDep,
    user: CanWriteDep,
    session: SessionDep,
    response: Response,
) -> MutationResult:
    actor = user.user_name
    try:
        applied, request = await service.update(calendar_key, body.to_entity(actor), actor)
    except CalendarNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except UnknownRuleError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc

    await session.commit()
    if applied is None:
        response.status_code = status.HTTP_202_ACCEPTED
    return _result(applied, request)


@router.delete("/calendars/{calendar_key}")
async def delete_calendar(
    calendar_key: int,
    service: CalendarServiceDep,
    user: CanWriteDep,
    session: SessionDep,
    response: Response,
) -> MutationResult:
    try:
        applied, request = await service.delete(calendar_key, user.user_name)
    except CalendarNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc

    await session.commit()
    if applied is None and request.status.value == "PENDING":
        response.status_code = status.HTTP_202_ACCEPTED
    return _result(applied, request)


@router.post("/calendars/{calendar_key}/materialise")
async def materialise(
    calendar_key: int,
    body: MaterialiseRequest,
    service: CalendarServiceDep,
    _: CanWriteDep,
    session: SessionDep,
) -> dict[str, int]:
    try:
        written = await service.materialise(calendar_key, body.years)
    except CalendarNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    await session.commit()
    return {"dates_written": written}


@router.get("/change-requests")
async def list_pending(service: CalendarServiceDep, _: CurrentUserDep) -> list[ChangeRequestRead]:
    return [ChangeRequestRead(**asdict(r)) for r in await service.pending()]


@router.post("/change-requests/{change_request_id}/approve")
async def approve(
    change_request_id: int,
    service: CalendarServiceDep,
    user: CanApproveDep,
    session: SessionDep,
) -> ChangeRequestRead:
    try:
        request = await service.approve(change_request_id, user.user_name)
    except CalendarNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except SelfApprovalError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    except (AlreadyResolvedError, ApprovalError) as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc

    await session.commit()
    return ChangeRequestRead(**asdict(request))


@router.post("/change-requests/{change_request_id}/reject")
async def reject(
    change_request_id: int,
    body: RejectRequest,
    service: CalendarServiceDep,
    user: CanApproveDep,
    session: SessionDep,
) -> ChangeRequestRead:
    try:
        request = await service.reject(change_request_id, user.user_name, body.reason)
    except CalendarNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except SelfApprovalError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    except (AlreadyResolvedError, ApprovalError) as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc

    await session.commit()
    return ChangeRequestRead(**asdict(request))
