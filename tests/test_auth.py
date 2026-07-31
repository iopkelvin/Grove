"""Authentication and authorisation.

The single most serious defect in the original code was that identity came
from the request. These tests exist to make sure it never quietly goes back
to doing that.
"""

from datetime import timedelta

import pytest

from api import UnsafeConfigurationError, create_app

# Imported as a module rather than `from ... import TestingConfig`: pytest
# tries to collect anything named Test* as a test class and warns loudly.
from api.config import settings
from tests.conftest import JWT_SECRET, AuthedClient, auth_headers, make_token


class TestTokenVerification:
    def test_valid_token_is_accepted(self, api):
        response = api.get("/api/users/me")

        assert response.status_code == 200
        assert response.get_json()["username"] == "kelvin"

    def test_request_without_a_token_is_rejected(self, client):
        response = client.get("/api/users/me")

        assert response.status_code == 401
        assert response.get_json()["code"] == "unauthorized"

    def test_token_signed_with_the_wrong_key_is_rejected(self, client, user):
        headers = auth_headers(user.supabase_id, secret="not-the-real-secret")

        response = client.get("/api/users/me", headers=headers)

        assert response.status_code == 401
        assert response.get_json()["code"] == "invalid_token"

    def test_expired_token_is_rejected_with_a_actionable_message(self, client, user):
        headers = auth_headers(user.supabase_id, expires_in=timedelta(seconds=-30))

        response = client.get("/api/users/me", headers=headers)

        assert response.status_code == 401
        # The frontend distinguishes "refresh the session" from "log in
        # again" by this message, so it is part of the contract.
        assert "expired" in response.get_json()["error"].lower()

    def test_token_for_another_application_is_rejected(self, client, user):
        headers = auth_headers(user.supabase_id, audience="some-other-app")

        response = client.get("/api/users/me", headers=headers)

        assert response.status_code == 401

    def test_token_without_a_subject_is_rejected(self, client, user):
        headers = auth_headers(user.supabase_id, omit_sub=True)

        response = client.get("/api/users/me", headers=headers)

        assert response.status_code == 401

    def test_malformed_authorization_header_is_ignored(self, client):
        response = client.get("/api/users/me", headers={"Authorization": "Basic abc123"})

        assert response.status_code == 401

    def test_token_for_a_user_who_has_not_synced_yet(self, client):
        """A verified token with no Grove row is not a 500 and not a
        silent success — it tells the client to finish signing up."""
        response = client.get("/api/users/me", headers=auth_headers("never-synced"))

        assert response.status_code == 401
        assert response.get_json()["code"] == "account_not_synced"


class TestIdentityCannotBeSpoofed:
    """The original vulnerability, from every angle it was exploitable."""

    def test_body_supabase_id_is_ignored_when_a_token_is_present(
        self, client, user, other_user
    ):
        response = client.patch(
            "/api/users/me",
            json={"supabase_id": other_user.supabase_id, "bio": "written by kelvin"},
            headers=auth_headers(user.supabase_id),
        )

        assert response.status_code == 200
        assert response.get_json()["username"] == "kelvin"
        assert other_user.bio is None

    def test_query_supabase_id_cannot_read_another_users_tasks(
        self, client, user, other_user, api
    ):
        api.post("/api/tasks", json={"title": "kelvin's private task"})

        response = client.get(
            f"/api/tasks?supabase_id={user.supabase_id}",
            headers=auth_headers(other_user.supabase_id),
        )

        assert response.status_code == 200
        assert response.get_json()["items"] == []

    def test_legacy_path_route_rejects_someone_elses_id(self, other_api, user):
        response = other_api.get(f"/api/users/{user.supabase_id}")

        assert response.status_code == 403

    def test_knowing_a_supabase_id_alone_grants_nothing(self, client, user):
        """A supabase_id is public — it appears in profile responses. Before
        this change, holding one was equivalent to being that person."""
        response = client.patch(
            f"/api/users/{user.supabase_id}", json={"bio": "anyone can write this"}
        )

        assert response.status_code == 401
        assert user.bio is None


class TestTrustedClientMode:
    """Local development without a JWT secret still has to work."""

    def test_legacy_supabase_id_is_accepted_without_a_secret(self, unverified_app):
        # Deliberately does not use the make_user fixture: that depends on
        # the `app` fixture, which would build a second application on its
        # own in-memory database and put the row in the wrong one.
        from api.config.database import db
        from api.models import User

        client = unverified_app.test_client()
        account = User(
            supabase_id="local-dev",
            username="local",
            email="local@berkeley.edu",
            first_name="local",
            last_name="dev",
        )
        db.session.add(account)
        db.session.commit()

        response = client.get("/api/users/me?supabase_id=local-dev")

        assert response.status_code == 200

    def test_health_reports_the_weaker_mode_honestly(self, unverified_app):
        response = unverified_app.test_client().get("/api/health")

        assert response.get_json()["auth"] == "trusted-client"

    def test_health_reports_jwt_mode_when_configured(self, client):
        assert client.get("/api/health").get_json()["auth"] == "jwt"

    def test_a_bearer_token_is_not_treated_as_verified_without_a_secret(
        self, unverified_app
    ):
        """The server cannot check the signature, so it must not pretend it
        did. It falls through to the legacy parameter, and with none
        supplied the request is anonymous."""
        client = unverified_app.test_client()

        response = client.get(
            "/api/users/me", headers={"Authorization": f"Bearer {make_token('anyone')}"}
        )

        assert response.status_code == 401


class TestProductionRefusesUnsafeConfiguration:
    def test_production_will_not_boot_without_a_jwt_secret(self, monkeypatch):
        monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
        config = settings.ProductionConfig()
        config.SUPABASE_JWT_SECRET = None

        with pytest.raises(UnsafeConfigurationError, match="SUPABASE_JWT_SECRET"):
            create_app(config)

    def test_production_will_not_boot_with_wildcard_cors(self):
        config = settings.ProductionConfig()
        config.SUPABASE_JWT_SECRET = JWT_SECRET
        config.CORS_ORIGINS = ["*"]

        with pytest.raises(UnsafeConfigurationError, match="CORS_ORIGINS"):
            create_app(config)

    def test_development_boots_happily_without_a_secret(self):
        config = settings.TestingConfig()
        config.SUPABASE_JWT_SECRET = None

        assert create_app(config) is not None


class TestOptionalAuth:
    def test_public_profile_is_readable_while_signed_out(self, client, user):
        response = client.get(f"/api/users/by-username/{user.username}")

        assert response.status_code == 200
        assert "email" not in response.get_json()

    def test_public_profile_never_leaks_an_email_to_another_user(
        self, other_api, user
    ):
        response = other_api.get(f"/api/users/by-username/{user.username}")

        assert response.status_code == 200
        assert "email" not in response.get_json()

    def test_your_own_public_profile_does_include_your_email(self, api, user):
        response = api.get(f"/api/users/by-username/{user.username}")

        assert response.get_json()["email"] == user.email

    def test_a_broken_token_degrades_to_anonymous_rather_than_failing(
        self, client, user
    ):
        response = client.get(
            f"/api/users/by-username/{user.username}",
            headers={"Authorization": "Bearer not-a-real-token"},
        )

        assert response.status_code == 200


def test_authed_client_helper_signs_as_the_right_person(client, make_user):
    """Guards the fixture itself: a bug here would make every isolation
    test above pass for the wrong reason."""
    someone = make_user("zoe")

    response = AuthedClient(client, someone).get("/api/users/me")

    assert response.get_json()["username"] == "zoe"
