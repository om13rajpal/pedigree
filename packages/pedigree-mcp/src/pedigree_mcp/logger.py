"""Structured JSON logger writing to stderr so MCP stdio transport stays clean."""

from __future__ import annotations

import sys

import structlog


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    """Return a bound structlog logger that writes JSON to stderr.

    Args:
        name: The logger name, typically the module's __name__.

    Returns:
        A structlog BoundLogger configured for JSON output on stderr.
    """
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(file=sys.stderr),
        cache_logger_on_first_use=True,
    )
    return structlog.get_logger(name)
