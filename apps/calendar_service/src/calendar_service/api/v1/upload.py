"""Bound and validate calendar Excel uploads before opening a write transaction."""

import io
import re
import zipfile
from collections.abc import AsyncGenerator
from datetime import UTC, date, datetime

from fastapi import HTTPException, Request
from openpyxl import load_workbook
from openpyxl.utils.exceptions import InvalidFileException
from pydantic import ValidationError
from python_multipart.exceptions import MultipartParseError
from starlette.datastructures import Headers, UploadFile
from starlette.formparsers import MultiPartException, MultiPartParser

from calendar_service.api.schemas.management import (
    UploadMetadata,
    UploadVerificationItem,
    UploadVerificationResponse,
)

XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
DATE_HEADER = "Calendar date"
MAX_CALENDAR_DATES = 366


class UploadTooLarge(MultiPartException):
    pass


class UnsupportedPartType(MultiPartException):
    pass


def _media_type(value: str | None) -> str:
    return (value or "").split(";", 1)[0].strip().lower()


class CalendarMultipartParser(MultiPartParser):
    complete = False

    def on_headers_finished(self) -> None:
        super().on_headers_finished()
        part = self._current_part
        if part.field_name == "data":
            content_type = Headers(raw=part.item_headers).get("content-type")
            if _media_type(content_type) != "application/json":
                raise UnsupportedPartType("The data part must contain application/json.")

    def on_end(self) -> None:
        self.complete = True


def _verification_error(year: int, message: str) -> UploadVerificationResponse:
    return UploadVerificationResponse(year=year, valid=False, items=[], errors=[message])


def verify_dates(
    raw: bytes, year: int, *, amend: bool
) -> UploadVerificationResponse:
    try:
        workbook = load_workbook(io.BytesIO(raw), read_only=True, data_only=False)
    except (InvalidFileException, OSError, ValueError, zipfile.BadZipFile):
        return _verification_error(year, "The file must be a valid .xlsx workbook.")

    try:
        if len(workbook.worksheets) != 1:
            return _verification_error(year, "The workbook must contain exactly one worksheet.")
        sheet = workbook.worksheets[0]
        if sheet.max_row > MAX_CALENDAR_DATES + 1 or sheet.max_column != 1:
            return _verification_error(
                year, "The worksheet must contain one date column and no more than 366 dates."
            )
        if sheet["A1"].value != DATE_HEADER:
            return _verification_error(
                year, f"The worksheet must have one column headed '{DATE_HEADER}'."
            )

        current_date = datetime.now(UTC).date()
        errors: list[str] = []
        if not amend and year not in (current_date.year, current_date.year + 1):
            errors.append("Only the current or next calendar year can be uploaded.")

        items: list[UploadVerificationItem] = []
        first_row_by_date: dict[date, int] = {}
        for row_number in range(2, sheet.max_row + 1):
            cell = sheet.cell(row_number, 1)
            value = cell.value
            display_value: str | None = None
            parsed_date: date | None = None
            row_errors: list[str] = []

            if isinstance(value, datetime):
                if cell.number_format.lower() == "yyyy-mm-dd":
                    parsed_date = value.date()
                    display_value = parsed_date.isoformat()
                else:
                    row_errors.append("Date cells must use the YYYY-MM-DD format.")
                    display_value = value.isoformat()
            elif isinstance(value, date):
                if cell.number_format.lower() == "yyyy-mm-dd":
                    parsed_date = value
                    display_value = value.isoformat()
                else:
                    row_errors.append("Date cells must use the YYYY-MM-DD format.")
                    display_value = value.isoformat()
            elif isinstance(value, str):
                display_value = value
                if re.search(r"[A-Za-z]", value):
                    row_errors.append("Dates must not contain letters.")
                if not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value):
                    row_errors.append("Date must use the YYYY-MM-DD format.")
                elif not row_errors:
                    try:
                        parsed_date = date.fromisoformat(value)
                    except ValueError:
                        row_errors.append(
                            "Date must use the YYYY-MM-DD format and be a real date."
                        )
            else:
                display_value = None if value is None else str(value)
                row_errors.append("Enter a date in YYYY-MM-DD format.")

            if parsed_date is not None:
                if parsed_date < current_date:
                    row_errors.append("Past dates are not allowed.")
                if not amend and parsed_date.year not in (
                    current_date.year,
                    current_date.year + 1,
                ):
                    row_errors.append("Date must be in the current or next calendar year.")
                first_row = first_row_by_date.get(parsed_date)
                if first_row is not None:
                    row_errors.append(f"Duplicate date; it first appears in row {first_row}.")
                else:
                    first_row_by_date[parsed_date] = row_number

            items.append(
                UploadVerificationItem(
                    row=row_number,
                    value=display_value,
                    date=parsed_date.isoformat() if parsed_date else None,
                    valid=not row_errors,
                    errors=row_errors,
                )
            )

        if not items:
            errors.append("The worksheet must contain at least one date.")
        is_valid = not errors and all(item.valid for item in items)
        return UploadVerificationResponse(year=year, valid=is_valid, items=items, errors=errors)
    finally:
        workbook.close()


def _validate_upload_year(year: int) -> None:
    current_year = datetime.now(UTC).year
    if year not in (current_year, current_year + 1):
        raise HTTPException(400, "Only the current or next calendar year can be uploaded.")


async def _read_upload_parts(request: Request, limit: int) -> tuple[int, bytes]:
    if _media_type(request.headers.get("content-type")) != "multipart/form-data":
        raise HTTPException(415, "Use multipart/form-data with JSON data and an .xlsx file.")

    async def bounded_stream() -> AsyncGenerator[bytes, None]:
        received = 0
        async for chunk in request.stream():
            received += len(chunk)
            if received > limit + 64 * 1024:
                raise UploadTooLarge("Uploaded file exceeds the limit.")
            yield chunk

    parser = CalendarMultipartParser(
        request.headers, bounded_stream(), max_files=2, max_fields=1, max_part_size=4096
    )
    try:
        form = await parser.parse()
    except UploadTooLarge as exc:
        raise HTTPException(413, exc.message) from exc
    except UnsupportedPartType as exc:
        raise HTTPException(415, exc.message) from exc
    except (MultiPartException, MultipartParseError) as exc:
        raise HTTPException(400, "Malformed multipart upload.") from exc
    try:
        if not parser.complete:
            raise HTTPException(400, "Malformed multipart upload.")
        if sorted(key for key, _ in form.multi_items()) != ["data", "file"]:
            raise HTTPException(400, "Exactly one data part and one file part are required.")
        data, file = form["data"], form["file"]
        if not isinstance(file, UploadFile):
            raise HTTPException(400, "The file part must be an .xlsx attachment.")
        if not file.filename or not file.filename.lower().endswith(".xlsx"):
            raise HTTPException(415, "Only .xlsx files are supported.")
        if _media_type(file.content_type) != XLSX_MEDIA_TYPE:
            raise HTTPException(415, "The file part must have the .xlsx media type.")
        if isinstance(data, UploadFile):
            data = await data.read(4097)
        if len(data) > 4096:
            raise HTTPException(400, "Upload metadata is too large.")
        try:
            year = int(UploadMetadata.model_validate_json(data).year)
            if year == 0:
                raise ValueError
        except (ValidationError, ValueError) as exc:
            raise HTTPException(400, "The data part must contain a valid YYYY year.") from exc
        raw = await file.read(limit + 1)
        if len(raw) > limit:
            raise HTTPException(413, "Uploaded file exceeds the limit.")
        return year, raw
    finally:
        await form.close()


async def verify_upload(
    request: Request,
    limit: int,
    *,
    amend: bool = False,
) -> UploadVerificationResponse:
    year, raw = await _read_upload_parts(request, limit)
    return verify_dates(raw, year, amend=amend)


async def read_upload(request: Request, limit: int) -> tuple[int, list[date]]:
    year, raw = await _read_upload_parts(request, limit)
    _validate_upload_year(year)
    verification = verify_dates(raw, year, amend=False)
    if not verification.valid:
        raise HTTPException(
            400, "Upload verification failed. Fix all invalid rows before uploading."
        )
    dates = [date.fromisoformat(item.date) for item in verification.items if item.date]
    if any(day.year != year for day in dates):
        raise HTTPException(400, "Every uploaded date must be in the requested year.")
    return year, dates
