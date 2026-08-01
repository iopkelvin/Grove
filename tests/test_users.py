"""Account sync, profile editing, and user search."""

from api.config.database import db
from api.models import User
from api.services import user as user_service
from tests.conftest import auth_headers


class TestAccountSync:
    def test_signup_creates_an_account(self, client):
        response = client.post(
            "/api/users/sync",
            json={"first_name": "Ada", "last_name": "Lovelace", "username": "ada@berkeley.edu"},
            headers=auth_headers("new-user", email="ada@berkeley.edu"),
        )

        assert response.status_code == 201
        body = response.get_json()
        assert body["username"] == "ada"
        assert body["first_name"] == "ada"
        assert body["display_name"] == "Ada Lovelace"

    def test_syncing_twice_returns_the_same_account(self, client):
        payload = {"first_name": "Ada", "last_name": "Lovelace"}
        headers = auth_headers("new-user", email="ada@berkeley.edu")

        first = client.post("/api/users/sync", json=payload, headers=headers)
        second = client.post("/api/users/sync", json=payload, headers=headers)

        assert first.status_code == 201
        assert second.status_code == 200
        assert first.get_json()["id"] == second.get_json()["id"]
        assert db.session.query(User).filter_by(supabase_id="new-user").count() == 1

    def test_missing_names_report_both_problems_at_once(self, client):
        response = client.post(
            "/api/users/sync", json={}, headers=auth_headers("new-user")
        )

        assert response.status_code == 400
        fields = response.get_json()["details"]["fields"]
        assert set(fields) == {"first_name", "last_name"}

    def test_identity_comes_from_the_token_not_the_body(self, client):
        response = client.post(
            "/api/users/sync",
            json={
                "supabase_id": "attacker-supplied",
                "email": "attacker@example.com",
                "first_name": "Ada",
                "last_name": "Lovelace",
            },
            headers=auth_headers("real-user", email="ada@berkeley.edu"),
        )

        assert response.status_code == 201
        assert response.get_json()["supabase_id"] == "real-user"
        assert response.get_json()["email"] == "ada@berkeley.edu"


class TestUsernameGeneration:
    def test_email_prefix_becomes_the_username(self, app):
        assert user_service.normalise_username_seed("john.doe+grove@berkeley.edu") == "john.doe"

    def test_a_seed_with_nothing_usable_still_produces_a_username(self, app):
        """The old code did `f"{base}{suffix}"` with base=None and produced
        the literal string "None2" as somebody's public handle."""
        assert user_service.normalise_username_seed(None) == "grove"
        assert user_service.normalise_username_seed("!!!") == "grove"
        assert user_service.normalise_username_seed("ab") == "abgrove"

    def test_collisions_get_a_numeric_suffix(self, make_user):
        make_user("taken")

        assert user_service.generate_unique_username("taken@berkeley.edu") == "taken2"

    def test_repeated_collisions_keep_counting(self, make_user):
        make_user("taken")
        make_user("taken2")
        make_user("taken3")

        assert user_service.generate_unique_username("taken") == "taken4"

    def test_two_signups_sharing_an_email_prefix_both_succeed(self, client):
        """john@gmail.com and john@yahoo.com are different people."""
        first = client.post(
            "/api/users/sync",
            json={"first_name": "John", "last_name": "A"},
            headers=auth_headers("john-1", email="john@gmail.com"),
        )
        second = client.post(
            "/api/users/sync",
            json={"first_name": "John", "last_name": "B"},
            headers=auth_headers("john-2", email="john@yahoo.com"),
        )

        assert first.get_json()["username"] == "john"
        assert second.get_json()["username"] == "john2"


class TestProfileEditing:
    def test_updating_one_field_leaves_the_others_alone(self, api):
        api.patch("/api/users/me", json={"bio": "growing things"})

        response = api.patch("/api/users/me", json={"display_name": "Kel"})

        body = response.get_json()
        assert body["display_name"] == "Kel"
        assert body["bio"] == "growing things"

    def test_clearing_an_optional_field(self, api):
        api.patch("/api/users/me", json={"bio": "temporary"})

        response = api.patch("/api/users/me", json={"bio": ""})

        assert response.get_json()["bio"] is None

    def test_required_names_cannot_be_blanked(self, api):
        response = api.patch("/api/users/me", json={"first_name": "   "})

        assert response.status_code == 400
        assert "first_name" in response.get_json()["details"]["fields"]

    def test_fields_outside_the_allowlist_are_refused(self, api, user):
        response = api.patch("/api/users/me", json={"username": "renamed"})

        assert response.status_code == 400
        assert user.username == "kelvin"

    def test_streak_cannot_be_written_through_the_profile(self, api, user):
        response = api.patch("/api/users/me", json={"current_streak": 999})

        assert response.status_code == 400
        assert api.get("/api/users/me").get_json()["current_streak"] == 0

    def test_an_over_long_bio_is_rejected_before_it_reaches_the_database(self, api):
        response = api.patch("/api/users/me", json={"bio": "x" * 5000})

        assert response.status_code == 400
        assert "at most" in response.get_json()["details"]["fields"]["bio"]


class TestSearch:
    def test_finds_a_user_by_partial_username(self, api, make_user):
        make_user("turner")

        results = api.get("/api/users/search?q=turn").get_json()

        assert [r["username"] for r in results] == ["turner"]

    def test_finds_a_user_by_display_name(self, api, make_user):
        make_user("aatish", display_name="Aatish Sharma")

        results = api.get("/api/users/search?q=sharma").get_json()

        assert [r["username"] for r in results] == ["aatish"]

    def test_excludes_the_searcher(self, api, user):
        results = api.get(f"/api/users/search?q={user.username}").get_json()

        assert results == []

    def test_exact_matches_rank_first(self, api, make_user):
        make_user("kylie")
        make_user("mkyle")
        make_user("kyle")

        results = api.get("/api/users/search?q=kyle").get_json()

        assert results[0]["username"] == "kyle"

    def test_results_carry_the_friendship_status(self, api, other_user):
        api.post("/api/friends", json={"target_user_id": other_user.id})

        results = api.get("/api/users/search?q=kyle").get_json()

        assert results[0]["friendship_status"] == "pending"

    def test_search_results_never_include_email(self, api, make_user):
        make_user("turner")

        results = api.get("/api/users/search?q=turner").get_json()

        assert "email" not in results[0]
