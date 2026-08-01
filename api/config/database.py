"""
Grove — database config.

Defines the single SQLAlchemy `db` object the rest of the backend imports.
Deliberately does NOT attach to the Flask app here — app.py does that with
db.init_app(app). Keeping them separate avoids circular imports between
app.py and the model files.

DATABASE_URL points at Supabase Postgres in production (and optionally in
local dev, see .env.example). If it's unset, blank, or malformed, we fall
back to a local SQLite file rather than crashing the app.
"""

from __future__ import annotations

import os
import warnings

from dotenv import load_dotenv
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError

load_dotenv()

# The one db object for the whole app. Models import this and don't make their own.
db = SQLAlchemy()

_DEFAULT_DATABASE_URL = "sqlite:///grove.db"


def _resolve_database_url(raw: str | None) -> str:
    url = (raw or "").strip()
    if not url:
        return _DEFAULT_DATABASE_URL

    # Supabase (and other providers) hand out "postgres://" URLs, but
    # SQLAlchemy 1.4+ only recognizes "postgresql://".
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]

    try:
        make_url(url)
    except ArgumentError:
        # Don't echo any part of `url` here — a mis-pasted value can
        # contain real credentials, and this ends up in logs.
        warnings.warn(
            "DATABASE_URL isn't a valid database URL — falling back to "
            "local SQLite. Check the value in your host's environment "
            "variable settings.",
            stacklevel=2,
        )
        return _DEFAULT_DATABASE_URL

    return url


SQLALCHEMY_DATABASE_URI = _resolve_database_url(os.environ.get("DATABASE_URL"))
