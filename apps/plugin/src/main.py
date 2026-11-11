
from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.exc import SQLAlchemyError
from service.fetchDates import get_dates_service
from config.logConfig import get_logger

logger = get_logger(__name__)
app = FastAPI()


@app.get("/api/dates")
def get_dates():

    try:
        return get_dates_service()

    except SQLAlchemyError:
        logger.exception("Database error in dates API")

        raise HTTPException(
            status_code=500,
            detail="Database error while fetching dates"
        )

    except Exception:
        logger.exception("Unexpected error in dates API")
        
        raise HTTPException(
            status_code=500,
            detail="Something went wrong while fetching dates"
        )

@app.get("/")
def home():
    return {
        "message": "FastAPI application is running successfully!"
    } 
