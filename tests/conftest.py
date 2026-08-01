"""
Shared pytest fixtures for the backend test suite.

Points DATABASE_URL at a throwaway SQLite file BEFORE app.py (and the
models) get imported, so running the suite never touches the real
Supabase database or the seeded friend/streak data in it. database.py
reads DATABASE_URL at import time and load_dotenv() there won't override
a value that's already set, so setting it here first is what makes the
isolation actually stick.

Production verifies tokens against Supabase's live JWKS — there's no live
project to check against in tests, so auth_headers() below signs tokens
against a local test secret instead, and verify_token() is monkeypatched
to check against that same secret. Everything else about auth (header
parsing, g.supabase_id, the 401/403 behavior routes build on) still runs
for real.
"""

import os
import tempfile

import jwt
import pytest

_db_fd, _db_path = tempfile.mkstemp(suffix=".db")
os.environ["DATABASE_URL"] = f"sqlite:///{_db_path}"
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")

from app import app as flask_app  # noqa: E402 — must import after DATABASE_URL is set
from api.config.database import db  # noqa: E402
from api.services import auth as auth_module  # noqa: E402

_TEST_SECRET = "test-secret-not-used-anywhere-real"


def _test_verify_token(token):
    if not token:
        return None
    try:
        payload = jwt.decode(token, _TEST_SECRET, algorithms=["HS256"], audience="authenticated")
    except jwt.PyJWTError:
        return None
    return payload.get("sub")


auth_module.verify_token = _test_verify_token


def auth_headers(supabase_id):
    """Authorization header for a request acting as `supabase_id`."""
    token = jwt.encode({"sub": supabase_id, "aud": "authenticated"}, _TEST_SECRET, algorithm="HS256")
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
