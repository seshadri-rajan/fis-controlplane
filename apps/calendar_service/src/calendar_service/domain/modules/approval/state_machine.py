"""State machine: DRAFT -> PENDING -> APPROVED | REJECTED.

Self-approval is rejected here: approver must differ from maker (11.4).
"""

from __future__ import annotations

from datetime import UTC, datetime

from .entity import ChangeRequest, ChangeStatus


class ApprovalError(Exception):
    pass


class SelfApprovalError(ApprovalError):
    pass


class AlreadyResolvedError(ApprovalError):
    pass


def _guard(request: ChangeRequest, actor: str) -> None:
    if request.status is not ChangeStatus.PENDING:
        raise AlreadyResolvedError(
            f"change request {request.change_request_id} is already {request.status.value}"
        )
    if actor == request.maker:
        raise SelfApprovalError(
            "four-eyes approval requires a different person from the maker"
        )


def approve(request: ChangeRequest, actor: str) -> ChangeRequest:
    _guard(request, actor)
    request.status = ChangeStatus.APPROVED
    request.checker = actor
    request.checked_at = datetime.now(UTC)
    return request


def reject(request: ChangeRequest, actor: str, reason: str) -> ChangeRequest:
    _guard(request, actor)
    if not reason.strip():
        raise ApprovalError("a rejection must carry a reason")
    request.status = ChangeStatus.REJECTED
    request.checker = actor
    request.checked_at = datetime.now(UTC)
    request.reject_reason = reason
    return request


def withdraw(request: ChangeRequest, actor: str) -> ChangeRequest:
    """A maker cancelling their own pending change. Scope confirmed pending 11.5."""
    if request.status is not ChangeStatus.PENDING:
        raise AlreadyResolvedError(
            f"change request {request.change_request_id} is already {request.status.value}"
        )
    if actor != request.maker:
        raise ApprovalError("only the maker may withdraw a pending change")
    request.status = ChangeStatus.REJECTED
    request.checker = None
    request.checked_at = datetime.now(UTC)
    request.reject_reason = "withdrawn by maker"
    return request
