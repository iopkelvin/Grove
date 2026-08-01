"""Grove — database setup.

Defines the single SQLAlchemy `db` object the rest of the backend imports.
Deliberately does NOT attach to a Flask app here — `create_app()` does that
with `db.init_app(app)`. Keeping them separate avoids circular imports
between the app factory and the model modules.

Resolving DATABASE_URL is a function rather than module-level work so that
importing a model never reads the environment as a side effect, and so tests
can exercise the resolution rules directly.
"""

from __future__ import annotations

import logging
import os

from dotenv import load_dotenv
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError

load_dotenv()

logger = logging.getLogger(__name__)

# The one db object for the whole app. Models import this; they do not make
# their own.
db = SQLAlchemy()

DEFAULT_DATABASE_URL = "sqlite:///grove.db"


def resolve_database_url(raw: str | None = None) -> str:
    """Turn a raw DATABASE_URL into a URL SQLAlchemy will actually accept.

    Three real failure modes this has to survive, all of which took the
    deployed backend down at some point:

    1. Unset or blank — fall back to a local SQLite file (zero setup, but
       not shared and not persistent on ephemeral hosts).
    2. The legacy ``postgres://`` scheme, which several providers still hand
       out and SQLAlchemy 1.4+ refuses to parse.
    3. Malformed entirely — e.g. the whole ``DATABASE_URL=postgresql://...``
       line pasted as the *value* in a host's dashboard, or the literal text
       "None". A typo should not take the service down, so this degrades to
       SQLite and logs loudly.
    """
    value = (raw if raw is not None else os.environ.get("DATABASE_URL") or "").strip()
    if not value:
        return DEFAULT_DATABASE_URL

    if value.startswith("postgres://"):
        value = value.replace("postgres://", "postgresql://", 1)

    try:
        make_url(value)
    except ArgumentError:
        logger.error(
            "DATABASE_URL is not a valid database URL (starts with %r) — falling back "
            "to local SQLite. Check the value in your host's environment settings.",
            value[:20],
        )
        return DEFAULT_DATABASE_URL

    return value
