
import logging
import os

os.makedirs("logs", exist_ok=True)

# Log format
formatter = logging.Formatter(
    "%(asctime)s | %(levelname)s | %(name)s | %(message)s"
)

# General application log
app_handler = logging.FileHandler(
    "logs/app.log",
    encoding="utf-8"
)
app_handler.setLevel(logging.INFO)
app_handler.setFormatter(formatter)

# Error-only log
error_handler = logging.FileHandler(
    "logs/error.log",
    encoding="utf-8"
)
error_handler.setLevel(logging.ERROR)
error_handler.setFormatter(formatter)

# Root logger
root_logger = logging.getLogger()
root_logger.setLevel(logging.INFO)

root_logger.addHandler(app_handler)
root_logger.addHandler(error_handler)

def get_logger(name):
    return logging.getLogger(name)
