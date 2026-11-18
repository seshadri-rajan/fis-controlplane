"""Bound and validate calendar CSV uploads before opening a write transaction."""

import csv
import io
from collections.abc import AsyncGenerator
from datetime import date

from fastapi import HTTPException, Request
from pydantic import ValidationError
from python_multipart.exceptions import MultipartParseError
from starlette.datastructures import Headers, UploadFile
from starlette.formparsers import MultiPartException, MultiPartParser

from calendar_service.api.schemas.management import UploadMetadata, parse_date


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


def _read_csv(raw: bytes, year: int) -> list[date]:
    try:
        rows = csv.reader(io.StringIO(raw.decode("utf-8-sig"), newline=""), strict=True)
        if next(rows, None) != ["date"]:
            raise ValueError("CSV must have exactly one column with the header 'date'.")
        dates: set[date] = set()
        for row in rows:
            if len(row) != 1:
                raise ValueError(f"CSV line {rows.line_num} must have one date.")
            day = parse_date(row[0])
            if day.year != year:
                raise ValueError(f"CSV line {rows.line_num} must be in the requested year.")
            if day in dates:
                raise ValueError(f"CSV line {rows.line_num} contains a duplicate date.")
            dates.add(day)
        if not dates:
            raise ValueError("CSV must contain at least one date.")
        return sorted(dates)
    except (UnicodeDecodeError, csv.Error) as exc:
        raise HTTPException(400, "The file must be a valid UTF-8 CSV.") from exc
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


async def read_upload(request: Request, limit: int) -> tuple[int, list[date]]:
    if _media_type(request.headers.get("content-type")) != "multipart/form-data":
        raise HTTPException(415, "Use multipart/form-data with data and file parts.")

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
            raise HTTPException(400, "The file part must be a CSV attachment.")
        if _media_type(file.content_type) != "text/csv":
            raise HTTPException(415, "The file part must have media type text/csv.")
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
        return year, _read_csv(raw, year)
    finally:
        await form.close()
