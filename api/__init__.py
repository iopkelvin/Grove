"""Grove — application factory.

`create_app()` exists so the application can be built more than once, with
different configuration each time. That single change is what makes the test
suite possible: every test gets a fresh app on a private in-memory database
instead of importing a module-level `app` object that was wired to whatever
DATABASE_URL happened to be in the environment at import time.

Boot order matters and is deliberate:

  1. logging      — so everything after it can report what it is doing
  2. config       — resolved once, from the environment
  3. safety check — refuse to serve production traffic unauthenticated
  4. extensions   — database, migrations, CORS
  5. middleware   — request ids, presence, request logging
  6. errors       — before blueprints, so nothing can 500 as HTML
  7. blueprints   — the routes themselves
  8. workers      — background queue and maintenance schedule
"""

from __future__ import annotations

import time

from flask import Flask, g, request
from flask_cors import CORS
from flask_migrate import Migrate

from api.config.database import db
from api.config.settings import Config, get_config
from api.utils.logger import configure_logging, get_logger, new_request_id, set_request_id

migrate = Migrate()
logger = get_logger(__name__)

# Header used for both the incoming (client- or proxy-supplied) and outgoing
# correlation id.
REQUEST_ID_HEADER = "X-Request-ID"

# Requests slower than this get logged at WARNING, so the slow ones surface
# without having to read every line of a healthy log.
SLOW_REQUEST_MS = 1000


class UnsafeConfigurationError(RuntimeError):
    """Raised when a configuration would be actively dangerous to serve."""


def create_app(config: Config | None = None, *, env_name: str | None = None) -> Flask:
    app = Flask(__name__)

    settings = config or get_config(env_name)
    configure_logging(level=settings.LOG_LEVEL, json_output=settings.LOG_JSON)

    app.config.from_object(settings)
    app.extensions["grove_settings"] = settings

    _check_configuration(app, settings)
    _init_extensions(app, settings)
    _register_middleware(app)

    # Registered before the blueprints so that a route failing at import or
    # dispatch time still produces JSON rather than Flask's HTML page.
    from api.utils.errors import register_error_handlers

    register_error_handlers(app)

    from api.routes import register_blueprints

    register_blueprints(app)

    from api.workers import init_background_workers

    init_background_workers(app)

    logger.info(
        "grove api ready",
        extra={
            "environment": settings.ENV_NAME,
            "database": "sqlite" if settings.is_sqlite else "postgresql",
            "auth": "jwt" if settings.SUPABASE_JWT_SECRET else "trusted-client",
        },
    )
    return app


# ── boot steps ──────────────────────────────────────────────────────────


def _check_configuration(app: Flask, settings: Config) -> None:
    """Refuse to boot into a state that would quietly do the wrong thing.

    Failing loudly at startup is the whole point: a misconfigured deploy
    that *starts* is one nobody notices until it has already served real
    users the wrong data.
    """
    requested = getattr(settings, "REQUESTED_ENV_NAME", settings.ENV_NAME)
    if requested != settings.ENV_NAME:
        logger.warning(
            "unknown FLASK_ENV %r — falling back to %s", requested, settings.ENV_NAME
        )

    if not settings.SUPABASE_JWT_SECRET:
        if not settings.ALLOW_UNVERIFIED_IDENTITY:
            raise UnsafeConfigurationError(
                "SUPABASE_JWT_SECRET is not set. In production the API cannot verify "
                "who is calling it, which would let anyone read and modify any user's "
                "data by supplying their supabase_id. Set SUPABASE_JWT_SECRET (Supabase "
                "dashboard > Settings > API > JWT Secret) and redeploy."
            )
        logger.warning(
            "AUTH IS NOT VERIFIED: SUPABASE_JWT_SECRET is unset, so the API trusts the "
            "supabase_id each request claims. Fine locally, never in production."
        )

    if getattr(settings, "SQLITE_FALLBACK_IN_PRODUCTION", False):
        logger.error(
            "Running in production against local SQLite because DATABASE_URL is unset "
            "or invalid. All data will be lost on the next deploy."
        )

    if settings.ENV_NAME == "production" and "*" in settings.CORS_ORIGINS:
        raise UnsafeConfigurationError(
            "CORS_ORIGINS is '*' in production. List the exact frontend origins instead."
        )


def _init_extensions(app: Flask, settings: Config) -> None:
    db.init_app(app)
    migrate.init_app(app, db)

    # Scoped to /api/* and to known origins. `CORS(app)` — the previous
    # setup — allowed every origin on the internet to call the API with the
    # browser's cooperation.
    CORS(
        app,
        resources={r"/api/*": {"origins": settings.CORS_ORIGINS}},
        allow_headers=["Content-Type", "Authorization", REQUEST_ID_HEADER],
        expose_headers=[REQUEST_ID_HEADER],
        max_age=600,
    )

    from api import models  # noqa: F401 — registers every table

    if settings.is_sqlite:
        with app.app_context():
            _bootstrap_sqlite_schema(app)


def _bootstrap_sqlite_schema(app: Flask) -> None:
    """Give a local SQLite database its tables, once, without breaking Alembic.

    A fresh clone should run with no setup step, which is what `create_all()`
    is for. But calling it unconditionally made `flask db upgrade` impossible
    against SQLite: create_app runs first, builds every table, and the
    initial migration then fails with "table users already exists".

    So it only runs when the database has never been touched — no
    alembic_version table — and immediately stamps the revision as head
    afterwards. The result is a database that create_all built but that
    Alembic considers fully migrated, so a later `flask db upgrade` applies
    exactly the revisions added since, and `flask db downgrade` works too.

    A real database (DATABASE_URL set) never reaches this: it is managed
    entirely with migrations.
    """
    from sqlalchemy import inspect

    inspector = inspect(db.engine)
    if inspector.has_table("alembic_version"):
        return

    db.create_all()

    # Tests run against a private in-memory database and never migrate it;
    # stamping would only cost a table and an import.
    if app.config.get("TESTING"):
        return

    try:
        from flask_migrate import stamp

        stamp(revision="head")
        logger.info("initialised local SQLite schema and stamped it at head")
    except Exception:  # pragma: no cover — missing/!unreadable migrations dir
        logger.warning(
            "created the SQLite schema but could not stamp the migration "
            "revision; `flask db upgrade` may need `flask db stamp head` first",
            exc_info=True,
        )


def _register_middleware(app: Flask) -> None:
    @app.before_request
    def _start_request():
        # Honour an id from an upstream proxy so a trace spans both hops,
        # but cap the length — this value ends up in every log line.
        incoming = (request.headers.get(REQUEST_ID_HEADER) or "").strip()[:64]
        request_id = incoming or new_request_id()
        set_request_id(request_id)
        g.request_id = request_id
        g.started_at = time.perf_counter()

    @app.after_request
    def _finish_request(response):
        response.headers[REQUEST_ID_HEADER] = getattr(g, "request_id", "-")

        started = getattr(g, "started_at", None)
        if started is not None:
            duration_ms = round((time.perf_counter() - started) * 1000, 1)
            level = logger.warning if duration_ms > SLOW_REQUEST_MS else logger.info
            level(
                "%s %s -> %s",
                request.method,
                request.path,
                response.status_code,
                extra={
                    "method": request.method,
                    "path": request.path,
                    "status": response.status_code,
                    "duration_ms": duration_ms,
                },
            )

        return response

    @app.after_request
    def _record_presence(response):
        """Touch the caller's last_seen_at once their request has succeeded.

        Queued rather than done inline so presence bookkeeping never adds
        latency to a user's request, and never fails one either — the queue
        drops work instead of raising.
        """
        account = getattr(g, "current_user", None)
        if account is None or response.status_code >= 500:
            return response

        background = app.extensions.get("grove_queue")
        if background is not None:
            background.submit(_touch_presence, account.id, name="touch_presence")

        return response

    @app.teardown_appcontext
    def _remove_session(exception=None):
        # Without this a request that raises can leave its session holding a
        # pooled connection, and the pool exhausts under any real load.
        if exception is not None:
            db.session.rollback()
        db.session.remove()


def _touch_presence(user_id: int) -> None:
    """Background job: mark a user as recently active."""
    from api.models import User
    from api.services import user as user_service

    account = db.session.get(User, user_id)
    if account is not None:
        user_service.touch_presence(account)


__all__ = ["UnsafeConfigurationError", "create_app", "db", "migrate"]
