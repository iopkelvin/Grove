"""
Shared pytest fixtures for the backend test suite.

Points DATABASE_URL at a throwaway SQLite file BEFORE app.py (and the
models) get imported, so running the suite never touches the real
Supabase database or the seeded friend/streak data in it. database.py
reads DATABASE_URL at import time and load_dotenv() there won't override
a value that's already set, so setting it here first is what makes the
isolation actually stick.
"""

import os
import tempfile

import pytest

_db_fd, _db_path = tempfile.mkstemp(suffix=".db")
os.environ["DATABASE_URL"] = f"sqlite:///{_db_path}"

from app import app as flask_app  # noqa: E402 — must import after DATABASE_URL is set
from api.config.database import db  # noqa: E402


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
