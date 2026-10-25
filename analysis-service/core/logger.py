"""
Structured JSON logger configuration using structlog.

Usage:
    from core.logger import get_logger
    logger = get_logger(__name__)
    logger.info("Agent started", agent="ParserAgent", project_id="abc123")
"""

import logging
import sys
import structlog
from core.config import settings


def configure_logging() -> None:
    """Configure structlog with appropriate processors for the environment."""

    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.ExceptionRenderer(),
    ]

    if settings.ENVIRONMENT == "production":
        # JSON output for log aggregation in production
        processors = shared_processors + [structlog.processors.JSONRenderer()]
    else:
        # Human-readable colored output in development
        processors = shared_processors + [
            structlog.dev.ConsoleRenderer(colors=True),
        ]

    structlog.configure(
        processors=processors,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    # Also configure the standard library logger to capture third-party logs
    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.DEBUG)
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=log_level,
    )
    # Quieten noisy libraries
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("motor").setLevel(logging.WARNING)
    logging.getLogger("pymongo").setLevel(logging.WARNING)


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    """
    Return a structlog logger bound to the given module name.

    Args:
        name: typically __name__ of the calling module

    Returns:
        Configured structlog BoundLogger instance
    """
    configure_logging()
    return structlog.get_logger(name)
