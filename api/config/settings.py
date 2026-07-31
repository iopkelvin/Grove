"""Grove — application settings.

Configuration used to be a handful of `os.environ.get` calls scattered across
app.py and database.py, evaluated at import time. That made two things
impossible: running the app under a different configuration (tests need an
in-memory database and predictable auth), and knowing at a glance what the
service actually reads from the environment.

Everything the backend reads from the environment is declared here, in one
place, and resolved when `create_app()` builds a config object — not when a
module happens to get imported.
"""

from __future__ import annotations

import os

from api.config.database import DEFAULT_DATABASE_URL, resolve_database_url

# Origins the Vite dev server runs on out of the box. Used when CORS_ORIGINS
# is not set, so a fresh clone can talk to the API without configuring
# anything.
DEFAULT_DEV_ORIGINS = (
    "http://localhost:5173",
    "http://127.0.0.1:5173",
)


def _env_flag(name: str, default: bool) -> bool:
    """Read a boolean-ish environment variable.

    Accepts the spellings people actually type ("1", "true", "yes", "on")
    rather than Python's `bool()` semantics, under which the string "false"
    is true.
    """
    raw = os.environ.get(name)
    if raw is None or not raw.strip():
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_list(name: str, default: tuple[str, ...]) -> list[str]:
    """Read a comma-separated environment variable into a list."""
    raw = (os.environ.get(name) or "").strip()
    if not raw:
        return list(default)
    return [item.strip() for item in raw.split(",") if item.strip()]


class Config:
    """Base configuration. Subclasses below only override what differs.

    Flask's `from_object` copies every UPPERCASE attribute into app.config,
    which is why the naming convention matters here.
    """

    ENV_NAME = "development"
    DEBUG = False
    TESTING = False

    # ── Database ────────────────────────────────────────────────────────
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    # pool_pre_ping costs one cheap round trip per checkout and in exchange
    # survives the connection drops that hosted Postgres (Supabase's pooler,
    # in our case) performs on idle clients. Without it the first request
    # after an idle period fails with "server closed the connection
    # unexpectedly".
    # The RUF012 suppressions in this class are deliberate: these are
    # overridable defaults on a settings object, not shared class state.
    # ClassVar would say the opposite of what is meant — both subclasses and
    # __init__ replace them wholesale.
    SQLALCHEMY_ENGINE_OPTIONS: dict = {"pool_pre_ping": True, "pool_recycle": 280}  # noqa: RUF012

    # ── HTTP ────────────────────────────────────────────────────────────
    # Bodies larger than this are rejected before they are parsed. Every
    # endpoint here takes small JSON documents; images go straight to
    # Supabase Storage from the browser and never touch this service.
    MAX_CONTENT_LENGTH = 1 * 1024 * 1024  # 1 MiB

    # ── Auth ────────────────────────────────────────────────────────────
    SUPABASE_JWT_SECRET: str | None = None
    # The audience Supabase stamps on user access tokens.
    SUPABASE_JWT_AUDIENCE = "authenticated"
    # With no JWT secret the API cannot verify anything, so it falls back to
    # believing the supabase_id the request claims. Fine for local
    # development, never for production (see ProductionConfig).
    ALLOW_UNVERIFIED_IDENTITY = True

    # ── Logging ─────────────────────────────────────────────────────────
    LOG_LEVEL = "INFO"
    LOG_JSON = False

    # ── CORS ────────────────────────────────────────────────────────────
    CORS_ORIGINS: list[str] = list(DEFAULT_DEV_ORIGINS)  # noqa: RUF012

    # Set by ProductionConfig when it detects the SQLite fallback.
    SQLITE_FALLBACK_IN_PRODUCTION = False

    def __init__(self) -> None:
        self.SQLALCHEMY_DATABASE_URI = resolve_database_url()
        self.SUPABASE_JWT_SECRET = (os.environ.get("SUPABASE_JWT_SECRET") or "").strip() or None
        self.LOG_LEVEL = (os.environ.get("LOG_LEVEL") or self.LOG_LEVEL).strip().upper()
        self.LOG_JSON = _env_flag("LOG_JSON", self.LOG_JSON)
        self.CORS_ORIGINS = _env_list("CORS_ORIGINS", tuple(self.CORS_ORIGINS))

    @property
    def is_sqlite(self) -> bool:
        return str(self.SQLALCHEMY_DATABASE_URI).startswith("sqlite://")


class DevelopmentConfig(Config):
    ENV_NAME = "development"
    DEBUG = True


class TestingConfig(Config):
    ENV_NAME = "testing"
    TESTING = True
    SQLALCHEMY_ENGINE_OPTIONS: dict = {}  # noqa: RUF012
    LOG_LEVEL = "CRITICAL"

    def __init__(self) -> None:
        super().__init__()
        # Tests get a private in-memory database. Deliberately ignores
        # DATABASE_URL, so running the suite cannot touch the shared
        # Supabase instance even when a developer has it exported.
        self.SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"


class ProductionConfig(Config):
    ENV_NAME = "production"
    DEBUG = False
    LOG_JSON = True
    # No JWT secret in production means the API would accept any claimed
    # identity. create_app() refuses to boot in that state rather than
    # serving an app where anyone can read and edit anyone else's data.
    ALLOW_UNVERIFIED_IDENTITY = False

    def __init__(self) -> None:
        super().__init__()
        # Falling back to SQLite in production means data silently
        # disappears on the next deploy — worth being loud about.
        self.SQLITE_FALLBACK_IN_PRODUCTION = (
            self.SQLALCHEMY_DATABASE_URI == DEFAULT_DATABASE_URL
        )


_CONFIGS = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}


def get_config(env_name: str | None = None) -> Config:
    """Build the config object for an environment name.

    An unrecognised value falls back to development rather than raising, so
    a typo in a host's dashboard degrades to a safe local-style boot with a
    warning instead of an unbootable service.
    """
    requested = (env_name or os.environ.get("FLASK_ENV") or "development").strip().lower()
    config = _CONFIGS.get(requested, DevelopmentConfig)()
    config.REQUESTED_ENV_NAME = requested
    return config
