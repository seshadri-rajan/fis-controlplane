"""Initial date-only Calendar Management schema."""

import sqlalchemy as sa
from alembic import op

revision = "20261118_management"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    pk = sa.BigInteger().with_variant(sa.Integer(), "sqlite")
    timestamp = sa.DateTime(timezone=True)
    op.create_table(
        "calendar",
        sa.Column("calendar_id", pk, sa.Identity(always=True), primary_key=True),
        sa.Column("calendar_name", sa.String(256), nullable=False, unique=True),
        sa.Column("is_migrated", sa.CHAR(1), nullable=False, server_default="N"),
        sa.Column("is_uploaded", sa.CHAR(1), nullable=False, server_default="N"),
        sa.Column("status", sa.CHAR(1), nullable=False, server_default="A"),
        sa.Column("created_by", sa.String(256), nullable=False),
        sa.Column("created_at", timestamp, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", timestamp, nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        "calendar_date",
        sa.Column(
            "calendar_id",
            pk,
            sa.ForeignKey("calendar.calendar_id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("calendar_date", sa.Date(), primary_key=True),
    )
    op.create_table(
        "audit_log",
        sa.Column("audit_log_id", pk, sa.Identity(always=True), primary_key=True),
        sa.Column("resource_type", sa.String(256)),
        sa.Column("resource_name", sa.String(256)),
        sa.Column("action", sa.String(256), nullable=False),
        sa.Column("performed_by", sa.String(256), nullable=False),
        sa.Column("performed_at", timestamp, nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("audit_log")
    op.drop_table("calendar_date")
    op.drop_table("calendar")
