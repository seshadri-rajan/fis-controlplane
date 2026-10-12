"""SQLAlchemy implementation of the change-request repository."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ....domain.modules.approval.entity import ChangeAction, ChangeRequest, ChangeStatus
from ....domain.modules.approval.repository import IChangeRequestRepository
from ..models import CalendarChangeRequest as ChangeRequestModel
from ..models import as_utc


def _to_entity(row: ChangeRequestModel) -> ChangeRequest:
    return ChangeRequest(
        change_request_id=row.change_request_id,
        entity=row.entity,
        entity_key=row.entity_key,
        action=ChangeAction(row.action),
        payload=row.payload,
        status=ChangeStatus(row.status),
        maker=row.maker,
        made_at=as_utc(row.made_at),
        checker=row.checker,
        checked_at=as_utc(row.checked_at),
        reject_reason=row.reject_reason,
    )


class ChangeRequestRepository(IChangeRequestRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(self, request: ChangeRequest) -> ChangeRequest:
        row = ChangeRequestModel(
            entity=request.entity,
            entity_key=request.entity_key,
            action=request.action.value,
            payload=request.payload,
            status=request.status.value,
            maker=request.maker,
            checker=request.checker,
            checked_at=request.checked_at,
        )
        self._session.add(row)
        await self._session.flush()
        request.change_request_id = row.change_request_id
        request.made_at = as_utc(row.made_at)
        return request

    async def get(self, change_request_id: int) -> ChangeRequest | None:
        row = await self._session.get(ChangeRequestModel, change_request_id)
        return _to_entity(row) if row else None

    async def list(self, status: ChangeStatus | None = None) -> list[ChangeRequest]:
        stmt = select(ChangeRequestModel)
        if status is not None:
            stmt = stmt.where(ChangeRequestModel.status == status.value)
        rows = (
            await self._session.scalars(stmt.order_by(ChangeRequestModel.change_request_id.desc()))
        ).all()
        return [_to_entity(row) for row in rows]

    async def save(self, request: ChangeRequest) -> ChangeRequest:
        assert request.change_request_id is not None
        row = await self._session.get(ChangeRequestModel, request.change_request_id)
        if row is None:
            raise LookupError(request.change_request_id)

        row.status = request.status.value
        row.checker = request.checker
        row.checked_at = request.checked_at
        row.reject_reason = request.reject_reason
        await self._session.flush()
        return request
