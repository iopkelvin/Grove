"""Grove — logging.

The backend had no logging at all: failures surfaced as a Flask stack trace
in whatever terminal happened to be attached, and on Render they vanished
into the platform's default output with no way to correlate a user's report
with a specific request.

This module gives every log line a request id, so "it broke when I clicked
save" becomes a single greppable trace, and lets production emit one JSON
object per line for log aggregators while keeping local output readable.

Usage:

    from api.utils.logger import get_logger
    logger = get_logger(__name__)
    logger.info("task created", extra={"task_id": task.id})
"""

from __future__ import annotations

import json
import logging
import sys
import uuid
from contextvars import ContextVar

# Set per request by the middleware in api/__init__.py. A ContextVar rather
# than a Flask `g` attribute so background workers and code outside a request
# context can still log without blowing up.
_request_id: ContextVar[str | None] = ContextVar("grove_request_id", default=None)

# LogRecord attributes that are always present. Anything else on a record
# came from `extra=` and belongs in the structured output.
_STANDARD_RECORD_KEYS = frozenset(
    logging.LogRecord("", 0, "", 0, "", None, None).__dict__
) | {"message", "asctime", "taskName"}


def new_request_id() -> str:
    """A short, unique-enough id for correlating one request's log lines."""
    return uuid.uuid4().hex[:12]


def set_request_id(request_id: str | None) -> None:
    _request_id.set(request_id)


def get_request_id() -> str | None:
    return _request_id.get()


class RequestIdFilter(logging.Filter):
    """Attaches the current request id to every record.

    A filter rather than a formatter concern so both formatters below — and
    any handler added later — see the same value.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = get_request_id() or "-"
        return True


class JsonFormatter(logging.Formatter):
    """One JSON object per line, for log aggregation in production."""

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", "-"),
        }

        # Anything passed via extra={...} rides along as its own key.
        for key, value in record.__dict__.items():
            if key not in _STANDARD_RECORD_KEYS and key != "request_id":
                payload[key] = value

        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)

        # default=str keeps a stray datetime or model object from turning a
        # log call into a TypeError inside the logging machinery.
        return json.dumps(payload, default=str)


class HumanFormatter(logging.Formatter):
    """Compact, aligned output for a developer watching a terminal."""

    def __init__(self) -> None:
        super().__init__(
            fmt="%(asctime)s %(levelname)-7s [%(request_id)s] %(name)s: %(message)s",
            datefmt="%H:%M:%S",
        )


def configure_logging(level: str = "INFO", json_output: bool = False) -> None:
    """Install Grove's handler on the root logger.

    Idempotent: calling it twice (the app factory runs many times over in
    the test suite) replaces the handler instead of stacking duplicates,
    which is the usual cause of every log line appearing three times.
    """
    root = logging.getLogger()

    for handler in list(root.handlers):
        if getattr(handler, "_grove_handler", False):
            root.removeHandler(handler)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter() if json_output else HumanFormatter())
    handler.addFilter(RequestIdFilter())
    handler._grove_handler = True

    resolved = getattr(logging, str(level).upper(), logging.INFO)
    root.setLevel(resolved)
    root.addHandler(handler)

    # Werkzeug logs one line per request at INFO; useful in development,
    # pure noise next to our own structured request log in production.
    logging.getLogger("werkzeug").setLevel(logging.WARNING if json_output else resolved)


def get_logger(name: str) -> logging.Logger:
    """Module-level logger. A thin wrapper so callers never touch `logging`
    directly and the implementation stays swappable."""
    return logging.getLogger(name)
