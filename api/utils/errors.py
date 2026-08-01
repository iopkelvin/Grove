"""Grove — API errors.

Every route used to build its own error response by hand:

    return jsonify({"error": "User not found"}), 404

which meant the shape drifted (some routes added extra keys, some didn't),
nothing was logged, and any failure the author had not anticipated — a
database integrity error, a typo raising AttributeError — escaped as
Flask's default HTML error page. A JSON API answering with HTML is the
worst possible failure mode for a frontend: `res.json()` throws while
parsing the error, and the user sees a blank screen instead of a message.

So: one exception hierarchy, one response shape, one place that logs.

    {
      "error":      "Task not found",     # human-readable, safe to display
      "code":       "not_found",          # stable, machine-readable
      "details":    {...},                # optional, field-level context
      "request_id": "9f2c1ab4e8d0"        # matches the X-Request-ID header
    }
"""

from __future__ import annotations

from flask import Flask, jsonify, request
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from werkzeug.exceptions import HTTPException

from api.config.database import db
from api.utils.logger import get_logger, get_request_id

logger = get_logger(__name__)


class ApiError(Exception):
    """Base class for every error the API raises deliberately.

    Raising one of these from anywhere — a route, a service, a validator —
    produces the documented JSON response. Nothing else needs a try/except.
    """

    status_code = 500
    code = "internal_error"
    message = "Something went wrong."

    def __init__(
        self,
        message: str | None = None,
        *,
        code: str | None = None,
        details: dict | None = None,
    ) -> None:
        super().__init__(message or self.message)
        self.message = message or self.message
        self.code = code or self.code
        self.details = details or {}

    def to_response(self) -> tuple[dict, int]:
        body: dict = {"error": self.message, "code": self.code}
        if self.details:
            body["details"] = self.details
        request_id = get_request_id()
        if request_id:
            body["request_id"] = request_id
        return body, self.status_code


class BadRequest(ApiError):
    """Malformed input: missing field, wrong type, unparseable body."""

    status_code = 400
    code = "bad_request"
    message = "The request was invalid."


class Unauthorized(ApiError):
    """No usable credentials. The client should log in again."""

    status_code = 401
    code = "unauthorized"
    message = "Authentication is required."


class Forbidden(ApiError):
    """Authenticated, but not allowed to touch this particular resource."""

    status_code = 403
    code = "forbidden"
    message = "You do not have permission to do that."


class NotFound(ApiError):
    status_code = 404
    code = "not_found"
    message = "Not found."


class Conflict(ApiError):
    """The request collides with existing state — duplicate friendship,
    username already taken, already a member of the room."""

    status_code = 409
    code = "conflict"
    message = "That conflicts with something that already exists."


class ValidationError(BadRequest):
    """A BadRequest carrying per-field messages.

    Kept distinct so the frontend can render errors next to the offending
    input rather than as one banner at the top of the form.
    """

    code = "validation_error"
    message = "Some fields are invalid."

    def __init__(self, errors: dict[str, str], message: str | None = None) -> None:
        super().__init__(message, details={"fields": errors})
        self.errors = errors


class NotImplementedYet(ApiError):
    """A route that exists in the URL map but is not built yet.

    Better than the `pass`-bodied stubs this replaces: those returned None,
    which Flask turns into a 500 with an unhelpful message about view
    functions not returning a valid response. A 501 tells the frontend
    exactly what is going on and is trivial to detect in a test.
    """

    status_code = 501
    code = "not_implemented"
    message = "This feature is not available yet."


def register_error_handlers(app: Flask) -> None:
    """Wire the whole hierarchy — plus the failures we do not raise
    ourselves — into JSON responses."""

    @app.errorhandler(ApiError)
    def _handle_api_error(exc: ApiError):
        body, status = exc.to_response()
        # 5xx is our bug; 4xx is the caller's. Only the former deserves
        # a stack trace and an error-level line.
        if status >= 500:
            logger.error("api error: %s", exc.message, exc_info=exc, extra={"code": exc.code})
        else:
            logger.info(
                "request rejected: %s", exc.message, extra={"code": exc.code, "status": status}
            )
        return jsonify(body), status

    @app.errorhandler(HTTPException)
    def _handle_http_exception(exc: HTTPException):
        """Werkzeug's own errors — 404 on an unknown URL, 405 on the wrong
        method, 413 on an oversized body — default to HTML. Convert them."""
        description = exc.description or exc.name

        # Werkzeug's 404 never says which URL missed, and "I typo'd the
        # endpoint" is the single most common frontend integration bug.
        if exc.code == 404 and request.path.startswith("/api/"):
            description = f"No such endpoint: {request.method} {request.path}"

        body = {
            "error": description,
            "code": exc.name.lower().replace(" ", "_"),
        }
        request_id = get_request_id()
        if request_id:
            body["request_id"] = request_id
        return jsonify(body), exc.code or 500

    @app.errorhandler(IntegrityError)
    def _handle_integrity_error(exc: IntegrityError):
        """A unique/foreign-key constraint fired.

        This is almost always a race the application logic already checks
        for — two clicks on "Add Friend", two signups with the same email —
        so it maps to 409, not 500. The session is rolled back; leaving it
        dirty would make every later query in the same request fail too.
        """
        db.session.rollback()
        logger.warning("integrity error: %s", exc.orig, extra={"code": "conflict"})
        body, status = Conflict(
            "That action conflicts with existing data. It may already have been done."
        ).to_response()
        return jsonify(body), status

    @app.errorhandler(SQLAlchemyError)
    def _handle_database_error(exc: SQLAlchemyError):
        db.session.rollback()
        logger.error("database error", exc_info=exc)
        body, status = ApiError(
            "The database is temporarily unavailable. Please try again.",
            code="database_error",
        ).to_response()
        return jsonify(body), status

    @app.errorhandler(Exception)
    def _handle_unexpected(exc: Exception):
        """Last resort. Never leaks the exception text to the client in
        production — the request id is what a user reports, and the detail
        lives in the logs."""
        db.session.rollback()
        logger.exception("unhandled exception")
        body, status = ApiError().to_response()
        if app.config.get("DEBUG"):
            body["debug"] = f"{type(exc).__name__}: {exc}"
        return jsonify(body), status
