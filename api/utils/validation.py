"""Grove — request parsing and validation.

Input handling was previously repeated inline at every call site:

    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "title is required"}), 400

...which is fine until you notice that no endpoint checked lengths, so a
200,000-character title reached a String(200) column and blew up as a
database error; that `request.json` raises a 415 HTML page when a client
forgets the Content-Type header; and that every field reported its problem
in a slightly different sentence.

These helpers make the checks declarative and the failures uniform. They
raise ValidationError, which api/utils/errors.py renders as a 400 carrying
per-field messages the frontend can put next to the offending input.
"""

from __future__ import annotations

from datetime import date as _date
from typing import Any

from flask import request

from api.utils.errors import BadRequest, ValidationError

# Sentinel distinguishing "the caller passed None" from "the caller passed
# nothing at all". PATCH semantics depend on that difference: an absent key
# means leave the field alone, an explicit null means clear it.
MISSING = object()


def json_body(*, required: bool = True) -> dict:
    """The request's JSON body as a dict.

    `request.get_json(silent=True)` rather than `request.json` because the
    latter aborts with a 415 HTML page when Content-Type is missing — a
    confusing failure for a frontend that only forgot a header.
    """
    body = request.get_json(silent=True)

    if body is None:
        if required:
            raise BadRequest(
                "Expected a JSON request body.",
                details={"hint": "Send Content-Type: application/json"},
            )
        return {}

    if not isinstance(body, dict):
        raise BadRequest("Expected the request body to be a JSON object.")

    return body


class FieldValidator:
    """Accumulates field errors so one response can report all of them.

    Reporting the first failure and stopping means a user with three empty
    required fields has to submit three times to learn that. This collects
    everything, then raises once.
    """

    def __init__(self, data: dict[str, Any]) -> None:
        self.data = data
        self.errors: dict[str, str] = {}

    # ── individual field readers ────────────────────────────────────────

    def string(
        self,
        key: str,
        *,
        required: bool = False,
        default: Any = MISSING,
        min_length: int = 1,
        max_length: int | None = None,
        lower: bool = False,
        allow_empty: bool = False,
    ) -> Any:
        """Read, strip and bounds-check a string field.

        Returns MISSING when the key is absent and no default was given, so
        PATCH handlers can tell "not supplied" from "supplied as empty".
        """
        if key not in self.data:
            if required:
                self.errors[key] = "This field is required."
                return MISSING
            return default

        raw = self.data[key]
        if raw is None:
            if required:
                self.errors[key] = "This field is required."
                return MISSING
            return None

        if not isinstance(raw, str):
            self.errors[key] = "Must be text."
            return MISSING

        value = raw.strip()
        if lower:
            value = value.lower()

        if not value:
            if required or not allow_empty:
                self.errors[key] = "This field cannot be empty."
                return MISSING
            return None

        if len(value) < min_length:
            self.errors[key] = f"Must be at least {min_length} characters."
            return MISSING

        if max_length is not None and len(value) > max_length:
            self.errors[key] = f"Must be at most {max_length} characters."
            return MISSING

        return value

    def boolean(self, key: str, *, required: bool = False, default: Any = MISSING) -> Any:
        if key not in self.data:
            if required:
                self.errors[key] = "This field is required."
                return MISSING
            return default

        raw = self.data[key]
        if isinstance(raw, bool):
            return raw
        # Tolerate the JSON-ish spellings a form or query string produces,
        # but reject anything genuinely ambiguous rather than guessing.
        if isinstance(raw, str) and raw.strip().lower() in {"true", "false"}:
            return raw.strip().lower() == "true"

        self.errors[key] = "Must be true or false."
        return MISSING

    def integer(
        self,
        key: str,
        *,
        required: bool = False,
        default: Any = MISSING,
        minimum: int | None = None,
        maximum: int | None = None,
    ) -> Any:
        if key not in self.data:
            if required:
                self.errors[key] = "This field is required."
                return MISSING
            return default

        raw = self.data[key]
        # bool is a subclass of int in Python; True should not read as 1 here.
        if isinstance(raw, bool) or not isinstance(raw, int):
            try:
                raw = int(str(raw).strip())
            except (TypeError, ValueError):
                self.errors[key] = "Must be a whole number."
                return MISSING

        if minimum is not None and raw < minimum:
            self.errors[key] = f"Must be at least {minimum}."
            return MISSING
        if maximum is not None and raw > maximum:
            self.errors[key] = f"Must be at most {maximum}."
            return MISSING

        return raw

    def string_list(
        self,
        key: str,
        *,
        default: Any = MISSING,
        max_items: int = 20,
        max_item_length: int = 40,
    ) -> Any:
        """A list of short strings — tags, in practice.

        Deduplicates case-insensitively while preserving the caller's
        ordering and original casing, and enforces a ceiling on both the
        number of items and their length so a single request cannot create
        thousands of Tag rows.
        """
        if key not in self.data:
            return default

        raw = self.data[key]
        if raw is None:
            return []

        if not isinstance(raw, list):
            self.errors[key] = "Must be a list."
            return MISSING

        if len(raw) > max_items:
            self.errors[key] = f"At most {max_items} items allowed."
            return MISSING

        cleaned: list[str] = []
        seen: set[str] = set()
        for item in raw:
            if not isinstance(item, str):
                self.errors[key] = "Every item must be text."
                return MISSING
            value = item.strip()
            if not value:
                continue
            if len(value) > max_item_length:
                self.errors[key] = f"Each item must be at most {max_item_length} characters."
                return MISSING
            fold = value.casefold()
            if fold in seen:
                continue
            seen.add(fold)
            cleaned.append(value)

        return cleaned

    def date(self, key: str, *, required: bool = False, default: Any = MISSING) -> Any:
        """An ISO-8601 date (YYYY-MM-DD).

        Explicit null is honoured and returns None, which is how the client
        clears a due date — distinct from omitting the key, which leaves it
        alone.
        """
        if key not in self.data:
            if required:
                self.errors[key] = "This field is required."
                return MISSING
            return default

        raw = self.data[key]
        if raw is None or (isinstance(raw, str) and not raw.strip()):
            if required:
                self.errors[key] = "This field is required."
                return MISSING
            return None

        if not isinstance(raw, str):
            self.errors[key] = "Must be a date in YYYY-MM-DD format."
            return MISSING

        try:
            return _date.fromisoformat(raw.strip()[:10])
        except ValueError:
            self.errors[key] = "Must be a date in YYYY-MM-DD format."
            return MISSING

    def one_of(self, key: str, choices: tuple[str, ...], *, required: bool = False) -> Any:
        value = self.string(key, required=required)
        if value is MISSING or value is None:
            return value
        if value not in choices:
            self.errors[key] = f"Must be one of: {', '.join(choices)}."
            return MISSING
        return value

    # ── finishing ───────────────────────────────────────────────────────

    def raise_if_invalid(self) -> None:
        if self.errors:
            raise ValidationError(self.errors)


def validate(data: dict[str, Any]) -> FieldValidator:
    """Convenience constructor so call sites read as one expression."""
    return FieldValidator(data)


def query_int(
    name: str, *, default: int, minimum: int | None = None, maximum: int | None = None
) -> int:
    """A validated integer from the query string.

    An absent or blank parameter takes the default; a present but nonsense
    one is a 400 rather than being silently coerced to the default, because
    `?limit=abc` quietly returning 50 rows hides a real client bug.
    """
    raw = request.args.get(name)
    if raw is None or not raw.strip():
        return default

    validator = validate({name: raw})
    value = validator.integer(name, default=default, minimum=minimum, maximum=maximum)
    validator.raise_if_invalid()
    return value


def query_flag(name: str) -> bool | None:
    """A tri-state boolean from the query string: True, False, or absent."""
    raw = request.args.get(name)
    if raw is None or not raw.strip():
        return None

    validator = validate({name: raw})
    value = validator.boolean(name)
    validator.raise_if_invalid()
    return value


def pagination_args(*, default_limit: int = 50, max_limit: int = 200) -> tuple[int, int]:
    """(limit, offset) from the query string, clamped to sane bounds.

    Every list endpoint previously returned every row it could find. That is
    fine with a class-project amount of data and not fine the first time
    somebody's task list has ten thousand entries in it.
    """
    return (
        query_int("limit", default=default_limit, minimum=1, maximum=max_limit),
        query_int("offset", default=0, minimum=0),
    )


def escape_like(term: str) -> str:
    """Escape LIKE wildcards in a user-supplied search term.

    Without this, searching for "%" matches every user in the database and
    "_" matches any single character — a search box that quietly turns into
    a full user dump. Pair with `.ilike(pattern, escape="\\\\")`.
    """
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
