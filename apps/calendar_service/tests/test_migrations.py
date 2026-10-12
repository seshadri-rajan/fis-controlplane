"""The migration must produce exactly the schema the models describe.

Without this, `create_all` in development and Alembic in deployment drift apart silently.
"""

from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect

from calendar_service.infra.database.models import Base

SERVICE_ROOT = Path(__file__).resolve().parents[1]
ALEMBIC_INI = SERVICE_ROOT / "alembic.ini"
SCRIPT_LOCATION = SERVICE_ROOT / "src" / "calendar_service" / "infra" / "database" / "migrations"


def test_migration_head_matches_models(tmp_path):
    database = tmp_path / "migrated.db"

    config = Config(str(ALEMBIC_INI))
    config.set_main_option("script_location", str(SCRIPT_LOCATION))
    config.set_main_option("sqlalchemy.url", f"sqlite+aiosqlite:///{database}")
    command.upgrade(config, "head")

    engine = create_engine(f"sqlite:///{database}")
    try:
        inspector = inspect(engine)
        migrated = set(inspector.get_table_names()) - {"alembic_version"}
        assert migrated == set(Base.metadata.tables)

        for table in sorted(migrated):
            migrated_columns = {c["name"] for c in inspector.get_columns(table)}
            model_columns = {c.name for c in Base.metadata.tables[table].columns}
            assert migrated_columns == model_columns, table
    finally:
        engine.dispose()


def test_change_request_table_exists_from_the_first_migration():
    """RECORD 11.3: the four-eyes gate must not be a later retrofit."""
    assert "calendar_change_request" in Base.metadata.tables
    constraints = {
        c.name for c in Base.metadata.tables["calendar_change_request"].constraints if c.name
    }
    assert "ck_change_request_no_self_approval" in constraints
