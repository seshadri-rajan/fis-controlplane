"""The migration must produce exactly the schema the models describe.

Without this, `create_all` in development and Alembic in deployment drift apart silently.
"""

from pathlib import Path

from alembic import command
from alembic.config import Config
from calendar_service.infra.database.management import ManagementBase
from sqlalchemy import create_engine, inspect

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
        assert migrated == set(ManagementBase.metadata.tables)

        for table in sorted(migrated):
            migrated_columns = {c["name"] for c in inspector.get_columns(table)}
            model_columns = {c.name for c in ManagementBase.metadata.tables[table].columns}
            assert migrated_columns == model_columns, table
        assert inspector.get_pk_constraint("calendar_date")["constrained_columns"] == [
            "calendar_id", "calendar_date"
        ]
    finally:
        engine.dispose()
