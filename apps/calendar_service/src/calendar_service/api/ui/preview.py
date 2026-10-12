"""Date preview for a calendar or rule, without persisting anything.

Read-only and safe to build before the approval model is settled. This is the screen that makes
the O-06 and O-07 ambiguities visible to the client.

Deliberately unauthenticated (O-32): pure computation over request-supplied input, exposing no
stored data. Rate limiting is the control that matters here, not a session.
"""

from fastapi import APIRouter, HTTPException, status

from calendar_core import UnknownRuleError, registered_rules

from ...domain.modules.calendar.preview import build_preview
from ..schemas.preview import PreviewDate, PreviewRequest, PreviewResponse, RuleSummary

router = APIRouter(prefix="/api/ui/preview", tags=["preview"])


@router.get("/rules")
async def list_rules() -> list[RuleSummary]:
    return [
        RuleSummary(rule_name=name, description=description)
        for name, description in sorted(registered_rules().items())
    ]


@router.post("")
async def preview(request: PreviewRequest) -> PreviewResponse:
    try:
        result = build_preview(
            request.to_spec(),
            request.year,
            [h.to_domain() for h in request.holidays],
        )
    except UnknownRuleError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc

    return PreviewResponse(
        name=request.name,
        year=result.year,
        total=result.total,
        shifted_count=len(result.shifted),
        by_month=result.by_month,
        dates=[
            PreviewDate(day=d.day, shifted_from=d.shifted_from, reason=d.reason)
            for d in result.dates
        ],
    )
