import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, URL,text
from sqlalchemy.exc import SQLAlchemyError
from config.logConfig import get_logger

logger = get_logger(__name__)
#DATABASE_URL = "postgresql+psycopg2://airflow:airflow@10.235.21.132:9000/airflow"
# Load environment variables
load_dotenv()

# Read database configuration
DATABASE_URL = URL.create(
    drivername="postgresql+psycopg2",
    username=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
    host=os.getenv("DB_HOST"),
    port=int(os.getenv("DB_PORT", "5432")),
    database=os.getenv("DB_NAME")
)

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True
)


def fetch_dates_from_db(schedule_name: str):
    query = text("""
        SELECT rundates
        FROM calanderdates.calander_info
        WHERE name = :schedule_name
    """)

    try:
        with engine.connect() as connection:
            result = connection.execute(
                query,
                {"schedule_name": schedule_name}
            )

            return [row[0] for row in result]

    except SQLAlchemyError:
        logger.exception("Database error while fetching dates")
        raise
