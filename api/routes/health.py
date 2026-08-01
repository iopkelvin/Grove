"""Grove — health and service metadata.

Render (and any other host worth using) needs an endpoint it can poll to
decide whether an instance is alive. `/` previously returned a hard-coded
"Grove API is running" string, which stayed cheerful even when the database
was unreachable — so a completely broken deploy looked healthy.

Two endpoints, because they answer different questions:

  /api/health   liveness — is the process up? Never touches the database,
                so a database outage cannot cause the host to kill and
                restart otherwise-fine instances in a loop.
  /api/ready    readiness — can it actually serve traffic? Runs a trivial
                query, and answers 503 when that fails.
"""

from flask import Blueprint, current_app, jsonify
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from api.config.database import db
from api.utils.auth import auth_mode
from api.utils.logger import get_logger

logger = get_logger(__name__)

health_bp = Blueprint("health", __name__)

API_VERSION = "1.0.0"


@health_bp.get("/")
def index():
    """Friendly root, so hitting the bare API URL in a browser explains
    what this service is instead of returning a bare 404."""
    return jsonify(
        {
            "service": "grove-api",
            "version": API_VERSION,
            "status": "running",
            "docs": "See README.md for the endpoint reference.",
        }
    )


@health_bp.get("/api/health")
def health():
    return jsonify(
        {
            "status": "ok",
            "version": API_VERSION,
            "environment": current_app.config.get("ENV_NAME"),
            "auth": auth_mode(current_app),
        }
    )


@health_bp.get("/api/ready")
def ready():
    try:
        db.session.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        logger.error("readiness check failed", exc_info=exc)
        return jsonify({"status": "unavailable", "database": "unreachable"}), 503

    return jsonify({"status": "ready", "database": "ok"})
