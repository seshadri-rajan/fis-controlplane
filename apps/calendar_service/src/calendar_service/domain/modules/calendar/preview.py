"""Calendar preview: generated dates plus the summary the UI needs.

Stateless. Holidays are supplied by the caller, so this works before any database exists.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date

from calendar_core import CalendarSpec, GeneratedDate, Holiday, generate_year


@dataclass(frozen=True, slots=True)
class PreviewResult:
    year: int
    dates: list[GeneratedDate]

    @property
    def total(self) -> int:
        return len(self.dates)

    @property
    def shifted(self) -> list[GeneratedDate]:
        return [d for d in self.dates if d.was_shifted]

    @property
    def by_month(self) -> dict[int, int]:
        counts = dict.fromkeys(range(1, 13), 0)
        for generated in self.dates:
            counts[generated.day.month] += 1
        return counts

    def has_no_dates_after(self, threshold: date) -> bool:
        """The O-04 cliff condition, expressed on a single calendar."""
        return all(generated.day <= threshold for generated in self.dates)


def build_preview(
    spec: CalendarSpec,
    year: int,
    holidays: Iterable[Holiday] = (),
) -> PreviewResult:
    return PreviewResult(year=year, dates=generate_year(spec, year, holidays))
