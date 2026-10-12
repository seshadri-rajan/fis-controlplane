"""SQLAlchemy models.

Corrects the schema defects recorded in RECORD.md section 6: declared foreign-key columns,
TIMESTAMPTZ throughout (S-10), JSONB audit payloads (S-11), a uniqueness constraint and index on
calendar dates (S-04, S-05), and real business_unit / application tables (S-12).

The holiday calendar link is retained despite D-08 (single region) so multi-region stays additive.
"""

from __future__ import annotations

from datetime import UTC, date, datetime

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

# none_as_null keeps Python None as SQL NULL rather than JSON 'null', which the
# mutual-exclusivity constraint on calendar depends on.
JsonType = JSON(none_as_null=True).with_variant(JSONB(none_as_null=True), "postgresql")
Timestamp = DateTime(timezone=True)

# SQLite only autoincrements INTEGER PRIMARY KEY, so keys need a dialect variant.
PkType = BigInteger().with_variant(Integer, "sqlite")

CALENDAR_KIND_BUSINESS_DAYS = "BUSINESS_DAYS"
CALENDAR_KIND_EXTENDED_RULE = "EXTENDED_RULE"

CHANGE_STATUS_PENDING = "PENDING"
CHANGE_STATUS_APPROVED = "APPROVED"
CHANGE_STATUS_REJECTED = "REJECTED"


class Base(DeclarativeBase):
    pass


def as_utc(value: datetime | None) -> datetime | None:
    """SQLite returns naive datetimes where PostgreSQL returns aware ones."""
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=UTC)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(Timestamp, server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(Timestamp, onupdate=func.now())
    created_by: Mapped[str] = mapped_column(String(100))


class BusinessUnit(Base, TimestampMixin):
    __tablename__ = "business_unit"

    bu_id: Mapped[int] = mapped_column(PkType, primary_key=True, autoincrement=True)
    bu_name: Mapped[str] = mapped_column(String(100), unique=True)
    active_flag: Mapped[bool] = mapped_column(Boolean, default=True)


class Application(Base, TimestampMixin):
    __tablename__ = "application"

    app_id: Mapped[int] = mapped_column(PkType, primary_key=True, autoincrement=True)
    app_name: Mapped[str] = mapped_column(String(100), unique=True)
    bu_id: Mapped[int | None] = mapped_column(ForeignKey("business_unit.bu_id"))
    active_flag: Mapped[bool] = mapped_column(Boolean, default=True)


class HolidayCalendar(Base, TimestampMixin):
    """Backend-managed; no UI create/update/delete, per the requirements."""

    __tablename__ = "holiday_calendar"

    holiday_calendar_id: Mapped[int] = mapped_column(
        PkType, primary_key=True, autoincrement=True
    )
    holiday_calendar_nm: Mapped[str] = mapped_column(String(100), unique=True)
    region: Mapped[str] = mapped_column(String(50), default="DEFAULT")
    active_flag: Mapped[bool] = mapped_column(Boolean, default=True)

    dates: Mapped[list[HolidayDate]] = relationship(
        back_populates="calendar", cascade="all, delete-orphan"
    )


class HolidayDate(Base):
    __tablename__ = "holiday_date"
    __table_args__ = (
        UniqueConstraint("holiday_calendar_id", "holiday_date", name="uq_holiday_calendar_date"),
        Index("ix_holiday_date_lookup", "holiday_calendar_id", "holiday_date"),
    )

    holiday_id: Mapped[int] = mapped_column(PkType, primary_key=True, autoincrement=True)
    holiday_calendar_id: Mapped[int] = mapped_column(
        ForeignKey("holiday_calendar.holiday_calendar_id", ondelete="CASCADE")
    )
    holiday_date: Mapped[date] = mapped_column(Date)
    holiday_name: Mapped[str] = mapped_column(String(100), default="")

    calendar: Mapped[HolidayCalendar] = relationship(back_populates="dates")


class CalendarRule(Base, TimestampMixin):
    """Reference data supplied by Fidelity (D-09).

    A row here does nothing unless a matching evaluator is registered in calendar_core.
    """

    __tablename__ = "calendar_rule"

    calendar_rule_id: Mapped[int] = mapped_column(PkType, primary_key=True, autoincrement=True)
    calendar_rule_nm: Mapped[str] = mapped_column(String(100), unique=True)
    calendar_rule_desc: Mapped[str | None] = mapped_column(Text)
    active_flag: Mapped[bool] = mapped_column(Boolean, default=True)


class Calendar(Base, TimestampMixin):
    __tablename__ = "calendar"
    __table_args__ = (
        CheckConstraint(
            f"kind in ('{CALENDAR_KIND_BUSINESS_DAYS}', '{CALENDAR_KIND_EXTENDED_RULE}')",
            name="ck_calendar_kind",
        ),
        # O-08: mutual exclusivity enforced in the database, not only the UI.
        CheckConstraint(
            f"(kind = '{CALENDAR_KIND_BUSINESS_DAYS}' and weekdays is not null"
            " and calendar_rule_id is null)"
            f" or (kind = '{CALENDAR_KIND_EXTENDED_RULE}' and calendar_rule_id is not null"
            " and weekdays is null)",
            name="ck_calendar_exactly_one_kind",
        ),
    )

    calendar_key: Mapped[int] = mapped_column(PkType, primary_key=True, autoincrement=True)
    calendar_nm: Mapped[str] = mapped_column(String(100), unique=True)
    calendar_desc: Mapped[str | None] = mapped_column(Text)
    kind: Mapped[str] = mapped_column(String(20))

    weekdays: Mapped[list[int] | None] = mapped_column(JsonType)
    calendar_rule_id: Mapped[int | None] = mapped_column(
        ForeignKey("calendar_rule.calendar_rule_id")
    )
    rule_params: Mapped[dict[str, int] | None] = mapped_column(JsonType)
    policies: Mapped[dict[str, str]] = mapped_column(JsonType, default=dict)

    holiday_calendar_id: Mapped[int | None] = mapped_column(
        ForeignKey("holiday_calendar.holiday_calendar_id")
    )
    bu_id: Mapped[int | None] = mapped_column(ForeignKey("business_unit.bu_id"))
    app_id: Mapped[int | None] = mapped_column(ForeignKey("application.app_id"))
    active_flag: Mapped[bool] = mapped_column(Boolean, default=True)

    rule: Mapped[CalendarRule | None] = relationship()
    dates: Mapped[list[CalendarDate]] = relationship(
        back_populates="calendar", cascade="all, delete-orphan"
    )


class CalendarDate(Base):
    __tablename__ = "calendar_date"
    __table_args__ = (
        UniqueConstraint("calendar_key", "calendar_date", name="uq_calendar_date"),
        Index("ix_calendar_date_lookup", "calendar_key", "calendar_date"),
    )

    calendar_date_id: Mapped[int] = mapped_column(PkType, primary_key=True, autoincrement=True)
    calendar_key: Mapped[int] = mapped_column(
        ForeignKey("calendar.calendar_key", ondelete="CASCADE")
    )
    calendar_date: Mapped[date] = mapped_column(Date)
    shifted_from: Mapped[date | None] = mapped_column(Date)
    remarks: Mapped[str] = mapped_column(String(255), default="")

    calendar: Mapped[Calendar] = relationship(back_populates="dates")


class CalendarChangeRequest(Base):
    """The four-eyes gate (RECORD.md 11.3).

    Present from the first migration even though the approval UI comes later; retrofitting an
    approval gate means rewriting every mutation path.
    """

    __tablename__ = "calendar_change_request"
    __table_args__ = (
        CheckConstraint(
            f"status in ('{CHANGE_STATUS_PENDING}', '{CHANGE_STATUS_APPROVED}',"
            f" '{CHANGE_STATUS_REJECTED}')",
            name="ck_change_request_status",
        ),
        CheckConstraint(
            "checker is null or checker <> maker",
            name="ck_change_request_no_self_approval",
        ),
        Index("ix_change_request_status", "status"),
    )

    change_request_id: Mapped[int] = mapped_column(
        PkType, primary_key=True, autoincrement=True
    )
    entity: Mapped[str] = mapped_column(String(50))
    entity_key: Mapped[int | None] = mapped_column(BigInteger)
    action: Mapped[str] = mapped_column(String(20))
    payload: Mapped[dict] = mapped_column(JsonType)
    status: Mapped[str] = mapped_column(String(20), default=CHANGE_STATUS_PENDING)

    maker: Mapped[str] = mapped_column(String(100))
    made_at: Mapped[datetime] = mapped_column(Timestamp, server_default=func.now())
    checker: Mapped[str | None] = mapped_column(String(100))
    checked_at: Mapped[datetime | None] = mapped_column(Timestamp)
    reject_reason: Mapped[str | None] = mapped_column(String(500))


class Role(Base, TimestampMixin):
    __tablename__ = "role"

    role_id: Mapped[int] = mapped_column(PkType, primary_key=True, autoincrement=True)
    role_name: Mapped[str] = mapped_column(String(100), unique=True)
    role_desc: Mapped[str | None] = mapped_column(String(500))


class AppUser(Base, TimestampMixin):
    """Local accounts; no SSO in this phase (D-01)."""

    __tablename__ = "app_user"

    user_id: Mapped[int] = mapped_column(PkType, primary_key=True, autoincrement=True)
    user_name: Mapped[str] = mapped_column(String(100), unique=True)
    user_email: Mapped[str] = mapped_column(String(255), unique=True)
    first_name: Mapped[str | None] = mapped_column(String(100))
    last_name: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE")

    password_hash: Mapped[str | None] = mapped_column(String(255))
    password_algo: Mapped[str] = mapped_column(String(20), default="argon2id")
    password_updated_at: Mapped[datetime | None] = mapped_column(Timestamp)
    failed_login_count: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(Timestamp)
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=True)

    bu_id: Mapped[int | None] = mapped_column(ForeignKey("business_unit.bu_id"))
    app_id: Mapped[int | None] = mapped_column(ForeignKey("application.app_id"))


class UserRole(Base):
    __tablename__ = "user_role"
    __table_args__ = (UniqueConstraint("user_id", "role_id", name="uq_user_role"),)

    user_role_id: Mapped[int] = mapped_column(PkType, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("app_user.user_id", ondelete="CASCADE"))
    role_id: Mapped[int] = mapped_column(ForeignKey("role.role_id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(Timestamp, server_default=func.now())
    created_by: Mapped[str] = mapped_column(String(100))


class ApiClient(Base):
    """Static API keys for machine callers (D-04). Only the SHA-256 hash is stored."""

    __tablename__ = "api_client"

    client_id: Mapped[int] = mapped_column(PkType, primary_key=True, autoincrement=True)
    client_name: Mapped[str] = mapped_column(String(100), unique=True)
    key_prefix: Mapped[str] = mapped_column(String(20), index=True)
    key_hash: Mapped[str] = mapped_column(String(64))
    bu_id: Mapped[int | None] = mapped_column(ForeignKey("business_unit.bu_id"))
    active_flag: Mapped[bool] = mapped_column(Boolean, default=True)
    expires_at: Mapped[datetime | None] = mapped_column(Timestamp)
    last_used_at: Mapped[datetime | None] = mapped_column(Timestamp)
    created_at: Mapped[datetime] = mapped_column(Timestamp, server_default=func.now())
    created_by: Mapped[str] = mapped_column(String(100))


class AuditLog(Base):
    __tablename__ = "audit_log"
    __table_args__ = (Index("ix_audit_entity", "entity", "entity_key"),)

    audit_key: Mapped[int] = mapped_column(PkType, primary_key=True, autoincrement=True)
    entity: Mapped[str] = mapped_column(String(50))
    entity_key: Mapped[int | None] = mapped_column(BigInteger)
    action: Mapped[str] = mapped_column(String(50))
    old_value: Mapped[dict | None] = mapped_column(JsonType)
    new_value: Mapped[dict | None] = mapped_column(JsonType)
    updated_by: Mapped[str] = mapped_column(String(100))
    updated_at: Mapped[datetime] = mapped_column(Timestamp, server_default=func.now())
