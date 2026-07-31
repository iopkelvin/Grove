# Kyle

"""
Grove — database config.

Defines the single SQLAlchemy `db` object the rest of the backend imports.
Deliberately does NOT attach to the Flask app here — app.py does that with
db.init_app(app). Keeping them separate avoids circular imports between
app.py and the model files.
"""

import os
from dotenv import load_dotenv
from flask_sqlalchemy import SQLAlchemy

load_dotenv()

# The one db object for the whole app. Models import this and don't make their own.
db = SQLAlchemy()

# DATABASE_URL is set in production (Render) to point at Supabase's Postgres,
# and can optionally be set locally (in a root .env, see .env.example) to
# develop against that same shared database. If it's unset, fall back to a
# local SQLite file — zero setup, but not shared and not persistent in
# ephemeral hosting environments.
_database_url = os.environ.get("DATABASE_URL", "sqlite:///grove.db")

# Some providers (Supabase included) hand out "postgres://" URLs, but
# SQLAlchemy 1.4+ only recognizes the "postgresql://" scheme.
if _database_url.startswith("postgres://"):
    _database_url = _database_url.replace("postgres://", "postgresql://", 1)

SQLALCHEMY_DATABASE_URI = _database_url
