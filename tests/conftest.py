"""
Shared pytest fixtures for the backend test suite.

Points DATABASE_URL at a throwaway SQLite file BEFORE app.py (and the
models) get imported, so running the suite never touches the real
Supabase database or the seeded friend/streak data in it. database.py
reads DATABASE_URL at import time and load_dotenv() there won't override
a value that's already set, so setting it here first is what makes the
isolation actually stick.

Same reasoning for SUPABASE_JWT_SECRET: it has to be set before app.py
imports api/services/auth.py, and it lets auth_headers() below sign
tokens that the app's own verify_token() will accept.
"""

import os
import tempfile

import jwt
import pytest

_db_fd, _db_path = tempfile.mkstemp(suffix=".db")
os.environ["DATABASE_URL"] = f"sqlite:///{_db_path}"

_TEST_JWT_SECRET = "test-secret-not-used-anywhere-real"
os.environ["SUPABASE_JWT_SECRET"] = _TEST_JWT_SECRET

from app import app as flask_app  # noqa: E402 — must import after DATABASE_URL is set
from api.config.database import db  # noqa: E402


def auth_headers(supabase_id):
    """Authorization header for a request acting as `supabase_id` — signs
    a token the app's own verify_token() (same secret) will accept."""
    token = jwt.encode(
        {"sub": supabase_id, "aud": "authenticated"}, _TEST_JWT_SECRET, algorithm="HS256"
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session", autouse=True)
def _cleanup_temp_db():
    # xunit-style teardown_module hooks don't fire for conftest.py itself
    # (it's not a collected test module), so the fd/file has to be closed
    # explicitly here instead — otherwise every test run leaks a temp file.
    yield
    os.close(_db_fd)
    os.remove(_db_path)


@pytest.fixture()
def client():
    """A Flask test client backed by a fresh, empty schema for each test."""
    flask_app.config.update(TESTING=True)
    with flask_app.app_context():
        db.create_all()
        yield flask_app.test_client()
        db.session.remove()
        db.drop_all()
