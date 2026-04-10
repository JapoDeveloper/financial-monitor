import logging
import sys
from app.core.config import settings


def setup_logging() -> logging.Logger:
    """
    Configures structured logging for the application.
    Uses rich handler in development, plain JSON-style in production.
    """
    log_level = logging.DEBUG if settings.is_development else logging.INFO

    logging.basicConfig(
        level=log_level,
        format="%(asctime)s | %(levelname)-8s | %(name)s:%(lineno)d - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        stream=sys.stdout,
    )

    # Silence noisy third-party loggers
    logging.getLogger("yfinance").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)

    logger = logging.getLogger("financial_platform")
    logger.info("Logging configured | env=%s | level=%s", settings.app_env, log_level)
    return logger


logger = setup_logging()
