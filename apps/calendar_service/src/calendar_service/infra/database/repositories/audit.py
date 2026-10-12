"""SQLAlchemy implementation of the audit repository."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ....domain.modules.audit.entity import AuditEntry
from ....domain.modules.audit.repository import IAuditRepository
from ..models import AuditLog, as_utc


class AuditRepository(IAuditRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def record(self, entry: AuditEntry) -> None:
        self._session.add(
            AuditLog(
                entity=entry.entity,
                entity_key=entry.entity_key,
                action=entry.action,
                old_value=entry.old_value,
                new_value=entry.new_value,
                updated_by=entry.updated_by,
            )
        )
        await self._session.flush()

    async def list_for(self, entity: str, entity_key: int | None = None) -> list[AuditEntry]:
        stmt = select(AuditLog).where(AuditLog.entity == entity)
        if entity_key is not None:
            stmt = stmt.where(AuditLog.entity_key == entity_key)

        rows = (await self._session.scalars(stmt.order_by(AuditLog.audit_key.desc()))).all()
        return [
            AuditEntry(
                audit_key=row.audit_key,
                entity=row.entity,
                entity_key=row.entity_key,
                action=row.action,
                old_value=row.old_value,
                new_value=row.new_value,
                updated_by=row.updated_by,
                updated_at=as_utc(row.updated_at),
            )
            for row in rows
        ]
