
from database.fetchFromDb import fetch_dates_from_db
from config.logConfig import get_logger

logger = get_logger(__name__)

def get_dates_service():

    try:
        schedule_name = "Daily Job Schedule"

        logger.info("Fetching dates for schedule: %s", schedule_name)

        records = fetch_dates_from_db(schedule_name)

        dates = []

        for json_data in records:

            if isinstance(json_data, dict):
                dates.extend(json_data.get("dates", []))

            elif isinstance(json_data, list):
                dates.extend(json_data)

        logger.info("Successfully processed %d dates", len(dates))

        return {
            "dates": dates
        }

    except Exception:
        logger.exception("Error in date service")
        raise