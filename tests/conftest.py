"""Shared pytest fixtures for the Grove backend.

Every test gets a freshly built application on its own in-memory SQLite
database. That is only possible because of the application factory — the
previous app.py built its Flask object at import time, wired to whatever
DATABASE_URL was in the environment, which is the direct reason this
repository had no tests.

Two deliberate choices worth knowing about:

* **The default test app has a JWT secret**, so the suite exercises the real
  verification path rather than the local-development fallback.
  test_auth.py covers the fallback separately.

* **The fixture holds an application context** for the duration of a test.
  Flask's test client reuses the pushed context instead of creating its
  own, so a model object created in the test body and the same row inside a
  request handler are the same identity in the same session. Without that,
  every assertion would need a refresh.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import jwt
import pytest

from api import create_app
from api.config.database import db
from api.config.settings import TestingConfig
from api.models import User

JWT_SECRET = "test-jwt-secret-not-used-anywhere-real"
JWT_AUDIENCE = "authenticated"


# ── application ─────────────────────────────────────────────────────────


@pytest.fixture
def app():
    config = TestingConfig()
    config.SUPABASE_JWT_SECRET = JWT_SECRET
    application = create_app(config)

    with application.app_context():
        db.create_all()
        yield application
        db.session.remove()
        db.drop_all()
        # In-memory SQLite keeps its single connection alive in the pool;
        # disposing releases it instead of leaking one per test.
        db.engine.dispose()


@pytest.fixture
def unverified_app():
    """An app in trusted-client mode — no JWT secret, legacy identity."""
    config = TestingConfig()
    config.SUPABASE_JWT_SECRET = None
    application = create_app(config)

    with application.app_context():
        db.create_all()
        yield application
        db.session.remove()
        db.drop_all()
        # In-memory SQLite keeps its single connection alive in the pool;
        # disposing releases it instead of leaking one per test.
        db.engine.dispose()


@pytest.fixture
def client(app):
    return app.test_client()


# ── tokens ──────────────────────────────────────────────────────────────


def make_token(
    supabase_id: str,
    *,
    email: str | None = None,
    secret: str = JWT_SECRET,
    audience: str = JWT_AUDIENCE,
    expires_in: timedelta = timedelta(hours=1),
    omit_sub: bool = False,
) -> str:
    """Mint a Supabase-shaped access token.

    The knobs exist so tests can build the specific broken tokens the auth
    layer has to reject: expired, wrong audience, wrong signing key, no
    subject.
    """
    claims: dict = {
        "aud": audience,
        "exp": datetime.now(UTC) + expires_in,
        "iat": datetime.now(UTC),
        "role": "authenticated",
    }
    if not omit_sub:
        claims["sub"] = supabase_id
    if email:
        claims["email"] = email
    return jwt.encode(claims, secret, algorithm="HS256")


def auth_headers(supabase_id: str, **kwargs) -> dict:
    return {"Authorization": f"Bearer {make_token(supabase_id, **kwargs)}"}


# ── authenticated client ────────────────────────────────────────────────


class AuthedClient:
    """Test client that signs every request as one particular user.

    Wrapping it means a test never repeats the Authorization header, and —
    more importantly — a test cannot accidentally pass an identity in the
    body and have it work, which is the exact bug the auth layer exists to
    prevent.
    """

    def __init__(self, client, account: User):
        self._client = client
        self.account = account
        self.headers = auth_headers(account.supabase_id, email=account.email)

    def _call(self, method: str, url: str, **kwargs):
        headers = {**self.headers, **kwargs.pop("headers", {})}
        return getattr(self._client, method)(url, headers=headers, **kwargs)

    def get(self, url, **kwargs):
        return self._call("get", url, **kwargs)

    def post(self, url, **kwargs):
        return self._call("post", url, **kwargs)

    def put(self, url, **kwargs):
        return self._call("put", url, **kwargs)

    def patch(self, url, **kwargs):
        return self._call("patch", url, **kwargs)

    def delete(self, url, **kwargs):
        return self._call("delete", url, **kwargs)


# ── data factories ──────────────────────────────────────────────────────


@pytest.fixture
def make_user(app):
    """Create a persisted user. Defaults are unique per call."""
    counter = {"n": 0}

    def _make(username: str | None = None, **overrides) -> User:
        counter["n"] += 1
        index = counter["n"]
        name = username or f"user{index}"

        account = User(
            supabase_id=overrides.pop("supabase_id", f"supabase-{index}"),
            username=name,
            email=overrides.pop("email", f"{name}@berkeley.edu"),
            first_name=overrides.pop("first_name", name),
            last_name=overrides.pop("last_name", "test"),
            display_name=overrides.pop("display_name", name.title()),
            **overrides,
        )
        # Present by default; a test that cares about being offline sets
        # last_seen_at explicitly.
        account.touch()
        db.session.add(account)
        db.session.commit()
        return account

    return _make


@pytest.fixture
def user(make_user):
    return make_user("kelvin")


@pytest.fixture
def other_user(make_user):
    return make_user("kyle")


@pytest.fixture
def api(client, user):
    """The primary user's authenticated client."""
    return AuthedClient(client, user)


@pytest.fixture
def other_api(client, other_user):
    """A second user's authenticated client, for isolation tests."""
    return AuthedClient(client, other_user)


@pytest.fixture
def make_task(api):
    """Create a task through the API, so it goes through real validation."""

    def _make(title: str = "Read chapter 3", **payload):
        response = api.post("/api/tasks", json={"title": title, **payload})
        assert response.status_code == 201, response.get_json()
        return response.get_json()

    return _make
