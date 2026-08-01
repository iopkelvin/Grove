# Kyle

"""
Grove — database config.

Defines the single SQLAlchemy `db` object the rest of the backend imports.
Deliberately does NOT attach to the Flask app here — app.py does that with
db.init_app(app). Keeping them separate avoids circular imports between
app.py and the model files.
"""

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

# DATABASE_URL is set in production (Render) to point at Supabase's Postgres,
# and can optionally be set locally (in a root .env, see .env.example) to
# develop against that same shared database. If it's unset, fall back to a
# local SQLite file — zero setup, but not shared and not persistent in
# ephemeral hosting environments.
_database_url = (os.environ.get("DATABASE_URL") or "").strip() or _DEFAULT_DATABASE_URL

# Some providers (Supabase included) hand out "postgres://" URLs, but
# SQLAlchemy 1.4+ only recognizes the "postgresql://" scheme.
if _database_url.startswith("postgres://"):
    _database_url = _database_url.replace("postgres://", "postgresql://", 1)

# Blank is handled above, but the value can also just be malformed — e.g.
# someone pastes "DATABASE_URL=postgresql://..." (the whole line) as the
# *value* in a host's dashboard instead of just the "postgresql://..."
# part, or it's literally the text "None". Rather than let a typo take
# the whole app down, fall back to SQLite and log loudly so it's still
# obvious something needs fixing.
try:
    make_url(_database_url)
except ArgumentError:
    warnings.warn(
        f"DATABASE_URL isn't a valid database URL (starts with "
        f"{_database_url[:20]!r}) — falling back to local SQLite. Check "
        f"the value in your host's environment variable settings.",
        stacklevel=2,
    )
    _database_url = _DEFAULT_DATABASE_URL

SQLALCHEMY_DATABASE_URI = _database_url
