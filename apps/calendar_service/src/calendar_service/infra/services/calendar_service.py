"""Calendar business operations over the repository interfaces.

Every mutation passes through `_submit`, which is the single place the four-eyes gate is applied.
With `approval_required` off the change still lands in calendar_change_request as an
auto-approved record, so enabling the gate later changes one branch rather than every call site.
"""

from __future__ import annotations

from dataclasses import asdict
from datetime import UTC, date, datetime
from typing import Any

from calendar_core import Holiday, UnknownRuleError, generate_year

from ...domain.modules.approval.entity import ChangeAction, ChangeRequest, ChangeStatus
from ...domain.modules.approval.repository import IChangeRequestRepository
from ...domain.modules.audit.entity import ENTITY_CALENDAR, ENTITY_CHANGE_REQUEST, AuditEntry
from ...domain.modules.audit.repository import IAuditRepository
from ...domain.modules.calendar.entity import Calendar, CalendarDate, CalendarKind
from ...domain.modules.calendar.exceptions import (
    CalendarNotFoundError,
    DuplicateCalendarError,
)
from ...domain.modules.calendar.repository import ICalendarRepository, IHolidayRepository

ENTITY = ENTITY_CALENDAR


class CalendarService:
    def __init__(
        self,
        calendars: ICalendarRepository,
        holidays: IHolidayRepository,
        changes: IChangeRequestRepository,
        audit: IAuditRepository,
        *,
        approval_required: bool,
        materialise_years: int = 2,
    ) -> None:
        self._calendars = calendars
        self._holidays = holidays
        self._changes = changes
        self._audit = audit
        self._approval_required = approval_required
        self._materialise_years = materialise_years

    # --- queries ---

    async def list(self, *, include_inactive: bool = False) -> list[Calendar]:
        return await self._calendars.list(include_inactive=include_inactive)

    async def get(self, calendar_key: int) -> Calendar:
        calendar = await self._calendars.get(calendar_key)
        if calendar is None:
            raise CalendarNotFoundError(f"calendar {calendar_key} not found")
        return calendar

    async def dates(self, calendar_key: int, year: int | None = None) -> list[CalendarDate]:
        await self.get(calendar_key)
        return await self._calendars.list_dates(calendar_key, year)

    async def coverage_end(self, calendar_key: int) -> date | None:
        return await self._calendars.max_date(calendar_key)

    # --- mutations ---

    async def create(self, calendar: Calendar, actor: str) -> tuple[Calendar | None, ChangeRequest]:
        if await self._calendars.get_by_name(calendar.calendar_nm):
            raise DuplicateCalendarError(f"calendar {calendar.calendar_nm!r} already exists")

        await self._resolve_rule(calendar)
        return await self._submit(ChangeAction.CREATE, calendar, actor)

    async def update(
        self, calendar_key: int, calendar: Calendar, actor: str
    ) -> tuple[Calendar | None, ChangeRequest]:
        existing = await self.get(calendar_key)
        calendar.calendar_key = existing.calendar_key
        calendar.calendar_nm = existing.calendar_nm
        calendar.created_by = existing.created_by

        await self._resolve_rule(calendar)
        return await self._submit(ChangeAction.UPDATE, calendar, actor)

    async def delete(self, calendar_key: int, actor: str) -> tuple[Calendar | None, ChangeRequest]:
        existing = await self.get(calendar_key)
        return await self._submit(ChangeAction.DELETE, existing, actor)

    async def approve(self, change_request_id: int, actor: str) -> ChangeRequest:
        from ...domain.modules.approval import state_machine

        request = await self._require_change(change_request_id)
        state_machine.approve(request, actor)
        await self._apply(request, actor)
        await self._audit.record(
            AuditEntry(
                entity=ENTITY_CHANGE_REQUEST,
                entity_key=request.change_request_id,
                action="APPROVE",
                new_value={"maker": request.maker, "checker": actor},
                updated_by=actor,
            )
        )
        return await self._changes.save(request)

    async def reject(self, change_request_id: int, actor: str, reason: str) -> ChangeRequest:
        from ...domain.modules.approval import state_machine

        request = await self._require_change(change_request_id)
        state_machine.reject(request, actor, reason)
        await self._audit.record(
            AuditEntry(
                entity=ENTITY_CHANGE_REQUEST,
                entity_key=request.change_request_id,
                action="REJECT",
                new_value={"maker": request.maker, "checker": actor, "reason": reason},
                updated_by=actor,
            )
        )
        return await self._changes.save(request)

    async def history(self, calendar_key: int) -> list[AuditEntry]:
        return await self._audit.list_for(ENTITY, calendar_key)

    async def pending(self) -> list[ChangeRequest]:
        return await self._changes.list(ChangeStatus.PENDING)

    # --- materialisation ---

    async def materialise(self, calendar_key: int, years: list[int]) -> int:
        calendar = await self.get(calendar_key)
        spec = calendar.to_spec()
        written = 0

        for year in years:
            holidays = [
                Holiday(day=day, name=name)
                for day, name in await self._holidays.holidays_for(
                    calendar.holiday_calendar_id, year
                )
            ]
            generated = generate_year(spec, year, holidays)
            await self._calendars.replace_dates(
                calendar_key,
                year,
                [
                    CalendarDate(
                        calendar_date=g.day, shifted_from=g.shifted_from, remarks=g.reason
                    )
                    for g in generated
                ],
            )
            written += len(generated)

        return written

    # --- internals ---

    async def _require_change(self, change_request_id: int) -> ChangeRequest:
        request = await self._changes.get(change_request_id)
        if request is None:
            raise CalendarNotFoundError(f"change request {change_request_id} not found")
        return request

    async def _resolve_rule(self, calendar: Calendar) -> None:
        if calendar.kind is not CalendarKind.EXTENDED_RULE:
            return

        if calendar.calendar_rule_id is None and calendar.rule_name:
            rule_id = await self._holidays.rule_id(calendar.rule_name)
            if rule_id is None:
                raise UnknownRuleError(f"rule {calendar.rule_name!r} is not registered")
            calendar.calendar_rule_id = rule_id
        elif calendar.calendar_rule_id is not None and not calendar.rule_name:
            calendar.rule_name = await self._holidays.rule_name(calendar.calendar_rule_id)

    async def _submit(
        self, action: ChangeAction, calendar: Calendar, actor: str
    ) -> tuple[Calendar | None, ChangeRequest]:
        request = ChangeRequest(
            entity=ENTITY,
            entity_key=calendar.calendar_key,
            action=action,
            payload=_payload(calendar),
            maker=actor,
        )

        if self._approval_required:
            return None, await self._changes.create(request)

        # Gate off: approved with no checker, which records truthfully that no second pair of
        # eyes was involved. Naming the maker as approver would be a false audit record.
        request.status = ChangeStatus.APPROVED
        request.checked_at = datetime.now(UTC)
        stored = await self._changes.create(request)
        applied = await self._apply(stored, actor)
        return applied, stored

    async def _apply(self, request: ChangeRequest, actor: str) -> Calendar | None:
        calendar = _from_payload(request.payload)
        before = (
            await self._calendars.get(calendar.calendar_key)
            if calendar.calendar_key is not None
            else None
        )

        match request.action:
            case ChangeAction.CREATE:
                result = await self._calendars.create(calendar)
                assert result.calendar_key is not None
                await self.materialise(
                    result.calendar_key, _default_years(self._materialise_years)
                )
            case ChangeAction.UPDATE:
                result = await self._calendars.update(calendar)
                assert result.calendar_key is not None
                await self.materialise(
                    result.calendar_key, _default_years(self._materialise_years)
                )
            case ChangeAction.DELETE:
                assert calendar.calendar_key is not None
                await self._calendars.deactivate(calendar.calendar_key)
                result = None

        await self._audit.record(
            AuditEntry(
                entity=ENTITY,
                entity_key=calendar.calendar_key,
                action=request.action.value,
                old_value=_payload(before) if before else None,
                new_value=_payload(result) if result else None,
                updated_by=actor,
            )
        )
        return result


def _default_years(count: int) -> list[int]:
    start = date.today().year
    return [start + offset for offset in range(count)]


def _payload(calendar: Calendar) -> dict[str, Any]:
    return {
        "calendar_key": calendar.calendar_key,
        "calendar_nm": calendar.calendar_nm,
        "calendar_desc": calendar.calendar_desc,
        "kind": calendar.kind.value,
        "weekdays": calendar.weekdays,
        "calendar_rule_id": calendar.calendar_rule_id,
        "rule_name": calendar.rule_name,
        "rule_params": calendar.rule_params,
        "policies": asdict(calendar.policies),
        "holiday_calendar_id": calendar.holiday_calendar_id,
        "bu_id": calendar.bu_id,
        "app_id": calendar.app_id,
        "active_flag": calendar.active_flag,
        "created_by": calendar.created_by,
    }


def _from_payload(payload: dict[str, Any]) -> Calendar:
    from ...domain.modules.calendar.entity import CalendarPolicies

    data = dict(payload)
    data["kind"] = CalendarKind(data["kind"])
    data["policies"] = CalendarPolicies(**data.get("policies", {}))
    data["rule_params"] = data.get("rule_params") or {}
    return Calendar(**data)
